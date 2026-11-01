const shipmentLifecycleService = require('../services/shipmentLifecycleService');
const Shipment = require('../models/Shipment');

/**
 * Get shipment lifecycle by ID
 * Endpoint: GET /api/shipment-lifecycle/:shipmentId
 */
const getLifecycleByShipmentId = async (req, res, next) => {
  try {
    const { shipmentId } = req.params;
    const result = await shipmentLifecycleService.getShipmentLifecycle(shipmentId);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

/**
 * Get shipment lifecycle by tracking ID
 * Endpoint: GET /api/shipment-lifecycle/tracking/:trackingId
 */
const getLifecycleByTrackingId = async (req, res, next) => {
  try {
    const { trackingId } = req.params;
    const result = await shipmentLifecycleService.getShipmentLifecycle(trackingId);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

/**
 * Update shipment lifecycle status (Phase 4B)
 * Endpoint: PATCH /api/shipment-lifecycle/:shipmentId/status
 */
const updateLifecycleStatus = async (req, res, next) => {
  try {
    const { shipmentId } = req.params;
    const { status, note, location, vehicleId, driverId } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'New status is required'
      });
    }

    const result = await shipmentLifecycleService.updateShipmentLifecycle(
      shipmentId,
      status,
      { note, location, vehicleId, driverId },
      req.user
    );

    res.status(200).json({
      success: true,
      message: `Shipment status successfully updated to ${status}`,
      data: result
    });
  } catch (error) {
    if (error.statusCode === 400 || error.isDuplicate || error.message?.includes('Invalid') || error.message?.includes('already in') || error.message?.includes('cannot undergo')) {
      return res.status(400).json({
        success: false,
        message: error.message,
        details: error.details
      });
    }
    if (error.statusCode === 409 || error.message?.includes('Conflict')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    if (error.message?.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

/**
 * Get Owner Lifecycle Overview Dashboard
 * Endpoint: GET /api/shipment-lifecycle/overview
 */
const getLifecycleOverview = async (req, res, next) => {
  try {
    const result = await shipmentLifecycleService.getShipmentLifecycleOverview();
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLifecycleByShipmentId,
  getLifecycleByTrackingId,
  updateLifecycleStatus,
  getLifecycleOverview
};
