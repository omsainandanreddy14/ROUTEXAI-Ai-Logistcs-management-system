const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

dotenv.config();

const Shipment = require('./models/Shipment');
const User = require('./models/User');
const Route = require('./models/Route');
const pricingService = require('./services/pricingService');
const pricingConfig = require('./config/pricingConfig');
const shipmentController = require('./controllers/shipmentController');
const routeController = require('./controllers/routeController');

const runDynamicPricingTests = async () => {
  let passedTests = 0;
  let totalTests = 10;
  const createdShipmentIds = [];
  const createdRouteIds = [];

  try {
    await connectDB();

    console.log('\n======================================================================');
    console.log('ROUTEXAI — DYNAMIC FREIGHT PRICING AUTOMATED TEST SUITE');
    console.log('======================================================================\n');

    // -------------------------------------------------------------------------
    // TEST 1: Category Handling Surcharges & Hierarchy
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Category Handling Surcharges & Hierarchy ---');
    const dist = 500;
    const wt = 200;

    const quoteStd = pricingService.calculateFreightQuote({ distanceKm: dist, weightKg: wt, goodsCategory: 'STANDARD' });
    const quoteFrag = pricingService.calculateFreightQuote({ distanceKm: dist, weightKg: wt, goodsCategory: 'FRAGILE' });
    const quoteElec = pricingService.calculateFreightQuote({ distanceKm: dist, weightKg: wt, goodsCategory: 'ELECTRONICS' });
    const quotePerish = pricingService.calculateFreightQuote({ distanceKm: dist, weightKg: wt, goodsCategory: 'PERISHABLE' });

    console.log(`Standard freight quote:    ₹${quoteStd.totalFreightQuote} (handling: ₹${quoteStd.breakdown.goodsHandlingCharge})`);
    console.log(`Fragile freight quote:     ₹${quoteFrag.totalFreightQuote} (handling: ₹${quoteFrag.breakdown.goodsHandlingCharge})`);
    console.log(`Electronics freight quote: ₹${quoteElec.totalFreightQuote} (handling: ₹${quoteElec.breakdown.goodsHandlingCharge})`);
    console.log(`Perishable freight quote:  ₹${quotePerish.totalFreightQuote} (handling: ₹${quotePerish.breakdown.goodsHandlingCharge})`);

    const hierarchyValid =
      quoteStd.totalFreightQuote < quoteFrag.totalFreightQuote &&
      quoteFrag.totalFreightQuote < quoteElec.totalFreightQuote &&
      quoteElec.totalFreightQuote < quotePerish.totalFreightQuote;

    if (hierarchyValid && quoteStd.breakdown.goodsHandlingCharge === 0) {
      console.log('✔ PASS: Category handling charges correctly scale: STANDARD < FRAGILE < ELECTRONICS < PERISHABLE');
      passedTests++;
    } else {
      console.error('❌ FAIL: Category handling hierarchy failed');
    }

    // -------------------------------------------------------------------------
    // TEST 2: Weight Scaling & Ton-Km Distance Factor
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Weight Scaling & Ton-Km Distance Factor ---');
    const testDist = 400; // factor = 4.0
    const q100 = pricingService.calculateFreightQuote({ distanceKm: testDist, weightKg: 100, goodsCategory: 'STANDARD' });
    const q200 = pricingService.calculateFreightQuote({ distanceKm: testDist, weightKg: 200, goodsCategory: 'STANDARD' });
    const q400 = pricingService.calculateFreightQuote({ distanceKm: testDist, weightKg: 400, goodsCategory: 'STANDARD' });

    console.log(`100 kg weight charge: ₹${q100.breakdown.weightCharge} (expected ₹600)`);
    console.log(`200 kg weight charge: ₹${q200.breakdown.weightCharge} (expected ₹1200)`);
    console.log(`400 kg weight charge: ₹${q400.breakdown.weightCharge} (expected ₹2400)`);

    if (
      q100.breakdown.weightCharge === 600 &&
      q200.breakdown.weightCharge === 1200 &&
      q400.breakdown.weightCharge === 2400
    ) {
      console.log('✔ PASS: Weight charge scales linearly with weight and distance factor');
      passedTests++;
    } else {
      console.error('❌ FAIL: Weight charge calculation mismatch');
    }

    // -------------------------------------------------------------------------
    // TEST 3: Distance Scaling & Minimum Quote Floor
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Distance Scaling & Minimum Quote Floor ---');
    const q250km = pricingService.calculateFreightQuote({ distanceKm: 250, weightKg: 100, goodsCategory: 'STANDARD' });
    const q500km = pricingService.calculateFreightQuote({ distanceKm: 500, weightKg: 100, goodsCategory: 'STANDARD' });

    console.log(`250 km distance charge: ₹${q250km.breakdown.distanceCharge} (expected ₹4500)`);
    console.log(`500 km distance charge: ₹${q500km.breakdown.distanceCharge} (expected ₹9000)`);

    const qFloor = pricingService.calculateFreightQuote({ distanceKm: 1, weightKg: 1, goodsCategory: 'STANDARD' });
    console.log(`Micro-trip total: ₹${qFloor.totalFreightQuote} (minimumChargeApplied: ${qFloor.breakdown.minimumChargeApplied})`);

    if (
      q250km.breakdown.distanceCharge === 4500 &&
      q500km.breakdown.distanceCharge === 9000 &&
      qFloor.totalFreightQuote === 500 &&
      qFloor.breakdown.minimumChargeApplied === true
    ) {
      console.log('✔ PASS: Distance charge scales accurately and minimum freight guarantee floor (₹500) is enforced');
      passedTests++;
    } else {
      console.error('❌ FAIL: Distance charge or minimum quote floor mismatch');
    }

    // -------------------------------------------------------------------------
    // TEST 4: Multi-Candidate Road Route Integration
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Multi-Candidate Road Route Integration ---');
    const hyd = { latitude: 17.3850, longitude: 78.4867 };
    const chn = { latitude: 13.0827, longitude: 80.2707 };

    const coordQuote = await pricingService.getQuoteForCoordinates({
      source: hyd,
      destination: chn,
      weightKg: 350,
      goodsCategory: 'ELECTRONICS',
      quantity: 10
    });

    console.log(`Candidates generated: ${coordQuote.candidateQuotes.length}`);
    coordQuote.candidateQuotes.forEach((cq, i) => {
      console.log(`  Candidate ${i + 1} (${cq.name}): ${cq.distanceKm.toFixed(1)} km -> ₹${cq.quote.totalFreightQuote}`);
    });

    if (
      coordQuote.candidateQuotes &&
      coordQuote.candidateQuotes.length >= 1 &&
      coordQuote.primaryQuote.totalFreightQuote > 0 &&
      (coordQuote.primaryQuote.distanceKm > 400 || coordQuote.primaryQuote.breakdown?.distanceKm > 400)
    ) {
      console.log('✔ PASS: Candidate road routes calculated with verified distance and dynamic quotes for each');
      passedTests++;
    } else {
      console.error('❌ FAIL: Multi-candidate road route integration failed', {
        candidates: coordQuote.candidateQuotes?.length,
        primaryQuote: coordQuote.primaryQuote
      });
    }

    // -------------------------------------------------------------------------
    // TEST 5: Validation for Missing, Zero, or Negative Weights
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Validation for Zero / Negative Weights ---');
    const qZero = pricingService.calculateFreightQuote({ distanceKm: 100, weightKg: 0, goodsCategory: 'STANDARD' });
    const qNeg = pricingService.calculateFreightQuote({ distanceKm: 100, weightKg: -25, goodsCategory: 'STANDARD' });
    const qNaN = pricingService.calculateFreightQuote({ distanceKm: 100, weightKg: 'abc', goodsCategory: 'STANDARD' });

    if (qZero.quoteUnavailable && qNeg.quoteUnavailable && qNaN.quoteUnavailable) {
      console.log('✔ PASS: Zero, negative, and invalid weights safely rejected with quoteUnavailable: true');
      passedTests++;
    } else {
      console.error('❌ FAIL: Invalid weights were not properly rejected');
    }

    // -------------------------------------------------------------------------
    // TEST 6: Hazardous Goods Policy Restriction
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Hazardous Goods Policy Restriction ---');
    const qHaz = pricingService.calculateFreightQuote({
      distanceKm: 500,
      weightKg: 200,
      goodsCategory: 'HAZARDOUS'
    });

    console.log('Hazardous quote result:', {
      quoteUnavailable: qHaz.quoteUnavailable,
      error: qHaz.error,
      message: qHaz.message?.substring(0, 70) + '...'
    });

    if (
      qHaz.quoteUnavailable === true &&
      qHaz.error === 'HAZMAT_RESTRICTED' &&
      typeof qHaz.message === 'string' &&
      qHaz.message.includes('restricted')
    ) {
      console.log('✔ PASS: Hazardous cargo correctly rejected with HAZMAT_RESTRICTED policy error');
      passedTests++;
    } else {
      console.error('❌ FAIL: Hazardous cargo policy restriction failed');
    }

    // -------------------------------------------------------------------------
    // TEST 7: Backend Shipment Controller Hazmat Policy Enforcement
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Shipment Controller Hazmat Policy Enforcement ---');
    let testCustomer = await User.findOne({ role: 'CUSTOMER' });
    if (!testCustomer) {
      testCustomer = await User.create({
        name: 'Pricing Test Customer',
        email: `pricing.customer.${Date.now()}@routexai.com`,
        password: 'hashedpassword123',
        role: 'CUSTOMER'
      });
    }

    let hazmatBlockedStatus = null;
    let hazmatBlockedError = null;

    const mockHazmatReq = {
      user: testCustomer,
      body: {
        pickupLocation: { coordinates: [78.4867, 17.3850] },
        deliveryLocation: { coordinates: [80.2707, 13.0827] },
        pickupAddress: { street: 'Jubilee Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
        deliveryAddress: { street: 'MG Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
        weightKg: 250,
        quantity: 5,
        cargoType: 'Chemical Reagents',
        packageType: 'HAZARDOUS'
      }
    };

    const mockHazmatRes = {
      status: function (code) {
        hazmatBlockedStatus = code;
        return this;
      },
      json: function (data) {
        hazmatBlockedError = data;
        return this;
      }
    };

    await shipmentController.createShipment(mockHazmatReq, mockHazmatRes, () => {});

    console.log('Controller Hazmat Response status:', hazmatBlockedStatus, 'error:', hazmatBlockedError?.error);

    if (hazmatBlockedStatus === 400 && hazmatBlockedError?.error === 'HAZMAT_RESTRICTED') {
      console.log('✔ PASS: Shipment controller blocked automated hazmat booking with HTTP 400 and HAZMAT_RESTRICTED');
      passedTests++;
    } else {
      console.error('❌ FAIL: Shipment controller did not reject hazardous cargo');
    }

    // -------------------------------------------------------------------------
    // TEST 8: Shipment Creation with Dynamic Pricing Persistence
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Shipment Creation with Dynamic Pricing Persistence ---');
    let createdShipmentData = null;

    const mockValidReq = {
      user: testCustomer,
      body: {
        pickupLocation: { coordinates: [78.4867, 17.3850] },
        deliveryLocation: { coordinates: [80.2707, 13.0827] },
        pickupAddress: { street: 'HiTech City', city: 'Hyderabad', state: 'Telangana', pincode: '500081' },
        deliveryAddress: { street: 'Guindy Industrial Estate', city: 'Chennai', state: 'Tamil Nadu', pincode: '600032' },
        weightKg: 300,
        quantity: 3,
        cargoType: 'Semiconductor Wafers',
        packageType: 'ELECTRONICS'
      }
    };

    const mockValidRes = {
      status: function (code) {
        return this;
      },
      json: function (data) {
        createdShipmentData = data?.data || data?.shipment;
        return this;
      }
    };

    await shipmentController.createShipment(mockValidReq, mockValidRes, (err) => {
      if (err) console.error('Shipment creation controller error:', err);
    });

    if (createdShipmentData && createdShipmentData._id) {
      createdShipmentIds.push(createdShipmentData._id);

      const savedShipment = await Shipment.findById(createdShipmentData._id);
      console.log(`Saved shipment estimatedCost: ₹${savedShipment.estimatedCost}`);
      console.log('Saved pricingDetails:', {
        distanceKm: savedShipment.pricingDetails?.distanceKm,
        distanceCharge: savedShipment.pricingDetails?.distanceCharge,
        weightCharge: savedShipment.pricingDetails?.weightCharge,
        goodsHandlingCharge: savedShipment.pricingDetails?.goodsHandlingCharge,
        configVersion: savedShipment.pricingDetails?.configVersion
      });

      if (
        savedShipment.estimatedCost > 0 &&
        savedShipment.pricingDetails &&
        savedShipment.pricingDetails.distanceCharge > 0 &&
        savedShipment.pricingDetails.goodsHandlingCharge > 0 &&
        savedShipment.pricingDetails.configVersion
      ) {
        console.log('✔ PASS: Shipment persisted with verified dynamic estimatedCost and full pricingDetails breakdown');
        passedTests++;
      } else {
        console.error('❌ FAIL: Saved shipment missing pricingDetails or estimatedCost');
      }
    } else {
      console.error('❌ FAIL: Could not create valid test shipment');
    }

    // -------------------------------------------------------------------------
    // TEST 9: Route Selection Pricing Resynchronization
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Route Selection Pricing Resynchronization ---');
    if (createdShipmentData && createdShipmentData._id) {
      const shipId = createdShipmentData._id;

      let testOwner = await User.findOne({ role: 'OWNER' });
      if (!testOwner) {
        testOwner = await User.create({
          name: 'Pricing Test Owner',
          email: `pricing.owner.${Date.now()}@routexai.com`,
          password: 'hashedpassword123',
          role: 'OWNER'
        });
      }

      let selectResStatus = null;
      let selectResBody = null;

      const mockSelectReq = {
        user: testOwner,
        body: {
          shipmentId: shipId,
          routeData: {
            name: 'Route B - Bypass Corridor',
            distanceKm: 650,
            durationMinutes: 560,
            score: 82,
            geometry: {
              type: 'LineString',
              coordinates: [[78.4867, 17.3850], [79.0, 15.0], [80.2707, 13.0827]]
            }
          }
        }
      };

      const mockSelectRes = {
        status: function (code) {
          selectResStatus = code;
          return this;
        },
        json: function (data) {
          selectResBody = data;
          return this;
        }
      };

      await routeController.selectRoute(mockSelectReq, mockSelectRes, (err) => {
        if (err) console.error('selectRoute controller error:', err);
      });

      if (selectResBody?.data?.route?._id) {
        createdRouteIds.push(selectResBody.data.route._id);
      }

      const updatedShipment = await Shipment.findById(shipId);
      console.log(`Updated shipment estimatedCost on Route B selection: ₹${updatedShipment.estimatedCost}`);
      console.log(`Updated pricingDetails distance: ${updatedShipment.pricingDetails?.distanceKm} km (expected 650 km)`);

      const expectedQuoteFor650km = pricingService.calculateFreightQuote({
        distanceKm: 650,
        weightKg: updatedShipment.weightKg,
        goodsCategory: updatedShipment.packageType,
        quantity: updatedShipment.quantity
      });

      if (
        updatedShipment.estimatedCost === expectedQuoteFor650km.totalFreightQuote &&
        updatedShipment.pricingDetails?.distanceKm === 650
      ) {
        console.log('✔ PASS: Route selection resynchronized shipment estimatedCost and pricingDetails to Route B exact distance (650 km)');
        passedTests++;
      } else {
        console.error('❌ FAIL: Route selection did not resynchronize shipment pricing');
      }
    } else {
      console.error('❌ SKIP: Test 9 skipped due to earlier failure');
    }

    // -------------------------------------------------------------------------
    // TEST 10: Idempotency & Clean Database Invariance
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Quote Idempotency & DB Cleanliness ---');
    const shipmentCountBefore = await Shipment.countDocuments();
    const routeCountBefore = await Route.countDocuments();

    for (let i = 0; i < 3; i++) {
      pricingService.calculateFreightQuote({ distanceKm: 420, weightKg: 150, goodsCategory: 'STANDARD' });
      await pricingService.getQuoteForCoordinates({
        source: hyd,
        destination: chn,
        weightKg: 150,
        goodsCategory: 'STANDARD'
      });
    }

    const shipmentCountAfter = await Shipment.countDocuments();
    const routeCountAfter = await Route.countDocuments();

    if (shipmentCountBefore === shipmentCountAfter && routeCountBefore === routeCountAfter) {
      console.log('✔ PASS: Quote generation is strictly idempotent and creates zero database artifacts');
      passedTests++;
    } else {
      console.error('❌ FAIL: Database count changed during stateless quote calculations');
    }

  } catch (err) {
    console.error('Unexpected test suite error:', err);
  } finally {
    try {
      if (createdShipmentIds.length > 0) {
        await Shipment.deleteMany({ _id: { $in: createdShipmentIds } });
        console.log(`\nCleaned up ${createdShipmentIds.length} test shipment(s).`);
      }
      if (createdRouteIds.length > 0) {
        await Route.deleteMany({ _id: { $in: createdRouteIds } });
        console.log(`Cleaned up ${createdRouteIds.length} test route(s).`);
      }
    } catch (cleanErr) {
      console.warn('Cleanup error:', cleanErr.message);
    }

    console.log('\n======================================================================');
    console.log(`FINAL RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(0)}%)`);
    console.log('======================================================================\n');

    await mongoose.connection.close();
    process.exit(passedTests === totalTests ? 0 : 1);
  }
};

runDynamicPricingTests();
