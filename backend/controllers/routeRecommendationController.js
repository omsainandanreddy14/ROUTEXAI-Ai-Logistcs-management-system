const routeRecommendationService = require('../services/routeRecommendationService');

// @desc    Get AI Route Recommendation for shipment
// @route   GET /api/route-recommendation/shipment/:shipmentId
// @access  Private
const getShipmentRouteRecommendation = async (req, res, next) => {
  try {
    const { shipmentId } = req.params;
    if (!shipmentId) {
      return res.status(400).json({ success: false, message: 'shipmentId parameter is required.' });
    }

    const recommendation = await routeRecommendationService.recommendRouteForShipment(shipmentId);

    res.json({
      success: true,
      data: recommendation
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getShipmentRouteRecommendation
};
