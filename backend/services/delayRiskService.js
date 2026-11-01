const axios = require('axios');
const weatherService = require('./weatherService');
const Shipment = require('../models/Shipment');

const FASTAPI_RISK_URL = process.env.FASTAPI_RISK_URL || 'http://127.0.0.1:8000/predict/risk';

/**
 * Predict Delay Risk using ML microservice (or fallback gracefully)
 * @param {string|Object} shipmentIdOrObj - Shipment ID or populated Shipment document
 */
const predictShipmentDelayRisk = async (shipmentIdOrObj, options = {}) => {
  let shipment = shipmentIdOrObj;
  
  if (typeof shipmentIdOrObj === 'string') {
    shipment = await Shipment.findById(shipmentIdOrObj)
      .populate('vehicle')
      .populate('driver')
      .populate('route');
  }

  if (!shipment) {
    throw new Error('Shipment not found');
  }

  // Extract coordinates for weather pickup location
  let pickupLat = 28.6139;
  let pickupLng = 77.2090;
  if (shipment.pickupLocation && Array.isArray(shipment.pickupLocation.coordinates)) {
    pickupLng = shipment.pickupLocation.coordinates[0];
    pickupLat = shipment.pickupLocation.coordinates[1];
  }

  // Fetch real-time weather from Open-Meteo via Phase 3A weatherService
  let weatherData = null;
  try {
    weatherData = await weatherService.getWeatherForLocation(pickupLat, pickupLng);
  } catch (wErr) {
    console.warn('[DelayRisk Service] Weather fetch warning, fallback to default weather:', wErr.message);
  }

  // Baseline ORS duration and distance (supports candidate route overrides via options)
  const distanceKm = options.distanceKm !== undefined ? Number(options.distanceKm) : (shipment.estimatedDistanceKm || 100);
  const expectedDurationMin = options.expectedDurationMin !== undefined 
    ? Number(options.expectedDurationMin) 
    : (options.durationMinutes !== undefined ? Number(options.durationMinutes) : (shipment.estimatedDurationMinutes || (distanceKm * 1.5)));
  const routeScore = options.routeScore !== undefined ? Number(options.routeScore) : 85.0;

  let shipmentTypeMap = {
    'STANDARD': 'STANDARD',
    'FRAGILE': 'FRAGILE',
    'HAZARDOUS': 'BULK',
    'COLD_STORAGE': 'PERISHABLE'
  };
  const shipmentType = shipmentTypeMap[shipment.packageType] || 'STANDARD';

  // Build ML Feature Request Payload matching FastAPI Pydantic schema
  const mlPayload = {
    distanceKm: Number(distanceKm),
    expectedDurationMin: Number(expectedDurationMin),
    vehicleCapacityKg: shipment.vehicle?.capacityKg || 5000,
    cargoWeightKg: shipment.weightKg || 500,
    cargoVolumeM3: (shipment.dimensions?.length && shipment.dimensions?.width && shipment.dimensions?.height)
      ? (shipment.dimensions.length * shipment.dimensions.width * shipment.dimensions.height) / 1000000
      : 3.0,
    packageCount: shipment.quantity || 1,
    temperatureC: weatherData?.current?.temperature ?? 25.0,
    humidityPercent: weatherData?.current?.humidity ?? 60.0,
    rainfallMm: weatherData?.current?.rain ?? 0.0,
    windSpeedKmph: weatherData?.current?.windSpeed ?? 10.0,
    visibilityKm: weatherData?.current?.visibility ? (weatherData.current.visibility / 1000.0) : 10.0,
    routeScore: Number(routeScore),
    driverExperienceYears: shipment.driver?.experienceYears || 5,
    vehicleAgeYears: 3,
    pickupHour: new Date(shipment.createdAt || Date.now()).getHours(),
    dayOfWeek: new Date(shipment.createdAt || Date.now()).getDay(),
    month: new Date(shipment.createdAt || Date.now()).getMonth() + 1,
    isWeekend: [0, 6].includes(new Date(shipment.createdAt || Date.now()).getDay()) ? 1 : 0,
    shipmentType: shipmentType,
    priority: shipment.priority || 'MEDIUM',
    vehicleType: shipment.vehicle?.vehicleType || shipment.vehicle?.type || 'TRUCK',
    trafficLevel: 'MEDIUM',
    weatherCondition: weatherData?.current?.condition ? weatherData.current.condition.toUpperCase() : 'CLEAR',
    weatherRisk: weatherData?.weatherRisk || 'LOW',
    delayRisk: 'LOW'
  };

  try {
    const response = await axios.post(FASTAPI_RISK_URL, mlPayload, { timeout: 8000 });
    return {
      success: true,
      riskAvailable: true,
      modelStatus: 'AVAILABLE',
      datasetType: 'SYNTHETIC',
      shipmentId: shipment._id,
      trackingNumber: shipment.trackingNumber,
      prediction: response.data.prediction,
      delayProbability: response.data.delayProbability,
      onTimeProbability: response.data.onTimeProbability,
      riskLevel: response.data.riskLevel,
      modelName: response.data.model,
      modelVersion: response.data.modelVersion,
      metrics: response.data.metrics,
      topFactors: response.data.topFactors,
      keyFactors: response.data.keyFactors || []
    };
  } catch (error) {
    const failureReason = error.code ? `${error.code} (${error.message})` : error.message;
    console.warn(`[DelayRisk Service] FastAPI microservice call to ${FASTAPI_RISK_URL} failed (${failureReason}). Returning fallback status.`);
    return {
      success: true,
      riskAvailable: false,
      modelStatus: 'FALLBACK',
      datasetType: 'SYNTHETIC',
      shipmentId: shipment._id,
      trackingNumber: shipment.trackingNumber,
      fallback: true,
      reason: `FastAPI microservice offline or unreachable: ${failureReason}`,
      riskLevel: 'UNKNOWN',
      prediction: 'UNKNOWN',
      delayProbability: 0
    };
  }
};

module.exports = {
  predictShipmentDelayRisk
};
