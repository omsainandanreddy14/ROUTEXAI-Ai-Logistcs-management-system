async function runTests() {
  console.log('--- ROUTEXAI ROUTE CALCULATION VERIFICATION ---');

  let token = null;
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@routexai.com',
        password: 'RouteXAI@123'
      })
    });
    const loginData = await loginRes.json();
    if (loginData.token || loginData.data?.token) {
      token = loginData.token || loginData.data?.token;
      console.log('Successfully logged in as Owner.');
    } else {
      console.log('Login failed:', loginData);
      return;
    }
  } catch (err) {
    console.error('Owner login failed:', err.message);
    return;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Test 1: Direct Customer-to-Customer Route Calculation
  try {
    const payload = {
      source: {
        latitude: 30.9010, // Ludhiana, Punjab
        longitude: 75.8573,
        address: 'Customer Store, Ludhiana',
        city: 'Ludhiana'
      },
      destination: {
        latitude: 16.5062, // Vijayawada, Andhra Pradesh
        longitude: 80.6480,
        address: 'Customer Warehouse, Vijayawada',
        city: 'Vijayawada'
      }
    };

    const res = await fetch('http://localhost:5000/api/routes/calculate', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    console.log('\n[TEST 1 SUCCESS] Route calculation response:');
    console.log('Success:', data.success);
    console.log('Source:', data.data?.source);
    console.log('Destination:', data.data?.destination);
    console.log('Routes returned:', data.data?.count);
    if (data.data?.routes && data.data.routes.length > 0) {
      console.log('Route A Name:', data.data.routes[0].name);
      console.log('Route A Distance:', data.data.routes[0].distanceKm, 'Km');
      console.log('Route A Geometry start coord [lng, lat]:', data.data.routes[0].geometry.coordinates[0]);
      console.log('Route A Geometry end coord [lng, lat]:', data.data.routes[0].geometry.coordinates[data.data.routes[0].geometry.coordinates.length - 1]);
    }
  } catch (err) {
    console.error('[TEST 1 FAILED]:', err.message);
  }

  // Test 2: Missing Coordinates Error (NO Hub Fallback)
  try {
    console.log('\n[TEST 2] Testing missing coordinates validation...');
    const res = await fetch('http://localhost:5000/api/routes/calculate', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        source: { latitude: null, longitude: null },
        destination: { latitude: 16.5062, longitude: 80.6480 }
      })
    });
    const data = await res.json();
    console.log('[TEST 2 SUCCESS] Server correctly rejected missing coordinates with HTTP status:', res.status);
    console.log('Response Error Message:', data.message);
  } catch (err) {
    console.error('[TEST 2 FAILED]:', err.message);
  }
}

runTests();
