const express = require('express');
const router = express.Router();
const {
  getShipments,
  createShipment,
  getShipmentByIdentifier,
  assignShipment,
  updateShipmentStatus
} = require('../controllers/shipmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, getShipments);
router.post('/', protect, authorize('CUSTOMER', 'OWNER'), createShipment);
router.get('/:identifier', getShipmentByIdentifier);
router.put('/:id/assign', protect, authorize('OWNER'), assignShipment);
router.put('/:id/status', protect, authorize('OWNER', 'DRIVER'), updateShipmentStatus);

module.exports = router;
