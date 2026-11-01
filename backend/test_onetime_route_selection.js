const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Shipment = require('./models/Shipment');
const Route = require('./models/Route');
const User = require('./models/User');
const Vehicle = require('./models/Vehicle');
const Driver = require('./models/Driver');
const Hub = require('./models/Hub');
const routeController = require('./controllers/routeController');
const routeService = require('./services/routeService');

// Mock Express req, res, next
function createMockReqRes(user, body = {}, params = {}) {
  const req = { user, body, params };
  const res = {
    statusCode: 200,
    headersSent: false,
    _json: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this._json = data;
      return this;
    }
  };
  const next = (err) => {
    if (err) throw err;
  };
  return { req, res, next };
}

async function runTests() {
  console.log('====================================================');
  console.log('ROUTEXAI: ONE-TIME ROUTE SELECTION & INTEGRITY TESTS');
  console.log('====================================================\n');

  try {
    await connectDB();
    console.log('✓ Connected to MongoDB Atlas');

    // 1. Fetch Owner User & Driver User
    const ownerUser = await User.findOne({ role: 'OWNER' });
    const driverUser = await User.findOne({ role: 'DRIVER' });

    if (!ownerUser) {
      throw new Error('No user with role OWNER found in database.');
    }
    console.log(`✓ Owner user verified: ${ownerUser.name} (${ownerUser.email})`);

    // 2. Fetch or create a test shipment
    let testShipment = await Shipment.findOne({ status: { $ne: 'DELIVERED' } })
      .populate('route');

    if (!testShipment) {
      testShipment = await Shipment.findOne().populate('route');
    }

    if (!testShipment) {
      throw new Error('No shipment found in database to test.');
    }

    console.log(`✓ Target shipment identified: ${testShipment.trackingId || testShipment.trackingNumber} (${testShipment._id})`);

    // Ensure clean initial state for this test shipment
    await Route.deleteMany({ shipment: testShipment._id });
    testShipment.route = null;
    await testShipment.save();
    console.log('✓ Reset existing routes for test shipment to clean baseline');

    // TEST 1: Role authorization - Driver attempting route selection
    console.log('\n--- TEST 1: Role Authorization Check ---');
    if (driverUser) {
      const { req: driverReq, res: driverRes, next: driverNext } = createMockReqRes(driverUser, {
        shipmentId: testShipment._id.toString(),
        routeData: { name: 'Test Route', distanceKm: 500, durationMinutes: 300 }
      });
      await routeController.selectRoute(driverReq, driverRes, driverNext);
      if (driverRes.statusCode === 403) {
        console.log('✓ PASS: Driver was correctly blocked with HTTP 403 Forbidden');
      } else {
        throw new Error(`Expected HTTP 403, got ${driverRes.statusCode}`);
      }
    } else {
      console.log('ℹ SKIP: No DRIVER user found to test role check');
    }

    // TEST 2: Calculate candidate routes
    console.log('\n--- TEST 2: Calculate Candidate Routes (Pre-Selection) ---');
    const { req: calcReq, res: calcRes, next: calcNext } = createMockReqRes(ownerUser, {
      shipmentId: testShipment._id.toString()
    });
    await routeController.calculateRoutes(calcReq, calcRes, calcNext);

    if (calcRes.statusCode !== 200 || !calcRes._json?.success) {
      throw new Error(`Calculate candidate routes failed: ${JSON.stringify(calcRes._json)}`);
    }

    const candidateRoutes = calcRes._json.data.routes;
    console.log(`✓ Generated ${candidateRoutes.length} candidate routes`);
    if (candidateRoutes.length < 2) {
      throw new Error(`Expected at least 2 candidate routes, got ${candidateRoutes.length}`);
    }

    const routeA = candidateRoutes[0];
    const routeB = candidateRoutes[1];

    console.log(`  Candidate 1: "${routeA.name}" | Status: ${routeA.status} | isSelected: ${routeA.isSelected}`);
    console.log(`  Candidate 2: "${routeB.name}" | Status: ${routeB.status} | isSelected: ${routeB.isSelected}`);

    if (routeA.status !== 'CALCULATED' || routeB.status !== 'CALCULATED') {
      throw new Error('Initial candidates must have status: CALCULATED prior to selection.');
    }
    if (routeA.isSelected || routeB.isSelected) {
      throw new Error('Initial candidates must not be marked isSelected: true prior to selection.');
    }
    console.log('✓ PASS: Candidate routes generated as CALCULATED without premature selection');

    // TEST 3: Select Route A for the first time
    console.log('\n--- TEST 3: Select Route A (First Selection) ---');
    const { req: selReq1, res: selRes1, next: selNext1 } = createMockReqRes(ownerUser, {
      shipmentId: testShipment._id.toString(),
      routeData: routeA
    });
    await routeController.selectRoute(selReq1, selRes1, selNext1);

    if (selRes1.statusCode !== 200 || !selRes1._json?.success) {
      throw new Error(`First route selection failed: ${JSON.stringify(selRes1._json)}`);
    }
    console.log(`✓ Response: "${selRes1._json.message}"`);

    // Verify database state
    const savedSelectedRoute = await Route.findOne({ shipment: testShipment._id, status: 'SELECTED' });
    if (!savedSelectedRoute) {
      throw new Error('No route with status: SELECTED found in database for test shipment.');
    }
    console.log(`✓ Database record created: Route ID ${savedSelectedRoute._id} with status: ${savedSelectedRoute.status}`);

    const updatedShipment = await Shipment.findById(testShipment._id);
    if (String(updatedShipment.route) !== String(savedSelectedRoute._id)) {
      throw new Error(`Shipment route reference mismatch: expected ${savedSelectedRoute._id}, got ${updatedShipment.route}`);
    }
    console.log(`✓ Shipment successfully linked: shipment.route = ${updatedShipment.route}`);
    console.log('✓ PASS: Route A selected and linked to shipment');

    // TEST 4: Idempotent re-click on Route A
    console.log('\n--- TEST 4: Idempotent Re-Click on Same Route (Route A) ---');
    const { req: selReq2, res: selRes2, next: selNext2 } = createMockReqRes(ownerUser, {
      shipmentId: testShipment._id.toString(),
      routeData: routeA
    });
    await routeController.selectRoute(selReq2, selRes2, selNext2);

    if (selRes2.statusCode !== 200 || !selRes2._json?.success) {
      throw new Error(`Idempotent re-click failed: ${JSON.stringify(selRes2._json)}`);
    }
    if (!selRes2._json.alreadySelected) {
      throw new Error('Expected alreadySelected: true in response');
    }
    console.log(`✓ Response: "${selRes2._json.message}" (alreadySelected: true)`);

    const selectedRoutesCount = await Route.countDocuments({ shipment: testShipment._id, status: 'SELECTED' });
    if (selectedRoutesCount !== 1) {
      throw new Error(`Duplicate routes created! Expected 1 SELECTED route, found ${selectedRoutesCount}`);
    }
    console.log(`✓ Database integrity maintained: Exactly ${selectedRoutesCount} SELECTED route exists for shipment`);
    console.log('✓ PASS: Idempotent re-selection succeeded with zero duplicate records');

    // TEST 5: One-Time Selection Enforcement - Attempt to select Route B
    console.log('\n--- TEST 5: One-Time Selection Enforcement (Attempting Route B) ---');
    const { req: selReq3, res: selRes3, next: selNext3 } = createMockReqRes(ownerUser, {
      shipmentId: testShipment._id.toString(),
      routeData: routeB
    });
    await routeController.selectRoute(selReq3, selRes3, selNext3);

    if (selRes3.statusCode !== 400) {
      throw new Error(`Expected HTTP 400 Bad Request, got ${selRes3.statusCode}`);
    }
    if (selRes3._json?.message !== 'A route has already been selected for this shipment.') {
      throw new Error(`Expected message 'A route has already been selected for this shipment.', got '${selRes3._json?.message}'`);
    }
    console.log(`✓ Correctly rejected with HTTP 400: "${selRes3._json.message}"`);

    const currentSelectedRoute = await Route.findOne({ shipment: testShipment._id, status: 'SELECTED' });
    if (String(currentSelectedRoute._id) !== String(savedSelectedRoute._id)) {
      throw new Error('Selected route was unexpectedly overwritten!');
    }
    console.log(`✓ PASS: Route B blocked; Route A remains the locked selection (${currentSelectedRoute.routeName})`);

    // TEST 6: MongoDB Partial Unique Index Enforcement
    console.log('\n--- TEST 6: Database Unique Index Constraint ---');
    let indexEnforced = false;
    try {
      // Direct raw Mongoose insert of a second SELECTED route for the same shipment
      await Route.collection.insertOne({
        shipment: testShipment._id,
        source: { latitude: 28.6, longitude: 77.2 },
        destination: { latitude: 19.0, longitude: 72.8 },
        distanceKm: 999,
        estimatedDurationMinutes: 600,
        score: 85,
        geometry: { type: 'LineString', coordinates: [[77.2, 28.6], [72.8, 19.0]] },
        routeName: 'Illegal Second Selected Route',
        status: 'SELECTED',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (dbErr) {
      if (dbErr.code === 11000 || dbErr.message.includes('E11000 duplicate key error')) {
        indexEnforced = true;
        console.log(`✓ MongoDB driver rejected duplicate SELECTED route with error E11000: duplicate key`);
      } else {
        throw dbErr;
      }
    }

    if (!indexEnforced) {
      throw new Error('Partial unique index failed to prevent insertion of second SELECTED route!');
    }
    console.log('✓ PASS: MongoDB partial unique index strictly prevents duplicate SELECTED routes');

    // TEST 7: Calculate Candidate Routes Post-Selection (Persistence)
    console.log('\n--- TEST 7: Candidate Route Status Reflection After Selection ---');
    const { req: calcReq2, res: calcRes2, next: calcNext2 } = createMockReqRes(ownerUser, {
      shipmentId: testShipment._id.toString()
    });
    await routeController.calculateRoutes(calcReq2, calcRes2, calcNext2);

    const postRoutes = calcRes2._json.data.routes;
    const postRouteA = postRoutes[0];
    const postRouteB = postRoutes[1];

    console.log(`  Candidate 1: "${postRouteA.name}" | Status: ${postRouteA.status} | isSelected: ${postRouteA.isSelected}`);
    console.log(`  Candidate 2: "${postRouteB.name}" | Status: ${postRouteB.status} | isSelected: ${postRouteB.isSelected}`);

    if (postRouteA.status !== 'SELECTED' || !postRouteA.isSelected) {
      throw new Error('Candidate matching Route A must reflect status: SELECTED and isSelected: true');
    }
    if (postRouteB.status !== 'CALCULATED' || postRouteB.isSelected) {
      throw new Error('Alternative Route B must reflect status: CALCULATED and isSelected: false');
    }
    if (!calcRes2._json.data.hasSelectedRoute) {
      throw new Error('calcRes2._json.data.hasSelectedRoute must be true');
    }
    console.log('✓ PASS: Calculate routes post-selection accurately marks Route A as SELECTED and Route B as CALCULATED');

    console.log('\n====================================================');
    console.log('ALL ONE-TIME ROUTE SELECTION TESTS PASSED (7/7)!');
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB Atlas');
  }
}

runTests();
