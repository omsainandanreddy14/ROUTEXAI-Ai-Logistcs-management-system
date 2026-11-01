const VehicleTracking = require('../models/VehicleTracking');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const Shipment = require('../models/Shipment');

// Configurable thresholds in minutes
const DEFAULT_STALE_MINUTES = 5;
const DEFAULT_OFFLINE_MINUTES = 30;

/**
 * Update Vehicle GPS location and tracking status (Phase 4A)
 */
const updateVehicleLocation = async ({
  vehicleId,
  driverId,
  shipmentId,
  latitude,
  longitude,
  speed,
  status
}) => {
  // 1. Validate mandatory coordinates & numeric bounds
  const lat = Number(latitude);
  const lng = Number(longitude);
  const spd = Number(speed);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    throw new Error('Invalid latitude: must be a number between -90 and 90');
  }

  if (isNaN(lng) || lng < -180 || lng > 180) {
    throw new Error('Invalid longitude: must be a number between -180 and 180');
  }

  if (isNaN(spd) || spd < 0) {
    throw new Error('Invalid speed: must be a non-negative number');
  }

  // 2. Validate Vehicle existence
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) {
    throw new Error(`Vehicle not found with ID: ${vehicleId}`);
  }

  // 3. Validate Shipment existence if supplied
  let shipmentObj = null;
  if (shipmentId) {
    shipmentObj = await Shipment.findById(shipmentId);
    if (!shipmentObj) {
      throw new Error(`Shipment not found with ID: ${shipmentId}`);
    }
    // Terminal shipments must NEVER be linked as active cargo
    if (['DELIVERED', 'CANCELLED', 'FAILED'].includes(shipmentObj.status)) {
      shipmentObj = null;
    }
  } else {
    // Attempt to find authoritative active shipment assigned to this vehicle
    shipmentObj = await Shipment.findOne({
      vehicle: vehicleId,
      status: { $nin: ['DELIVERED', 'CANCELLED', 'FAILED'] }
    });
  }

  // 4. Validate Driver existence if supplied
  let driverObj = null;
  if (driverId) {
    driverObj = await User.findById(driverId);
    if (!driverObj) {
      throw new Error(`Driver not found with ID: ${driverId}`);
    }
  } else if (shipmentObj?.driver) {
    driverObj = await User.findById(shipmentObj.driver);
  } else if (vehicle.assignedDriver) {
    driverObj = await User.findById(vehicle.assignedDriver);
  }

  // 5. Determine vehicle operational status
  const validStatuses = ['AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'IDLE', 'OFFLINE'];
  let trackingStatus = status;
  if (!trackingStatus || !validStatuses.includes(trackingStatus)) {
    if (shipmentObj && ['IN_TRANSIT', 'PICKED_UP', 'DISPATCHED', 'NEAR_DESTINATION', 'AT_DESTINATION', 'OUT_FOR_DELIVERY'].includes(shipmentObj.status)) {
      trackingStatus = 'IN_TRANSIT';
    } else if (shipmentObj) {
      trackingStatus = 'ASSIGNED';
    } else if (spd > 0) {
      trackingStatus = 'IN_TRANSIT';
    } else {
      trackingStatus = 'AVAILABLE';
    }
  } else if (trackingStatus === 'OFFLINE' || trackingStatus === 'AVAILABLE') {
    if (shipmentObj && ['IN_TRANSIT', 'PICKED_UP', 'DISPATCHED', 'NEAR_DESTINATION', 'AT_DESTINATION', 'OUT_FOR_DELIVERY'].includes(shipmentObj.status)) {
      trackingStatus = 'IN_TRANSIT';
    } else if (shipmentObj) {
      trackingStatus = 'ASSIGNED';
    }
  }

  // 6. Build tracking payload
  const updatePayload = {
    vehicle: vehicleId,
    driver: driverObj ? driverObj._id : null,
    shipment: shipmentObj ? shipmentObj._id : null,
    latitude: lat,
    longitude: lng,
    speed: spd,
    status: trackingStatus,
    location: {
      type: 'Point',
      coordinates: [lng, lat]
    },
    lastUpdated: new Date()
  };

  // 7. Upsert tracking record
  const updatedTracking = await VehicleTracking.findOneAndUpdate(
    { vehicle: vehicleId },
    updatePayload,
    { new: true, upsert: true, runValidators: true }
  )
    .populate('vehicle')
    .populate('driver', 'name email phone role')
    .populate('shipment', 'trackingNumber trackingId status pickupCity deliveryCity weightKg');

  // 8. Keep Vehicle.currentLocation in sync for Phase 2/3 compatibility
  await Vehicle.findByIdAndUpdate(vehicleId, {
    currentLocation: {
      type: 'Point',
      coordinates: [lng, lat]
    }
  });

  return updatedTracking;
};

