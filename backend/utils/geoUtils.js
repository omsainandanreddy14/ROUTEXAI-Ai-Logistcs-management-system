/**
 * Utility functions for geographic and polyline distance calculations
 */

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
  return parseFloat((R * c).toFixed(4));
};

/**
 * Calculate the minimum distance in Km from a vehicle point (lat, lon)
 * to a route polyline given as an array of [longitude, latitude] coordinates (GeoJSON format).
 */
const calculateDistanceToPolyline = (pointLat, pointLon, coordinates) => {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
    return null;
  }

  // If polyline has only 1 point
  if (coordinates.length === 1) {
    const [cLon, cLat] = coordinates[0];
    return calculateHaversineDistance(pointLat, pointLon, cLat, cLon);
  }

  let minDistanceKm = Infinity;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[i + 1];

    const midLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
    const kx = Math.cos(midLat) * 111.32;
    const ky = 110.574;

    const dx = (lon2 - lon1) * kx;
    const dy = (lat2 - lat1) * ky;

    const wx = (pointLon - lon1) * kx;
    const wy = (pointLat - lat1) * ky;

    const c2 = dx * dx + dy * dy;
    let distKm;

    if (c2 <= 0.00000001) {
      // Degenerate segment
      distKm = Math.sqrt(wx * wx + wy * wy);
    } else {
      const c1 = wx * dx + wy * dy;
      const t = c1 / c2;

      if (t <= 0) {
        distKm = Math.sqrt(wx * wx + wy * wy);
      } else if (t >= 1) {
        distKm = Math.sqrt((wx - dx) * (wx - dx) + (wy - dy) * (wy - dy));
      } else {
        const px = t * dx;
        const py = t * dy;
        distKm = Math.sqrt((wx - px) * (wx - px) + (wy - py) * (wy - py));
      }
    }

    if (distKm < minDistanceKm) {
      minDistanceKm = distKm;
    }
  }

  return parseFloat(minDistanceKm.toFixed(3));
};

module.exports = {
  calculateHaversineDistance,
  calculateDistanceToPolyline
};
