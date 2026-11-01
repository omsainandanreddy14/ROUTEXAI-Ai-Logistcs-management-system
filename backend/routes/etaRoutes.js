const express = require('express');
const router = express.Router();
const { getShipmentETA, predictCustomETA } = require('../controllers/etaController');

router.get('/shipment/:shipmentId', getShipmentETA);
router.post('/predict', predictCustomETA);

module.exports = router;
