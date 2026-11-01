const express = require('express');
const router = express.Router();
const { getShipmentAccessibility } = require('../controllers/accessibilityController');

router.get('/shipment/:shipmentId', getShipmentAccessibility);

module.exports = router;
