const axios = require('axios');
const weatherService = require('./weatherService');
const Shipment = require('../models/Shipment');

const FASTAPI_ETA_URL = process.env.FASTAPI_ETA_URL || 'http://127.0.0.1:8000/predict/eta';

/**
 * Predict ETA using ML microservice (or fallback to ORS baseline)
 * @param {string|Object} shipmentIdOrObj - Shipment ID or populated Shipment document
 */
const predictShipmentETA = async (shipmentIdOrObj, options = {}) => {
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
    console.warn('[ETA Service] Weather fetch warning, fallback to default weather:', wErr.message);
  }

  // Baseline ORS duration and distance (supports candidate route overrides via options)
  const distanceKm = options.distanceKm !== undefined ? Number(options.distanceKm) : (shipment.estimatedDistanceKm || 100);
  const expectedDurationMin = options.expectedDurationMin !== undefined 
    ? Number(options.expectedDurationMin) 
    : (options.durationMinutes !== undefined ? Number(options.durationMinutes) : (shipment.estimatedDurationMinutes || (distanceKm * 1.5)));
  const routeScore = options.routeScore !== undefined ? Number(options.routeScore) : 85.0;

  // Map packageType to ML dataset categorical shipmentType
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
    const response = await axios.post(FASTAPI_ETA_URL, mlPayload, { timeout: 8000 });
    return {
      success: true,
      mlEtaAvailable: true,
      modelStatus: 'AVAILABLE',
      datasetType: 'SYNTHETIC',
      shipmentId: shipment._id,
      trackingNumber: shipment.trackingNumber,
      baselineDurationMin: response.data.baselineDurationMin,
      baselineDurationHours: response.data.baselineDurationHours,
      predictedDurationMin: response.data.predictedDurationMin,
      predictedDurationHours: response.data.predictedDurationHours,
      differenceFromBaselineMin: response.data.differenceFromBaselineMin,
      modelName: response.data.model,
      metrics: response.data.metrics,
      weatherContext: {
        condition: weatherData?.current?.condition || 'Clear',
        temperature: weatherData?.current?.temperature ?? 25,
        risk: weatherData?.weatherRisk || 'LOW'
      }
    };
  } catch (error) {
    const failureReason = error.code ? `${error.code} (${error.message})` : error.message;
    console.warn(`[ETA Service] FastAPI microservice call to ${FASTAPI_ETA_URL} failed (${failureReason}). Returning ORS Baseline fallback.`);
    return {
      success: true,
      mlEtaAvailable: false,
      modelStatus: 'FALLBACK',
      datasetType: 'SYNTHETIC',
      shipmentId: shipment._id,
      trackingNumber: shipment.trackingNumber,
      baselineDurationMin: roundNumber(expectedDurationMin, 2),
      baselineDurationHours: roundNumber(expectedDurationMin / 60, 2),
      predictedDurationMin: roundNumber(expectedDurationMin, 2),
      predictedDurationHours: roundNumber(expectedDurationMin / 60, 2),
      differenceFromBaselineMin: 0,
      modelName: 'ORS Baseline (Fallback)',
      fallbackReason: `FastAPI service offline or unreachable: ${failureReason}`,
      weatherContext: {
        condition: weatherData?.current?.condition || 'Clear',
        temperature: weatherData?.current?.temperature ?? 25,
        risk: weatherData?.weatherRisk || 'LOW'
      }
    };
  }
};

const roundNumber = (num, decimals = 2) => {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

module.exports = {
  predictShipmentETA
};
