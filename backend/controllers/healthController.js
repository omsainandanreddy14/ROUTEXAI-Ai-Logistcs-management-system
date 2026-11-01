const mongoose = require('mongoose');
const { checkMLHealth } = require('../services/mlProcessSupervisor');

/**
 * @desc    Comprehensive backend & deployment health check endpoint
 * @route   GET /health and GET /api/health
 * @access  Public
 */
const getHealthStatus = async (req, res) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // 1. Inspect actual Mongoose connection state
  // readyState codes: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const readyStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const readyState = mongoose.connection ? mongoose.connection.readyState : 0;
  const mongoStatus = readyStateMap[readyState] || 'unknown';
  const isMongoConnected = readyState === 1;

  // 2. Inspect ML microservice connectivity via configured FASTAPI_HEALTH_URL
  let mlHealth = { running: false, error: 'Unchecked' };
  try {
    mlHealth = await checkMLHealth(1500);
  } catch (err) {
    mlHealth = { running: false, error: err.message };
  }

  // 3. Determine operational status
  // MongoDB is the critical dependency for core backend operations.
  // ML service is an intelligent auxiliary service with automatic baseline fallbacks.
  const isHealthy = isMongoConnected;
  let overallStatus = 'unhealthy';

  if (isMongoConnected) {
    overallStatus = mlHealth.running ? 'healthy' : 'degraded';
  }

  const httpStatus = isHealthy ? 200 : 503;

  const payload = {
    status: overallStatus,
    service: 'RouteXAI Backend Engine',
    timestamp,
    uptimeSeconds: Math.floor(process.uptime()),
    responseTimeMs: Date.now() - startTime,
    dependencies: {
      mongodb: {
        status: mongoStatus,
        connected: isMongoConnected,
        readyState: readyState
      },
      mlService: {
        status: mlHealth.running ? 'connected' : 'unreachable',
        connected: !!mlHealth.running,
        etaModelLoaded: !!mlHealth.etaModelLoaded,
        delayRiskModelLoaded: !!mlHealth.delayRiskModelLoaded
      }
    }
  };

  return res.status(httpStatus).json(payload);
};

module.exports = { getHealthStatus };
