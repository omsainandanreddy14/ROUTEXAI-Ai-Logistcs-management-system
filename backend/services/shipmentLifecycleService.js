const Shipment = require('../models/Shipment');
const ShipmentLifecycle = require('../models/ShipmentLifecycle');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const User = require('../models/User');
const Hub = require('../models/Hub');
const Route = require('../models/Route');
const VehicleTracking = require('../models/VehicleTracking');

const STAGE_ORDER = [
  'CREATED',
  'PICKUP_PENDING',
  'VEHICLE_ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_DESTINATION',
  'OUT_FOR_DELIVERY',
  'DELIVERED'
];

/**
 * Strict allowed shipment lifecycle status transitions (Phase 4B)
 */
const VALID_STATUS_TRANSITIONS = {
  CREATED: ['CONFIRMED', 'PICKUP_PENDING', 'VEHICLE_ASSIGNED', 'CANCELLED'],
  PENDING: ['CONFIRMED', 'PICKUP_PENDING', 'VEHICLE_ASSIGNED', 'CANCELLED'],
  CONFIRMED: ['PICKUP_PENDING', 'VEHICLE_ASSIGNED', 'CANCELLED'],
  PICKUP_PENDING: ['VEHICLE_ASSIGNED', 'CANCELLED'],
  VEHICLE_ASSIGNED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'DELAYED', 'CANCELLED'],
  DISPATCHED: ['IN_TRANSIT', 'DELAYED', 'CANCELLED'],
  IN_TRANSIT: ['AT_DESTINATION', 'DELAYED', 'FAILED', 'CANCELLED'],
  NEAR_DESTINATION: ['AT_DESTINATION', 'DELAYED', 'FAILED', 'CANCELLED'],
  AT_DESTINATION: ['OUT_FOR_DELIVERY', 'DELAYED', 'FAILED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELAYED', 'FAILED', 'CANCELLED'],
  DELAYED: ['IN_TRANSIT', 'AT_DESTINATION', 'OUT_FOR_DELIVERY', 'CANCELLED', 'FAILED'],
  DELIVERED: [], // Terminal state
  CANCELLED: [], // Terminal state
  FAILED: [] // Terminal state
};

/**
 * Sequential stage hierarchy mapping for backward transition prevention
 */
const STAGE_ORDER_MAP = {
  CREATED: 0,
  PENDING: 0,
  CONFIRMED: 0,
  PICKUP_PENDING: 1,
  VEHICLE_ASSIGNED: 2,
  PICKED_UP: 3,
  DISPATCHED: 3,
  IN_TRANSIT: 4,
  NEAR_DESTINATION: 4,
  AT_DESTINATION: 5,
  OUT_FOR_DELIVERY: 6,
  DELIVERED: 7
};

/**
 * Validate status transition dynamically
 */
