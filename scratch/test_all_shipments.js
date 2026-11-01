const dotenv = require('dotenv');
dotenv.config({ path: './backend/.env' });
const connectDB = require('./backend/config/db');
const Shipment = require('./backend/models/Shipment');
const etaService = require('./backend/services/etaService');
const delayRiskService = require('./backend/services/delayRiskService');
const accessibilityService = require('./backend/services/accessibilityService');
const routeRecommendationService = require('./backend/services/routeRecommendationService');

const runAudit = async () => {
  try {
    await connectDB();
    console.log('\n==================================================');
    console.log('PHASE 3F MULTI-SHIPMENT AUDIT & VERIFICATION');
    console.log('==================================================\n');

    const targetTrackingIds = ['RXAI-2026-441930', 'RXAI-2026-653131', 'RXAI-2026-580780'];

    for (const trackingId of targetTrackingIds) {
      console.log(`\n--------------------------------------------------`);
      console.log(`AUDITING SHIPMENT: ${trackingId}`);
      console.log(`--------------------------------------------------`);

      const shipment = await Shipment.findOne({
        $or: [{ trackingId }, { trackingNumber: trackingId }]
      }).populate('vehicle').populate('driver').populate('route');

      if (!shipment) {
        console.error(`❌ Shipment ${trackingId} NOT FOUND in MongoDB!`);
        continue;
      }

      console.log(`ID: ${shipment._id}`);
      console.log(`Pickup: ${shipment.pickupAddress?.city || shipment.pickupCity || 'Origin'}`);
      console.log(`Delivery: ${shipment.deliveryAddress?.city || shipment.deliveryCity || 'Dest'}`);
      console.log(`Weight: ${shipment.weightKg} kg | Package Type: ${shipment.packageType} | Priority: ${shipment.priority}`);
      console.log(`Assigned Vehicle: ${shipment.vehicle ? shipment.vehicle.registrationNumber + ' (' + shipment.vehicle.capacityKg + 'kg)' : 'None'}`);
      console.log(`Assigned Driver: ${shipment.driver ? shipment.driver.name + ' (' + shipment.driver.experienceYears + ' yrs exp)' : 'None'}`);

      // 1. ETA Test
      const etaRes = await etaService.predictShipmentETA(shipment);
      console.log(`\n[Phase 3C ETA] Status: ${etaRes.modelStatus} | ML Available: ${etaRes.mlEtaAvailable}`);
      console.log(`  Baseline: ${etaRes.baselineDurationMin} min | Predicted: ${etaRes.predictedDurationMin} min | Diff: ${etaRes.differenceFromBaselineMin} min`);
      if (etaRes.fallbackReason) console.log(`  Fallback Reason: ${etaRes.fallbackReason}`);

      // 2. Delay Risk Test
      const riskRes = await delayRiskService.predictShipmentDelayRisk(shipment);
      console.log(`\n[Phase 3D Delay Risk] Status: ${riskRes.modelStatus} | Available: ${riskRes.riskAvailable}`);
      console.log(`  Risk Level: ${riskRes.riskLevel} | Delay Prob: ${riskRes.delayProbability}% | On-Time: ${riskRes.onTimeProbability}% | Prediction: ${riskRes.prediction}`);
      if (riskRes.reason) console.log(`  Fallback Reason: ${riskRes.reason}`);

      // 3. Accessibility Test
      const accessRes = await accessibilityService.evaluateShipmentAccessibility(shipment);
      console.log(`\n[Phase 3E Accessibility] Available: ${accessRes.available} | Score: ${accessRes.score}/100 | Level: ${accessRes.level}`);
      console.log(`  Vehicle Compat: ${accessRes.vehicleCompatibility} | Cargo Compat: ${accessRes.cargoCompatibility}`);
      console.log(`  Operational Risk: ${accessRes.operationalRisk} | ETA Impact: ${accessRes.etaImpact}`);

      // 4. Recommendation Test
      const recRes = await routeRecommendationService.recommendRouteForShipment(shipment._id);
      console.log(`\n[Phase 3F Recommendation] Recommended Route: ${recRes.recommendedRoute.name} (Score: ${recRes.recommendedRoute.recommendationScore}/100)`);
      console.log(`  Recommendation Level: ${recRes.recommendedRoute.recommendationLevel}`);
      console.log(`  Key Advantages: ${recRes.recommendedRoute.positiveFactors.join(' | ')}`);
      if (recRes.recommendedRoute.warningFactors.length > 0) {
        console.log(`  Warnings: ${recRes.recommendedRoute.warningFactors.join(' | ')}`);
      }

      console.log(`\n  All Candidates Comparative Breakdown:`);
      recRes.candidateRoutes.forEach((c, idx) => {
        console.log(`    Route #${idx + 1}: ${c.name}`);
        console.log(`      Score: ${c.recommendationScore}/100 (Disqualified: ${c.disqualified})`);
        console.log(`      Distance: ${c.distanceKm} km | Duration: ${c.durationMinutes} min | Predicted ETA: ${c.predictedEtaMin} min`);
        console.log(`      Delay Prob: ${Math.round(c.delayProbability * 100)}% | Access Score: ${c.accessibilityScore}/100 | Weather: ${c.weatherRisk}`);
        console.log(`      Breakdown -> Quality(25%): ${c.scoreBreakdown.qualityScore.raw} (${c.scoreBreakdown.qualityScore.points}pts), ETA(20%): ${c.scoreBreakdown.etaEfficiency.raw} (${c.scoreBreakdown.etaEfficiency.points}pts), Delay(20%): ${c.scoreBreakdown.delayRiskScore.raw} (${c.scoreBreakdown.delayRiskScore.points}pts), Access(20%): ${c.scoreBreakdown.accessibilityScore.raw} (${c.scoreBreakdown.accessibilityScore.points}pts), Dist(10%): ${c.scoreBreakdown.distanceEfficiency.raw} (${c.scoreBreakdown.distanceEfficiency.points}pts), Weather(5%): ${c.scoreBreakdown.weatherScore.raw} (${c.scoreBreakdown.weatherScore.points}pts)`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('Audit Error:', err);
    process.exit(1);
  }
};

runAudit();
