const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const Vehicle = require('./models/Vehicle');
const VehicleTracking = require('./models/VehicleTracking');
const Shipment = require('./models/Shipment');
const Driver = require('./models/Driver');
const User = require('./models/User');
const Hub = require('./models/Hub');

const shipmentLifecycleService = require('./services/shipmentLifecycleService');
const trackingService = require('./services/trackingService');

const runFleetStatusSyncTests = async () => {
  console.log('\n======================================================================');
  console.log('ROUTE-XAI FLEET STATUS & SHIPMENT SYNCHRONIZATION TEST SUITE');
  console.log('======================================================================\n');

  try {
    await connectDB();

    // Setup or retrieve test dependencies (prefer vehicles without active shipments)
    const allVehicles = await Vehicle.find();
    const testDrivers = await User.find({ role: 'DRIVER' });
    const hubs = await Hub.find();

    if (allVehicles.length < 2 || testDrivers.length < 2 || hubs.length < 2) {
      throw new Error('Insufficient seed data (need at least 2 vehicles, 2 drivers, 2 hubs)');
    }

    const availableVehicles = [];
    for (const v of allVehicles) {
      const activeS = await Shipment.findOne({ vehicle: v._id, status: { $nin: ['DELIVERED', 'CANCELLED', 'FAILED'] } });
      if (!activeS) availableVehicles.push(v);
    }

    const vehicleA = availableVehicles[0] || allVehicles[0];
    const vehicleB = availableVehicles[1] || allVehicles[1];
    const driverA = testDrivers[0];
    const driverB = testDrivers[1];
    const hubOrigin = hubs[0];
    const hubDest = hubs[1];

    console.log(`Using Test Vehicle A: ${vehicleA.registrationNumber} (${vehicleA._id})`);
    console.log(`Using Test Vehicle B: ${vehicleB.registrationNumber} (${vehicleB._id})`);
    console.log(`Using Test Driver A: ${driverA.name} (${driverA._id})`);
    console.log(`Using Test Driver B: ${driverB.name} (${driverB._id})\n`);

    // --- TEST 1: Creation and Assignment Lifecycle Sync ---
    console.log('--- TEST 1: Shipment Assignment Synchronizes Vehicle & VehicleTracking ---');
    const randId = Math.floor(100000 + Math.random() * 900000);
    const testShipment1 = await Shipment.create({
      trackingNumber: `RTX-SYNC-${randId}`,
      trackingId: `RXAI-2026-SYNC-${randId}`,
      customer: driverA._id, // placeholder user
      originHub: hubOrigin._id,
      destinationHub: hubDest._id,
      pickupCity: 'City A',
      deliveryCity: 'City B',
      weightKg: 300,
      status: 'CREATED',
      vehicle: vehicleA._id,
      driver: driverA._id
    });

    await shipmentLifecycleService.updateShipmentLifecycle(
      testShipment1._id,
      'VEHICLE_ASSIGNED',
      { vehicleId: vehicleA._id, driverId: driverA._id }
    );

    const vehicleADocAssigned = await Vehicle.findById(vehicleA._id);
    const trackingADocAssigned = await VehicleTracking.findOne({ vehicle: vehicleA._id });

    if (vehicleADocAssigned.status !== 'ON_TRIP') {
      throw new Error(`Expected Vehicle A status ON_TRIP, got ${vehicleADocAssigned.status}`);
    }
    if (String(trackingADocAssigned.shipment) !== String(testShipment1._id)) {
      throw new Error(`Expected VehicleTracking shipment ${testShipment1._id}, got ${trackingADocAssigned.shipment}`);
    }
    if (trackingADocAssigned.status !== 'ASSIGNED') {
      throw new Error(`Expected VehicleTracking status ASSIGNED, got ${trackingADocAssigned.status}`);
    }
    console.log('✓ TEST 1 PASSED: Vehicle status set to ON_TRIP, VehicleTracking status set to ASSIGNED with shipment reference.');

    // --- TEST 2: In-Transit Lifecycle Sync ---
    console.log('\n--- TEST 2: IN_TRANSIT Transition Sets Operational Status IN_TRANSIT ---');
    await shipmentLifecycleService.updateShipmentLifecycle(testShipment1._id, 'PICKED_UP');
    await shipmentLifecycleService.updateShipmentLifecycle(testShipment1._id, 'IN_TRANSIT');

    const trackingADocInTransit = await VehicleTracking.findOne({ vehicle: vehicleA._id });
    if (trackingADocInTransit.status !== 'IN_TRANSIT') {
      throw new Error(`Expected VehicleTracking status IN_TRANSIT, got ${trackingADocInTransit.status}`);
    }
    console.log('✓ TEST 2 PASSED: VehicleTracking operational status synced to IN_TRANSIT.');

    // --- TEST 3: Delivery Completion Frees Vehicle & Resets VehicleTracking ---
    console.log('\n--- TEST 3: DELIVERED Transition Frees Vehicle and Clears VehicleTracking Cargo ---');
    await shipmentLifecycleService.updateShipmentLifecycle(testShipment1._id, 'AT_DESTINATION');
    await shipmentLifecycleService.updateShipmentLifecycle(testShipment1._id, 'OUT_FOR_DELIVERY');
    await shipmentLifecycleService.updateShipmentLifecycle(testShipment1._id, 'DELIVERED');

    const vehicleADocDelivered = await Vehicle.findById(vehicleA._id);
    const trackingADocDelivered = await VehicleTracking.findOne({ vehicle: vehicleA._id });

    if (vehicleADocDelivered.status !== 'AVAILABLE') {
      throw new Error(`Expected Vehicle A status AVAILABLE on delivery, got ${vehicleADocDelivered.status}`);
    }
    if (vehicleADocDelivered.assignedDriver !== null) {
      throw new Error(`Expected Vehicle A assignedDriver null on delivery, got ${vehicleADocDelivered.assignedDriver}`);
    }
    if (trackingADocDelivered.status !== 'AVAILABLE') {
      throw new Error(`Expected VehicleTracking status AVAILABLE on delivery, got ${trackingADocDelivered.status}`);
    }
    if (trackingADocDelivered.shipment !== null) {
      throw new Error(`Expected VehicleTracking shipment null on delivery, got ${trackingADocDelivered.shipment}`);
    }
    if (trackingADocDelivered.speed !== 0) {
      throw new Error(`Expected VehicleTracking speed 0 on delivery, got ${trackingADocDelivered.speed}`);
    }
    console.log('✓ TEST 3 PASSED: Vehicle status AVAILABLE, assignedDriver cleared, VehicleTracking status AVAILABLE, shipment null, speed 0.');

    // --- TEST 4: Terminal Shipments NEVER Appear As Active Cargo in getLiveVehicleTracking ---
    console.log('\n--- TEST 4: Terminal Shipments Are Excluded from getLiveVehicleTracking ---');
    // Deliberately attach the delivered shipment to tracking to test protective filtering
    await VehicleTracking.findOneAndUpdate(
      { vehicle: vehicleA._id },
      { $set: { shipment: testShipment1._id, status: 'ASSIGNED' } }
    );

    const liveDataAfterPoll = await trackingService.getLiveVehicleTracking();
    const liveItemA = liveDataAfterPoll.trackingItems.find((i) => String(i.vehicleId) === String(vehicleA._id));

    if (liveItemA.shipment !== null) {
      throw new Error(`Expected liveItemA.shipment to be null for delivered shipment, got: ${JSON.stringify(liveItemA.shipment)}`);
    }
    if (liveItemA.status !== 'AVAILABLE') {
      throw new Error(`Expected liveItemA.status to resolve to AVAILABLE, got: ${liveItemA.status}`);
    }
    console.log('✓ TEST 4 PASSED: Terminal shipment filtered out from active cargo and vehicle status resolved to AVAILABLE.');

    // --- TEST 5: Telemetry Vitality Distinction ---
    console.log('\n--- TEST 5: Telemetry Vitality (LIVE/STALE/OFFLINE) Is Distinct from Operational Status ---');
    // Set lastUpdated to 10 minutes ago (> 5m -> STALE)
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    await VehicleTracking.findOneAndUpdate(
      { vehicle: vehicleA._id },
      { $set: { lastUpdated: tenMinsAgo, status: 'AVAILABLE' } }
    );

    const staleCheck = await trackingService.getLiveVehicleTracking({ staleMinutes: 5, offlineMinutes: 30 });
    const staleItemA = staleCheck.trackingItems.find((i) => String(i.vehicleId) === String(vehicleA._id));
    if (staleItemA.trackingVitality !== 'STALE') {
      throw new Error(`Expected vitality STALE for 10m old telemetry, got ${staleItemA.trackingVitality}`);
    }
    if (staleItemA.status !== 'AVAILABLE') {
      throw new Error(`Expected operational status AVAILABLE, got ${staleItemA.status}`);
    }

    // Set lastUpdated to 45 minutes ago (> 30m -> OFFLINE)
    const fortyFiveMinsAgo = new Date(Date.now() - 45 * 60 * 1000);
    await VehicleTracking.findOneAndUpdate(
      { vehicle: vehicleA._id },
      { $set: { lastUpdated: fortyFiveMinsAgo, status: 'AVAILABLE' } }
    );

    const offlineCheck = await trackingService.getLiveVehicleTracking({ staleMinutes: 5, offlineMinutes: 30 });
    const offlineItemA = offlineCheck.trackingItems.find((i) => String(i.vehicleId) === String(vehicleA._id));
    if (offlineItemA.trackingVitality !== 'OFFLINE') {
      throw new Error(`Expected vitality OFFLINE for 45m old telemetry, got ${offlineItemA.trackingVitality}`);
    }
    if (offlineItemA.status !== 'AVAILABLE') {
      throw new Error(`Expected operational status AVAILABLE, got ${offlineItemA.status}`);
    }
    console.log('✓ TEST 5 PASSED: Vitality STALE/OFFLINE accurately separated from operational status AVAILABLE.');

    // --- TEST 6: Multi-Shipment Delivery Protection Safeguard ---
    console.log('\n--- TEST 6: Multi-Shipment Delivery Safeguard Does Not Free Reassigned Vehicles ---');
    const randId2 = Math.floor(100000 + Math.random() * 900000);
    const randId3 = Math.floor(100000 + Math.random() * 900000);

    const shipmentMulti1 = await Shipment.create({
      trackingNumber: `RTX-M1-${randId2}`,
      trackingId: `RXAI-2026-M1-${randId2}`,
      customer: driverA._id,
      originHub: hubOrigin._id,
      destinationHub: hubDest._id,
      pickupCity: 'City A',
      deliveryCity: 'City B',
      weightKg: 100,
      status: 'OUT_FOR_DELIVERY',
      vehicle: vehicleB._id,
      driver: driverB._id
    });

    const shipmentMulti2 = await Shipment.create({
      trackingNumber: `RTX-M2-${randId3}`,
      trackingId: `RXAI-2026-M2-${randId3}`,
      customer: driverA._id,
      originHub: hubOrigin._id,
      destinationHub: hubDest._id,
      pickupCity: 'City A',
      deliveryCity: 'City B',
      weightKg: 100,
      status: 'IN_TRANSIT',
      vehicle: vehicleB._id,
      driver: driverB._id
    });

    // Deliver shipmentMulti1 — vehicleB still has active shipmentMulti2
    await shipmentLifecycleService.updateShipmentLifecycle(shipmentMulti1._id, 'DELIVERED');

    const vehicleBAfterM1Delivered = await Vehicle.findById(vehicleB._id);
    const trackingBAfterM1Delivered = await VehicleTracking.findOne({ vehicle: vehicleB._id });

    if (vehicleBAfterM1Delivered.status !== 'ON_TRIP') {
      throw new Error(`Expected Vehicle B to remain ON_TRIP due to active shipmentMulti2, got ${vehicleBAfterM1Delivered.status}`);
    }
    if (String(trackingBAfterM1Delivered.shipment) !== String(shipmentMulti2._id)) {
      throw new Error(`Expected VehicleTracking B to retain shipmentMulti2, got ${trackingBAfterM1Delivered.shipment}`);
    }
    console.log('✓ TEST 6 PASSED: Vehicle retained ON_TRIP and tracking shifted to other active shipment on partial delivery.');

    // Cleanup test multi-shipments
    await shipmentLifecycleService.updateShipmentLifecycle(shipmentMulti2._id, 'AT_DESTINATION');
    await shipmentLifecycleService.updateShipmentLifecycle(shipmentMulti2._id, 'OUT_FOR_DELIVERY');
    await shipmentLifecycleService.updateShipmentLifecycle(shipmentMulti2._id, 'DELIVERED');

    // Clean up temporary shipments from DB
    await Shipment.deleteMany({ _id: { $in: [testShipment1._id, shipmentMulti1._id, shipmentMulti2._id] } });

    console.log('\n======================================================================');
    console.log('ALL FLEET STATUS & SHIPMENT SYNCHRONIZATION TESTS PASSED! (100%)');
    console.log('======================================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  }
};

runFleetStatusSyncTests();
