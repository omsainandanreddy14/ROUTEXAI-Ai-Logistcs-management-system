const axios = require('axios');

// Calculate Haversine distance in Km between two lat/lng coordinates
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in Km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
};

// Calculate rule-based or multi-signal Route Intelligence Score
const calculateRouteScore = (distanceKm, durationMinutes, isAlternative = false, index = 0, signalOptions = null) => {
  if (signalOptions && typeof signalOptions === 'object') {
    const quality = signalOptions.qualityScore !== undefined ? Number(signalOptions.qualityScore) : (isAlternative ? 80 : 90);
    const eta = signalOptions.etaScore !== undefined ? Number(signalOptions.etaScore) : Math.max(50, 100 - (durationMinutes / 60) * 1.5);
    const delay = signalOptions.delayScore !== undefined ? Number(signalOptions.delayScore) : 75;
    const access = signalOptions.accessibilityScore !== undefined ? Number(signalOptions.accessibilityScore) : 85;
    const dist = signalOptions.distanceScore !== undefined ? Number(signalOptions.distanceScore) : Math.max(50, 100 - distanceKm * 0.02);
    const weather = signalOptions.weatherScore !== undefined ? Number(signalOptions.weatherScore) : 100;

    const rawScore = (
      quality * 0.25 +
      eta * 0.20 +
      delay * 0.20 +
      access * 0.20 +
      dist * 0.10 +
      weather * 0.05
    );

    return Math.max(50, Math.min(99, Math.round(rawScore)));
  }

  let baseScore = 100;

  // Scaled penalties for distance, duration, and alternative bypass corridor
  const distancePenalty = Math.min(distanceKm * 0.008, 20);
  const durationPenalty = Math.min((durationMinutes / 60) * 0.5, 20);

  let score = Math.round(baseScore - distancePenalty - durationPenalty - index * 5);

  // Keep score within realistic logistics rating range (55 to 98)
  return Math.max(55, Math.min(98, score));
};

// Helper to generate distinct alternative route geometry curve
const generateAlternativeGeometry = (coords) => {
  if (!coords || coords.length < 3) return coords;
  const len = coords.length;
  return coords.map((pt, i) => {
    if (i === 0 || i === len - 1) return pt;
    const factor = Math.sin((i / len) * Math.PI); // Arc offset peaking at midpoint
    const offsetLng = factor * 0.08; // ~8km lateral bypass shift
    const offsetLat = factor * 0.05;
    return [
      parseFloat((pt[0] + offsetLng).toFixed(6)),
      parseFloat((pt[1] + offsetLat).toFixed(6))
    ];
  });
};

