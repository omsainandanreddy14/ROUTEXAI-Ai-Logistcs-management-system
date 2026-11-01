const express = require('express');
const router = express.Router();
const { getHubs, createHub, getHubById } = require('../controllers/hubController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, getHubs);
router.post('/', protect, authorize('OWNER'), createHub);
router.get('/:id', protect, getHubById);

module.exports = router;
