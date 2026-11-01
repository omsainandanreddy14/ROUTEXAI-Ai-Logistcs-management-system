const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');

// @desc    Get all vehicles
// @route   GET /api/vehicles
// @access  Private
const getVehicles = async (req, res, next) => {
  try {
    const vehicles = await Vehicle.find().populate('assignedDriver', 'name email phone');
    res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new vehicle
// @route   POST /api/vehicles
// @access  Private (OWNER only)
const createVehicle = async (req, res, next) => {
  try {
    const { registrationNumber, vehicleType, capacityKg, fuelType, assignedDriver } = req.body;

    const vehicle = await Vehicle.create({
      registrationNumber,
      vehicleType,
      capacityKg,
      fuelType: fuelType || 'DIESEL',
      assignedDriver: assignedDriver || null
    });

    if (assignedDriver) {
      await Driver.findOneAndUpdate({ user: assignedDriver }, { assignedVehicle: vehicle._id });
    }

    res.status(201).json({ success: true, data: vehicle });
  } catch (error) {
    next(error);
  }
};

// @desc    Update vehicle status / driver assignment
// @route   PUT /api/vehicles/:id
// @access  Private (OWNER only)
const updateVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    if (req.body.assignedDriver) {
      await Driver.findOneAndUpdate({ user: req.body.assignedDriver }, { assignedVehicle: vehicle._id });
    }

    res.json({ success: true, data: vehicle });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVehicles,
  createVehicle,
  updateVehicle
};
