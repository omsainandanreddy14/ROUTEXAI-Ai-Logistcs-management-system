const express = require('express');
const router = express.Router();
const { getCurrentWeather, getShipmentEndpointWeather } = require('../controllers/weatherController');
const { protect } = require('../middleware/authMiddleware');

router.get('/current', protect, getCurrentWeather);
router.get('/shipment/:id', protect, getShipmentEndpointWeather);

module.exports = router;
