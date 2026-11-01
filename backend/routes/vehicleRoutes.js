const express = require('express');
const router = express.Router();
const { getVehicles, createVehicle, updateVehicle } = require('../controllers/vehicleController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, getVehicles);
router.post('/', protect, authorize('OWNER'), createVehicle);
router.put('/:id', protect, authorize('OWNER'), updateVehicle);

module.exports = router;