const validateStatusTransition = async (shipmentId, previousStatus, newStatus) => {
  if (!previousStatus) {
    return { valid: false, message: 'Current status is missing.' };
  }

  // Reject duplicate status update
  if (previousStatus === newStatus) {
    return {
      valid: false,
      isDuplicate: true,
      message: `Shipment is already in '${newStatus}' status.`
    };
  }

  // Terminal states cannot undergo any transitions
  if (['DELIVERED', 'CANCELLED', 'FAILED'].includes(previousStatus)) {
    return {
      valid: false,
      message: `Shipment is in terminal state '${previousStatus}' and cannot undergo further status transitions.`
    };
  }

  // DELIVERED status can ONLY be reached from OUT_FOR_DELIVERY
  if (newStatus === 'DELIVERED' && previousStatus !== 'OUT_FOR_DELIVERY') {
    return {
      valid: false,
      message: `DELIVERED status can only be reached directly from 'OUT_FOR_DELIVERY'. Cannot transition from '${previousStatus}' to 'DELIVERED'.`
    };
  }

  // Handle DELAYED status recovery
  if (previousStatus === 'DELAYED') {
    const lastDelayedLog = await ShipmentLifecycle.findOne({ shipment: shipmentId, status: 'DELAYED' })
      .sort({ timestamp: -1, createdAt: -1 });

    const preDelayStatus = lastDelayedLog?.previousStatus || 'IN_TRANSIT';
    const preDelayIndex = STAGE_ORDER.indexOf(preDelayStatus);
    const newIndex = STAGE_ORDER.indexOf(newStatus);

    if (['CANCELLED', 'FAILED'].includes(newStatus)) {
      return { valid: true };
    }

    if (newStatus === 'DELIVERED') {
      return {
        valid: false,
        message: `Shipment in DELAYED state (previously ${preDelayStatus}) cannot transition directly to DELIVERED. Must recover to normal stage first.`
      };
    }

    // Prohibit backward transition from pre-delay status
    if (newIndex !== -1 && preDelayIndex !== -1 && newIndex < preDelayIndex) {
      return {
        valid: false,
        message: `Invalid recovery from DELAYED: Cannot transition backward from '${preDelayStatus}' (index ${preDelayIndex}) to '${newStatus}' (index ${newIndex}).`
      };
    }

    // Allowed recovery states: resuming preDelayStatus OR advancing to immediate next stage preDelayIndex + 1
    if (newIndex !== -1 && preDelayIndex !== -1 && (newIndex === preDelayIndex || newIndex === preDelayIndex + 1)) {
      return { valid: true };
    }

    return {
      valid: false,
      message: `Invalid recovery from DELAYED (previously ${preDelayStatus}). Allowed recovery states: [${preDelayStatus}, ${STAGE_ORDER[preDelayIndex + 1] || ''}]`
    };
  }

  // Validate against allowed transitions whitelist
  const allowedTransitions = VALID_STATUS_TRANSITIONS[previousStatus] || [];
  if (!allowedTransitions.includes(newStatus)) {
    return {
      valid: false,
      message: `Invalid shipment lifecycle transition from '${previousStatus}' to '${newStatus}'.`
    };
  }

  // Stage order check: prohibit backward transitions
  const prevStageIndex = STAGE_ORDER_MAP[previousStatus];
  const newStageIndex = STAGE_ORDER_MAP[newStatus];

  if (prevStageIndex !== undefined && newStageIndex !== undefined && newStageIndex < prevStageIndex) {
    return {
      valid: false,
      message: `Invalid backward transition from '${previousStatus}' to '${newStatus}'. Backward transitions are strictly prohibited.`
    };
  }

  return { valid: true };
};

/**
 * Update shipment status and create exactly ONE lifecycle history log with Optimistic Concurrency Control
 */
