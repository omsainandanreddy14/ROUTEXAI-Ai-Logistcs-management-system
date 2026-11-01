const express = require('express');
const router = express.Router();
const { getDrivers, getDriverMe, updateDriverStatus } = require('../controllers/driverController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, authorize('OWNER'), getDrivers);
router.get('/me', protect, authorize('DRIVER'), getDriverMe);
router.put('/status', protect, authorize('DRIVER', 'OWNER'), updateDriverStatus);

module.exports = router;