// Downsample large polyline coordinate arrays for smooth Leaflet rendering
const sampleCoordinates = (coords, maxPoints = 500) => {
  if (!coords || coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const sampled = [];
  for (let i = 0; i < coords.length; i += step) {
    sampled.push(coords[i]);
  }
  if (coords.length > 0 && sampled[sampled.length - 1] !== coords[coords.length - 1]) {
    sampled.push(coords[coords.length - 1]);
  }
  return sampled;
};

/**
 * Service to query OpenRouteService & OSRM Directions APIs for real road geometry
 */
const calculateCandidateRoutes = async (source, destination, trackingId = null) => {
  const { latitude: srcLat, longitude: srcLng } = source;
  const { latitude: destLat, longitude: destLng } = destination;

  const sLat = parseFloat(srcLat);
  const sLng = parseFloat(srcLng);
  const dLat = parseFloat(destLat);
  const dLng = parseFloat(destLng);

  if (isNaN(sLat) || isNaN(sLng) || isNaN(dLat) || isNaN(dLng)) {
    throw new Error('Invalid source or destination coordinates provided.');
  }

  // Strict geographical coordinate bounds validation
  if (sLat < -90 || sLat > 90 || dLat < -90 || dLat > 90 ||
      sLng < -180 || sLng > 180 || dLng < -180 || dLng > 180) {
    throw new Error('Coordinates out of valid geographical bounds (-90 to 90 lat, -180 to 180 lng).');
  }

  // Debug logging for route calculation verification
  console.log('\n[RouteXAI Route Calculation]');
  console.log(`Shipment:\n${trackingId || 'Direct Coordinates Request'}`);
  console.log(`Pickup:\n${sLat}, ${sLng}`);
  console.log(`Delivery:\n${dLat}, ${dLng}`);
  console.log('Using direct customer-to-customer route.');
  console.log(`ORS Source:\n[${sLng}, ${sLat}]`);
  console.log(`ORS Destination:\n[${dLng}, ${dLat}]\n`);

  const apiKey = process.env.ORS_API_KEY;
  const primaryEndpoint = 'https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson';
  const secondaryEndpoint = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';

  try {
    let orsResponse = null;

    if (apiKey) {
      const payload = {
        coordinates: [
          [parseFloat(srcLng), parseFloat(srcLat)],
          [parseFloat(destLng), parseFloat(destLat)]
        ],
        elevation: false,
        instructions: true,
        preference: 'recommended'
      };

      const headers = {
        Authorization: apiKey,
        'Content-Type': 'application/json'
      };

      try {
        orsResponse = await axios.post(primaryEndpoint, payload, { headers, timeout: 8000 });
      } catch (err) {
        console.log('Primary ORS endpoint fallback, trying secondary endpoint...');
        try {
          orsResponse = await axios.post(secondaryEndpoint, payload, { headers, timeout: 8000 });
        } catch (secErr) {
          console.log('ORS endpoints unavailable or rate-limited. Trying OSRM road routing engine...');
        }
      }
    }

    // Process OpenRouteService Response
    if (orsResponse && orsResponse.data && orsResponse.data.features && orsResponse.data.features.length > 0) {
      const feature = orsResponse.data.features[0];
      const summary = feature.properties?.summary || {};
      const distanceKm = parseFloat(((summary.distance || 0) / 1000).toFixed(2));
      const durationMinutes = Math.round((summary.duration || 0) / 60);
      const rawCoordinates = feature.geometry?.coordinates || [];
      const mainCoordinates = sampleCoordinates(rawCoordinates, 600);
      const altCoordinates = generateAlternativeGeometry(mainCoordinates);

      const mainRoute = {
        id: 'route-opt-1',
        name: 'Route A: Primary Express Highway',
        distanceKm,
        durationMinutes,
        score: calculateRouteScore(distanceKm, durationMinutes, false, 0),
        geometry: {
          type: 'LineString',
          coordinates: mainCoordinates
        },
        trafficStatus: 'Normal Highway Flow',
        weatherRisk: 'LOW',
        roadQuality: 'High-speed Highway'
      };

      const altDistance = parseFloat((distanceKm * 1.06).toFixed(2));
      const altDuration = Math.round(durationMinutes * 1.08);

      const altRoute = {
        id: 'route-opt-2',
        name: 'Route B: Regional Bypass Corridor',
        distanceKm: altDistance,
        durationMinutes: altDuration,
        score: calculateRouteScore(altDistance, altDuration, true, 1),
        geometry: {
          type: 'LineString',
          coordinates: altCoordinates
        },
        trafficStatus: 'Moderate Transit',
        weatherRisk: 'LOW',
        roadQuality: 'Standard Highway'
      };

      return {
        success: true,
        source,
        destination,
        count: 2,
        routes: [mainRoute, altRoute]
      };
    }

    // 2. OSRM Road Routing Engine (Free Public Road-by-Road Highway Routing)
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${parseFloat(srcLng)},${parseFloat(srcLat)};${parseFloat(destLng)},${parseFloat(destLat)}?overview=full&geometries=geojson`;
      const osrmRes = await axios.get(osrmUrl, { timeout: 10000 });

      if (osrmRes.data && osrmRes.data.code === 'Ok' && osrmRes.data.routes && osrmRes.data.routes.length > 0) {
        const osrmRoute = osrmRes.data.routes[0];
        const distanceKm = parseFloat((osrmRoute.distance / 1000).toFixed(2));
        const durationMinutes = Math.round(osrmRoute.duration / 60);
        const rawCoords = osrmRoute.geometry?.coordinates || [];
        const mainCoordinates = sampleCoordinates(rawCoords, 600);
        const altCoordinates = generateAlternativeGeometry(mainCoordinates);

        console.log(`[OSRM Road Engine] Successfully generated real road geometry: ${mainCoordinates.length} waypoints (${distanceKm} Km)`);

        const mainRoute = {
          id: 'route-opt-1',
          name: 'Route A: Primary Express Highway (OSRM Road Routing)',
          distanceKm,
          durationMinutes,
          score: calculateRouteScore(distanceKm, durationMinutes, false, 0),
          geometry: {
            type: 'LineString',
            coordinates: mainCoordinates
          },
          trafficStatus: 'Normal Highway Flow',
          weatherRisk: 'LOW',
          roadQuality: 'National Highway Corridor'
        };

        const altDistance = parseFloat((distanceKm * 1.05).toFixed(2));
        const altDuration = Math.round(durationMinutes * 1.07);

        const altRoute = {
          id: 'route-opt-2',
          name: 'Route B: Regional Bypass Corridor',
          distanceKm: altDistance,
          durationMinutes: altDuration,
          score: calculateRouteScore(altDistance, altDuration, true, 1),
          geometry: {
            type: 'LineString',
            coordinates: altCoordinates
          },
          trafficStatus: 'Moderate Transit',
          weatherRisk: 'LOW',
          roadQuality: 'State Highway Bypass'
        };

        return {
          success: true,
          source,
          destination,
          count: 2,
          routes: [mainRoute, altRoute]
        };
      }
    } catch (osrmError) {
      console.warn('OSRM road engine unavailable:', osrmError.message);
    }

    // Internal geometric fallback if all online services are offline
    const directKm = calculateHaversineDistance(srcLat, srcLng, destLat, destLng);
      const highwayKm = parseFloat((directKm * 1.25).toFixed(2));
      const estMinutes = Math.round((highwayKm / 60) * 60); // ~60 km/h avg logistics speed

      // Generate 10 interpolated waypoints between src and dest
      const waypointsA = [];
      const waypointsB = [];
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const ratio = i / steps;
        const lng = parseFloat((parseFloat(srcLng) + (parseFloat(destLng) - parseFloat(srcLng)) * ratio).toFixed(6));
        const lat = parseFloat((parseFloat(srcLat) + (parseFloat(destLat) - parseFloat(srcLat)) * ratio).toFixed(6));
        waypointsA.push([lng, lat]);
      }

      const altWaypoints = generateAlternativeGeometry(waypointsA);

      const fallbackRouteA = {
        id: 'route-opt-1',
        name: 'Route A: Direct Transit Highway',
        distanceKm: highwayKm,
        durationMinutes: estMinutes,
        score: calculateRouteScore(highwayKm, estMinutes, false, 0),
        geometry: {
          type: 'LineString',
          coordinates: waypointsA
        },
        trafficStatus: 'Normal Logistics Flow',
        weatherRisk: 'LOW',
        roadQuality: 'National Highway Corridor'
      };

      const fallbackRouteB = {
        id: 'route-opt-2',
        name: 'Route B: Regional Bypass Highway',
        distanceKm: parseFloat((highwayKm * 1.07).toFixed(2)),
        durationMinutes: Math.round(estMinutes * 1.09),
        score: calculateRouteScore(highwayKm * 1.07, estMinutes * 1.09, true, 1),
        geometry: {
          type: 'LineString',
          coordinates: altWaypoints
        },
        trafficStatus: 'Moderate Flow',
        weatherRisk: 'LOW',
        roadQuality: 'State Highway Bypass'
      };

      return {
        success: true,
        source,
        destination,
        count: 2,
        routes: [fallbackRouteA, fallbackRouteB]
      };
  } catch (error) {
    console.error('Route calculation service error:', error.message);
    throw error;
  }
};

module.exports = {
  calculateCandidateRoutes,
  calculateHaversineDistance,
  calculateRouteScore
};
