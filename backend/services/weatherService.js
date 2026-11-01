const axios = require('axios');

// In-memory weather cache (TTL: 15 minutes)
const weatherCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * WMO Weather Interpretation Codes (WW) mapping
 */
const getWmoWeatherCondition = (code) => {
  const wmoMap = {
    0: 'Clear Sky',
    1: 'Mainly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing Rime Fog',
    51: 'Light Drizzle',
    53: 'Moderate Drizzle',
    55: 'Dense Drizzle',
    56: 'Light Freezing Drizzle',
    57: 'Dense Freezing Drizzle',
    61: 'Slight Rain',
    63: 'Moderate Rain',
    65: 'Heavy Rain',
    66: 'Light Freezing Rain',
    67: 'Heavy Freezing Rain',
    71: 'Slight Snow Fall',
    73: 'Moderate Snow Fall',
    75: 'Heavy Snow Fall',
    77: 'Snow Grains',
    80: 'Slight Rain Showers',
    81: 'Moderate Rain Showers',
    82: 'Violent Rain Showers',
    85: 'Slight Snow Showers',
    86: 'Heavy Snow Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with Slight Hail',
    99: 'Thunderstorm with Heavy Hail'
  };
  return wmoMap[code] || 'Variable Atmospheric Conditions';
};

/**
 * Transparent Rule-Based Weather Risk Indicator (LOW, MEDIUM, HIGH)
 * Thresholds:
 * - HIGH: Rain > 10mm OR Wind > 45km/h OR Severe WMO (95,96,99) OR Visibility < 1000m
 * - MEDIUM: Rain > 2mm OR Wind > 25km/h OR Moderate WMO (45,48,51,53,55,61,63,80,81) OR Visibility < 3000m
 * - LOW: Normal clear/mild weather
 */
const calculateWeatherRisk = ({ rain, windSpeed, weatherCode, visibility }) => {
  const severeWmoCodes = [95, 96, 99];
  const moderateWmoCodes = [45, 48, 51, 53, 55, 61, 63, 65, 80, 81, 82];

  if (
    rain > 10.0 ||
    windSpeed > 45.0 ||
    severeWmoCodes.includes(weatherCode) ||
    (visibility !== null && visibility < 1000)
  ) {
    return {
      weatherRisk: 'HIGH',
      riskReason:
        severeWmoCodes.includes(weatherCode)
          ? 'Active thunderstorm or severe convective storm detected.'
          : rain > 10.0
          ? `Heavy rainfall deluge detected (${rain} mm).`
          : windSpeed > 45.0
          ? `Gale force wind gusts detected (${windSpeed} km/h).`
          : `Severe low visibility warning (${(visibility / 1000).toFixed(1)} km).`
    };
  }

  if (
    rain > 2.0 ||
    windSpeed > 25.0 ||
    moderateWmoCodes.includes(weatherCode) ||
    (visibility !== null && visibility < 3000)
  ) {
    return {
      weatherRisk: 'MEDIUM',
      riskReason:
        rain > 2.0
          ? `Moderate precipitation detected (${rain} mm).`
          : windSpeed > 25.0
          ? `Elevated crosswind speed (${windSpeed} km/h).`
          : `Moderate weather activity (${getWmoWeatherCondition(weatherCode)}).`
    };
  }

  return {
    weatherRisk: 'LOW',
    riskReason: 'Favorable logistics weather conditions along transit corridor.'
  };
};

/**
 * Fetch Current Weather from Open-Meteo API with In-Memory Caching
 * Open-Meteo API requires NO API KEY for free usage.
 */
