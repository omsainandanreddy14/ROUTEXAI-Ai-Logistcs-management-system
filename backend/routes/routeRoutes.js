const express = require('express');
const router = express.Router();
const { calculateRoutes, selectRoute, getRouteById } = require('../controllers/routeController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/calculate', protect, authorize('OWNER', 'DRIVER'), calculateRoutes);
router.post('/select', protect, authorize('OWNER'), selectRoute);
router.get('/:id', protect, getRouteById);

module.exports = router;
