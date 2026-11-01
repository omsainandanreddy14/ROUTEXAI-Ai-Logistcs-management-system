const express = require('express');
const router = express.Router();
const { getCustomers } = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, authorize('OWNER'), getCustomers);

module.exports = router;
