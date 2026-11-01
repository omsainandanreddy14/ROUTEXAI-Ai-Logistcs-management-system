const delayRiskService = require('../services/delayRiskService');
const Shipment = require('../models/Shipment');

// @desc    Get ML-based Delay Risk prediction for a specific shipment
// @route   GET /api/delay-risk/shipment/:shipmentId
// @access  Public / Protected
const getShipmentDelayRisk = async (req, res, next) => {
  try {
    const { shipmentId } = req.params;
    const shipment = await Shipment.findById(shipmentId)
      .populate('vehicle')
      .populate('driver')
      .populate('route');

    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: 'Shipment not found'
      });
    }

    const riskResult = await delayRiskService.predictShipmentDelayRisk(shipment, req.query);
    res.json(riskResult);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getShipmentDelayRisk
};
