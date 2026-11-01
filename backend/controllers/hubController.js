const Hub = require('../models/Hub');

// @desc    Get all hubs
// @route   GET /api/hubs
// @access  Private
const getHubs = async (req, res, next) => {
  try {
    const hubs = await Hub.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, count: hubs.length, data: hubs });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new hub
// @route   POST /api/hubs
// @access  Private (OWNER only)
const createHub = async (req, res, next) => {
  try {
    const { name, code, city, state, address, longitude, latitude, capacity } = req.body;

    const hub = await Hub.create({
      name,
      code,
      city,
      state,
      address,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      capacity: capacity || 1000
    });

    res.status(201).json({ success: true, data: hub });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single hub by ID
// @route   GET /api/hubs/:id
// @access  Private
const getHubById = async (req, res, next) => {
  try {
    const hub = await Hub.findById(req.params.id);
    if (!hub) {
      return res.status(404).json({ success: false, message: 'Hub not found' });
    }
    res.json({ success: true, data: hub });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHubs,
  createHub,
  getHubById
};
