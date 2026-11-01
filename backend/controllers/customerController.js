const Customer = require('../models/Customer');

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private (OWNER only)
const getCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find().populate('user', 'name email phone');
    res.json({ success: true, count: customers.length, data: customers });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers
};
