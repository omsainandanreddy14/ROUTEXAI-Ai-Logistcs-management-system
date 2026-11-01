const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');

const FASTAPI_HEALTH_URL = process.env.FASTAPI_HEALTH_URL || 'http://127.0.0.1:8000/health';
let spawnedProcess = null;

/**
 * Check whether FastAPI ML Microservice is running and responding to health check.
 * @returns {Promise<{running: boolean, data?: object, error?: string}>}
 */
const checkMLHealth = async (timeoutMs = 2000) => {
  try {
    const res = await axios.get(FASTAPI_HEALTH_URL, { timeout: timeoutMs });
    if (res.status === 200 && res.data && res.data.status === 'ok') {
      return {
        running: true,
        etaModelLoaded: !!res.data.etaModelLoaded,
        delayRiskModelLoaded: !!res.data.delayRiskModelLoaded,
        data: res.data
      };
    }
    return {
      running: false,
      error: `Unexpected status ${res.status}`
    };
  } catch (err) {
    return {
      running: false,
      error: err.code || err.message
    };
  }
};

/**
 * Ensure FastAPI ML Microservice is running.
 * If down, attempts to auto-spawn the service using `py -m uvicorn ml.services.eta_api:app`.
 */
const ensureMLServiceRunning = async () => {
  const initialHealth = await checkMLHealth(1500);
  if (initialHealth.running) {
    console.log(`[ML Supervisor] FastAPI microservice is healthy on ${FASTAPI_HEALTH_URL} (ETA & Delay Risk models active).`);
    return initialHealth;
  }

  console.log(`[ML Supervisor] FastAPI microservice is offline (${initialHealth.error}).`);

  // In production or when pointing to a remote service, do not attempt local child process spawn
  const isLocalEndpoint = FASTAPI_HEALTH_URL.includes('127.0.0.1') || FASTAPI_HEALTH_URL.includes('localhost');
  if (process.env.NODE_ENV === 'production' || !isLocalEndpoint) {
    console.warn(`[ML Supervisor] Remote FastAPI service at ${FASTAPI_HEALTH_URL} is currently unreachable. Skipping local process spawn.`);
    return initialHealth;
  }

  console.log(`[ML Supervisor] Attempting local development auto-spawn...`);
  const rootDir = path.resolve(__dirname, '..', '..');

  try {
    // Attempt to spawn via Python launcher 'py' (standard on Windows with multiple Pythons)
    spawnedProcess = spawn('py', ['-m', 'uvicorn', 'ml.services.eta_api:app', '--host', '127.0.0.1', '--port', '8000'], {
      cwd: rootDir,
      shell: true,
      stdio: 'ignore'
    });

    spawnedProcess.on('error', (err) => {
      console.warn(`[ML Supervisor] Auto-spawn process error: ${err.message}`);
    });

    spawnedProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[ML Supervisor] Auto-spawned ML process exited with code ${code}.`);
      }
    });

    // Clean up child process when Node exits
    const cleanup = () => {
      if (spawnedProcess && !spawnedProcess.killed) {
        try {
          spawnedProcess.kill();
        } catch (_) {}
      }
    };
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Poll for readiness up to 6 times (max ~4.5 seconds)
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 750));
      const health = await checkMLHealth(1000);
      if (health.running) {
        console.log(`[ML Supervisor] FastAPI microservice successfully auto-spawned and ready on ${FASTAPI_HEALTH_URL}.`);
        return health;
      }
    }

    console.warn('[ML Supervisor] Auto-spawn launched but FastAPI health check timed out. Please run start-all.bat if models show fallback.');
    return { running: false, error: 'Spawn timed out' };
  } catch (spawnErr) {
    console.warn(`[ML Supervisor] Unable to spawn FastAPI service: ${spawnErr.message}. Ensure Python 3.13 is installed.`);
    return { running: false, error: spawnErr.message };
  }
};

module.exports = {
  checkMLHealth,
  ensureMLServiceRunning
};
