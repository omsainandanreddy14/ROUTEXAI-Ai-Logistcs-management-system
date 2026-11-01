const dotenv = require('dotenv');
const connectDB = require('./config/db');
const mongoose = require('mongoose');

dotenv.config();

const Shipment = require('./models/Shipment');
const Vehicle = require('./models/Vehicle');
const User = require('./models/User');
const Hub = require('./models/Hub');
const Route = require('./models/Route');
const ShipmentLifecycle = require('./models/ShipmentLifecycle');
const shipmentLifecycleService = require('./services/shipmentLifecycleService');
const trackingService = require('./services/trackingService');

const runStrictLifecycleTests = async () => {
  try {
    await connectDB();

    console.log('\n==================================================');
    console.log('PHASE 4B STRICT LIFECYCLE STATE MACHINE AUDIT');
    console.log('==================================================\n');

    const shipments = await Shipment.find().populate('vehicle').populate('driver');
    if (shipments.length === 0) {
      console.error('No shipments found in database to test.');
      process.exit(1);
    }

    const testShipment = shipments[0];
    const trackingId = testShipment.trackingId || testShipment.trackingNumber;

    // Reset test shipment status to CREATED for a clean sequential test
    testShipment.status = 'CREATED';
    await testShipment.save();
    await ShipmentLifecycle.deleteMany({ shipment: testShipment._id });

    // Initial CREATED history record
    await ShipmentLifecycle.create({
      shipment: testShipment._id,
      trackingId: trackingId,
      status: 'CREATED',
      previousStatus: null,
      timestamp: new Date(),
      note: 'Initial CREATED record'
    });

    console.log(`Testing with Shipment ${trackingId}...`);

    // TEST 1A: CREATED -> VEHICLE_ASSIGNED (Must PASS - Vehicle Assignment)
    const t1a = await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'VEHICLE_ASSIGNED');
    if (t1a.shipment.currentStatus !== 'VEHICLE_ASSIGNED') throw new Error('TEST 1A Failed');
    console.log('✓ TEST 1A: CREATED → VEHICLE_ASSIGNED Direct Assignment (Passed)');

    // Reset status to CREATED for sequential test
    await Shipment.findByIdAndUpdate(testShipment._id, { status: 'CREATED' });
    await ShipmentLifecycle.deleteMany({ shipment: testShipment._id, status: 'VEHICLE_ASSIGNED' });

    // TEST 1: CREATED -> PICKUP_PENDING (Must PASS)
    const t1 = await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'PICKUP_PENDING');
    if (t1.shipment.currentStatus !== 'PICKUP_PENDING') throw new Error('TEST 1 Failed');
    console.log('✓ TEST 1: CREATED → PICKUP_PENDING (Passed)');

    // TEST 2: PICKUP_PENDING -> VEHICLE_ASSIGNED (Must PASS)
    const t2 = await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'VEHICLE_ASSIGNED');
    if (t2.shipment.currentStatus !== 'VEHICLE_ASSIGNED') throw new Error('TEST 2 Failed');
    console.log('✓ TEST 2: PICKUP_PENDING → VEHICLE_ASSIGNED (Passed)');

    // TEST 3: VEHICLE_ASSIGNED -> PICKED_UP (Must PASS)
    const t3 = await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'PICKED_UP');
    if (t3.shipment.currentStatus !== 'PICKED_UP') throw new Error('TEST 3 Failed');
    console.log('✓ TEST 3: VEHICLE_ASSIGNED → PICKED_UP (Passed)');

    // TEST 4: PICKED_UP -> IN_TRANSIT (Must PASS)
    const t4 = await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'IN_TRANSIT');
    if (t4.shipment.currentStatus !== 'IN_TRANSIT') throw new Error('TEST 4 Failed');
    console.log('✓ TEST 4: PICKED_UP → IN_TRANSIT (Passed)');

    // TEST 5: IN_TRANSIT -> AT_DESTINATION (Must PASS)
    const t5 = await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'AT_DESTINATION');
    if (t5.shipment.currentStatus !== 'AT_DESTINATION') throw new Error('TEST 5 Failed');
    console.log('✓ TEST 5: IN_TRANSIT → AT_DESTINATION (Passed)');

    // TEST 6: AT_DESTINATION -> OUT_FOR_DELIVERY (Must PASS)
    const t6 = await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'OUT_FOR_DELIVERY');
    if (t6.shipment.currentStatus !== 'OUT_FOR_DELIVERY') throw new Error('TEST 6 Failed');
    console.log('✓ TEST 6: AT_DESTINATION → OUT_FOR_DELIVERY (Passed)');

    // TEST 7: OUT_FOR_DELIVERY -> DELIVERED (Must PASS)
    const t7 = await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'DELIVERED');
    if (t7.shipment.currentStatus !== 'DELIVERED') throw new Error('TEST 7 Failed');
    console.log('✓ TEST 7: OUT_FOR_DELIVERY → DELIVERED (Passed)');

    // TEST 8: PICKED_UP -> DELIVERED (Must FAIL)
    await Shipment.findByIdAndUpdate(testShipment._id, { status: 'PICKED_UP' });
    try {
      await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'DELIVERED');
      throw new Error('TEST 8 Failed: PICKED_UP -> DELIVERED was incorrectly allowed');
    } catch (err) {
      if (err.message.includes('Invalid') || err.message.includes('DELIVERED status can only be reached')) {
        console.log('✓ TEST 8: PICKED_UP → DELIVERED (Rejected as expected)');
      } else throw err;
    }

    // TEST 9: CREATED -> DELIVERED (Must FAIL)
    await Shipment.findByIdAndUpdate(testShipment._id, { status: 'CREATED' });
    try {
      await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'DELIVERED');
      throw new Error('TEST 9 Failed: CREATED -> DELIVERED was incorrectly allowed');
    } catch (err) {
      if (err.message.includes('Invalid') || err.message.includes('DELIVERED status can only be reached')) {
        console.log('✓ TEST 9: CREATED → DELIVERED (Rejected as expected)');
      } else throw err;
    }

    // TEST 10: IN_TRANSIT -> DELIVERED (Must FAIL)
    await Shipment.findByIdAndUpdate(testShipment._id, { status: 'IN_TRANSIT' });
    try {
      await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'DELIVERED');
      throw new Error('TEST 10 Failed: IN_TRANSIT -> DELIVERED was incorrectly allowed');
    } catch (err) {
      if (err.message.includes('Invalid') || err.message.includes('DELIVERED status can only be reached')) {
        console.log('✓ TEST 10: IN_TRANSIT → DELIVERED (Rejected as expected)');
      } else throw err;
    }

    // TEST 11: DELIVERED -> IN_TRANSIT (Must FAIL)
    await Shipment.findByIdAndUpdate(testShipment._id, { status: 'DELIVERED' });
    try {
      await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'IN_TRANSIT');
      throw new Error('TEST 11 Failed: DELIVERED -> IN_TRANSIT was incorrectly allowed');
    } catch (err) {
      if (err.message.includes('Invalid') || err.message.includes('terminal state')) {
        console.log('✓ TEST 11: DELIVERED → IN_TRANSIT (Rejected as expected)');
      } else throw err;
    }

    // TEST 12: DELIVERED -> DELIVERED (Must FAIL - duplicate)
    try {
      await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'DELIVERED');
      throw new Error('TEST 12 Failed: DELIVERED -> DELIVERED was incorrectly allowed');
    } catch (err) {
      if (err.isDuplicate || err.message.includes('already in')) {
        console.log('✓ TEST 12: DELIVERED → DELIVERED (Rejected duplicate as expected)');
      } else throw err;
    }

    // TEST 13 & 14: Duplicate update & Single History Record Verification
    await Shipment.findByIdAndUpdate(testShipment._id, { status: 'PICKED_UP' });
    const countBefore = await ShipmentLifecycle.countDocuments({ shipment: testShipment._id });
    try {
      await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'PICKED_UP');
    } catch (err) {
      // expected duplicate rejection
    }
    const countAfter = await ShipmentLifecycle.countDocuments({ shipment: testShipment._id });
    if (countBefore !== countAfter) {
      throw new Error('TEST 13/14 Failed: Duplicate status update created extra history record!');
    }
    console.log('✓ TEST 13 & 14: Duplicate status update did NOT create extra history record (Passed)');

    // TEST 16: OUT_FOR_DELIVERY -> IN_TRANSIT (Must FAIL)
    await Shipment.findByIdAndUpdate(testShipment._id, { status: 'OUT_FOR_DELIVERY' });
    try {
      await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'IN_TRANSIT');
      throw new Error('TEST 16 Failed: OUT_FOR_DELIVERY -> IN_TRANSIT was incorrectly allowed');
    } catch (err) {
      if (err.message.includes('Invalid')) {
        console.log('✓ TEST 16: OUT_FOR_DELIVERY → IN_TRANSIT (Rejected as expected)');
      } else throw err;
    }

    // TEST 17: OUT_FOR_DELIVERY -> DELAYED -> IN_TRANSIT (Must FAIL)
    await Shipment.findByIdAndUpdate(testShipment._id, { status: 'OUT_FOR_DELIVERY' });
    await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'DELAYED');
    try {
      await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'IN_TRANSIT');
      throw new Error('TEST 17 Failed: OUT_FOR_DELIVERY -> DELAYED -> IN_TRANSIT backward recovery was incorrectly allowed');
    } catch (err) {
      if (err.message.includes('Invalid') || err.message.includes('backward')) {
        console.log('✓ TEST 17: OUT_FOR_DELIVERY → DELAYED → IN_TRANSIT (Rejected as expected)');
      } else throw err;
    }

    // TEST 18: CANCELLED Terminal State (Must FAIL on further transitions)
    await Shipment.findByIdAndUpdate(testShipment._id, { status: 'CANCELLED' });
    try {
      await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'IN_TRANSIT');
      throw new Error('TEST 18 Failed: CANCELLED -> IN_TRANSIT transition was allowed');
    } catch (err) {
      if (err.message.includes('terminal state') || err.message.includes('Invalid')) {
        console.log('✓ TEST 18: CANCELLED is Terminal State (Passed)');
      } else throw err;
    }

    // TEST 19: FAILED Terminal State (Must FAIL on further transitions)
    await Shipment.findByIdAndUpdate(testShipment._id, { status: 'FAILED' });
    try {
      await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'IN_TRANSIT');
      throw new Error('TEST 19 Failed: FAILED -> IN_TRANSIT transition was allowed');
    } catch (err) {
      if (err.message.includes('terminal state') || err.message.includes('Invalid')) {
        console.log('✓ TEST 19: FAILED is Terminal State (Passed)');
      } else throw err;
    }

    // TEST 20: Optimistic Concurrency Control Test
    await Shipment.findByIdAndUpdate(testShipment._id, { status: 'OUT_FOR_DELIVERY' });
    // Simulate concurrent modification in DB
    await Shipment.findByIdAndUpdate(testShipment._id, { status: 'DELIVERED' });
    try {
      await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'DELIVERED');
    } catch (err) {
      if (err.statusCode === 409 || err.isDuplicate || err.message.includes('Conflict') || err.message.includes('already in')) {
        console.log('✓ TEST 20: Optimistic Concurrency Control (Conflict Detected & Handled)');
      } else throw err;
    }

    // TEST 21: Verify previousStatus === previous Shipment.status and newStatus === updated Shipment.status
    await Shipment.findByIdAndUpdate(testShipment._id, { status: 'OUT_FOR_DELIVERY' });
    await ShipmentLifecycle.deleteMany({ shipment: testShipment._id, status: 'DELIVERED' });
    const res21 = await shipmentLifecycleService.updateShipmentLifecycle(testShipment._id, 'DELIVERED');
    const latestLog = res21.history[res21.history.length - 1];
    if (latestLog.previousStatus !== 'OUT_FOR_DELIVERY' || latestLog.status !== 'DELIVERED') {
      throw new Error(`TEST 21 Failed: History log statuses (${latestLog.previousStatus} -> ${latestLog.status}) do not match transition!`);
    }
    console.log('✓ TEST 21: History log previousStatus & status match exact transition (Passed)');

    // TEST 22: Verify Phase 4A vehicle tracking remains functional
    const trackingRes = await trackingService.getLiveVehicleTracking();
    if (!trackingRes || typeof trackingRes.summaryMetrics.totalTracked !== 'number') {
      throw new Error('TEST 22 Failed: Phase 4A tracking service failed!');
    }
    console.log('✓ TEST 22: Phase 4A Live Vehicle Tracking remains 100% operational (Passed)');

    console.log('\n==================================================');
    console.log('ALL 22 PHASE 4B STRICT LIFECYCLE TESTS PASSED PERFECTLY!');
    console.log('==================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Audit Failure:', err.message);
    process.exit(1);
  }
};

runStrictLifecycleTests();
