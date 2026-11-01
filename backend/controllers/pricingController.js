const pricingService = require('../services/pricingService');
const { getPricingConfig, updatePricingConfig, resetPricingConfig } = require('../config/pricingConfig');

/**
 * @desc    Calculate dynamic freight quote based on road distance, weight, and goods category
 * @route   POST /api/pricing/quote
 * @access  Public / Private
 */
const getFreightQuote = async (req, res, next) => {
  try {
    const {
      source,
      destination,
      pickupLocation,
      deliveryLocation,
      distanceKm,
      weightKg,
      goodsCategory,
      packageType,
      quantity
    } = req.body;

    const resolvedCategory = goodsCategory || packageType || 'STANDARD';

    // Fast-path: If verified road distance in km is directly provided
    if (typeof distanceKm === 'number' && distanceKm > 0) {
      const quote = pricingService.calculateFreightQuote({
        distanceKm,
        weightKg,
        goodsCategory: resolvedCategory,
        quantity: quantity || 1
      });

      if (quote.quoteUnavailable) {
        return res.status(quote.error === 'HAZMAT_RESTRICTED' ? 400 : 200).json({
          success: false,
          quoteUnavailable: true,
          error: quote.error,
          message: quote.message,
          data: quote
        });
      }

      return res.json({
        success: true,
        data: quote
      });
    }

    // Standard path: Resolve coordinates from source/destination or GeoJSON Point
    let srcCoords = source;
    if (!srcCoords && pickupLocation?.coordinates && Array.isArray(pickupLocation.coordinates)) {
      srcCoords = {
        latitude: parseFloat(pickupLocation.coordinates[1]),
        longitude: parseFloat(pickupLocation.coordinates[0])
      };
    }

    let destCoords = destination;
    if (!destCoords && deliveryLocation?.coordinates && Array.isArray(deliveryLocation.coordinates)) {
      destCoords = {
        latitude: parseFloat(deliveryLocation.coordinates[1]),
        longitude: parseFloat(deliveryLocation.coordinates[0])
      };
    }

    if (!srcCoords || !destCoords) {
      return res.status(400).json({
        success: false,
        quoteUnavailable: true,
        error: 'COORDINATES_MISSING',
        message: 'Freight quote unavailable. Pickup and delivery coordinates are required.'
      });
    }

    const quoteResult = await pricingService.getQuoteForCoordinates(srcCoords, destCoords, {
      weightKg,
      goodsCategory: resolvedCategory,
      quantity: quantity || 1
    });

    if (quoteResult.quoteUnavailable) {
      return res.status(quoteResult.error === 'HAZMAT_RESTRICTED' ? 400 : 200).json({
        success: false,
        quoteUnavailable: true,
        error: quoteResult.error,
        message: quoteResult.message,
        data: quoteResult
      });
    }

    res.json({
      success: true,
      data: quoteResult
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get active pricing rates, categories, and policies
 * @route   GET /api/pricing/config
 * @access  Public
 */
const getPricingConfiguration = (req, res) => {
  const config = getPricingConfig();
  res.json({
    success: true,
    data: config
  });
};

/**
 * @desc    Update active pricing configuration (Owner only)
 * @route   PUT /api/pricing/config
 * @access  Private (OWNER only)
 */
const updatePricingConfiguration = (req, res) => {
  const updated = updatePricingConfig(req.body);
  res.json({
    success: true,
    message: 'Freight pricing configuration updated successfully',
    data: updated
  });
};

/**
 * @desc    Reset pricing configuration to demonstration defaults
 * @route   POST /api/pricing/config/reset
 * @access  Private (OWNER only)
 */
const resetPricingConfiguration = (req, res) => {
  const reset = resetPricingConfig();
  res.json({
    success: true,
    message: 'Freight pricing configuration reset to default demonstration rates',
    data: reset
  });
};

module.exports = {
  getFreightQuote,
  getPricingConfiguration,
  updatePricingConfiguration,
  resetPricingConfiguration
};
