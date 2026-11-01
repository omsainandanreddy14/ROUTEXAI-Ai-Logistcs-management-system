const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('./config/db');
const Shipment = require('./models/Shipment');
const { getAIDashboardOverview } = require('./controllers/aiDashboardController');

const runDashboardAudit = async () => {
  try {
    await connectDB();
    console.log('\n==================================================');
    console.log('PHASE 3G AI DASHBOARD BACKEND OVERVIEW AUDIT');
    console.log('==================================================\n');

    const targetTrackingIds = ['RXAI-2026-441930', 'RXAI-2026-653131', 'RXAI-2026-580780'];

    for (const trackingId of targetTrackingIds) {
      console.log(`\n--------------------------------------------------`);
      console.log(`TESTING AI DASHBOARD OVERVIEW: ${trackingId}`);
      console.log(`--------------------------------------------------`);

      const req = { query: { shipmentId: trackingId } };
      let responseData = null;
      const res = {
        json: (data) => {
          responseData = data;
        }
      };
      const next = (err) => {
        if (err) console.error('Controller Error:', err);
      };

      await getAIDashboardOverview(req, res, next);

      if (!responseData || !responseData.success) {
        console.error(`❌ Failed to fetch dashboard overview for ${trackingId}`);
        continue;
      }

      const d = responseData.data;
      console.log(`Tracking ID: ${d.trackingNumber}`);
      console.log(`Summary Metrics: Total=${d.summaryMetrics.totalShipments}, Active=${d.summaryMetrics.activeShipments}, Vehicles=${d.summaryMetrics.vehiclesAssigned}, Delivered=${d.summaryMetrics.deliveredShipments}`);
      console.log(`Services Status: ETA=${d.aiServicesStatus.eta}, DelayRisk=${d.aiServicesStatus.delayRisk}, Accessibility=${d.aiServicesStatus.accessibility}, RouteIntelligence=${d.aiServicesStatus.routeRecommendation}`);
      console.log(`Dataset Status: ${d.datasetStatus}`);

      // Weather (Phase 3A)
      console.log(`\n[Phase 3A Weather] Endpoint Risk: ${d.weather?.endpointRisk || 'LOW'}`);
      console.log(`  Pickup (${d.weather?.pickupCity}): ${d.weather?.pickupWeather?.temperature}°C | ${d.weather?.pickupWeather?.condition} | Risk: ${d.weather?.pickupWeather?.weatherRisk}`);
      console.log(`  Delivery (${d.weather?.deliveryCity}): ${d.weather?.deliveryWeather?.temperature}°C | ${d.weather?.deliveryWeather?.condition} | Risk: ${d.weather?.deliveryWeather?.weatherRisk}`);

      // ETA (Phase 3C)
      console.log(`\n[Phase 3C ETA] Status: ${d.eta?.modelStatus} | Engine: ${d.eta?.modelName}`);
      console.log(`  Baseline: ${d.eta?.baselineDurationMin} min | Predicted: ${d.eta?.predictedDurationMin} min | Diff: ${d.eta?.differenceFromBaselineMin} min`);

      // Delay Risk (Phase 3D)
      console.log(`\n[Phase 3D Delay Risk] Status: ${d.delayRisk?.modelStatus} | Risk Level: ${d.delayRisk?.riskLevel}`);
      console.log(`  Delay Prob: ${d.delayRisk?.delayProbability}% | On-Time: ${d.delayRisk?.onTimeProbability}% | Classification: ${d.delayRisk?.prediction}`);
      console.log(`  Top Key Factors (${d.delayRisk?.keyFactors?.length || 0}):`);
      (d.delayRisk?.keyFactors || []).slice(0, 3).forEach((kf) => {
        console.log(`    - ${kf.feature}: ${kf.importance}%`);
      });

      // Accessibility (Phase 3E)
      console.log(`\n[Phase 3E Accessibility] Available: ${d.accessibility?.available} | Score: ${d.accessibility?.score}/100 | Level: ${d.accessibility?.level}`);
      console.log(`  Vehicle: ${d.accessibility?.vehicleCompatibility} | Cargo: ${d.accessibility?.cargoCompatibility} | Risk: ${d.accessibility?.operationalRisk} | ETA Impact: ${d.accessibility?.etaImpact}`);

      // Route Recommendation (Phase 3F)
      if (d.routeRecommendation && d.routeRecommendation.recommendedRoute) {
        const rec = d.routeRecommendation.recommendedRoute;
        console.log(`\n[Phase 3F Route Recommendation] Recommended: ${rec.name} (Score: ${rec.recommendationScore}/100 | ${rec.recommendationLevel})`);
        console.log(`  Distance: ${rec.distanceKm} km | Predicted ETA: ${rec.predictedEtaMin} min | Delay Prob: ${rec.delayProbabilityPercent}% | Access Score: ${rec.accessibilityScore}`);
        console.log(`  Advantages: ${rec.positiveFactors?.join(' | ')}`);
        if (rec.warningFactors?.length > 0) console.log(`  Warnings: ${rec.warningFactors?.join(' | ')}`);
      }

      console.log(`\nMulti-Shipment Overview Table Entries: ${d.multiShipmentOverview?.length || 0}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Audit Error:', err);
    process.exit(1);
  }
};

runDashboardAudit();
