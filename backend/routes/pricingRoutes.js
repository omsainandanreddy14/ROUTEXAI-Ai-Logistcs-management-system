const express = require('express');
const router = express.Router();
const {
  getFreightQuote,
  getPricingConfiguration,
  updatePricingConfiguration,
  resetPricingConfiguration
} = require('../controllers/pricingController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/quote', getFreightQuote);
router.get('/config', getPricingConfiguration);
router.put('/config', protect, authorize('OWNER'), updatePricingConfiguration);
router.post('/config/reset', protect, authorize('OWNER'), resetPricingConfiguration);

module.exports = router;
