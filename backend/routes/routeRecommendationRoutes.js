const express = require('express');
const router = express.Router();
const { getShipmentRouteRecommendation } = require('../controllers/routeRecommendationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/shipment/:shipmentId', protect, getShipmentRouteRecommendation);

module.exports = router;
