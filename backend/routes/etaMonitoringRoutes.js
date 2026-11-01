const express = require('express');
const router = express.Router();
const etaMonitoringController = require('../controllers/etaMonitoringController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Owner fleet overview
router.get('/overview', protect, authorize('OWNER'), etaMonitoringController.getMonitoringOverview);

// Owner-only configuration
router.patch('/config', protect, authorize('OWNER'), etaMonitoringController.updateConfig);

// Single shipment ETA monitoring (Owner, assigned Driver, owning Customer)
router.get('/shipment/:shipmentId', protect, etaMonitoringController.getShipmentETAMonitoring);

// Manual recalculation trigger (Owner, assigned Driver)
router.post('/recalculate/:shipmentId', protect, authorize('OWNER', 'DRIVER'), etaMonitoringController.recalculateShipmentETA);

module.exports = router;
