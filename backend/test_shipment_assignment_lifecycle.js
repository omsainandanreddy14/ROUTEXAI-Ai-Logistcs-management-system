const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const Shipment = require('./models/Shipment');
const Vehicle = require('./models/Vehicle');
const Driver = require('./models/Driver');
const User = require('./models/User');
const Hub = require('./models/Hub');
const VehicleTracking = require('./models/VehicleTracking');
const ShipmentLifecycle = require('./models/ShipmentLifecycle');
const shipmentLifecycleService = require('./services/shipmentLifecycleService');
const { assignShipment } = require('./controllers/shipmentController');

const mockResponse = () => {
  const res = {};
  res.statusCode = 200;
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (data) {
    res.jsonData = data;
    return res;
  };
  return res;
};

const runAssignmentLifecycleTests = async () => {
  console.log('\n======================================================================');
  console.log('ROUTE-XAI SHIPMENT ASSIGNMENT & LIFECYCLE TRANSITION TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} - ${details}`);
      failed++;
    }
  };

  const createdShipmentIds = [];
  const createdVehicleIds = [];
  const createdDriverIds = [];
  const createdUserIds = [];

  try {
    await connectDB();

    // Find or create Owner user for context
    let ownerUser = await User.findOne({ role: 'OWNER' });
    if (!ownerUser) {
      ownerUser = await User.create({
        name: 'Test Fleet Owner',
        email: `test_owner_${Date.now()}@routexai.com`,
        password: 'password123',
        role: 'OWNER'
      });
      createdUserIds.push(ownerUser._id);
    }

    // Find or create Customer user for shipment
    let customerUser = await User.findOne({ role: 'CUSTOMER' });
    if (!customerUser) {
      customerUser = await User.create({
        name: 'Test Customer',
        email: `test_cust_${Date.now()}@routexai.com`,
        password: 'password123',
        role: 'CUSTOMER'
      });
      createdUserIds.push(customerUser._id);
    }

    // Create a dedicated test Driver
    const driverUser = await User.create({
      name: 'Test Assignment Driver',
      email: `test_driver_${Date.now()}@routexai.com`,
      password: 'password123',
      role: 'DRIVER'
    });
    createdUserIds.push(driverUser._id);

    const testDriver = await Driver.create({
      user: driverUser._id,
      licenseNumber: `DL-TEST-${Date.now().toString().slice(-6)}`,
      experienceYears: 6,
      rating: 4.9,
      status: 'AVAILABLE'
    });
    createdDriverIds.push(testDriver._id);

    // Create a dedicated test Vehicle
    const testVehicle = await Vehicle.create({
      registrationNumber: `MH-04-TEST-${Date.now().toString().slice(-4)}`,
      vehicleType: 'HEAVY_TRUCK',
      capacityKg: 10000,
      status: 'AVAILABLE',
      fuelType: 'DIESEL'
    });
    createdVehicleIds.push(testVehicle._id);

    console.log(`Driver created: ${driverUser.name} (${driverUser._id})`);
    console.log(`Vehicle created: ${testVehicle.registrationNumber} (${testVehicle._id}, Capacity: ${testVehicle.capacityKg} kg)\n`);

    // =========================================================================
    // TEST 1: Direct Service Validation (validateStatusTransition)
    // =========================================================================
    console.log('--- TEST 1: validateStatusTransition Rules for CONFIRMED Status ---');
    const dummyId = new mongoose.Types.ObjectId();

    const check1 = await shipmentLifecycleService.validateStatusTransition(dummyId, 'CONFIRMED', 'VEHICLE_ASSIGNED');
    assert(check1.valid === true, 'CONFIRMED -> VEHICLE_ASSIGNED is allowed');

    const check2 = await shipmentLifecycleService.validateStatusTransition(dummyId, 'CONFIRMED', 'PICKUP_PENDING');
    assert(check2.valid === true, 'CONFIRMED -> PICKUP_PENDING is allowed');

    const check3 = await shipmentLifecycleService.validateStatusTransition(dummyId, 'CONFIRMED', 'CANCELLED');
    assert(check3.valid === true, 'CONFIRMED -> CANCELLED is allowed');

    const check4 = await shipmentLifecycleService.validateStatusTransition(dummyId, 'VEHICLE_ASSIGNED', 'CONFIRMED');
    assert(check4.valid === false, 'VEHICLE_ASSIGNED -> CONFIRMED (backward) is prohibited');

    const check5 = await shipmentLifecycleService.validateStatusTransition(dummyId, 'CONFIRMED', 'DELIVERED');
    assert(check5.valid === false, 'CONFIRMED -> DELIVERED (skipping stages) is prohibited');

    // =========================================================================
    // TEST 2: Assign Driver and Vehicle to CONFIRMED Shipment
    // =========================================================================
    console.log('\n--- TEST 2: Successful Assignment of CONFIRMED Shipment via assignShipment ---');
    const randCode = Math.floor(100000 + Math.random() * 900000);
    const confirmedShipment = await Shipment.create({
      trackingNumber: `RTX-CONF-${randCode}`,
      trackingId: `RXAI-2026-${randCode}`,
      customer: customerUser._id,
      pickupAddress: { city: 'Mumbai', state: 'Maharashtra', street: 'Andheri East', pincode: '400069' },
      deliveryAddress: { city: 'Pune', state: 'Maharashtra', street: 'Hinjawadi', pincode: '411057' },
      weightKg: 2500,
      quantity: 10,
      cargoType: 'Industrial Hardware',
      status: 'CONFIRMED'
    });
    createdShipmentIds.push(confirmedShipment._id);

    const req2 = {
      params: { id: confirmedShipment._id.toString() },
      body: { driverId: driverUser._id.toString(), vehicleId: testVehicle._id.toString() },
      user: { _id: ownerUser._id, role: 'OWNER' }
    };
    const res2 = mockResponse();
    let nextCalled = false;
    await assignShipment(req2, res2, (err) => { nextCalled = true; console.error('Next called with:', err); });

    assert(res2.statusCode === 200, 'assignShipment returns 200 OK');
    assert(res2.jsonData?.success === true, 'assignShipment responds with success: true');

    // Verify Shipment in DB
    const dbShipment2 = await Shipment.findById(confirmedShipment._id);
    assert(dbShipment2.status === 'VEHICLE_ASSIGNED', 'Shipment status transitioned to VEHICLE_ASSIGNED');
    assert(String(dbShipment2.driver) === String(driverUser._id), 'Shipment driver matches assigned driver user ID');
    assert(String(dbShipment2.vehicle) === String(testVehicle._id), 'Shipment vehicle matches assigned vehicle ID');

    // Verify Driver in DB
    const dbDriver2 = await Driver.findOne({ user: driverUser._id });
    assert(dbDriver2.status === 'ON_TRIP', 'Driver status synchronized to ON_TRIP');
    assert(String(dbDriver2.assignedVehicle) === String(testVehicle._id), 'Driver assignedVehicle matches vehicle');

    // Verify Vehicle in DB
    const dbVehicle2 = await Vehicle.findById(testVehicle._id);
    assert(dbVehicle2.status === 'ON_TRIP', 'Vehicle status synchronized to ON_TRIP');
    assert(String(dbVehicle2.assignedDriver) === String(driverUser._id), 'Vehicle assignedDriver matches driver');

    // Verify VehicleTracking
    const dbTracking2 = await VehicleTracking.findOne({ vehicle: testVehicle._id });
    assert(dbTracking2 && dbTracking2.status === 'ASSIGNED', 'VehicleTracking synchronized to status ASSIGNED');
    assert(String(dbTracking2.shipment) === String(confirmedShipment._id), 'VehicleTracking linked to shipment');

    // Verify ShipmentLifecycle event log
    const dbLifecycle2 = await ShipmentLifecycle.find({ shipment: confirmedShipment._id, status: 'VEHICLE_ASSIGNED' });
    assert(dbLifecycle2.length === 1, 'Exactly one VEHICLE_ASSIGNED lifecycle log created');

    // =========================================================================
    // TEST 3: Prevent Duplicate Assignment on Already-Assigned Shipment
    // =========================================================================
    console.log('\n--- TEST 3: Prevent Duplicate Assignment on Already VEHICLE_ASSIGNED Shipment ---');
    const req3 = {
      params: { id: confirmedShipment._id.toString() },
      body: { driverId: driverUser._id.toString(), vehicleId: testVehicle._id.toString() },
      user: { _id: ownerUser._id, role: 'OWNER' }
    };
    const res3 = mockResponse();
    await assignShipment(req3, res3, () => {});
    assert(res3.statusCode === 400, 'Duplicate assignment returns 400 Bad Request');
    assert(res3.jsonData?.message?.includes('already assigned'), 'Duplicate assignment message explains shipment is already assigned');

    // Free testVehicle and driver from confirmedShipment by marking it DELIVERED
    await Shipment.findByIdAndUpdate(confirmedShipment._id, { status: 'DELIVERED' });
    await Vehicle.findByIdAndUpdate(testVehicle._id, { status: 'AVAILABLE', assignedDriver: null });
    await Driver.findOneAndUpdate({ user: driverUser._id }, { status: 'AVAILABLE', assignedVehicle: null });

    // =========================================================================
    // TEST 4: Prevent Assignment with Insufficient Vehicle Capacity
    // =========================================================================
    console.log('\n--- TEST 4: Insufficient Vehicle Capacity Validation ---');
    // Reset vehicle and driver to AVAILABLE for testing
    await Vehicle.findByIdAndUpdate(testVehicle._id, { status: 'AVAILABLE', assignedDriver: null });
    await Driver.findOneAndUpdate({ user: driverUser._id }, { status: 'AVAILABLE', assignedVehicle: null });

    const randCode4 = Math.floor(100000 + Math.random() * 900000);
    const overweightShipment = await Shipment.create({
      trackingNumber: `RTX-OVER-${randCode4}`,
      trackingId: `RXAI-2026-${randCode4}`,
      customer: customerUser._id,
      pickupAddress: { city: 'Delhi', state: 'Delhi', street: 'Connaught Place', pincode: '110001' },
      deliveryAddress: { city: 'Jaipur', state: 'Rajasthan', street: 'MI Road', pincode: '302001' },
      weightKg: 25000, // Vehicle capacity is 10000
      quantity: 50,
      cargoType: 'Steel Beams',
      status: 'CONFIRMED'
    });
    createdShipmentIds.push(overweightShipment._id);

    const req4 = {
      params: { id: overweightShipment._id.toString() },
      body: { driverId: driverUser._id.toString(), vehicleId: testVehicle._id.toString() },
      user: { _id: ownerUser._id, role: 'OWNER' }
    };
    const res4 = mockResponse();
    await assignShipment(req4, res4, () => {});

    assert(res4.statusCode === 400, 'Overweight shipment returns 400 Bad Request');
    assert(res4.jsonData?.message?.includes('insufficient'), 'Error message clearly specifies insufficient capacity');

    // Check no partial mutation
    const dbOverweightShipment = await Shipment.findById(overweightShipment._id);
    assert(dbOverweightShipment.status === 'CONFIRMED', 'Shipment status remains CONFIRMED without partial mutation');
    assert(dbOverweightShipment.driver === null || dbOverweightShipment.driver === undefined, 'Shipment driver not partially set');

    // =========================================================================
    // TEST 5: Reject Unavailable Vehicle & Active Conflict Checks
    // =========================================================================
    console.log('\n--- TEST 5: Reject Unavailable Vehicle & Conflict Handling ---');
    // Set vehicle to MAINTENANCE
    await Vehicle.findByIdAndUpdate(testVehicle._id, { status: 'MAINTENANCE' });

    const randCode5 = Math.floor(100000 + Math.random() * 900000);
    const validShipment5 = await Shipment.create({
      trackingNumber: `RTX-TEST5-${randCode5}`,
      trackingId: `RXAI-2026-${randCode5}`,
      customer: customerUser._id,
      pickupAddress: { city: 'Bengaluru', state: 'Karnataka', street: 'Whitefield', pincode: '560066' },
      deliveryAddress: { city: 'Chennai', state: 'Tamil Nadu', street: 'Guindy', pincode: '600032' },
      weightKg: 1000,
      quantity: 5,
      cargoType: 'Electronics',
      status: 'CONFIRMED'
    });
    createdShipmentIds.push(validShipment5._id);

    const req5 = {
      params: { id: validShipment5._id.toString() },
      body: { driverId: driverUser._id.toString(), vehicleId: testVehicle._id.toString() },
      user: { _id: ownerUser._id, role: 'OWNER' }
    };
    const res5 = mockResponse();
    await assignShipment(req5, res5, () => {});

    assert(res5.statusCode === 400, 'Assigning MAINTENANCE vehicle returns 400');
    assert(res5.jsonData?.message?.includes('not available'), 'Error message states vehicle is not available');

    // Restore vehicle to AVAILABLE
    await Vehicle.findByIdAndUpdate(testVehicle._id, { status: 'AVAILABLE' });

    // =========================================================================
    // TEST 6: Invalid Driver ID / Non-existent Driver
    // =========================================================================
    console.log('\n--- TEST 6: Non-Existent or Invalid Driver Rejection ---');
    const fakeDriverId = new mongoose.Types.ObjectId();
    const req6 = {
      params: { id: validShipment5._id.toString() },
      body: { driverId: fakeDriverId.toString(), vehicleId: testVehicle._id.toString() },
      user: { _id: ownerUser._id, role: 'OWNER' }
    };
    const res6 = mockResponse();
    await assignShipment(req6, res6, () => {});

    assert(res6.statusCode === 404, 'Non-existent driver returns 404 Not Found');

    // =========================================================================
    // TEST 7: Full Downstream Lifecycle Progression
    // =========================================================================
    console.log('\n--- TEST 7: Lifecycle Progression from VEHICLE_ASSIGNED to DELIVERED ---');
    // Ensure vehicle and driver are AVAILABLE
    await Vehicle.findByIdAndUpdate(testVehicle._id, { status: 'AVAILABLE', assignedDriver: null });
    await Driver.findOneAndUpdate({ user: driverUser._id }, { status: 'AVAILABLE', assignedVehicle: null });

    // Assign validShipment5 cleanly
    const req7Assign = {
      params: { id: validShipment5._id.toString() },
      body: { driverId: driverUser._id.toString(), vehicleId: testVehicle._id.toString() },
      user: { _id: ownerUser._id, role: 'OWNER' }
    };
    const res7Assign = mockResponse();
    await assignShipment(req7Assign, res7Assign, () => {});
    assert(res7Assign.statusCode === 200, 'Assigned shipment successfully for downstream test');

    // Advance to PICKED_UP
    const p1 = await shipmentLifecycleService.updateShipmentLifecycle(validShipment5._id, 'PICKED_UP', {}, ownerUser);
    assert(p1.currentStage?.status === 'PICKED_UP', 'Transitioned VEHICLE_ASSIGNED -> PICKED_UP');

    // Advance to IN_TRANSIT
    const p2 = await shipmentLifecycleService.updateShipmentLifecycle(validShipment5._id, 'IN_TRANSIT', {}, ownerUser);
    assert(p2.currentStage?.status === 'IN_TRANSIT', 'Transitioned PICKED_UP -> IN_TRANSIT');

    // Advance to AT_DESTINATION
    const p3 = await shipmentLifecycleService.updateShipmentLifecycle(validShipment5._id, 'AT_DESTINATION', {}, ownerUser);
    assert(p3.currentStage?.status === 'AT_DESTINATION', 'Transitioned IN_TRANSIT -> AT_DESTINATION');

    // Advance to OUT_FOR_DELIVERY
    const p4 = await shipmentLifecycleService.updateShipmentLifecycle(validShipment5._id, 'OUT_FOR_DELIVERY', {}, ownerUser);
    assert(p4.currentStage?.status === 'OUT_FOR_DELIVERY', 'Transitioned AT_DESTINATION -> OUT_FOR_DELIVERY');

    // Advance to DELIVERED
    const p5 = await shipmentLifecycleService.updateShipmentLifecycle(validShipment5._id, 'DELIVERED', {}, ownerUser);
    assert(p5.currentStage?.status === 'DELIVERED', 'Transitioned OUT_FOR_DELIVERY -> DELIVERED');

    // Verify Driver and Vehicle returned to AVAILABLE upon DELIVERED
    const finalDriver = await Driver.findOne({ user: driverUser._id });
    const finalVehicle = await Vehicle.findById(testVehicle._id);
    assert(finalDriver.status === 'AVAILABLE', 'Driver status returned to AVAILABLE upon delivery');
    assert(finalVehicle.status === 'AVAILABLE', 'Vehicle status returned to AVAILABLE upon delivery');

  } catch (error) {
    console.error('Test execution failed with error:', error);
    failed++;
  } finally {
    // Clean up created test entities
    try {
      if (createdShipmentIds.length > 0) {
        await Shipment.deleteMany({ _id: { $in: createdShipmentIds } });
        await ShipmentLifecycle.deleteMany({ shipment: { $in: createdShipmentIds } });
      }
      if (createdVehicleIds.length > 0) {
        await Vehicle.deleteMany({ _id: { $in: createdVehicleIds } });
        await VehicleTracking.deleteMany({ vehicle: { $in: createdVehicleIds } });
      }
      if (createdDriverIds.length > 0) {
        await Driver.deleteMany({ _id: { $in: createdDriverIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      console.log('\nCleaned up test database fixtures.');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }

    await mongoose.connection.close();

    console.log('\n======================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
};

runAssignmentLifecycleTests();
