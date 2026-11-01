const Shipment = require('../models/Shipment');
const routeService = require('./routeService');
const weatherService = require('./weatherService');
const etaService = require('./etaService');
const delayRiskService = require('./delayRiskService');
const accessibilityService = require('./accessibilityService');

/**
 * Service to evaluate and rank candidate routes for a given shipment (Phase 3F)
 * Genuinely evaluates each shipment using actual signals from ML microservices,
 * Open-Meteo weather, and accessibility intelligence rules.
 */
const recommendRouteForShipment = async (shipmentId) => {
  const shipment = await Shipment.findById(shipmentId)
    .populate('vehicle')
    .populate('driver')
    .populate('route');

  if (!shipment) {
    throw new Error('Shipment not found');
  }

  const pCoords = shipment.pickupLocation?.coordinates;
  const dCoords = shipment.deliveryLocation?.coordinates;

  if (!pCoords || !dCoords || !Array.isArray(pCoords) || !Array.isArray(dCoords)) {
    throw new Error('Shipment pickup or delivery coordinates are missing.');
  }

  const source = {
    latitude: parseFloat(pCoords[1]),
    longitude: parseFloat(pCoords[0]),
    address: typeof shipment.pickupAddress === 'object' ? (shipment.pickupAddress?.street || 'Customer Pickup') : (shipment.pickupAddress || 'Customer Pickup'),
    city: shipment.pickupAddress?.city || shipment.pickupCity || 'Customer Pickup Location'
  };

  const destination = {
    latitude: parseFloat(dCoords[1]),
    longitude: parseFloat(dCoords[0]),
    address: typeof shipment.deliveryAddress === 'object' ? (shipment.deliveryAddress?.street || 'Customer Delivery') : (shipment.deliveryAddress || 'Customer Delivery'),
    city: shipment.deliveryAddress?.city || shipment.deliveryCity || 'Customer Delivery Location'
  };

  const trackingInfo = shipment.trackingId || shipment.trackingNumber;

  // 1. Calculate candidate routes using routeService
  const candidateResult = await routeService.calculateCandidateRoutes(source, destination, trackingInfo);
  const candidates = candidateResult.routes || [];

  if (candidates.length === 0) {
    throw new Error('No candidate routes found for shipment coordinates.');
  }

  // 2. Fetch endpoint weather for pickup location
  let weatherRisk = 'LOW';
  try {
    const weatherData = await weatherService.getWeatherForLocation(source.latitude, source.longitude);
    weatherRisk = weatherData?.weatherRisk || 'LOW';
  } catch (wErr) {
    console.warn('[RouteRecommendation Service] Weather lookup failed:', wErr.message);
  }

  // Weather Score mapping (Endpoint Weather Risk)
  const weatherScoreMap = {
    'LOW': 100,
    'MEDIUM': 60,
    'HIGH': 20
  };
  const rawWeatherScore = weatherScoreMap[weatherRisk] || 100;

  // 3. Gather signals independently for each candidate route
  const evaluatedCandidates = await Promise.all(
    candidates.map(async (cand) => {
      // Phase 3C ETA Signal
      let predictedEtaMin = cand.durationMinutes;
      let etaFallback = false;
      let etaFallbackReason = null;

      try {
        const etaRes = await etaService.predictShipmentETA(shipment, {
          distanceKm: cand.distanceKm,
          expectedDurationMin: cand.durationMinutes,
          routeScore: cand.score
        });

        if (etaRes && etaRes.predictedDurationMin) {
          predictedEtaMin = etaRes.predictedDurationMin;
        }

        if (etaRes && etaRes.modelStatus === 'FALLBACK') {
          etaFallback = true;
          etaFallbackReason = etaRes.fallbackReason || 'FastAPI service offline or unreachable';
        }
      } catch (eErr) {
        etaFallback = true;
        etaFallbackReason = eErr.message;
      }

      // Phase 3D Delay Risk Signal
      let delayProbRatio = 0.15; // default fallback ratio (15%)
      let delayFallback = false;
      let delayFallbackReason = null;

      try {
        const riskRes = await delayRiskService.predictShipmentDelayRisk(shipment, {
          distanceKm: cand.distanceKm,
          expectedDurationMin: cand.durationMinutes,
          routeScore: cand.score
        });

        if (riskRes && riskRes.delayProbability !== undefined) {
          const rawVal = Number(riskRes.delayProbability);
          // Standardize delay probability to 0.0 - 1.0 ratio
          delayProbRatio = rawVal > 1.0 ? rawVal / 100.0 : rawVal;
        }

        if (riskRes && (riskRes.modelStatus === 'FALLBACK' || !riskRes.riskAvailable)) {
          delayFallback = true;
          delayFallbackReason = riskRes.reason || 'FastAPI service offline or unreachable';
        }
      } catch (rErr) {
        delayFallback = true;
        delayFallbackReason = rErr.message;
      }

      // Phase 3E Accessibility Signal
      let accessScore = 85;
      let isIncompatible = false;
      let overloadLevel = 'LOW';

      try {
        const accessRes = await accessibilityService.evaluateShipmentAccessibility(shipment, {
          routeScore: cand.score,
          distanceKm: cand.distanceKm,
          expectedDurationMin: cand.durationMinutes,
          durationMinutes: cand.durationMinutes
        });

        if (accessRes) {
          accessScore = accessRes.score !== undefined ? accessRes.score : 85;
          isIncompatible = accessRes.isIncompatible || false;
          overloadLevel = accessRes.overloadLevel || 'LOW';
        }
      } catch (aErr) {
        console.warn(`[RouteRecommendation] Accessibility eval failed for candidate ${cand.id}:`, aErr.message);
      }

      return {
        ...cand,
        predictedEtaMin,
        etaFallback,
        etaFallbackReason,
        delayProbRatio,
        delayFallback,
        delayFallbackReason,
        accessibilityScore: accessScore,
        isIncompatible,
        overloadLevel
      };
    })
  );

  // 4. Compute normalization bounds across candidate routes for CURRENT shipment only
  const etas = evaluatedCandidates.map((c) => c.predictedEtaMin);
  const minEta = Math.min(...etas);
  const maxEta = Math.max(...etas);

  const distances = evaluatedCandidates.map((c) => c.distanceKm);
  const minDist = Math.min(...distances);
  const maxDist = Math.max(...distances);

  // 5. Compute normalized scores, weights, and disqualifications
  const scoredCandidates = evaluatedCandidates.map((cand) => {
    // S_quality (25%)
    const qualityScore = cand.score || 85;

    // S_eta (20%): Normalized across candidates for current shipment only
    let etaEfficiency = 100;
    if (maxEta > minEta) {
      etaEfficiency = Math.round(100 - ((cand.predictedEtaMin - minEta) / (maxEta - minEta)) * 40);
    }

    // S_delay (20%): Derived from ML delay probability (1 - P_delay) * 100
    const delayRiskScore = Math.round((1.0 - cand.delayProbRatio) * 100.0 * 10) / 10;

    // S_accessibility (20%)
    const accessibilityScore = cand.accessibilityScore;

    // S_distance (10%): Normalized across candidates for current shipment only
    let distanceEfficiency = 100;
    if (maxDist > minDist) {
      distanceEfficiency = Math.round(100 - ((cand.distanceKm - minDist) / (maxDist - minDist)) * 30);
    }

    // S_weather (5%)
    const weatherScore = rawWeatherScore;

    // Disqualification check
    const isDisqualified = cand.isIncompatible || cand.overloadLevel === 'CRITICAL';
    let disqualificationReason = null;
    if (cand.isIncompatible) {
      disqualificationReason = 'Incompatible vehicle/cargo payload specifications';
    } else if (cand.overloadLevel === 'CRITICAL') {
      disqualificationReason = 'Critical vehicle capacity overload';
    }

    // Recommendation Score calculation (Phase 3F exact formula)
    const rawTotalScore = (
      qualityScore * 0.25 +
      etaEfficiency * 0.20 +
      delayRiskScore * 0.20 +
      accessibilityScore * 0.20 +
      distanceEfficiency * 0.10 +
      weatherScore * 0.05
    );

    const recommendationScore = Math.round(rawTotalScore * 10) / 10;

    // Recommendation Level mapping
    let recommendationLevel = 'RECOMMENDED';
    if (isDisqualified || recommendationScore < 50) {
      recommendationLevel = 'NOT_RECOMMENDED';
    } else if (recommendationScore >= 80) {
      recommendationLevel = 'HIGHLY_RECOMMENDED';
    } else if (recommendationScore >= 65) {
      recommendationLevel = 'RECOMMENDED';
    } else {
      recommendationLevel = 'CAUTION_RECOMMENDED';
    }

    return {
      id: cand.id,
      name: cand.name,
      distanceKm: cand.distanceKm,
      durationMinutes: cand.durationMinutes,
      predictedEtaMin: cand.predictedEtaMin,
      etaFallback: cand.etaFallback,
      etaFallbackReason: cand.etaFallbackReason,
      delayProbability: cand.delayProbRatio,
      delayProbabilityPercent: Math.round(cand.delayProbRatio * 1000) / 10,
      delayFallback: cand.delayFallback,
      delayFallbackReason: cand.delayFallbackReason,
      accessibilityScore: cand.accessibilityScore,
      weatherRisk: weatherRisk,
      disqualified: isDisqualified,
      disqualificationReason,
      recommendationScore: isDisqualified ? 0 : recommendationScore,
      rawRecommendationScore: recommendationScore,
      recommendationLevel,
      scoreBreakdown: {
        qualityScore: { raw: qualityScore, weight: 0.25, points: Math.round(qualityScore * 0.25 * 100) / 100 },
        etaEfficiency: { raw: etaEfficiency, weight: 0.20, points: Math.round(etaEfficiency * 0.20 * 100) / 100 },
        delayRiskScore: { raw: delayRiskScore, weight: 0.20, points: Math.round(delayRiskScore * 0.20 * 100) / 100 },
        accessibilityScore: { raw: accessibilityScore, weight: 0.20, points: Math.round(accessibilityScore * 0.20 * 100) / 100 },
        distanceEfficiency: { raw: distanceEfficiency, weight: 0.10, points: Math.round(distanceEfficiency * 0.10 * 100) / 100 },
        weatherScore: { raw: weatherScore, weight: 0.05, points: Math.round(weatherScore * 0.05 * 100) / 100 }
      },
      geometry: cand.geometry,
      trafficStatus: cand.trafficStatus,
      roadQuality: cand.roadQuality
    };
  });

  // 6. Ranking and Deterministic Tie-Breaking
  scoredCandidates.sort((a, b) => {
    // 1. Non-disqualified first
    if (a.disqualified !== b.disqualified) {
      return a.disqualified ? 1 : -1;
    }
    // 2. Higher recommendation score
    if (Math.abs(b.recommendationScore - a.recommendationScore) > 0.1) {
      return b.recommendationScore - a.recommendationScore;
    }
    // 3. Faster predicted ETA
    if (a.predictedEtaMin !== b.predictedEtaMin) {
      return a.predictedEtaMin - b.predictedEtaMin;
    }
    // 4. Lower delay probability
    if (a.delayProbability !== b.delayProbability) {
      return a.delayProbability - b.delayProbability;
    }
    // 5. Higher accessibility score
    if (a.accessibilityScore !== b.accessibilityScore) {
      return b.accessibilityScore - a.accessibilityScore;
    }
    // 6. Shortest distance
    return a.distanceKm - b.distanceKm;
  });

  // Pick top recommended route
  const recommendedRoute = scoredCandidates[0];

  // 7. Generate Explanations for Recommended Route vs Alternatives
  scoredCandidates.forEach((cand, idx) => {
    const isBest = idx === 0;
    const pos = [];
    const warn = [];

    if (cand.disqualified) {
      warn.push(`⚠ Disqualified: ${cand.disqualificationReason}`);
    } else {
      if (isBest) {
        pos.push(`Highest multi-signal recommendation score (${cand.recommendationScore}/100)`);
      }

      // Compare with secondary candidate if exists
      const other = scoredCandidates.find((c, i) => i !== idx && !c.disqualified);
      if (other) {
        // ETA comparison
        const etaDiff = Math.round(other.predictedEtaMin - cand.predictedEtaMin);
        if (etaDiff > 0) {
          pos.push(`Faster estimated transit time (saves ~${etaDiff} min vs ${other.name})`);
        } else if (etaDiff < 0) {
          warn.push(`Slightly longer transit time (+${Math.abs(etaDiff)} min vs ${other.name})`);
        }

        // Delay Risk comparison
        const delayDiff = Math.round((other.delayProbability - cand.delayProbability) * 1000) / 10;
        if (delayDiff > 0) {
          pos.push(`Lower delay probability (${cand.delayProbabilityPercent}% vs ${other.delayProbabilityPercent}%)`);
        } else if (delayDiff < 0) {
          warn.push(`Higher delay risk probability (${cand.delayProbabilityPercent}% vs ${other.delayProbabilityPercent}%)`);
        }

        // Accessibility comparison
        if (cand.accessibilityScore > other.accessibilityScore) {
          pos.push(`Higher operational accessibility rating (${cand.accessibilityScore} vs ${other.accessibilityScore})`);
        }

        // Distance comparison
        const distDiff = Math.round((cand.distanceKm - other.distanceKm) * 10) / 10;
        if (distDiff < 0) {
          pos.push(`Shorter route distance (${cand.distanceKm} km vs ${other.distanceKm} km)`);
        } else if (distDiff > 0) {
          warn.push(`Slightly longer bypass distance (+${distDiff} km)`);
        }
      } else {
        pos.push('Favorable road geometry and infrastructure compatibility');
      }

      if (weatherRisk === 'LOW') {
        pos.push('Favorable weather conditions along corridor');
      } else {
        warn.push(`Endpoint weather caution: ${weatherRisk} risk conditions detected`);
      }
    }

    cand.positiveFactors = pos;
    cand.warningFactors = warn;
    cand.isRecommended = isBest;
  });

  // 8. Build complete DEV diagnostic report array (Requirement 9)
  const diagnostics = scoredCandidates.map((c) => ({
    shipmentId: shipment._id,
    trackingNumber: shipment.trackingNumber || shipment.trackingId,
    candidateRoute: c.name,
    routeScore: c.scoreBreakdown.qualityScore.raw,
    distanceKm: c.distanceKm,
    expectedDurationMin: c.durationMinutes,
    predictedDurationMin: c.predictedEtaMin,
    etaFallback: c.etaFallback,
    etaFallbackReason: c.etaFallbackReason,
    delayProbability: `${c.delayProbabilityPercent}%`,
    delayFallback: c.delayFallback,
    delayFallbackReason: c.delayFallbackReason,
    accessibilityScore: c.accessibilityScore,
    weatherRisk: c.weatherRisk,
    etaNormalizedScore: c.scoreBreakdown.etaEfficiency.raw,
    delayScore: c.scoreBreakdown.delayRiskScore.raw,
    distanceNormalizedScore: c.scoreBreakdown.distanceEfficiency.raw,
    finalRecommendationScore: c.recommendationScore
  }));

  return {
    shipmentId: shipment._id,
    trackingNumber: shipment.trackingNumber || shipment.trackingId,
    disclaimer: 'DATASET: SYNTHETIC — Decision Support Only',
    recommendedRoute,
    candidateRoutes: scoredCandidates,
    diagnostics
  };
};

module.exports = {
  recommendRouteForShipment
};
