const mongoose = require('mongoose');
const Shipment = require('../models/Shipment');
const Hub = require('../models/Hub');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const User = require('../models/User');
const VehicleTracking = require('../models/VehicleTracking');
const shipmentLifecycleService = require('../services/shipmentLifecycleService');

// @desc    Get all shipments (Owner gets all, Customer gets theirs, Driver gets assigned)
// @route   GET /api/shipments
// @access  Private
const getShipments = async (req, res, next) => {
  try {
    let query = {};

    if (req.user.role === 'CUSTOMER') {
      query.customer = req.user._id;
    } else if (req.user.role === 'DRIVER') {
      const driverDoc = await Driver.findOne({ user: req.user._id });
      const driverIds = [req.user._id];
      if (driverDoc) driverIds.push(driverDoc._id);
      query.driver = { $in: driverIds };
    }

    const shipments = await Shipment.find(query)
      .populate('customer', 'name email phone')
      .populate('originHub', 'name code city state location')
      .populate('destinationHub', 'name code city state location')
      .populate('driver', 'name email phone')
      .populate('vehicle', 'registrationNumber vehicleType capacityKg')
      .populate('route', 'routeName distanceKm durationMinutes status color')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: shipments.length, data: shipments });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new shipment
// @route   POST /api/shipments
// @access  Private (CUSTOMER or OWNER)
const createShipment = async (req, res, next) => {
  try {
    const {
      originHubId,
      destinationHubId,
      pickupAddress,
      pickupCity,
      pickupState,
      pickupPincode,
      pickupLocation,
      pickupLocationType,
      deliveryAddress,
      deliveryCity,
      deliveryState,
      deliveryPincode,
      deliveryLocation,
      deliveryLocationType,
      weightKg,
      quantity,
      priority,
      cargoType,
      packageType,
      notes
    } = req.body;

    const parsedWeight = parseFloat(weightKg);
    const parsedQuantity = parseInt(quantity || 1, 10);

    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      return res.status(400).json({ success: false, message: 'Weight must be greater than zero.' });
    }

    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be greater than zero.' });
    }

    if (!pickupLocation || !pickupLocation.coordinates || !Array.isArray(pickupLocation.coordinates) || pickupLocation.coordinates.length < 2) {
      return res.status(400).json({ success: false, message: 'Pickup location coordinates are required.' });
    }

    if (!deliveryLocation || !deliveryLocation.coordinates || !Array.isArray(deliveryLocation.coordinates) || deliveryLocation.coordinates.length < 2) {
      return res.status(400).json({ success: false, message: 'Delivery location coordinates are required.' });
    }

    const srcLng = parseFloat(pickupLocation.coordinates[0]);
    const srcLat = parseFloat(pickupLocation.coordinates[1]);
    const destLng = parseFloat(deliveryLocation.coordinates[0]);
    const destLat = parseFloat(deliveryLocation.coordinates[1]);

    if (isNaN(srcLng) || isNaN(srcLat)) {
      return res.status(400).json({ success: false, message: 'Pickup location coordinates are required.' });
    }

    if (isNaN(destLng) || isNaN(destLat)) {
      return res.status(400).json({ success: false, message: 'Delivery location coordinates are required.' });
    }

    if (Math.abs(srcLng - destLng) < 0.0001 && Math.abs(srcLat - destLat) < 0.0001) {
      return res.status(400).json({ success: false, message: 'Pickup and delivery locations cannot be the same.' });
    }

    const geocodingService = require('../services/geocodingService');
    const [srcGeo, destGeo] = await Promise.all([
      geocodingService.reverseGeocode(srcLat, srcLng),
      geocodingService.reverseGeocode(destLat, destLng)
    ]);

    const resolvedPickupCity = pickupCity || (typeof pickupAddress === 'object' ? pickupAddress?.city : null) || srcGeo.city || originHub?.city || 'Origin City';
    const resolvedDeliveryCity = deliveryCity || (typeof deliveryAddress === 'object' ? deliveryAddress?.city : null) || destGeo.city || destinationHub?.city || 'Destination City';

    const formattedPickupAddress = typeof pickupAddress === 'object' ? {
      street: pickupAddress.street || 'Customer Pickup Address',
      city: resolvedPickupCity,
      state: pickupAddress.state || srcGeo.state || 'Origin State',
      pincode: pickupAddress.pincode || '110001'
    } : {
      street: pickupAddress || 'Customer Pickup Address',
      city: resolvedPickupCity,
      state: pickupState || srcGeo.state || 'Origin State',
      pincode: pickupPincode || '110001'
    };

    const formattedDeliveryAddress = typeof deliveryAddress === 'object' ? {
      street: deliveryAddress.street || 'Customer Delivery Address',
      city: resolvedDeliveryCity,
      state: deliveryAddress.state || destGeo.state || 'Destination State',
      pincode: deliveryAddress.pincode || '400001'
    } : {
      street: deliveryAddress || 'Customer Delivery Address',
      city: resolvedDeliveryCity,
      state: deliveryState || destGeo.state || 'Destination State',
      pincode: deliveryPincode || '400001'
    };

    const randNum = Math.floor(100000 + Math.random() * 900000);
    const trackingId = `RXAI-2026-${randNum}`;
    const trackingNumber = `RTX-${randNum}`;

    const resolvedCategory = (packageType || 'STANDARD').toUpperCase().trim();
    const pricingService = require('../services/pricingService');

    let roadGeometry = null;
    let estDistance = null;
    let estDuration = null;

    try {
      const routeService = require('../services/routeService');
      const routeCalc = await routeService.calculateCandidateRoutes(
        { latitude: srcLat, longitude: srcLng },
        { latitude: destLat, longitude: destLng },
        trackingId
      );
      if (routeCalc && routeCalc.routes && routeCalc.routes.length > 0) {
        roadGeometry = routeCalc.routes[0].geometry;
        estDistance = routeCalc.routes[0].distanceKm;
        estDuration = routeCalc.routes[0].durationMinutes;
      }
    } catch (e) {
      console.warn('Initial road geometry calculation note:', e.message);
    }

    if (!estDistance || estDistance <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Freight quote unavailable: Unable to calculate verified road route between the specified locations.'
      });
    }

    // Calculate verified dynamic freight quote on backend
    const quoteResult = pricingService.calculateFreightQuote({
      distanceKm: estDistance,
      weightKg: parsedWeight,
      goodsCategory: resolvedCategory,
      quantity: parsedQuantity
    });

    if (quoteResult.quoteUnavailable) {
      return res.status(quoteResult.error === 'HAZMAT_RESTRICTED' ? 400 : 400).json({
        success: false,
        error: quoteResult.error,
        message: quoteResult.message
      });
    }

    const estimatedCost = quoteResult.totalFreightQuote;
    const pricingDetails = quoteResult.breakdown;

    const shipment = await Shipment.create({
      trackingNumber,
      trackingId,
      customer: req.user.role === 'CUSTOMER' ? req.user._id : (req.body.customerId || req.user._id),
      originHub: originHubId || null,
      destinationHub: destinationHubId || null,
      pickupLocationType: pickupLocationType || (originHubId ? 'COMPANY_HUB' : 'CUSTOMER_LOCATION'),
      deliveryLocationType: deliveryLocationType || (destinationHubId ? 'COMPANY_HUB' : 'CUSTOMER_LOCATION'),
      pickupAddress: formattedPickupAddress,
      deliveryAddress: formattedDeliveryAddress,
      pickupLocation: {
        type: 'Point',
        coordinates: [srcLng, srcLat]
      },
      deliveryLocation: {
        type: 'Point',
        coordinates: [destLng, destLat]
      },
      weightKg: parsedWeight,
      quantity: parsedQuantity,
      priority: priority || 'MEDIUM',
      cargoType: cargoType || 'General Cargo',
      packageType: resolvedCategory,
      estimatedCost,
      pricingDetails,
      estimatedDistanceKm: estDistance,
      estimatedDurationMinutes: estDuration,
      selectedRouteGeometry: roadGeometry,
      notes: notes || '',
      status: 'CREATED'
    });

    const populated = await Shipment.findById(shipment._id)
      .populate('customer', 'name email phone')
      .populate('originHub')
      .populate('destinationHub');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Get shipment by tracking number or ID
