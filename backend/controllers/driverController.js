const Driver = require('../models/Driver');
const User = require('../models/User');

// @desc    Get all drivers
// @route   GET /api/drivers
// @access  Private (OWNER only)
const getDrivers = async (req, res, next) => {
  try {
    const drivers = await Driver.find()
      .populate('user', 'name email phone role')
      .populate('assignedVehicle', 'registrationNumber vehicleType capacityKg');
    res.json({ success: true, count: drivers.length, data: drivers });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current driver profile
// @route   GET /api/drivers/me
// @access  Private (DRIVER only)
const getDriverMe = async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .populate('user', 'name email phone')
      .populate('assignedVehicle');
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found' });
    }
    res.json({ success: true, data: driver });
  } catch (error) {
    next(error);
  }
};

// @desc    Update driver status (AVAILABLE, ON_TRIP, OFF_DUTY)
// @route   PUT /api/drivers/status
// @access  Private (DRIVER, OWNER)
const updateDriverStatus = async (req, res, next) => {
  try {
    const { status, driverId } = req.body;
    let query = { user: req.user._id };
    if (req.user.role === 'OWNER' && driverId) {
      query = { $or: [{ _id: driverId }, { user: driverId }] };
    }
    const driver = await Driver.findOneAndUpdate(
      query,
      { status },
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: driver });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDrivers,
  getDriverMe,
  updateDriverStatus
};
