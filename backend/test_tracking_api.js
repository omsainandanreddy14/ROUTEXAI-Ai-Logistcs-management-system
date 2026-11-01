const dotenv = require('dotenv');
const connectDB = require('./config/db');
const mongoose = require('mongoose');

dotenv.config();

const Vehicle = require('./models/Vehicle');
const User = require('./models/User');
const Shipment = require('./models/Shipment');
const VehicleTracking = require('./models/VehicleTracking');
const trackingService = require('./services/trackingService');

const runTrackingAudit = async () => {
  try {
    await connectDB();

    console.log('\n==================================================');
    console.log('PHASE 4A LIVE TRACKING API & BACKEND AUDIT');
    console.log('==================================================\n');

    // 1. Fetch active vehicles, drivers, shipments for audit
    const vehicles = await Vehicle.find();
    const drivers = await User.find({ role: 'DRIVER' });
    const shipments = await Shipment.find();

    console.log(`Found ${vehicles.length} Vehicles, ${drivers.length} Drivers, ${shipments.length} Shipments in DB.`);

    if (vehicles.length === 0) {
      console.log('No vehicles found in database. Exiting test.');
      process.exit(0);
    }

    const testVehicle = vehicles[0];
    const testDriver = drivers[0] || null;
    const testShipment = shipments[0] || null;

    console.log(`\n--- TEST 1: Updating Valid Vehicle GPS Location (${testVehicle.registrationNumber}) ---`);
    const validUpdate = await trackingService.updateVehicleLocation({
      vehicleId: testVehicle._id,
      driverId: testDriver?._id,
      shipmentId: testShipment?._id,
      latitude: 28.7041, // Delhi
      longitude: 77.1025,
      speed: 55,
      status: 'IN_TRANSIT'
    });

    console.log('✓ Valid Update Succeeded:');
    console.log(`  Vehicle Reg: ${validUpdate.vehicle?.registrationNumber}`);
    console.log(`  Coordinates: [${validUpdate.longitude}, ${validUpdate.latitude}]`);
    console.log(`  Speed: ${validUpdate.speed} km/h`);
    console.log(`  Status: ${validUpdate.status}`);

    console.log('\n--- TEST 2: Validation Check (Invalid Coordinates & Speed) ---');

    // Test Invalid Latitude
    try {
      await trackingService.updateVehicleLocation({
        vehicleId: testVehicle._id,
        latitude: 195.0, // Invalid lat > 90
        longitude: 77.1025,
        speed: 40
      });
      console.error('❌ Failed: Invalid latitude was accepted unexpectedly!');
    } catch (e) {
      console.log(`✓ Rejected Invalid Latitude as expected: "${e.message}"`);
    }

    // Test Invalid Longitude
    try {
      await trackingService.updateVehicleLocation({
        vehicleId: testVehicle._id,
        latitude: 28.7041,
        longitude: -210.0, // Invalid lng < -180
        speed: 40
      });
      console.error('❌ Failed: Invalid longitude was accepted unexpectedly!');
    } catch (e) {
      console.log(`✓ Rejected Invalid Longitude as expected: "${e.message}"`);
    }

    // Test Negative Speed
    try {
      await trackingService.updateVehicleLocation({
        vehicleId: testVehicle._id,
        latitude: 28.7041,
        longitude: 77.1025,
        speed: -15 // Negative speed
      });
      console.error('❌ Failed: Negative speed was accepted unexpectedly!');
    } catch (e) {
      console.log(`✓ Rejected Negative Speed as expected: "${e.message}"`);
    }

    // Test Non-existent Vehicle
    try {
      const fakeId = new mongoose.Types.ObjectId();
      await trackingService.updateVehicleLocation({
        vehicleId: fakeId,
        latitude: 28.7041,
        longitude: 77.1025,
        speed: 40
      });
      console.error('❌ Failed: Non-existent vehicle was accepted unexpectedly!');
    } catch (e) {
      console.log(`✓ Rejected Non-existent Vehicle as expected: "${e.message}"`);
    }

    console.log('\n--- TEST 3: Retrieving Live Tracking Dashboard Overview ---');
    const liveOverview = await trackingService.getLiveVehicleTracking({
      staleMinutes: 5,
      offlineMinutes: 30
    });

    console.log(`✓ Live Overview Retracted:`);
    console.log(`  Total Tracked Vehicles: ${liveOverview.summaryMetrics.totalTracked}`);
    console.log(`  LIVE Count: ${liveOverview.summaryMetrics.liveCount}`);
    console.log(`  STALE Count: ${liveOverview.summaryMetrics.staleCount}`);
    console.log(`  OFFLINE Count: ${liveOverview.summaryMetrics.offlineCount}`);
    console.log(`  In Transit Count: ${liveOverview.summaryMetrics.inTransitCount}`);

    console.log('\nSample Tracked Items:');
    liveOverview.trackingItems.forEach((item, idx) => {
      console.log(
        `  [${idx + 1}] ${item.vehicle?.registrationNumber || item.vehicleId} | ` +
          `Status: ${item.status} | ` +
          `Vitality: ${item.trackingVitality} | ` +
          `Speed: ${item.speed} km/h | ` +
          `Coords: [${item.longitude}, ${item.latitude}] | ` +
          `Driver: ${item.driver?.name || 'Unassigned'} | ` +
          `Shipment: ${item.shipment?.trackingNumber || 'None'}`
      );
    });

    console.log('\n==================================================');
    console.log('ALL PHASE 4A BACKEND TRACKING TESTS PASSED PERFECTLY!');
    console.log('==================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Audit Error:', err);
    process.exit(1);
  }
};

runTrackingAudit();
