const etaService = require('../services/etaService');
const Shipment = require('../models/Shipment');

// @desc    Get ML-based ETA prediction for a specific shipment
// @route   GET /api/eta/shipment/:shipmentId
// @access  Public / Protected
const getShipmentETA = async (req, res, next) => {
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

    const etaResult = await etaService.predictShipmentETA(shipment, req.query);
    res.json(etaResult);
  } catch (error) {
    next(error);
  }
};

// @desc    Predict ETA for arbitrary route inputs (ad-hoc calculation)
// @route   POST /api/eta/predict
// @access  Public / Protected
const predictCustomETA = async (req, res, next) => {
  try {
    const { distanceKm, expectedDurationMin, weightKg, priority, vehicleType, packageType } = req.body;

    const mockShipment = {
      _id: 'adhoc-prediction',
      trackingNumber: 'RXAI-ADHOC',
      estimatedDistanceKm: distanceKm || 100,
      estimatedDurationMinutes: expectedDurationMin || (distanceKm ? distanceKm * 1.5 : 120),
      weightKg: weightKg || 500,
      priority: priority || 'MEDIUM',
      packageType: packageType || 'STANDARD',
      vehicle: { type: vehicleType || 'TRUCK', capacityKg: 5000 },
      pickupLocation: { coordinates: [77.2090, 28.6139] }
    };

    const etaResult = await etaService.predictShipmentETA(mockShipment);
    res.json(etaResult);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getShipmentETA,
  predictCustomETA
};
