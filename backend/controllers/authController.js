const User = require('../models/User');
const Customer = require('../models/Customer');
const Driver = require('../models/Driver');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'routexai_super_secret_jwt_key_2026_capstone_project', {
    expiresIn: '30d'
  });
};

// @desc    Register a new user (OWNER, DRIVER, CUSTOMER)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, licenseNumber, companyName } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const userRole = role ? role.toUpperCase() : 'CUSTOMER';
    if (!['OWNER', 'DRIVER', 'CUSTOMER'].includes(userRole)) {
      return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
      phone: phone || ''
    });

    if (userRole === 'CUSTOMER') {
      await Customer.create({
        user: user._id,
        companyName: companyName || ''
      });
    } else if (userRole === 'DRIVER') {
      await Driver.create({
        user: user._id,
        licenseNumber: licenseNumber || `DL-${Math.floor(100000 + Math.random() * 900000)}`
      });
    }

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        token: generateToken(user._id)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        token: generateToken(user._id)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    let profileDetail = null;

    if (user.role === 'DRIVER') {
      profileDetail = await Driver.findOne({ user: user._id }).populate('assignedVehicle');
    } else if (user.role === 'CUSTOMER') {
      profileDetail = await Customer.findOne({ user: user._id });
    }

    res.json({
      success: true,
      data: {
        user,
        profileDetail
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe
};
