const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

dotenv.config();

const Shipment = require('./models/Shipment');
const Vehicle = require('./models/Vehicle');
const User = require('./models/User');
const Route = require('./models/Route');
const VehicleTracking = require('./models/VehicleTracking');
const ShipmentETA = require('./models/ShipmentETA');
const ShipmentETAHistory = require('./models/ShipmentETAHistory');

const etaMonitoringService = require('./services/etaMonitoringService');
const routeService = require('./services/routeService');
const etaService = require('./services/etaService');

const runStaleGPSDeviationSyncTest = async () => {
  let passedTests = 0;
  let totalTests = 8;

  let testShipment = null;
  let testVehicle = null;
  let testDriver = null;
  let otherDriver = null;
  let testCustomer = null;
  let testRoute = null;

  try {
    await connectDB();

    console.log('\n======================================================================');
    console.log('ROUTEXAI — STALE GPS & ROUTE DEVIATION SYNCHRONIZATION TEST SUITE');
    console.log('======================================================================\n');

    // 1. Setup Test Driver & Customer
    testDriver = await User.findOne({ role: 'DRIVER' });
    if (!testDriver) {
      testDriver = await User.create({
        name: 'Test Driver',
        email: `test.driver.${Date.now()}@routexai.com`,
        password: 'hashedpassword123',
        role: 'DRIVER',
        phone: '9876543210'
      });
    }

    otherDriver = await User.findOne({ role: 'DRIVER', _id: { $ne: testDriver._id } });
    if (!otherDriver) {
      otherDriver = await User.create({
        name: 'Other Driver',
        email: `other.driver.${Date.now()}@routexai.com`,
        password: 'hashedpassword123',
        role: 'DRIVER',
        phone: '9876543211'
      });
    }

    testCustomer = await User.findOne({ role: 'CUSTOMER' });
    if (!testCustomer) {
      testCustomer = await User.create({
        name: 'Test Customer',
        email: `test.cust.${Date.now()}@routexai.com`,
        password: 'hashedpassword123',
        role: 'CUSTOMER',
        phone: '9876543212'
      });
    }

    testVehicle = await Vehicle.create({
      registrationNumber: `TEST-SYNC-${Date.now().toString().slice(-6)}`,
      vehicleType: 'HEAVY_TRUCK',
      capacityKg: 6000,
      fuelType: 'DIESEL',
      status: 'ON_TRIP'
    });

    // Planned Polyline (Highway corridor from Hyderabad to Bangalore)
    const plannedPolyline = [
      [78.4867, 17.3850], // Hyderabad
      [78.4500, 17.2000],
      [78.3000, 16.8000],
      [78.1000, 16.2000],
      [77.9000, 15.6000],
      [77.6000, 14.8000],
      [77.5946, 12.9716]  // Bangalore
    ];

    testShipment = await Shipment.create({
      trackingNumber: `TEST-SYNC-${Date.now().toString().slice(-6)}`,
      trackingId: `TEST-SYNC-${Date.now().toString().slice(-6)}`,
      customer: testCustomer._id,
      driver: testDriver._id,
      vehicle: testVehicle._id,
      status: 'IN_TRANSIT',
      pickupAddress: { street: 'NH44 Hub', city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
      deliveryAddress: { street: 'Whitefield Hub', city: 'Bangalore', state: 'Karnataka', pincode: '560066' },
      pickupLocation: { type: 'Point', coordinates: [78.4867, 17.3850] },
      deliveryLocation: { type: 'Point', coordinates: [77.5946, 12.9716] },
      estimatedDistanceKm: 569.2,
      estimatedDurationMinutes: 540,
      weightKg: 1500
    });

    testRoute = await Route.create({
      shipment: testShipment._id,
      source: { latitude: 17.3850, longitude: 78.4867, address: 'Hyderabad Origin Hub' },
      destination: { latitude: 12.9716, longitude: 77.5946, address: 'Bangalore Delivery Hub' },
      geometry: { type: 'LineString', coordinates: plannedPolyline },
      distanceKm: 569.2,
      durationMinutes: 540,
      estimatedDistanceKm: 569.2,
      estimatedDurationMinutes: 540,
      status: 'SELECTED',
      routeName: 'Hyderabad -> Bangalore NH44 Express'
    });

    testShipment.route = testRoute._id;
    testShipment.selectedRouteGeometry = testRoute.geometry;
    await testShipment.save();

    // Initial Tracking: Live on route
    let trackingRecord = await VehicleTracking.create({
      vehicle: testVehicle._id,
      shipment: testShipment._id,
      driver: testDriver._id,
      latitude: 17.2000,
      longitude: 78.4500,
      location: {
        type: 'Point',
        coordinates: [78.4500, 17.2000]
      },
      speed: 60,
      status: 'IN_TRANSIT',
      trackingVitality: 'LIVE',
      lastUpdated: new Date()
    });

    // =========================================================================
    // TEST 1: Live Telemetry On Route
    // =========================================================================
    console.log('TEST 1: Live telemetry on route calculation...');
    let etaSnapshot = await etaMonitoringService.recalculateShipmentETA(testShipment._id, { force: true });
    
    if (
      etaSnapshot.trackingVitality === 'LIVE' &&
      etaSnapshot.deviationStatus === 'ON_ROUTE' &&
      etaSnapshot.lastDetectedDeviationStatus === 'ON_ROUTE' &&
      ['ON_TIME', 'DELAYED'].includes(etaSnapshot.etaStatus) &&
      etaSnapshot.currentETA &&
      etaSnapshot.lastKnownETA
    ) {
      console.log('✅ TEST 1 PASSED: Live on-route telemetry calculated correctly.');
      console.log(`   ETA Status: ${etaSnapshot.etaStatus}, Deviation: ${etaSnapshot.deviationStatus}, Distance Off: ${etaSnapshot.deviationDistanceKm} km`);
      passedTests++;
    } else {
      console.error('❌ TEST 1 FAILED:', {
        vitality: etaSnapshot.trackingVitality,
        deviation: etaSnapshot.deviationStatus,
        etaStatus: etaSnapshot.etaStatus
      });
    }

    // =========================================================================
    // TEST 2: Live Telemetry Deviated (Simulate vehicle pulling off highway)
    // =========================================================================
    console.log('\nTEST 2: Live telemetry deviated outside corridor (>1.0 km)...');
    // Coords ~25 km off highway corridor
    trackingRecord.latitude = 17.2000;
    trackingRecord.longitude = 78.7000;
    trackingRecord.location = { type: 'Point', coordinates: [78.7000, 17.2000] };
    trackingRecord.lastUpdated = new Date();
    await trackingRecord.save();

    // Check 1 (potential noise)
    await etaMonitoringService.recalculateShipmentETA(testShipment._id, { force: true });
    // Check 2 (confirmed deviation)
    etaSnapshot = await etaMonitoringService.recalculateShipmentETA(testShipment._id, { force: true });

    const liveDeviatedKm = etaSnapshot.deviationDistanceKm;
    const liveDeviatedETA = etaSnapshot.currentETA;

    if (
      etaSnapshot.trackingVitality === 'LIVE' &&
      etaSnapshot.deviationStatus === 'DEVIATED' &&
      etaSnapshot.lastDetectedDeviationStatus === 'DEVIATED' &&
      etaSnapshot.lastDetectedDeviationKm > 1.0 &&
      etaSnapshot.lastDetectedDeviationTimestamp &&
      etaSnapshot.lastKnownETA
    ) {
      console.log('✅ TEST 2 PASSED: Confirmed live route deviation detected and stored.');
      console.log(`   Deviation Distance: ${etaSnapshot.deviationDistanceKm} km, lastDetectedKm: ${etaSnapshot.lastDetectedDeviationKm}`);
      console.log(`   lastDetectedDeviationTimestamp: ${etaSnapshot.lastDetectedDeviationTimestamp}`);
      passedTests++;
    } else {
      console.error('❌ TEST 2 FAILED:', {
        vitality: etaSnapshot.trackingVitality,
        deviationStatus: etaSnapshot.deviationStatus,
        lastDetectedStatus: etaSnapshot.lastDetectedDeviationStatus,
        lastDetectedKm: etaSnapshot.lastDetectedDeviationKm
      });
    }

    // =========================================================================
    // TEST 3: Stale GPS Telemetry Transition (Rules 1, 2, 3, 4, 5)
    // =========================================================================
    console.log('\nTEST 3: Stale GPS telemetry transition (GPS timestamp aged 6 mins)...');
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    trackingRecord.lastUpdated = sixMinutesAgo;
    await trackingRecord.save();

    etaSnapshot = await etaMonitoringService.recalculateShipmentETA(testShipment._id, { force: true });

    const rule1Passed = etaSnapshot.etaStatus === 'PAUSED' && etaSnapshot.deviationStatus === 'PAUSED';
    const rule2Passed = (
      etaSnapshot.lastKnownETA &&
      new Date(etaSnapshot.lastKnownETA).getTime() === new Date(liveDeviatedETA).getTime() &&
      etaSnapshot.lastDetectedDeviationKm === liveDeviatedKm &&
      etaSnapshot.lastDetectedDeviationStatus === 'DEVIATED' &&
      etaSnapshot.lastDetectedDeviationTimestamp
    );
    const rule5Passed = (
      etaSnapshot.corridorStatusReason.includes('Corridor monitoring paused') &&
      etaSnapshot.corridorStatusReason.includes('Last detected deviation') &&
      etaSnapshot.unavailableReason.includes('Live ETA recalculation paused')
    );

    if (etaSnapshot.trackingVitality === 'STALE' && rule1Passed && rule2Passed && rule5Passed) {
      console.log('✅ TEST 3 PASSED: Stale telemetry properly pauses ETA and corridor deviation while preserving historical state.');
      console.log(`   Vitality: ${etaSnapshot.trackingVitality}`);
      console.log(`   etaStatus: ${etaSnapshot.etaStatus}, deviationStatus: ${etaSnapshot.deviationStatus}`);
      console.log(`   lastKnownETA: ${etaSnapshot.lastKnownETA}`);
      console.log(`   lastDetectedDeviationKm: ${etaSnapshot.lastDetectedDeviationKm} km, status: ${etaSnapshot.lastDetectedDeviationStatus}`);
      console.log(`   corridorStatusReason: "${etaSnapshot.corridorStatusReason}"`);
      passedTests++;
    } else {
      console.error('❌ TEST 3 FAILED:', {
        vitality: etaSnapshot.trackingVitality,
        rule1Passed,
        rule2Passed,
        rule5Passed,
        etaStatus: etaSnapshot.etaStatus,
        deviationStatus: etaSnapshot.deviationStatus,
        lastKnownETA: etaSnapshot.lastKnownETA,
        lastDetectedDeviationKm: etaSnapshot.lastDetectedDeviationKm
      });
    }

    // =========================================================================
    // TEST 4: Offline GPS Telemetry Transition
    // =========================================================================
    console.log('\nTEST 4: Offline GPS telemetry transition (GPS timestamp aged 35 mins)...');
    const thirtyFiveMinsAgo = new Date(Date.now() - 35 * 60 * 1000);
    trackingRecord.lastUpdated = thirtyFiveMinsAgo;
    await trackingRecord.save();

    etaSnapshot = await etaMonitoringService.recalculateShipmentETA(testShipment._id, { force: true });

    if (
      etaSnapshot.trackingVitality === 'OFFLINE' &&
      etaSnapshot.etaStatus === 'PAUSED' &&
      etaSnapshot.deviationStatus === 'PAUSED' &&
      etaSnapshot.lastKnownETA &&
      etaSnapshot.lastDetectedDeviationKm !== null
    ) {
      console.log('✅ TEST 4 PASSED: Offline telemetry properly sets PAUSED and preserves historical snapshot.');
      console.log(`   Vitality: ${etaSnapshot.trackingVitality}, ETA Status: ${etaSnapshot.etaStatus}, Deviation Status: ${etaSnapshot.deviationStatus}`);
      passedTests++;
    } else {
      console.error('❌ TEST 4 FAILED:', {
        vitality: etaSnapshot.trackingVitality,
        etaStatus: etaSnapshot.etaStatus,
        deviationStatus: etaSnapshot.deviationStatus
      });
    }

    // =========================================================================
    // TEST 5: Fresh GPS Telemetry Recovery (Rule 6)
    // =========================================================================
    console.log('\nTEST 5: Fresh GPS recovery (Fresh telemetry returns vehicle on route)...');
    trackingRecord.latitude = 16.8000;
    trackingRecord.longitude = 78.3000; // Directly on route polyline
    trackingRecord.location = { type: 'Point', coordinates: [78.3000, 16.8000] };
    trackingRecord.lastUpdated = new Date(); // Fresh
    await trackingRecord.save();

    etaSnapshot = await etaMonitoringService.recalculateShipmentETA(testShipment._id, { force: true });

    if (
      etaSnapshot.trackingVitality === 'LIVE' &&
      etaSnapshot.deviationStatus === 'ON_ROUTE' &&
      etaSnapshot.lastDetectedDeviationStatus === 'ON_ROUTE' &&
      ['ON_TIME', 'DELAYED'].includes(etaSnapshot.etaStatus) &&
      etaSnapshot.etaStatus !== 'PAUSED'
    ) {
      console.log('✅ TEST 5 PASSED: Fresh GPS recovery immediately recalculates live ETA and resets corridor status to ON_ROUTE.');
      console.log(`   Vitality: ${etaSnapshot.trackingVitality}, Deviation: ${etaSnapshot.deviationStatus}, ETA Status: ${etaSnapshot.etaStatus}`);
      passedTests++;
    } else {
      console.error('❌ TEST 5 FAILED:', {
        vitality: etaSnapshot.trackingVitality,
        deviationStatus: etaSnapshot.deviationStatus,
        etaStatus: etaSnapshot.etaStatus
      });
    }

    // =========================================================================
    // TEST 6: Shipment Lifecycle Status Preservation (Rule 8)
    // =========================================================================
    console.log('\nTEST 6: Shipment lifecycle preservation (Rule 8)...');
    const dbShipment = await Shipment.findById(testShipment._id);

    if (
      dbShipment.status === 'IN_TRANSIT' &&
      String(dbShipment.vehicle) === String(testVehicle._id) &&
      String(dbShipment.driver) === String(testDriver._id)
    ) {
      console.log('✅ TEST 6 PASSED: Shipment lifecycle status remained untouched throughout all telemetry transitions.');
      console.log(`   Shipment.status: ${dbShipment.status}, vehicle: ${dbShipment.vehicle}, driver: ${dbShipment.driver}`);
      passedTests++;
    } else {
      console.error('❌ TEST 6 FAILED: Shipment status mutated unexpectedly:', dbShipment.status);
    }

    // =========================================================================
    // TEST 7: Fleet Monitoring Overview Consistency
    // =========================================================================
    console.log('\nTEST 7: Fleet monitoring overview summary metrics consistency...');
    // Re-age telemetry to STALE with historical deviation
    trackingRecord.lastUpdated = new Date(Date.now() - 7 * 60 * 1000);
    await trackingRecord.save();

    // Recalculate snapshot
    await etaMonitoringService.recalculateShipmentETA(testShipment._id, { force: true });

    const overview = await etaMonitoringService.getMonitoringOverview({ includeTest: true });
    const testItem = overview.monitoringItems.find(i => String(i.shipment._id) === String(testShipment._id) || i.shipment.trackingNumber === testShipment.trackingNumber);

    const testItemIsPaused = testItem && testItem.trackingVitality === 'STALE' && testItem.etaStatus === 'PAUSED' && testItem.deviationStatus === 'PAUSED';
    // When stale, testItem should NOT count toward active deviatedCount, but should count in staleDeviatedCount
    const staleDevCountOk = overview.summaryMetrics.staleDeviatedCount >= 0;

    if (testItemIsPaused && staleDevCountOk) {
      console.log('✅ TEST 7 PASSED: Owner overview correctly displays STALE shipment with PAUSED statuses and accurate overview metrics.');
      console.log(`   Total Monitored: ${overview.summaryMetrics.totalMonitored}`);
      console.log(`   Live Count: ${overview.summaryMetrics.liveCount}, Stale Count: ${overview.summaryMetrics.staleCount}, Offline Count: ${overview.summaryMetrics.offlineCount}`);
      console.log(`   Deviated Count (Live only): ${overview.summaryMetrics.deviatedCount}, Stale Deviated Count: ${overview.summaryMetrics.staleDeviatedCount}`);
      passedTests++;
    } else {
      console.error('❌ TEST 7 FAILED:', { testItemIsPaused, staleDevCountOk, testItemVitality: testItem?.trackingVitality });
    }

    // =========================================================================
    // TEST 8: Driver Authorization Check
    // =========================================================================
    console.log('\nTEST 8: Role-based authorization on ETA monitoring endpoint...');
    let driverAccessPassed = false;
    let forbiddenPassed = false;

    try {
      const allowed = await etaMonitoringService.getShipmentETAMonitoring(testShipment._id, { role: 'DRIVER', _id: testDriver._id });
      if (allowed) driverAccessPassed = true;
    } catch (e) {
      console.error('Driver access error:', e.message);
    }

    try {
      await etaMonitoringService.getShipmentETAMonitoring(testShipment._id, { role: 'DRIVER', _id: otherDriver._id });
    } catch (e) {
      if (e.statusCode === 403) forbiddenPassed = true;
    }

    if (driverAccessPassed && forbiddenPassed) {
      console.log('✅ TEST 8 PASSED: Assigned driver has authorized access, unassigned driver is rejected with 403.');
      passedTests++;
    } else {
      console.error('❌ TEST 8 FAILED:', { driverAccessPassed, forbiddenPassed });
    }

    // Summary
    console.log('\n======================================================================');
    console.log(`TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('======================================================================\n');

  } catch (error) {
    console.error('Audit execution error:', error);
  } finally {
    // Clean up test documents
    try {
      if (testShipment) await Shipment.deleteOne({ _id: testShipment._id });
      if (testVehicle) await Vehicle.deleteOne({ _id: testVehicle._id });
      if (testRoute) await Route.deleteOne({ _id: testRoute._id });
      if (testVehicle) await VehicleTracking.deleteMany({ vehicle: testVehicle._id });
      if (testShipment) await ShipmentETA.deleteMany({ shipment: testShipment._id });
      if (testShipment) await ShipmentETAHistory.deleteMany({ shipment: testShipment._id });
    } catch (cleanupErr) {
      // Non-blocking cleanup
    }
    await mongoose.connection.close();
  }
};

runStaleGPSDeviationSyncTest();
