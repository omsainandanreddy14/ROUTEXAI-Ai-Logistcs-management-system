const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');

dotenv.config();

connectDB();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/hubs', require('./routes/hubRoutes'));
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
app.use('/api/drivers', require('./routes/driverRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/shipments', require('./routes/shipmentRoutes'));
app.use('/api/routes', require('./routes/routeRoutes'));
app.use('/api/weather', require('./routes/weatherRoutes'));
app.use('/api/eta', require('./routes/etaRoutes'));
app.use('/api/delay-risk', require('./routes/delayRiskRoutes'));
app.use('/api/accessibility', require('./routes/accessibilityRoutes'));
app.use('/api/route-recommendation', require('./routes/routeRecommendationRoutes'));
app.use('/api/ai-dashboard', require('./routes/aiDashboardRoutes'));
app.use('/api/tracking', require('./routes/trackingRoutes'));
app.use('/api/shipment-lifecycle', require('./routes/shipmentLifecycleRoutes'));
app.use('/api/eta-monitoring', require('./routes/etaMonitoringRoutes'));
app.use('/api/pricing', require('./routes/pricingRoutes'));

const { checkMLHealth, ensureMLServiceRunning } = require('./services/mlProcessSupervisor');

app.get('/api/ml/health', async (req, res) => {
  const status = await checkMLHealth(2000);
  res.json({
    success: true,
    ...status
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'RouteXAI Backend Engine',
    phase: 'Phase 3A - Real-Time Weather Intelligence Engine',
    timestamp: new Date()
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`RouteXAI Backend Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  ensureMLServiceRunning().catch((err) => {
    console.warn('[ML Supervisor] Background check warning:', err.message);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[RouteXAI Error] Port ${PORT} is already in use. Retrying or free port ${PORT} to continue.\n`);
  } else {
    console.error('Server error:', err.message);
  }
});
