const etaMonitoringService = require('../services/etaMonitoringService');
const Shipment = require('../models/Shipment');

// @desc    Get ETA and route deviation monitoring for one shipment
// @route   GET /api/eta-monitoring/shipment/:shipmentId
// @access  Private (Owner, Driver [assigned only], Customer [own only])
const getShipmentETAMonitoring = async (req, res, next) => {
  try {
    const { shipmentId } = req.params;
    const result = await etaMonitoringService.getShipmentETAMonitoring(shipmentId, req.user);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'ETA monitoring record not found for this shipment'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

// @desc    Get fleet-wide ETA and deviation monitoring overview
// @route   GET /api/eta-monitoring/overview
// @access  Private (Owner only)
const getMonitoringOverview = async (req, res, next) => {
  try {
    const result = await etaMonitoringService.getMonitoringOverview(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Trigger on-demand recalculation of shipment ETA
// @route   POST /api/eta-monitoring/recalculate/:shipmentId
// @access  Private (Owner or assigned Driver)
const recalculateShipmentETA = async (req, res, next) => {
  try {
    const { shipmentId } = req.params;

    // Driver authorization check
    if (req.user.role === 'DRIVER') {
      const shipment = await Shipment.findById(shipmentId);
      if (shipment && shipment.driver?.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only recalculate ETA for your assigned shipments.'
        });
      }
    }

    const result = await etaMonitoringService.recalculateShipmentETA(shipmentId, { force: true });
    res.json({
      success: true,
      message: 'Shipment ETA recalculated successfully',
      data: result
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

// @desc    Update ETA monitoring thresholds
// @route   PATCH /api/eta-monitoring/config
// @access  Private (Owner only)
const updateConfig = async (req, res, next) => {
  try {
    const result = etaMonitoringService.updateMonitoringConfig(req.body);
    res.json({
      success: true,
      message: 'ETA monitoring thresholds updated',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getShipmentETAMonitoring,
  getMonitoringOverview,
  recalculateShipmentETA,
  updateConfig
};