/**
 * Retrieve Live Vehicle Tracking data for Owner Dashboard (Phase 4A)
 */
const getLiveVehicleTracking = async (options = {}) => {
  const staleMinutes = Number(options.staleMinutes || process.env.STALE_THRESHOLD_MINUTES || DEFAULT_STALE_MINUTES);
  const offlineMinutes = Number(options.offlineMinutes || process.env.OFFLINE_THRESHOLD_MINUTES || DEFAULT_OFFLINE_MINUTES);

  // 1. Ensure all Vehicles have an up-to-date, reconciled VehicleTracking document
  const allVehicles = await Vehicle.find().populate('assignedDriver', 'name email phone role');
  for (const v of allVehicles) {
    const activeShipment = await Shipment.findOne({
      vehicle: v._id,
      status: { $nin: ['DELIVERED', 'CANCELLED', 'FAILED'] }
    }).populate('driver', 'name email phone role');

    let operationalStatus;
    if (activeShipment) {
      operationalStatus = ['IN_TRANSIT', 'PICKED_UP', 'DISPATCHED', 'NEAR_DESTINATION', 'AT_DESTINATION', 'OUT_FOR_DELIVERY'].includes(activeShipment.status)
        ? 'IN_TRANSIT'
        : 'ASSIGNED';
    } else if (v.status === 'MAINTENANCE' || v.status === 'OUT_OF_SERVICE') {
      operationalStatus = 'MAINTENANCE';
    } else {
      operationalStatus = 'AVAILABLE';
    }

    const assignedDriver = activeShipment?.driver || (activeShipment ? v.assignedDriver : null);
    const assignedDriverId = assignedDriver?._id || null;
    const existingTracking = await VehicleTracking.findOne({ vehicle: v._id });

    if (!existingTracking) {
      const lng = v.currentLocation?.coordinates?.[0] ?? 77.2090;
      const lat = v.currentLocation?.coordinates?.[1] ?? 28.6139;

      await VehicleTracking.create({
        vehicle: v._id,
        driver: assignedDriverId,
        shipment: activeShipment?._id || null,
        latitude: lat,
        longitude: lng,
        speed: 0,
        status: operationalStatus,
        location: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        lastUpdated: new Date()
      });
    } else {
      // Reconcile if tracking contains stale/delivered shipment or mismatched operational status
      const needsSync = (
        (activeShipment && String(existingTracking.shipment || '') !== String(activeShipment._id)) ||
        (!activeShipment && existingTracking.shipment !== null) ||
        (activeShipment && String(existingTracking.driver || '') !== String(assignedDriverId || '')) ||
        (!activeShipment && existingTracking.driver !== null && operationalStatus === 'AVAILABLE') ||
        (existingTracking.status !== operationalStatus && existingTracking.status !== 'OFFLINE')
      );

      if (needsSync) {
        existingTracking.shipment = activeShipment ? activeShipment._id : null;
        existingTracking.driver = activeShipment ? assignedDriverId : null;
        existingTracking.status = operationalStatus;
        if (!activeShipment && operationalStatus === 'AVAILABLE') {
          existingTracking.speed = 0;
        }
        await existingTracking.save();
      }
    }

    // Synchronize Vehicle document status & assignedDriver with active shipment
    const expectedVehicleStatus = (operationalStatus === 'IN_TRANSIT' || operationalStatus === 'ASSIGNED')
      ? 'ON_TRIP'
      : (v.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'AVAILABLE');
    const expectedVehicleDriver = activeShipment ? assignedDriverId : null;

    if (v.status !== expectedVehicleStatus || String(v.assignedDriver?._id || '') !== String(expectedVehicleDriver || '')) {
      await Vehicle.findByIdAndUpdate(v._id, {
        status: expectedVehicleStatus,
        assignedDriver: expectedVehicleDriver
      });
    }
  }

  // 2. Query all VehicleTracking records with populated references
  const rawTrackingList = await VehicleTracking.find()
    .populate('vehicle')
    .populate('driver', 'name email phone role')
    .populate('shipment', 'trackingNumber trackingId status pickupCity deliveryCity weightKg pickupAddress deliveryAddress')
    .sort({ lastUpdated: -1 });

  const now = Date.now();
  let liveCount = 0;
  let staleCount = 0;
  let offlineCount = 0;

  const trackingItems = rawTrackingList.map((t) => {
    const lastUpdatedTime = new Date(t.lastUpdated).getTime();
    const diffMinutes = Math.max(0, (now - lastUpdatedTime) / (1000 * 60));

    // Telemetry vitality is strictly determined by telemetry age
    let trackingVitality = 'LIVE';
    if (diffMinutes >= offlineMinutes) {
      trackingVitality = 'OFFLINE';
      offlineCount++;
    } else if (diffMinutes >= staleMinutes) {
      trackingVitality = 'STALE';
      staleCount++;
    } else {
      trackingVitality = 'LIVE';
      liveCount++;
    }

    // Ensure terminal shipments are NEVER exposed as active cargo
    const isTerminalShipment = t.shipment && ['DELIVERED', 'CANCELLED', 'FAILED'].includes(t.shipment.status);
    const safeShipment = isTerminalShipment ? null : (t.shipment ? {
      _id: t.shipment._id,
      trackingNumber: t.shipment.trackingNumber || t.shipment.trackingId,
      status: t.shipment.status,
      pickupCity: t.shipment.pickupAddress?.city || t.shipment.pickupCity || 'Origin',
      deliveryCity: t.shipment.deliveryAddress?.city || t.shipment.deliveryCity || 'Destination',
      weightKg: t.shipment.weightKg
    } : null);

    // Resolve operational status: terminal shipment must NEVER leave vehicle in ASSIGNED/IN_TRANSIT
    let resolvedStatus = t.status;
    if (safeShipment) {
      resolvedStatus = ['IN_TRANSIT', 'PICKED_UP', 'DISPATCHED', 'NEAR_DESTINATION', 'AT_DESTINATION', 'OUT_FOR_DELIVERY'].includes(safeShipment.status)
        ? 'IN_TRANSIT'
        : 'ASSIGNED';
    } else if (isTerminalShipment || (!safeShipment && (resolvedStatus === 'IN_TRANSIT' || resolvedStatus === 'ASSIGNED' || resolvedStatus === 'OFFLINE'))) {
      resolvedStatus = (t.speed > 0 && !isTerminalShipment) ? 'IN_TRANSIT' : 'AVAILABLE';
    }

    return {
      _id: t._id,
      vehicleId: t.vehicle?._id || null,
      vehicle: t.vehicle ? {
        _id: t.vehicle._id,
        registrationNumber: t.vehicle.registrationNumber,
        vehicleType: t.vehicle.vehicleType,
        capacityKg: t.vehicle.capacityKg,
        fuelType: t.vehicle.fuelType
      } : null,
      driver: t.driver ? {
        _id: t.driver._id,
        name: t.driver.name,
        phone: t.driver.phone,
        email: t.driver.email
      } : null,
      shipment: safeShipment,
      latitude: t.latitude,
      longitude: t.longitude,
      speed: t.speed,
      status: resolvedStatus,
      trackingVitality,
      minutesSinceUpdate: Math.round(diffMinutes * 10) / 10,
      lastUpdated: t.lastUpdated
    };
  });

  return {
    summaryMetrics: {
      totalTracked: trackingItems.length,
      liveCount,
      staleCount,
      offlineCount,
      inTransitCount: trackingItems.filter((i) => i.status === 'IN_TRANSIT').length,
      availableCount: trackingItems.filter((i) => i.status === 'AVAILABLE').length,
      assignedCount: trackingItems.filter((i) => i.status === 'ASSIGNED').length
    },
    thresholds: {
      staleThresholdMinutes: staleMinutes,
      offlineThresholdMinutes: offlineMinutes
    },
    trackingItems,
    generatedAt: new Date()
  };
};

module.exports = {
  updateVehicleLocation,
  getLiveVehicleTracking,
  DEFAULT_STALE_MINUTES,
  DEFAULT_OFFLINE_MINUTES
};