const getWeatherForLocation = async (latitude, longitude) => {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Invalid latitude or longitude parameters provided.');
  }

  // Cache key rounded to 2 decimal places (~1.1 km resolution)
  const cacheKey = `${lat.toFixed(2)}_${lng.toFixed(2)}`;
  const cachedData = weatherCache.get(cacheKey);

  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL_MS) {
    return { ...cachedData.data, cached: true };
  }

  const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&hourly=visibility&forecast_days=1`;

  try {
    const response = await axios.get(openMeteoUrl, { timeout: 6000 });
    const data = response.data;
    const current = data.current || {};
    const hourly = data.hourly || {};

    const temperature = current.temperature_2m ?? 25;
    const apparentTemperature = current.apparent_temperature ?? temperature;
    const humidity = current.relative_humidity_2m ?? 65;
    const precipitation = current.precipitation ?? 0;
    const rain = current.rain ?? precipitation;
    const weatherCode = current.weather_code ?? 0;
    const cloudCover = current.cloud_cover ?? 20;
    const windSpeed = current.wind_speed_10m ?? 12;
    const windDirection = current.wind_direction_10m ?? 180;

    // Visibility in meters from current hourly step or fallback
    const visibility = Array.isArray(hourly.visibility) && hourly.visibility.length > 0 ? hourly.visibility[0] : 10000;

    const condition = getWmoWeatherCondition(weatherCode);
    const { weatherRisk, riskReason } = calculateWeatherRisk({ rain, windSpeed, weatherCode, visibility });

    const formattedResponse = {
      location: {
        latitude: lat,
        longitude: lng
      },
      temperature: Math.round(temperature),
      apparentTemperature: Math.round(apparentTemperature),
      humidity: Math.round(humidity),
      precipitation: parseFloat(precipitation.toFixed(1)),
      rain: parseFloat(rain.toFixed(1)),
      windSpeed: Math.round(windSpeed),
      windDirection: Math.round(windDirection),
      visibility: Math.round(visibility),
      visibilityKm: parseFloat((visibility / 1000).toFixed(1)),
      cloudCover: Math.round(cloudCover),
      weatherCode,
      condition,
      weatherRisk,
      riskReason,
      cached: false,
      timestamp: new Date().toISOString()
    };

    // Store in cache
    weatherCache.set(cacheKey, {
      timestamp: Date.now(),
      data: formattedResponse
    });

    return formattedResponse;
  } catch (error) {
    console.error('Open-Meteo API request error:', error.message);
    throw new Error('Weather data temporarily unavailable.');
  }
};

/**
 * Helper to fetch endpoint weather for pickup and delivery locations of a shipment
 */
const getShipmentEndpointWeather = async (shipment) => {
  if (!shipment) return null;

  const pCoords = shipment.pickupLocation?.coordinates;
  const dCoords = shipment.deliveryLocation?.coordinates;

  if (!pCoords || !dCoords || !Array.isArray(pCoords) || !Array.isArray(dCoords)) {
    return null;
  }

  const pickupLat = parseFloat(pCoords[1]);
  const pickupLng = parseFloat(pCoords[0]);
  const deliveryLat = parseFloat(dCoords[1]);
  const deliveryLng = parseFloat(dCoords[0]);

  const [pickupResult, deliveryResult] = await Promise.allSettled([
    getWeatherForLocation(pickupLat, pickupLng),
    getWeatherForLocation(deliveryLat, deliveryLng)
  ]);

  const pickupWeather = pickupResult.status === 'fulfilled' ? pickupResult.value : null;
  const deliveryWeather = deliveryResult.status === 'fulfilled' ? deliveryResult.value : null;

  let endpointRisk = 'LOW';
  if (
    (pickupWeather && pickupWeather.weatherRisk === 'HIGH') ||
    (deliveryWeather && deliveryWeather.weatherRisk === 'HIGH')
  ) {
    endpointRisk = 'HIGH';
  } else if (
    (pickupWeather && pickupWeather.weatherRisk === 'MEDIUM') ||
    (deliveryWeather && deliveryWeather.weatherRisk === 'MEDIUM')
  ) {
    endpointRisk = 'MEDIUM';
  }

  const pickupCity = (typeof shipment.pickupAddress === 'object' && shipment.pickupAddress?.city) || shipment.pickupCity || 'Customer Pickup';
  const deliveryCity = (typeof shipment.deliveryAddress === 'object' && shipment.deliveryAddress?.city) || shipment.deliveryCity || 'Customer Delivery';

  return {
    shipmentId: shipment._id,
    trackingNumber: shipment.trackingNumber || shipment.trackingId,
    endpointRisk,
    pickupCity,
    pickupWeather,
    deliveryCity,
    deliveryWeather
  };
};

module.exports = {
  getWeatherForLocation,
  calculateWeatherRisk,
  getWmoWeatherCondition,
  getShipmentEndpointWeather
};
