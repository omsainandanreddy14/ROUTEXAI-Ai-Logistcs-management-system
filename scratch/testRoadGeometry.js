async function runRoadTest() {
  console.log('--- TESTING REAL ROAD GEOMETRY FOR PHAGWARA TO MITTAMADAPALLE ---');

  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@routexai.com', password: 'RouteXAI@123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token || loginData.data?.token;

  const payload = {
    source: {
      latitude: 31.24851483384525,
      longitude: 75.70064890805875,
      address: 'Lovely Professional University, फगवाड़ा, Punjab, 144411',
      city: 'फगवाड़ा'
    },
    destination: {
      latitude: 14.389470224093053,
      longitude: 78.7519995532675,
      address: 'Mittamadapalle, Mittamadapalle, Andhra Pradesh, 516216',
      city: 'Mittamadapalle'
    }
  };

  const res = await fetch('http://localhost:5000/api/routes/calculate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log('Success:', data.success);
  if (data.data?.routes && data.data.routes.length > 0) {
    const routeA = data.data.routes[0];
    console.log('Route Name:', routeA.name);
    console.log('Road Distance:', routeA.distanceKm, 'Km');
    console.log('Driving Duration:', routeA.durationMinutes, 'mins');
    console.log('Geometry Type:', routeA.geometry.type);
    console.log('Road Polyline Waypoint Count:', routeA.geometry.coordinates.length);
    console.log('Start Waypoint:', routeA.geometry.coordinates[0]);
    console.log('Mid Waypoint (Highway curve sample):', routeA.geometry.coordinates[Math.floor(routeA.geometry.coordinates.length / 2)]);
    console.log('End Waypoint:', routeA.geometry.coordinates[routeA.geometry.coordinates.length - 1]);
  }
}

runRoadTest();
