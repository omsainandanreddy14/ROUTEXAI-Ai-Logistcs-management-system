const express = require('express');
const router = express.Router();
const shipmentLifecycleController = require('../controllers/shipmentLifecycleController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Owner Overview (Owner Restricted)
router.get('/overview', protect, authorize('OWNER'), shipmentLifecycleController.getLifecycleOverview);

// Get by Tracking ID
router.get('/tracking/:trackingId', protect, shipmentLifecycleController.getLifecycleByTrackingId);

// Get by Shipment ID
router.get('/:shipmentId', protect, shipmentLifecycleController.getLifecycleByShipmentId);

// Update Status (Owner and assigned Driver)
router.patch('/:shipmentId/status', protect, authorize('OWNER', 'DRIVER'), shipmentLifecycleController.updateLifecycleStatus);

module.exports = router;
