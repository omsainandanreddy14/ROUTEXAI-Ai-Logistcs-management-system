const express = require('express');
const router = express.Router();
const { getShipmentDelayRisk } = require('../controllers/delayRiskController');

router.get('/shipment/:shipmentId', getShipmentDelayRisk);

module.exports = router;
