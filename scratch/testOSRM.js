async function testOSRM() {
  const srcLng = 75.7006;
  const srcLat = 31.2485; // Phagwara
  const destLng = 78.7520;
  const destLat = 14.3895; // Mittamadapalle

  const url = `https://router.project-osrm.org/route/v1/driving/${srcLng},${srcLat};${destLng},${destLat}?overview=full&geometries=geojson`;
  console.log('Testing OSRM API:', url);

  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('OSRM Code:', data.code);
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      console.log('OSRM Distance:', (route.distance / 1000).toFixed(2), 'Km');
      console.log('OSRM Duration:', Math.round(route.duration / 60), 'mins');
      console.log('OSRM Geometry Type:', route.geometry.type);
      console.log('OSRM Coordinates Count:', route.geometry.coordinates.length);
      console.log('First 3 Coords:', route.geometry.coordinates.slice(0, 3));
      console.log('Last 3 Coords:', route.geometry.coordinates.slice(-3));
    } else {
      console.log('No routes found in OSRM response.');
    }
  } catch (err) {
    console.error('OSRM Error:', err.message);
  }
}

testOSRM();