// @route   GET /api/shipments/:identifier
// @access  Public / Private
const getShipmentByIdentifier = async (req, res, next) => {
  try {
    const identifier = req.params.identifier;
    let shipment = await Shipment.findOne({
      $or: [
        { trackingNumber: identifier.toUpperCase() },
        { trackingId: identifier.toUpperCase() }
      ]
    })
      .populate('customer', 'name email phone')
      .populate('originHub', 'name code city state location')
      .populate('destinationHub', 'name code city state location')
      .populate('driver', 'name email phone')
      .populate('vehicle', 'registrationNumber vehicleType capacityKg')
      .populate('route');

    if (!shipment && identifier.match(/^[0-9a-fA-F]{24}$/)) {
      shipment = await Shipment.findById(identifier)
        .populate('customer', 'name email phone')
        .populate('originHub', 'name code city state location')
        .populate('destinationHub', 'name code city state location')
        .populate('driver', 'name email phone')
        .populate('vehicle', 'registrationNumber vehicleType capacityKg')
        .populate('route');
    }

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    res.json({ success: true, data: shipment });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign driver and vehicle to shipment
// @route   PUT /api/shipments/:id/assign
// @access  Private (OWNER only)
const assignShipment = async (req, res, next) => {
  try {
    const { driverId, vehicleId } = req.body;

    if (!driverId || !vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Both driverId and vehicleId are required for shipment assignment.'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid shipment ID format.' });
    }

    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({ success: false, message: 'Invalid driver ID format.' });
    }

    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ success: false, message: 'Invalid vehicle ID format.' });
    }

    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    // Verify shipment is in an assignable state
    const ASSIGNABLE_STATUSES = ['CREATED', 'PENDING', 'CONFIRMED', 'PICKUP_PENDING'];
    if (shipment.status === 'VEHICLE_ASSIGNED') {
      return res.status(400).json({
        success: false,
        message: `Shipment is already assigned to a vehicle and driver (status: 'VEHICLE_ASSIGNED').`
      });
    }

    if (!ASSIGNABLE_STATUSES.includes(shipment.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign fleet vehicle/driver to shipment in '${shipment.status}' status.`
      });
    }

    // Vehicle validation
    const vehicleDoc = await Vehicle.findById(vehicleId);
    if (!vehicleDoc) {
      return res.status(404).json({ success: false, message: 'Selected vehicle not found.' });
    }

    if (vehicleDoc.status !== 'AVAILABLE') {
      return res.status(400).json({
        success: false,
        message: `Selected vehicle is not available for assignment (current status: ${vehicleDoc.status}).`
      });
    }

    if (shipment.weightKg > vehicleDoc.capacityKg) {
      return res.status(400).json({
        success: false,
        message: `Vehicle capacity (${vehicleDoc.capacityKg} Kg) is insufficient for this shipment (${shipment.weightKg} Kg).`
      });
    }

    const activeShipmentWithVehicle = await Shipment.findOne({
      _id: { $ne: shipment._id },
      vehicle: vehicleId,
      status: { $nin: ['DELIVERED', 'CANCELLED', 'FAILED'] }
    });
    if (activeShipmentWithVehicle) {
      return res.status(400).json({
        success: false,
        message: `Selected vehicle is already assigned to active shipment ${activeShipmentWithVehicle.trackingNumber || activeShipmentWithVehicle.trackingId}.`
      });
    }

    // Driver validation
    let driverDoc = await Driver.findOne({ $or: [{ user: driverId }, { _id: driverId }] }).populate('user');
    let driverUserId = null;

    if (driverDoc) {
      if (driverDoc.status !== 'AVAILABLE') {
        return res.status(400).json({
          success: false,
          message: `Selected driver is not available for assignment (current status: ${driverDoc.status}).`
        });
      }
      driverUserId = driverDoc.user?._id || driverDoc.user;
    } else {
      const driverUser = await User.findById(driverId);
      if (!driverUser || driverUser.role !== 'DRIVER') {
        return res.status(404).json({
          success: false,
          message: 'Selected driver was not found or is not registered as a driver.'
        });
      }
      driverUserId = driverUser._id;
    }

    const activeShipmentWithDriver = await Shipment.findOne({
      _id: { $ne: shipment._id },
      driver: driverUserId,
      status: { $nin: ['DELIVERED', 'CANCELLED', 'FAILED'] }
    });
    if (activeShipmentWithDriver) {
      return res.status(400).json({
        success: false,
        message: `Selected driver is already assigned to active shipment ${activeShipmentWithDriver.trackingNumber || activeShipmentWithDriver.trackingId}.`
      });
    }

    // Atomic assignment via session transaction if supported, with automatic rollback
    let session = null;
    let inTransaction = false;

    try {
      session = await mongoose.startSession();
      session.startTransaction();
      inTransaction = true;
    } catch (sessErr) {
      session = null;
      inTransaction = false;
    }

    try {
      await shipmentLifecycleService.updateShipmentLifecycle(
        shipment._id,
        'VEHICLE_ASSIGNED',
        {
          driverId: driverUserId,
          vehicleId: vehicleDoc._id,
          note: 'Vehicle and Driver assigned by Owner'
        },
        req.user,
        { session }
      );

      if (inTransaction && session) {
        await session.commitTransaction();
      }

      const updatedShipment = await Shipment.findById(shipment._id)
        .populate('customer', 'name email phone')
        .populate('originHub', 'name code city state')
        .populate('destinationHub', 'name code city state')
        .populate('driver', 'name email phone')
        .populate('vehicle', 'registrationNumber vehicleType capacityKg');

      return res.json({ success: true, data: updatedShipment });
    } catch (error) {
      if (inTransaction && session) {
        try {
          await session.abortTransaction();
        } catch (abortErr) {
          console.error('Failed to abort transaction:', abortErr.message);
        }
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update shipment status
// @route   PUT /api/shipments/:id/status
// @access  Private (OWNER or DRIVER)
const updateShipmentStatus = async (req, res, next) => {
  try {
    const { status, note, location } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    await shipmentLifecycleService.updateShipmentLifecycle(
      req.params.id,
      status,
      { note: note || `Status updated via shipment API to ${status}`, location },
      req.user
    );

    const updatedShipment = await Shipment.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('originHub', 'name code city state')
      .populate('destinationHub', 'name code city state')
      .populate('driver', 'name email phone')
      .populate('vehicle', 'registrationNumber vehicleType capacityKg');

    res.json({ success: true, message: `Shipment status updated to ${status}`, data: updatedShipment });
  } catch (error) {
    if (error.statusCode === 400 || error.message?.includes('Invalid shipment lifecycle transition') || error.message?.includes('already in')) {
      return res.status(400).json({
        success: false,
        message: error.message,
        details: error.details
      });
    }
    if (error.message?.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

module.exports = {
  getShipments,
  createShipment,
  getShipmentByIdentifier,
  assignShipment,
  updateShipmentStatus
};