const updateShipmentLifecycle = async (shipmentIdOrTracking, newStatus, metadata = {}, user = null, options = {}) => {
  const session = options.session || null;
  const idStr = String(shipmentIdOrTracking);
  let query = Shipment.findOne({
    $or: [
      { _id: idStr.match(/^[0-9a-fA-F]{24}$/) ? idStr : null },
      { trackingNumber: idStr.toUpperCase() },
      { trackingId: idStr.toUpperCase() }
    ]
  });

  if (session) {
    query = query.session(session);
  }
  const shipment = await query;

  if (!shipment) {
    throw new Error(`Shipment not found with identifier: ${shipmentIdOrTracking}`);
  }

  const previousStatus = shipment.status;

  // Check duplicate status update
  if (previousStatus === newStatus) {
    const dupErr = new Error(`Shipment is already in '${newStatus}' status.`);
    dupErr.statusCode = 400;
    dupErr.isDuplicate = true;
    throw dupErr;
  }

  // Validate status transition
  const transitionCheck = await validateStatusTransition(shipment._id, previousStatus, newStatus);
  if (!transitionCheck.valid) {
    const err = new Error(transitionCheck.message || 'Invalid shipment lifecycle transition');
    err.statusCode = 400;
    err.details = transitionCheck;
    throw err;
  }

  // Optimistic Concurrency Protection: Match both _id and previousStatus in MongoDB
  const updatePayload = {
    status: newStatus
  };
  if (metadata.vehicleId) updatePayload.vehicle = metadata.vehicleId;
  if (metadata.driverId) updatePayload.driver = metadata.driverId;

  const findAndUpdateOptions = { new: true };
  if (session) findAndUpdateOptions.session = session;

  const updatedShipment = await Shipment.findOneAndUpdate(
    { _id: shipment._id, status: previousStatus },
    { $set: updatePayload, $inc: { __v: 1 } },
    findAndUpdateOptions
  );

  if (!updatedShipment) {
    const conflictErr = new Error(`Conflict: Shipment status was concurrently modified by another request. Current status is no longer '${previousStatus}'.`);
    conflictErr.statusCode = 409;
    throw conflictErr;
  }

  // Sync Driver, Vehicle, and VehicleTracking telemetry
  if (['VEHICLE_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'AT_DESTINATION', 'OUT_FOR_DELIVERY'].includes(newStatus)) {
    if (updatedShipment.driver) {
      await Driver.findOneAndUpdate(
        { $or: [{ user: updatedShipment.driver }, { _id: updatedShipment.driver }] },
        { status: 'ON_TRIP', assignedVehicle: updatedShipment.vehicle },
        session ? { session } : {}
      );
    }
    if (updatedShipment.vehicle) {
      await Vehicle.findByIdAndUpdate(
        updatedShipment.vehicle,
        {
          status: 'ON_TRIP',
          assignedDriver: updatedShipment.driver
        },
        session ? { session } : {}
      );
      const operationalStatus = ['IN_TRANSIT', 'PICKED_UP', 'AT_DESTINATION', 'OUT_FOR_DELIVERY'].includes(newStatus)
        ? 'IN_TRANSIT'
        : 'ASSIGNED';

      const vehicleDoc = await Vehicle.findById(updatedShipment.vehicle).session(session || null);
      const coords = (vehicleDoc?.currentLocation?.coordinates && vehicleDoc.currentLocation.coordinates.length === 2)
        ? vehicleDoc.currentLocation.coordinates
        : [77.2090, 28.6139];
      const lng = coords[0];
      const lat = coords[1];

      await VehicleTracking.findOneAndUpdate(
        { vehicle: updatedShipment.vehicle },
        {
          $set: {
            status: operationalStatus,
            driver: updatedShipment.driver,
            shipment: updatedShipment._id,
            lastUpdated: new Date()
          },
          $setOnInsert: {
            latitude: lat,
            longitude: lng,
            speed: 0,
            location: {
              type: 'Point',
              coordinates: [lng, lat]
            }
          }
        },
        { upsert: true, ...(session && { session }) }
      );
    }
  } else if (['DELIVERED', 'CANCELLED', 'FAILED'].includes(newStatus)) {
    if (updatedShipment.vehicle) {
      const otherActiveShipment = await Shipment.findOne({
        _id: { $ne: updatedShipment._id },
        vehicle: updatedShipment.vehicle,
        status: { $nin: ['DELIVERED', 'CANCELLED', 'FAILED'] }
      }).sort({ updatedAt: -1 });

      if (otherActiveShipment) {
        const nextOperational = ['IN_TRANSIT', 'PICKED_UP', 'AT_DESTINATION', 'OUT_FOR_DELIVERY'].includes(otherActiveShipment.status)
          ? 'IN_TRANSIT'
          : 'ASSIGNED';
        await Vehicle.findByIdAndUpdate(updatedShipment.vehicle, {
          status: 'ON_TRIP',
          assignedDriver: otherActiveShipment.driver
        });
        await VehicleTracking.findOneAndUpdate(
          { vehicle: updatedShipment.vehicle },
          {
            $set: {
              status: nextOperational,
              shipment: otherActiveShipment._id,
              driver: otherActiveShipment.driver,
              lastUpdated: new Date()
            }
          }
        );
      } else {
        await Vehicle.findByIdAndUpdate(updatedShipment.vehicle, {
          status: 'AVAILABLE',
          assignedDriver: null
        });
        await VehicleTracking.findOneAndUpdate(
          { vehicle: updatedShipment.vehicle },
          {
            $set: {
              status: 'AVAILABLE',
              shipment: null,
              driver: null,
              speed: 0,
              lastUpdated: new Date()
            }
          }
        );
      }
    }

    if (updatedShipment.driver) {
      const otherActiveDriverShipment = await Shipment.findOne({
        _id: { $ne: updatedShipment._id },
        driver: updatedShipment.driver,
        status: { $nin: ['DELIVERED', 'CANCELLED', 'FAILED'] }
      });

      if (otherActiveDriverShipment) {
        await Driver.findOneAndUpdate(
          { $or: [{ user: updatedShipment.driver }, { _id: updatedShipment.driver }] },
          { status: 'ON_TRIP', assignedVehicle: otherActiveDriverShipment.vehicle }
        );
      } else {
        await Driver.findOneAndUpdate(
          { $or: [{ user: updatedShipment.driver }, { _id: updatedShipment.driver }] },
          { status: 'AVAILABLE', assignedVehicle: null }
        );
      }
    }
  }

  // Create exactly ONE ShipmentLifecycle history record
  const lifecycleRecord = {
    shipment: updatedShipment._id,
    trackingId: updatedShipment.trackingId || updatedShipment.trackingNumber,
    status: newStatus,
    previousStatus,
    timestamp: metadata.timestamp || new Date(),
    location: metadata.location || {
      latitude: metadata.latitude || null,
      longitude: metadata.longitude || null,
      address: metadata.address || ''
    },
    vehicle: updatedShipment.vehicle,
    driver: updatedShipment.driver,
    note: metadata.note || `Lifecycle status transitioned to ${newStatus}`,
    updatedBy: user?._id || metadata.updatedBy || null
  };

  if (session) {
    await ShipmentLifecycle.create([lifecycleRecord], { session });
  } else {
    await ShipmentLifecycle.create(lifecycleRecord);
  }

  return getShipmentLifecycle(updatedShipment._id);
};

/**
 * Retrieve complete shipment lifecycle details and timeline (Read-Only)
 */
const getShipmentLifecycle = async (shipmentIdOrTracking) => {
  const idStr = String(shipmentIdOrTracking);
  let shipment = await Shipment.findOne({
    $or: [
      { _id: idStr.match(/^[0-9a-fA-F]{24}$/) ? idStr : null },
      { trackingNumber: idStr.toUpperCase() },
      { trackingId: idStr.toUpperCase() }
    ]
  })
    .populate('customer', 'name email phone')
    .populate('originHub', 'name code city state location')
    .populate('destinationHub', 'name code city state location')
    .populate('driver', 'name email phone')
    .populate('vehicle', 'registrationNumber vehicleType capacityKg fuelType')
    .populate('route');

  if (!shipment) {
    throw new Error(`Shipment not found with identifier: ${shipmentIdOrTracking}`);
  }

  // Read-only query for history records sorted chronologically by timestamp ASC
  const historyRecords = await ShipmentLifecycle.find({ shipment: shipment._id })
    .populate('updatedBy', 'name email role')
    .sort({ timestamp: 1, createdAt: 1 });

  // Integration with Phase 4A VehicleTracking for real-time telemetry
  let vehicleTelemetry = null;
  if (shipment.vehicle) {
    vehicleTelemetry = await VehicleTracking.findOne({ vehicle: shipment.vehicle._id });
  }

  // Standard 8 normal stages
  const STAGE_ORDER = [
    'CREATED',
    'PICKUP_PENDING',
    'VEHICLE_ASSIGNED',
    'PICKED_UP',
    'IN_TRANSIT',
    'AT_DESTINATION',
    'OUT_FOR_DELIVERY',
    'DELIVERED'
  ];

  const historyStatusMap = new Map();
  historyRecords.forEach((h) => {
    historyStatusMap.set(h.status, h);
  });

  const currentStatusIndex = STAGE_ORDER_MAP[shipment.status] !== undefined
    ? STAGE_ORDER_MAP[shipment.status]
    : STAGE_ORDER.indexOf(shipment.status);
  const isExceptionState = ['DELAYED', 'CANCELLED', 'FAILED'].includes(shipment.status);

  const timeline = STAGE_ORDER.map((stageName, idx) => {
    const historyItem = historyStatusMap.get(stageName);

    let isCompleted = false;
    let isCurrent = false;

    if (stageName === shipment.status) {
      isCurrent = true;
      isCompleted = true;
    } else if (shipment.status === 'CONFIRMED' && stageName === 'CREATED') {
      isCurrent = true;
      isCompleted = true;
    } else if (historyItem) {
      isCompleted = true;
    } else if (currentStatusIndex !== -1 && idx < currentStatusIndex && !isExceptionState) {
      isCompleted = true;
    }

    return {
      stage: stageName,
      label: stageName.replace(/_/g, ' '),
      completed: isCompleted,
      current: isCurrent,
      timestamp: historyItem ? historyItem.timestamp : isCompleted ? (shipment.updatedAt || shipment.createdAt) : null,
      location: historyItem?.location || null,
      note: historyItem?.note || null
    };
  });

  const latestHistory = historyRecords.length > 0 ? historyRecords[historyRecords.length - 1] : null;

  return {
    shipment: {
      _id: shipment._id,
      trackingId: shipment.trackingId || shipment.trackingNumber,
      trackingNumber: shipment.trackingNumber,
      origin: shipment.pickupAddress?.city || shipment.pickupCity || 'Origin',
      destination: shipment.deliveryAddress?.city || shipment.deliveryCity || 'Destination',
      pickupAddress: shipment.pickupAddress,
      deliveryAddress: shipment.deliveryAddress,
      weightKg: shipment.weightKg,
      priority: shipment.priority,
      packageType: shipment.packageType,
      currentStatus: shipment.status,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
      estimatedDistanceKm: shipment.estimatedDistanceKm,
      estimatedDurationMinutes: shipment.estimatedDurationMinutes
    },
    currentStage: {
      status: shipment.status,
      timestamp: latestHistory ? latestHistory.timestamp : shipment.updatedAt,
      location: latestHistory?.location || {
        latitude: vehicleTelemetry?.latitude || null,
        longitude: vehicleTelemetry?.longitude || null,
        address: ''
      }
    },
    timeline,
    history: historyRecords,
    assignedVehicle: shipment.vehicle ? {
      _id: shipment.vehicle._id,
      registrationNumber: shipment.vehicle.registrationNumber,
      vehicleType: shipment.vehicle.vehicleType,
      capacityKg: shipment.vehicle.capacityKg,
      telemetry: vehicleTelemetry ? {
        latitude: vehicleTelemetry.latitude,
        longitude: vehicleTelemetry.longitude,
        speed: vehicleTelemetry.speed,
        status: vehicleTelemetry.status,
        lastUpdated: vehicleTelemetry.lastUpdated
      } : null
    } : null,
    assignedDriver: shipment.driver ? {
      _id: shipment.driver._id,
      name: shipment.driver.name,
      phone: shipment.driver.phone,
      email: shipment.driver.email
    } : null
  };
};

/**
 * Retrieve Owner Lifecycle Overview & Summary Counters
 */
const getShipmentLifecycleOverview = async () => {
  const shipments = await Shipment.find()
    .populate('customer', 'name email')
    .populate('driver', 'name email phone')
    .populate('vehicle', 'registrationNumber vehicleType')
    .sort({ updatedAt: -1 });

  const summaryMetrics = {
    totalShipments: shipments.length,
    CREATED: shipments.filter((s) => s.status === 'CREATED').length,
    PICKUP_PENDING: shipments.filter((s) => s.status === 'PICKUP_PENDING').length,
    VEHICLE_ASSIGNED: shipments.filter((s) => s.status === 'VEHICLE_ASSIGNED').length,
    PICKED_UP: shipments.filter((s) => ['PICKED_UP', 'DISPATCHED'].includes(s.status)).length,
    IN_TRANSIT: shipments.filter((s) => s.status === 'IN_TRANSIT').length,
    AT_DESTINATION: shipments.filter((s) => ['AT_DESTINATION', 'NEAR_DESTINATION'].includes(s.status)).length,
    OUT_FOR_DELIVERY: shipments.filter((s) => s.status === 'OUT_FOR_DELIVERY').length,
    DELIVERED: shipments.filter((s) => s.status === 'DELIVERED').length,
    DELAYED: shipments.filter((s) => s.status === 'DELAYED').length,
    CANCELLED: shipments.filter((s) => s.status === 'CANCELLED').length,
    FAILED: shipments.filter((s) => s.status === 'FAILED').length
  };

  const shipmentList = shipments.map((s) => ({
    _id: s._id,
    trackingId: s.trackingId || s.trackingNumber,
    trackingNumber: s.trackingNumber,
    origin: s.pickupAddress?.city || s.pickupCity || 'Origin',
    destination: s.deliveryAddress?.city || s.deliveryCity || 'Destination',
    status: s.status,
    weightKg: s.weightKg,
    driverName: s.driver?.name || 'Unassigned',
    vehicleReg: s.vehicle?.registrationNumber || 'Unassigned',
    updatedAt: s.updatedAt
  }));

  return {
    summaryMetrics,
    shipmentList,
    generatedAt: new Date()
  };
};

module.exports = {
  VALID_STATUS_TRANSITIONS,
  validateStatusTransition,
  updateShipmentLifecycle,
  getShipmentLifecycle,
  getShipmentLifecycleOverview
};
