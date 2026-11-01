const Shipment = require('../models/Shipment');
const Route = require('../models/Route');
const Vehicle = require('../models/Vehicle');
const weatherService = require('../services/weatherService');
const etaService = require('../services/etaService');
const delayRiskService = require('../services/delayRiskService');
const accessibilityService = require('../services/accessibilityService');
const routeRecommendationService = require('../services/routeRecommendationService');

/**
 * Owner AI Dashboard Controller (Phase 3G)
 * Aggregates presentation-layer outputs from existing Phase 3A-3F services.
 */
const getAIDashboardOverview = async (req, res, next) => {
  try {
    const { shipmentId } = req.query;

    // 1. Fetch all shipments for metrics & selection list
    const allShipments = await Shipment.find()
      .populate('vehicle')
      .populate('driver')
      .populate('route')
      .sort({ createdAt: -1 });

    const totalShipments = allShipments.length;
    const activeShipments = allShipments.filter((s) => ['CREATED', 'PENDING', 'CONFIRMED', 'IN_TRANSIT'].includes(s.status)).length;
    const vehiclesAssigned = allShipments.filter((s) => s.vehicle).length;
    const deliveredShipments = allShipments.filter((s) => s.status === 'DELIVERED').length;
    const routesAnalyzed = allShipments.filter((s) => s.route || s.selectedRouteGeometry).length || totalShipments;
    const recommendedRoutesCount = totalShipments;

    // 2. Select target shipment
    let targetShipment = null;
    if (shipmentId) {
      targetShipment = allShipments.find(
        (s) => s._id.toString() === shipmentId || s.trackingId === shipmentId || s.trackingNumber === shipmentId
      );
    }
    if (!targetShipment && allShipments.length > 0) {
      targetShipment = allShipments[0];
    }

    if (!targetShipment) {
      return res.json({
        success: true,
        data: {
          summaryMetrics: {
            totalShipments: 0,
            activeShipments: 0,
            vehiclesAssigned: 0,
            deliveredShipments: 0,
            routesAnalyzed: 0,
            recommendedRoutes: 0
          },
          allShipmentsList: [],
          shipment: null,
          weather: null,
          eta: null,
          delayRisk: null,
          accessibility: null,
          routeRecommendation: null,
          multiShipmentOverview: [],
          generatedAt: new Date()
        }
      });
    }

    // 3. Query Phase 3F Recommendation first to get the winning recommended candidate route context
    const recRes = await routeRecommendationService.recommendRouteForShipment(targetShipment._id).catch(() => null);
    const recRoute = recRes?.recommendedRoute;

    // Prepare candidate route overrides so Phase 3C, 3D, and 3E reflect the SAME candidate route evaluated by 3F
    const candidateOptions = recRoute ? {
      distanceKm: recRoute.distanceKm,
      expectedDurationMin: recRoute.durationMinutes,
      routeScore: recRoute.scoreBreakdown?.qualityScore?.raw || 85
    } : {};

    // 4. Query Phase 3A, 3C, 3D, 3E services concurrently using target shipment & candidate route overrides
    const [weatherRes, etaRes, delayRiskRes, accessRes] = await Promise.all([
      weatherService.getShipmentEndpointWeather(targetShipment).catch(() => null),
      etaService.predictShipmentETA(targetShipment, candidateOptions).catch((err) => ({
        success: true,
        mlEtaAvailable: false,
        modelStatus: 'FALLBACK',
        fallbackReason: err.message,
        baselineDurationMin: targetShipment.estimatedDurationMinutes || 100,
        predictedDurationMin: targetShipment.estimatedDurationMinutes || 100,
        differenceFromBaselineMin: 0,
        modelName: 'ORS Baseline (Fallback)'
      })),
      delayRiskService.predictShipmentDelayRisk(targetShipment, candidateOptions).catch((err) => ({
        success: true,
        riskAvailable: false,
        modelStatus: 'FALLBACK',
        reason: err.message,
        riskLevel: 'UNKNOWN',
        prediction: 'UNKNOWN',
        delayProbability: 0
      })),
      accessibilityService.evaluateShipmentAccessibility(targetShipment, candidateOptions).catch((err) => ({
        success: true,
        available: false,
        score: 0,
        level: 'UNKNOWN',
        reason: err.message
      }))
    ]);

    // 5. Build multi-shipment summary overview cards/table
    const multiShipmentOverview = await Promise.all(
      allShipments.slice(0, 10).map(async (s) => {
        let bestScore = 75;
        let recStatus = 'RECOMMENDED';
        let etaVal = s.estimatedDurationMinutes || 120;
        let riskVal = 'LOW';
        let accessScoreVal = 85;

        try {
          const rec = await routeRecommendationService.recommendRouteForShipment(s._id);
          if (rec && rec.recommendedRoute) {
            bestScore = rec.recommendedRoute.recommendationScore;
            etaVal = rec.recommendedRoute.predictedEtaMin || s.estimatedDurationMinutes || 120;
            accessScoreVal = rec.recommendedRoute.accessibilityScore || 85;
            recStatus = rec.recommendedRoute.recommendationLevel || 'RECOMMENDED';
          }
          const candidateOpts = rec?.recommendedRoute ? {
            distanceKm: rec.recommendedRoute.distanceKm,
            expectedDurationMin: rec.recommendedRoute.durationMinutes,
            routeScore: rec.recommendedRoute.scoreBreakdown?.qualityScore?.raw || 85
          } : {};
          const risk = await delayRiskService.predictShipmentDelayRisk(s, candidateOpts);
          if (risk && risk.riskLevel) {
            riskVal = risk.riskLevel;
          }
        } catch (mErr) {
          // Fallback if prediction unavailable
        }

        return {
          _id: s._id,
          trackingNumber: s.trackingId || s.trackingNumber,
          pickupCity: s.pickupAddress?.city || s.pickupCity || 'Origin',
          deliveryCity: s.deliveryAddress?.city || s.destinationCity || 'Destination',
          weightKg: s.weightKg,
          status: s.status,
          routeName: s.route?.routeName || 'Primary Express Highway',
          aiScore: bestScore,
          predictedEtaMin: etaVal,
          delayRiskLevel: riskVal,
          accessibilityScore: accessScoreVal,
          recommendationStatus: recStatus
        };
      })
    );

    // 5. Return aggregated response object
    res.json({
      success: true,
      data: {
        summaryMetrics: {
          totalShipments,
          activeShipments,
          vehiclesAssigned,
          deliveredShipments,
          routesAnalyzed,
          recommendedRoutes: recommendedRoutesCount
        },
        shipmentId: targetShipment._id,
        trackingNumber: targetShipment.trackingId || targetShipment.trackingNumber,
        shipment: targetShipment,
        weather: weatherRes,
        eta: etaRes,
        delayRisk: delayRiskRes,
        accessibility: accessRes,
        routeRecommendation: recRes,
        allShipmentsList: allShipments.map((s) => ({
          _id: s._id,
          trackingNumber: s.trackingId || s.trackingNumber,
          pickupCity: s.pickupAddress?.city || s.pickupCity || 'Origin',
          deliveryCity: s.deliveryAddress?.city || s.deliveryCity || 'Destination',
          status: s.status,
          weightKg: s.weightKg
        })),
        multiShipmentOverview,
        aiServicesStatus: {
          eta: etaRes?.modelStatus || (etaRes?.mlEtaAvailable ? 'AVAILABLE' : 'FALLBACK'),
          delayRisk: delayRiskRes?.modelStatus || (delayRiskRes?.riskAvailable ? 'AVAILABLE' : 'FALLBACK'),
          accessibility: accessRes?.available !== false ? 'AVAILABLE' : 'FALLBACK',
          routeRecommendation: recRes ? 'AVAILABLE' : 'FALLBACK'
        },
        datasetStatus: 'DATASET: SYNTHETIC',
        generatedAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAIDashboardOverview
};
