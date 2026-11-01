const express = require('express');
const router = express.Router();
const { getAIDashboardOverview } = require('../controllers/aiDashboardController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/overview', protect, authorize('OWNER'), getAIDashboardOverview);
router.get('/shipment/:shipmentId', protect, authorize('OWNER'), (req, res, next) => {
  req.query.shipmentId = req.params.shipmentId;
  getAIDashboardOverview(req, res, next);
});

module.exports = router;
