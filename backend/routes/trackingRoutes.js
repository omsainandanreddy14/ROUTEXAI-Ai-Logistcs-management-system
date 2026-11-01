const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const { protect, authorize } = require('../middleware/authMiddleware');

// GPS Update API (Protected for authenticated driver/vehicle/system/owner updates)
router.patch('/vehicles/:vehicleId/location', protect, trackingController.updateLocation);
router.post('/location', protect, trackingController.updateLocation);

// Current Live Tracking API (Owner Restricted)
router.get('/vehicles/live', protect, authorize('OWNER'), trackingController.getLiveTracking);

module.exports = router;
