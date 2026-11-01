const axios = require('axios');

// In-memory cache for reverse geocoding results
const geocodeCache = new Map();

/**
 * Reverse-geocode latitude and longitude coordinates into a human-readable city/locality name.
 * Uses public APIs dynamically without any hardcoded city mappings.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<{ city: string, state: string, country: string, formattedName: string }>}
 */
const reverseGeocode = async (latitude, longitude) => {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return { city: 'Unknown Location', state: '', country: '', formattedName: 'Unknown Location' };
  }

  // Cache key rounded to ~100m precision (3 decimal places)
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  // Primary API: BigDataCloud Reverse Geocoding API (Fast, Free, No API key required)
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await axios.get(url, { timeout: 3000 });
    
    if (res.data) {
      const city = res.data.city || res.data.locality || res.data.principalSubdivision || 'Unknown Location';
      const state = res.data.principalSubdivision || '';
      const country = res.data.countryName || '';
      const formattedName = city;

      const result = { city, state, country, formattedName };
      geocodeCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.warn(`[Geocoding Service] Primary reverse geocode failed for (${lat}, ${lng}):`, err.message);
  }

  // Fallback API: OpenStreetMap Nominatim API
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'RouteXAI-Logistics/1.0' },
      timeout: 3000
    });

    if (res.data && res.data.address) {
      const addr = res.data.address;
      const city = addr.city || addr.town || addr.village || addr.suburb || addr.state_district || addr.state || 'Unknown Location';
      const state = addr.state || '';
      const country = addr.country || '';
      const formattedName = city;

      const result = { city, state, country, formattedName };
      geocodeCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.warn(`[Geocoding Service] Fallback reverse geocode failed for (${lat}, ${lng}):`, err.message);
  }

  // Generic fallback if network fails
  const fallbackResult = {
    city: `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
    state: '',
    country: '',
    formattedName: `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`
  };
  geocodeCache.set(cacheKey, fallbackResult);
  return fallbackResult;
};

module.exports = {
  reverseGeocode
};
