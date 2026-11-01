const accessibilityService = require('../services/accessibilityService');
const Shipment = require('../models/Shipment');
require('../models/Vehicle');
require('../models/Driver');
require('../models/Route');
require('../models/User');

// @desc    Get Phase 3E Accessibility Intelligence evaluation for a specific shipment
// @route   GET /api/accessibility/shipment/:shipmentId
// @access  Public / Protected
const getShipmentAccessibility = async (req, res, next) => {
  try {
    const { shipmentId } = req.params;
    const { routeScore, distanceKm, durationMinutes, expectedDurationMin } = req.query;

    const options = {};
    if (routeScore !== undefined && routeScore !== null) {
      options.routeScore = Number(routeScore);
    }
    if (distanceKm !== undefined && distanceKm !== null) {
      options.distanceKm = Number(distanceKm);
    }
    const duration = expectedDurationMin !== undefined ? expectedDurationMin : durationMinutes;
    if (duration !== undefined && duration !== null) {
      options.durationMinutes = Number(duration);
      options.expectedDurationMin = Number(duration);
    }

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

    const accessibilityResult = await accessibilityService.evaluateShipmentAccessibility(shipment, options);
    res.json(accessibilityResult);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getShipmentAccessibility
};
