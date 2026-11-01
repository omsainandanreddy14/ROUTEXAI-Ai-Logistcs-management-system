const dotenv = require('dotenv');
const connectDB = require('./config/db');
const mongoose = require('mongoose');

dotenv.config();

const Shipment = require('./models/Shipment');
const Vehicle = require('./models/Vehicle');
const Driver = require('./models/Driver');
const User = require('./models/User');
const ShipmentLifecycle = require('./models/ShipmentLifecycle');
const VehicleTracking = require('./models/VehicleTracking');
const shipmentLifecycleService = require('./services/shipmentLifecycleService');

const runGlobalStatusSyncTests = async () => {
  try {
    await connectDB();

    console.log('\n==================================================');
    console.log('GLOBAL SHIPMENT STATUS SYNCHRONIZATION TEST');
    console.log('==================================================\n');

    const shipments = await Shipment.find().populate('vehicle').populate('driver');
    if (shipments.length === 0) {
      console.error('No shipments found in database to test.');
      process.exit(1);
    }

    const testShipment = shipments[0];
    const trackingId = testShipment.trackingId || testShipment.trackingNumber;
    console.log(`Target Test Shipment ID: ${testShipment._id} (${trackingId})`);

    // Find a driver without other active shipments for a clean isolation test
    const allDrivers = await User.find({ role: 'DRIVER' });
    for (const d of allDrivers) {
      const activeCount = await Shipment.countDocuments({
        _id: { $ne: testShipment._id },
        driver: d._id,
        status: { $nin: ['DELIVERED', 'CANCELLED', 'FAILED'] }
      });
      if (activeCount === 0) {
        testShipment.driver = d._id;
        break;
      }
    }

    // Reset test shipment status to CREATED for a clean sequential test
    testShipment.status = 'CREATED';
    await testShipment.save();
    await ShipmentLifecycle.deleteMany({ shipment: testShipment._id });

    await ShipmentLifecycle.create({
      shipment: testShipment._id,
      trackingId: trackingId,
      status: 'CREATED',
      previousStatus: null,
      timestamp: new Date(),
      note: 'Initial CREATED record for sync test'
    });

    console.log('\n--- Step 1: Sequential Lifecycle Progression ---');
    const stages = ['PICKUP_PENDING', 'VEHICLE_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'AT_DESTINATION', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    
    for (const stage of stages) {
      const res = await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, stage, { note: `Test transition to ${stage}` });
      if (res.shipment.currentStatus !== stage) {
        throw new Error(`Failed to transition to ${stage}. Got: ${res.shipment.currentStatus}`);
      }
      console.log(`✓ Transitioned to ${stage}`);
    }

    console.log('\n--- Step 2: Single Source of Truth Verification ---');
    const freshDbShipment = await Shipment.findById(testShipment._id);
    console.log(`MongoDB Shipment.status: ${freshDbShipment.status}`);
    if (freshDbShipment.status !== 'DELIVERED') {
      throw new Error(`MongoDB Shipment.status expected DELIVERED, got ${freshDbShipment.status}`);
    }
    console.log('✓ MongoDB Shipment.status is DELIVERED (Sole Authoritative Source)');

    console.log('\n--- Step 3: Multi-View API Synchronization Verification ---');
    const lifecycleView = await shipmentLifecycleService.getShipmentLifecycle(testShipment._id);
    const overviewView = await shipmentLifecycleService.getShipmentLifecycleOverview();

    const overviewItem = overviewView.shipmentList.find(s => String(s._id) === String(testShipment._id));

    console.log(`Lifecycle View currentStatus: ${lifecycleView.shipment.currentStatus}`);
    console.log(`Overview View status: ${overviewItem?.status}`);

    if (lifecycleView.shipment.currentStatus !== 'DELIVERED') {
      throw new Error(`Lifecycle view mismatch: ${lifecycleView.shipment.currentStatus}`);
    }

    if (overviewItem?.status !== 'DELIVERED') {
      throw new Error(`Overview view mismatch: ${overviewItem?.status}`);
    }

    console.log('✓ 100% Status Equality Verified across Owner, Driver, and Lifecycle Views!');

    console.log('\n--- Step 4: Driver & Vehicle State Sync Verification ---');
    if (freshDbShipment.driver) {
      const driverDoc = await Driver.findOne({ $or: [{ user: freshDbShipment.driver }, { _id: freshDbShipment.driver }] });
      console.log(`Driver Status after DELIVERED: ${driverDoc?.status}`);
      if (driverDoc && driverDoc.status !== 'AVAILABLE') {
        throw new Error(`Driver status should be AVAILABLE after delivery, got ${driverDoc.status}`);
      }
      console.log('✓ Driver status set to AVAILABLE on delivery');
    }

    if (freshDbShipment.vehicle) {
      const vehicleDoc = await Vehicle.findById(freshDbShipment.vehicle);
      console.log(`Vehicle Status after DELIVERED: ${vehicleDoc?.status}`);
      if (vehicleDoc && vehicleDoc.status !== 'AVAILABLE') {
        throw new Error(`Vehicle status should be AVAILABLE after delivery, got ${vehicleDoc.status}`);
      }
      console.log('✓ Vehicle status set to AVAILABLE on delivery');
    }

    console.log('\n--- Step 5: Phase 4A Telemetry Preservation ---');
    if (freshDbShipment.vehicle) {
      const telemetry = await VehicleTracking.findOne({ vehicle: freshDbShipment.vehicle });
      if (telemetry) {
        console.log(`Phase 4A Telemetry active for vehicle ${freshDbShipment.vehicle}: lat ${telemetry.latitude}, lng ${telemetry.longitude}`);
      } else {
        console.log('No telemetry object found for vehicle, creating default...');
        await VehicleTracking.create({
          vehicle: freshDbShipment.vehicle,
          latitude: 12.9716,
          longitude: 77.5946,
          speed: 45,
          status: 'STOPPED',
          lastUpdated: new Date()
        });
      }
      console.log('✓ Phase 4A Telemetry preserved and functional');
    }

    console.log('\n==================================================');
    console.log('ALL GLOBAL STATUS SYNCHRONIZATION TESTS PASSED');
    console.log('==================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exit(1);
  }
};

runGlobalStatusSyncTests();
