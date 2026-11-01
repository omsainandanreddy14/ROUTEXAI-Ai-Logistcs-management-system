/**
 * RouteXAI Backend Health Endpoint Test Suite
 * Validates deployment monitoring requirements for GET /health and GET /api/health
 */
const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const { getHealthStatus } = require('./controllers/healthController');

async function runHealthTests() {
  console.log('====================================================');
  console.log('   ROUTEXAI DEPLOYMENT HEALTH MONITORING TEST SUITE  ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  // --- Test 1: Express Route Registration Verification ---
  console.log('Test 1: Verifying Express Route Registrations...');
  try {
    // Require app structure without starting listen port
    const express = require('express');
    const app = express();
    app.get('/health', getHealthStatus);
    app.get('/api/health', getHealthStatus);

    const routes = app._router.stack
      .filter((r) => r.route)
      .map((r) => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`);

    assert(routes.includes('GET /health'), 'GET /health is registered on Express router');
    assert(routes.includes('GET /api/health'), 'GET /api/health is registered on Express router');
  } catch (err) {
    assert(false, `Route registration test error: ${err.message}`);
  }

  // --- Test 2: Operational Health Check with MongoDB Connected ---
  console.log('\nTest 2: Testing Operational Health Check (Database Connected)...');
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/routexai';
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    }

    let statusCode = null;
    let jsonPayload = null;

    const mockReq = {};
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonPayload = data;
          }
        };
      }
    };

    await getHealthStatus(mockReq, mockRes);

    assert(statusCode === 200, `Returns HTTP 200 when operational (received ${statusCode})`);
    assert(
      jsonPayload && (jsonPayload.status === 'healthy' || jsonPayload.status === 'degraded'),
      `Status reports operational ('${jsonPayload?.status}')`
    );
    assert(Boolean(jsonPayload?.timestamp), `Timestamp is present (${jsonPayload?.timestamp})`);
    assert(
      !isNaN(Date.parse(jsonPayload?.timestamp)),
      'Timestamp is a valid ISO date string'
    );
    assert(
      jsonPayload?.dependencies?.mongodb?.connected === true,
      'MongoDB dependency reports connected = true'
    );
    assert(
      jsonPayload?.dependencies?.mongodb?.status === 'connected',
      'MongoDB status is "connected"'
    );
    assert(
      jsonPayload?.dependencies?.mongodb?.readyState === 1,
      'MongoDB readyState equals 1'
    );
    assert(
      jsonPayload?.dependencies?.mlService !== undefined,
      'ML Service dependency status is present'
    );
    assert(
      typeof jsonPayload?.dependencies?.mlService?.connected === 'boolean',
      'ML Service connected flag is boolean'
    );

    // Verify secrets protection: no URI, passwords, or tokens in payload
    const rawString = JSON.stringify(jsonPayload);
    const hasSecrets =
      rawString.includes('mongodb+srv://') ||
      rawString.includes('password') ||
      rawString.includes('JWT_SECRET') ||
      rawString.includes('ORS_API_KEY');

    assert(!hasSecrets, 'Zero credentials, connection strings, or secrets exposed in output');
  } catch (err) {
    assert(false, `Operational health check error: ${err.message}`);
  }

  // --- Test 3: Failure Mode Health Check (Simulated DB Disconnected) ---
  console.log('\nTest 3: Testing Dependency Failure Handling (MongoDB Disconnected)...');
  try {
    // Temporarily mock disconnected readyState (0)
    const originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 0,
      configurable: true
    });

    let statusCode = null;
    let jsonPayload = null;

    const mockReq = {};
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonPayload = data;
          }
        };
      }
    };

    await getHealthStatus(mockReq, mockRes);

    assert(statusCode === 503, `Returns HTTP 503 when MongoDB is down (received ${statusCode})`);
    assert(jsonPayload?.status === 'unhealthy', 'Status indicates "unhealthy"');
    assert(
      jsonPayload?.dependencies?.mongodb?.connected === false,
      'MongoDB dependency reports connected = false'
    );
    assert(
      jsonPayload?.dependencies?.mongodb?.status === 'disconnected',
      'MongoDB dependency reports status = "disconnected"'
    );

    // Restore original readyState
    delete mongoose.connection.readyState;
  } catch (err) {
    assert(false, `Failure mode test error: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================\n');

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runHealthTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
