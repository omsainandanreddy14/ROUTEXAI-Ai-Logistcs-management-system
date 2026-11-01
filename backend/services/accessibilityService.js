const mongoose = require('mongoose');
const Shipment = require('../models/Shipment');
const Driver = require('../models/Driver');
require('../models/Vehicle');
require('../models/Route');
require('../models/User');
const weatherService = require('./weatherService');
const etaService = require('./etaService');
const delayRiskService = require('./delayRiskService');

/**
 * Evaluates Accessibility Intelligence (Phase 3E) for a specific shipment.
 * Strictly shipment-specific and route-specific evaluation with exact score arithmetic.
 * 
 * @param {string|Object} shipmentIdOrObj - Shipment ID or populated Shipment object
 * @param {Object} [options] - Optional route parameters ({ routeScore, distanceKm, durationMinutes })
 * @returns {Promise<Object>} Structured accessibility assessment object
 */
const evaluateShipmentAccessibility = async (shipmentIdOrObj, options = {}) => {
  let shipment = null;
  let shipmentId = null;

  if (typeof shipmentIdOrObj === 'string' && mongoose.Types.ObjectId.isValid(shipmentIdOrObj)) {
    shipmentId = shipmentIdOrObj;
  } else if (shipmentIdOrObj && shipmentIdOrObj._id && mongoose.Types.ObjectId.isValid(shipmentIdOrObj._id)) {
    shipmentId = shipmentIdOrObj._id.toString();
  } else if (shipmentIdOrObj && typeof shipmentIdOrObj.toString === 'function' && mongoose.Types.ObjectId.isValid(shipmentIdOrObj.toString())) {
    shipmentId = shipmentIdOrObj.toString();
  }

  if (shipmentId) {
    shipment = await Shipment.findById(shipmentId)
      .populate('vehicle')
      .populate('driver')
      .populate('route');
  } else if (typeof shipmentIdOrObj === 'object') {
    shipment = shipmentIdOrObj;
  }

  if (!shipment) {
    throw new Error('Shipment not found');
  }

  // Determine active route document or route score
  const routeDoc = shipment.route || null;
  let isCandidateRouteEvaluation = false;
  let routeScore = options.routeScore !== undefined && options.routeScore !== null ? Number(options.routeScore) : null;
  
  if (options.routeScore !== undefined && options.routeScore !== null && !routeDoc) {
    isCandidateRouteEvaluation = true;
  }

  if (routeScore === null && routeDoc && routeDoc.score !== undefined) {
    routeScore = Number(routeDoc.score);
  }

  // Selected route is required for accessibility evaluation
  if (routeScore === null && !routeDoc) {
    return {
      success: true,
      available: false,
      shipmentId: shipment._id,
      trackingNumber: shipment.trackingNumber || shipment.trackingId,
      reason: 'Selected route is required for accessibility assessment. Please select a candidate route in Route Intelligence.',
      score: 0,
      level: 'UNKNOWN'
    };
  }

  if (routeScore === null) {
    routeScore = 85; // Fallback if route exists but score missing
  }

  const reasons = [];

  // --- 1. Vehicle & Cargo Compatibility (Max 25 pts) ---
  const cargoWeightKg = Number(shipment.weightKg || 0);
  let vehicleId = null;
  let vehicleCapacityKg = null;
  let vehicleAgeYears = null;

  if (shipment.vehicle) {
    vehicleId = shipment.vehicle._id || 'assigned_vehicle';
    vehicleCapacityKg = Number(shipment.vehicle.capacityKg || 0);
    
    if (shipment.vehicle.ageYears !== undefined && shipment.vehicle.ageYears !== null) {
      vehicleAgeYears = Number(shipment.vehicle.ageYears);
    } else if (shipment.vehicle.createdAt) {
      const createdYear = new Date(shipment.vehicle.createdAt).getFullYear();
      const currentYear = new Date().getFullYear();
      vehicleAgeYears = Math.max(1, currentYear - createdYear);
    } else {
      vehicleAgeYears = 3;
    }
  }

  let vehicleCompatibility = 'UNKNOWN';
  let cargoCompatibility = 'UNKNOWN';
  let vehicleCargoPoints = 15;
  let isIncompatible = false;

  if (!shipment.vehicle || !vehicleCapacityKg || vehicleCapacityKg <= 0) {
    vehicleCompatibility = 'UNKNOWN';
    cargoCompatibility = 'UNKNOWN';
    vehicleCargoPoints = 15;
    reasons.push('⚠ Vehicle or vehicle capacity not assigned to shipment.');
  } else {
    const utilization = cargoWeightKg / vehicleCapacityKg;
    if (cargoWeightKg > vehicleCapacityKg) {
      vehicleCompatibility = 'INCOMPATIBLE';
      cargoCompatibility = 'INCOMPATIBLE';
      vehicleCargoPoints = 0;
      isIncompatible = true;
      reasons.push(`⚠ Cargo weight (${cargoWeightKg} kg) exceeds assigned vehicle capacity (${vehicleCapacityKg} kg).`);
    } else {
      vehicleCompatibility = 'COMPATIBLE';
      if (utilization <= 0.70) {
        cargoCompatibility = 'HIGH';
        vehicleCargoPoints = 25;
        reasons.push(`✓ Cargo weight (${cargoWeightKg} kg) is well within vehicle capacity (${vehicleCapacityKg} kg) — ${(utilization * 100).toFixed(1)}% utilization.`);
      } else if (utilization <= 0.90) {
        cargoCompatibility = 'MEDIUM';
        vehicleCargoPoints = 18;
        reasons.push(`✓ Cargo weight (${cargoWeightKg} kg) utilizes ${(utilization * 100).toFixed(1)}% of vehicle capacity (${vehicleCapacityKg} kg).`);
      } else {
        cargoCompatibility = 'LOW';
        vehicleCargoPoints = 10;
        reasons.push(`⚠ High vehicle capacity utilization (${(utilization * 100).toFixed(1)}%).`);
      }
    }
  }

  // --- 2. Route Suitability (Max 20 pts) ---
  let routeSuitability = 'MEDIUM';
  let routePoints = 14;

  if (routeScore >= 80) {
    routeSuitability = 'HIGH';
    routePoints = 20;
    reasons.push(`✓ Route quality score (${routeScore}/100) indicates favorable transit suitability.`);
  } else if (routeScore >= 60) {
    routeSuitability = 'MEDIUM';
    routePoints = 14;
    reasons.push(`✓ Route quality score (${routeScore}/100) indicates acceptable route suitability.`);
  } else {
    routeSuitability = 'LOW';
    routePoints = 8;
    reasons.push(`⚠ Route quality score (${routeScore}/100) indicates lower route suitability.`);
  }

  // --- 3. Weather Impact (Max 15 pts) ---
  let pickupLat = 28.6139;
  let pickupLng = 77.2090;
  if (shipment.pickupLocation && Array.isArray(shipment.pickupLocation.coordinates) && shipment.pickupLocation.coordinates.length >= 2) {
    pickupLng = shipment.pickupLocation.coordinates[0];
    pickupLat = shipment.pickupLocation.coordinates[1];
  }

  let weatherData = null;
  try {
    weatherData = await weatherService.getWeatherForLocation(pickupLat, pickupLng);
  } catch (wErr) {
    console.warn('[Accessibility Service] Weather fetch warning:', wErr.message);
  }

  const weatherRisk = weatherData?.weatherRisk || 'LOW';
  let weatherImpact = 'LOW';
  let weatherPoints = 15;

  if (weatherRisk === 'LOW') {
    weatherImpact = 'LOW';
    weatherPoints = 15;
    reasons.push('✓ Current endpoint weather risk is LOW.');
  } else if (weatherRisk === 'MEDIUM') {
    weatherImpact = 'MEDIUM';
    weatherPoints = 10;
    reasons.push('⚠ Moderate weather risk detected at route endpoint.');
  } else if (weatherRisk === 'HIGH') {
    weatherImpact = 'HIGH';
    weatherPoints = 4;
    reasons.push('⚠ High weather risk detected at route endpoint.');
  } else {
    weatherImpact = 'UNKNOWN';
    weatherPoints = 10;
    reasons.push('⚠ Weather context unavailable.');
  }

  // --- 4. Operational Delay Risk (Phase 3D Integration) (Max 15 pts) ---
  let delayRiskData = null;
  try {
    delayRiskData = await delayRiskService.predictShipmentDelayRisk(shipment, options);
  } catch (dErr) {
    console.warn('[Accessibility Service] Delay risk service warning:', dErr.message);
  }

  const delayProbability = delayRiskData?.delayProbability ?? 0;
  let operationalRisk = 'LOW';
  let delayRiskPoints = 15;

  if (delayRiskData && delayRiskData.riskAvailable) {
    if (delayProbability < 30.0) {
      operationalRisk = 'LOW';
      delayRiskPoints = 15;
      reasons.push(`✓ Operational delay risk is LOW (${delayProbability}% probability).`);
    } else if (delayProbability < 60.0) {
      operationalRisk = 'MEDIUM';
      delayRiskPoints = 10;
      reasons.push(`⚠ Moderate operational delay risk (${delayProbability}% probability).`);
    } else {
      operationalRisk = 'HIGH';
      delayRiskPoints = 4;
      reasons.push(`⚠ High operational delay risk (${delayProbability}% probability).`);
    }
  } else {
    operationalRisk = 'UNKNOWN';
    delayRiskPoints = 10;
    reasons.push(`⚠ Delay risk prediction unavailable (${delayRiskData?.reason || 'Service error'}).`);
  }

  // --- 5. ETA Impact (Phase 3C Integration) (Max 10 pts) ---
  let etaData = null;
  try {
    etaData = await etaService.predictShipmentETA(shipment, options);
  } catch (eErr) {
    console.warn('[Accessibility Service] ETA service warning:', eErr.message);
  }

  let etaImpact = 'UNKNOWN';
  let etaPoints = 7;
  const baselineEta = etaData?.baselineDurationMin ?? 0;
  const predictedEta = etaData?.predictedDurationMin ?? 0;
  let etaDifference = 0;

  if (etaData && etaData.mlEtaAvailable && etaData.differenceFromBaselineMin !== undefined) {
    etaDifference = etaData.differenceFromBaselineMin;
    const diffSign = etaDifference > 0 ? '+' : '';
    if (etaDifference <= 15.0) {
      etaImpact = 'LOW';
      etaPoints = 10;
      reasons.push(`✓ Predicted ML transit duration aligns closely with baseline (${diffSign}${etaDifference} min).`);
    } else if (etaDifference <= 45.0) {
      etaImpact = 'MEDIUM';
      etaPoints = 6;
      reasons.push(`⚠ Predicted ML transit duration indicates moderate delay adjustment (${diffSign}${etaDifference} min).`);
    } else {
      etaImpact = 'HIGH';
      etaPoints = 2;
      reasons.push(`⚠ Predicted ML transit duration indicates significant corridor delay (${diffSign}${etaDifference} min).`);
    }
  } else {
    etaImpact = 'UNKNOWN';
    etaPoints = 7;
    reasons.push('⚠ ML ETA prediction context unavailable.');
  }

  // --- 6. Driver Experience Factor (Max 10 pts) ---
  let driverExperience = 'UNKNOWN';
  let driverPoints = 7;
  let driverId = null;
  let driverExperienceYears = null;

  if (shipment.driver) {
    if (typeof shipment.driver === 'object' && shipment.driver.experienceYears !== undefined && shipment.driver.experienceYears !== null) {
      driverExperienceYears = Number(shipment.driver.experienceYears);
      driverId = shipment.driver._id || 'assigned_driver';
    } else {
      const driverUserId = shipment.driver._id || shipment.driver;
      if (mongoose.Types.ObjectId.isValid(driverUserId)) {
        const driverDoc = await Driver.findOne({ user: driverUserId });
        if (driverDoc) {
          driverId = driverDoc._id;
          if (driverDoc.experienceYears !== undefined && driverDoc.experienceYears !== null) {
            driverExperienceYears = Number(driverDoc.experienceYears);
          }
        }
      }
    }
  }

  if (driverExperienceYears === null) {
    driverExperience = 'UNKNOWN';
    driverPoints = 7;
    reasons.push('⚠ Driver experience details not assigned to shipment.');
  } else if (driverExperienceYears >= 3) {
    driverExperience = 'EXPERIENCED';
    driverPoints = 10;
    reasons.push(`✓ Assigned driver has ${driverExperienceYears} years of operational experience.`);
  } else if (driverExperienceYears >= 1) {
    driverExperience = 'MODERATE';
    driverPoints = 7;
    reasons.push(`✓ Assigned driver has ${driverExperienceYears} years of operational experience.`);
  } else {
    driverExperience = 'LIMITED';
    driverPoints = 4;
    reasons.push(`⚠ Assigned driver experience is under 1 year (${driverExperienceYears} years).`);
  }

  // --- 7. Vehicle Age Factor (Max 5 pts) ---
  let vehicleAgeFactor = 'UNKNOWN';
  let vehicleAgePoints = 3;

  if (vehicleAgeYears === null) {
    vehicleAgeFactor = 'UNKNOWN';
    vehicleAgePoints = 3;
    reasons.push('⚠ Assigned vehicle specifications unavailable.');
  } else if (vehicleAgeYears <= 5) {
    vehicleAgeFactor = 'NORMAL';
    vehicleAgePoints = 5;
    reasons.push(`✓ Assigned vehicle age (${vehicleAgeYears} yrs) is within optimal fleet parameters.`);
  } else if (vehicleAgeYears <= 10) {
    vehicleAgeFactor = 'OLDER';
    vehicleAgePoints = 3;
    reasons.push(`⚠ Vehicle age (${vehicleAgeYears} yrs) is in older fleet operational bracket.`);
  } else {
    vehicleAgeFactor = 'HIGH-AGE';
    vehicleAgePoints = 1;
    reasons.push(`⚠ Vehicle age (${vehicleAgeYears} yrs) represents a high-age fleet factor.`);
  }

  // --- Score Summation & Thresholds ---
  const rawTotal = vehicleCargoPoints + routePoints + weatherPoints + delayRiskPoints + etaPoints + driverPoints + vehicleAgePoints;
  let finalScore = Math.min(100, Math.max(0, Math.round(rawTotal)));

  let level = 'MODERATE';
  if (finalScore >= 80) {
    level = 'GOOD';
  } else if (finalScore >= 60) {
    level = 'MODERATE';
  } else if (finalScore >= 40) {
    level = 'RESTRICTED';
  } else {
    level = 'CRITICAL';
  }

  // HARD SAFETY RULE: Cargo weight exceeding vehicle capacity MUST result in CRITICAL level
  if (isIncompatible) {
    level = 'CRITICAL';
    if (finalScore > 39) {
      finalScore = 39;
    }
  }

  const routeLabel = routeDoc
    ? routeDoc._id.toString()
    : isCandidateRouteEvaluation
    ? `Candidate Route Evaluation (Score: ${routeScore})`
    : 'Candidate Route Evaluation';

  // Output Backend Debug Log exactly as requested
  console.log(`[PHASE 3E DEBUG]
shipmentId: ${shipment._id || 'N/A'}
trackingNumber: ${shipment.trackingNumber || shipment.trackingId || 'N/A'}
routeId: ${routeLabel}
routeScore: ${routeScore}
cargoWeightKg: ${cargoWeightKg}
vehicleId: ${vehicleId || 'NONE'}
vehicleCapacityKg: ${vehicleCapacityKg !== null ? vehicleCapacityKg : 'N/A'}
vehicleAgeYears: ${vehicleAgeYears !== null ? vehicleAgeYears : 'N/A'}
driverId: ${driverId || 'NONE'}
driverExperienceYears: ${driverExperienceYears !== null ? driverExperienceYears : 'N/A'}
weatherRisk: ${weatherRisk}
delayProbability: ${delayProbability}%
baselineEta: ${baselineEta} min
predictedEta: ${predictedEta} min
etaDifference: ${etaDifference} min
vehicleCargoPoints: ${vehicleCargoPoints}
routeSuitabilityPoints: ${routePoints}
weatherPoints: ${weatherPoints}
delayRiskPoints: ${delayRiskPoints}
etaPoints: ${etaPoints}
driverExperiencePoints: ${driverPoints}
vehicleAgePoints: ${vehicleAgePoints}
rawTotal: ${rawTotal}
finalScore: ${finalScore}
accessibilityLevel: ${level}`);

  return {
    success: true,
    available: true,
    shipmentId: shipment._id,
    trackingNumber: shipment.trackingNumber || shipment.trackingId,
    routeId: routeLabel,
    score: finalScore,
    rawTotal: rawTotal,
    level: level,
    vehicleCompatibility: vehicleCompatibility,
    cargoCompatibility: cargoCompatibility,
    routeSuitability: routeSuitability,
    weatherImpact: weatherImpact,
    operationalRisk: operationalRisk,
    etaImpact: etaImpact,
    driverExperience: driverExperience,
    vehicleAgeFactor: vehicleAgeFactor,
    reasons: reasons,
    components: {
      vehicleCargo: vehicleCargoPoints,
      route: routePoints,
      weather: weatherPoints,
      delayRisk: delayRiskPoints,
      eta: etaPoints,
      driver: driverPoints,
      vehicleAge: vehicleAgePoints
    },
    ruleBased: true,
    dataSource: 'RouteXAI shipment + route + vehicle + driver + weather + ML signals',
    datasetType: 'SYNTHETIC'
  };
};

module.exports = {
  evaluateShipmentAccessibility
};
