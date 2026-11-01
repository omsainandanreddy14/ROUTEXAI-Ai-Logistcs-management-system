const trackingService = require('../services/trackingService');

/**
 * Update Vehicle Location & Tracking Status (Phase 4A)
 * Endpoint: PATCH /api/tracking/vehicles/:vehicleId/location OR POST /api/tracking/location
 */
const updateLocation = async (req, res, next) => {
  try {
    const vehicleId = req.params.vehicleId || req.body.vehicleId;

    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle ID is required'
      });
    }

    const { latitude, longitude, speed, status, driverId, shipmentId } = req.body;

    const result = await trackingService.updateVehicleLocation({
      vehicleId,
      driverId,
      shipmentId,
      latitude,
      longitude,
      speed,
      status
    });

    res.status(200).json({
      success: true,
      message: 'Vehicle tracking location updated successfully',
      data: result
    });
  } catch (error) {
    if (
      error.message.includes('not found') ||
      error.message.includes('Invalid latitude') ||
      error.message.includes('Invalid longitude') ||
      error.message.includes('Invalid speed')
    ) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

/**
 * Retrieve Owner Live Vehicle Tracking Dashboard Overview (Phase 4A)
 * Endpoint: GET /api/tracking/vehicles/live
 */
const getLiveTracking = async (req, res, next) => {
  try {
    const { staleMinutes, offlineMinutes } = req.query;

    const result = await trackingService.getLiveVehicleTracking({
      staleMinutes,
      offlineMinutes
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateLocation,
  getLiveTracking
};
