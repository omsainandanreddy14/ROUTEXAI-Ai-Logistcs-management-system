const { getPricingConfig } = require('../config/pricingConfig');
const routeService = require('./routeService');

/**
 * RouteXAI — Dynamic Freight Pricing Service
 *
 * Implements the core multi-factor pricing formula:
 * Freight Quote = Distance Charge + Weight Charge + Goods Handling Charge
 *
 * Where:
 * - Distance Charge = Road Distance (km) * Base Rate per km
 * - Weight Charge   = Cargo Weight (kg) * Weight Rate per kg * Distance Factor (Distance km / 100)
 * - Goods Handling  = Category-specific Flat Fee + Percentage Surcharge + Urgency Fee
 */

/**
 * Pure calculation function for dynamic freight pricing
 * @param {Object} params
 * @param {number} params.distanceKm - Verified road route distance in km
 * @param {number} params.weightKg - Cargo weight in kg
 * @param {string} params.goodsCategory - Category/handling type ('STANDARD', 'FRAGILE', 'ELECTRONICS', 'PERISHABLE', 'HAZARDOUS')
 * @param {number} [params.quantity=1] - Package quantity
 * @param {Object} [params.customConfig] - Optional config override
 * @returns {Object} Quote breakdown result or unavailable notification
 */
const calculateFreightQuote = ({
  distanceKm,
  weightKg,
  goodsCategory = 'STANDARD',
  quantity = 1,
  customConfig = null
}) => {
  const config = customConfig || getPricingConfig();

  // 1. Validate Weight
  const parsedWeight = parseFloat(weightKg);
  if (isNaN(parsedWeight) || parsedWeight <= 0) {
    return {
      success: false,
      quoteUnavailable: true,
      error: 'INVALID_WEIGHT',
      message: 'Freight quote unavailable. Cargo weight must be a positive number.'
    };
  }

  // 2. Validate Road Distance
  const parsedDistance = parseFloat(distanceKm);
  if (isNaN(parsedDistance) || parsedDistance <= 0) {
    return {
      success: false,
      quoteUnavailable: true,
      error: 'DISTANCE_UNAVAILABLE',
      message: 'Freight quote unavailable. Unable to determine verified road route distance.'
    };
  }

  // 3. Resolve Goods Category & Handling Policy
  const categoryKey = String(goodsCategory || 'STANDARD').toUpperCase().trim();
  const categoryRules = config.categoryRates[categoryKey] || config.categoryRates.STANDARD;

  // Enforce Hazardous Materials Transport Policy
  if (!categoryRules.supported) {
    return {
      success: false,
      quoteUnavailable: true,
      supported: false,
      error: 'HAZMAT_RESTRICTED',
      goodsCategory: categoryKey,
      message:
        categoryRules.policyMessage ||
        'Hazardous cargo transport is restricted. Standard automated booking is not supported for hazardous materials without specialized hazmat fleet compliance and regulatory permits. Please contact operations support.'
    };
  }

  const parsedQty = Math.max(1, parseInt(quantity || 1, 10));
  const roundedDistKm = parseFloat(parsedDistance.toFixed(2));
  const roundedWeightKg = parseFloat(parsedWeight.toFixed(2));

  // 4. Distance Charge: Road Distance (km) * Base Rate per km
  const distanceCharge = parseFloat((roundedDistKm * config.baseRatePerKm).toFixed(2));

  // 5. Weight Charge: Cargo Weight (kg) * Weight Rate per kg * Distance Factor (distanceKm / 100)
  const distanceFactor = parseFloat((roundedDistKm / (config.distanceFactorDivisor || 100)).toFixed(4));
  const weightCharge = parseFloat((roundedWeightKg * config.weightRatePerKg * distanceFactor).toFixed(2));

  // Base charge subtotal before category surcharges
  const baseSubtotal = parseFloat((distanceCharge + weightCharge).toFixed(2));

  // 6. Goods Handling Charge: Category flat fee + percentage surcharge + urgency surcharge
  const handlingFlatFee = categoryRules.handlingFeeFlat || 0;
  const handlingPercentRate = categoryRules.handlingFeePercent || 0;
  const handlingPercentFee = parseFloat((baseSubtotal * handlingPercentRate).toFixed(2));
  const urgencyFee = categoryRules.urgencySurcharge || 0;
  const goodsHandlingCharge = parseFloat((handlingFlatFee + handlingPercentFee + urgencyFee).toFixed(2));

  // 7. Optional Package Count Charge (for packages > 1)
  const packageCharge = parsedQty > 1 ? (parsedQty - 1) * (config.packageHandlingFeePerUnit || 0) : 0;

  // 8. Total Gross and Minimum Quote Enforcement
  const grossSubtotal = parseFloat((distanceCharge + weightCharge + goodsHandlingCharge + packageCharge).toFixed(2));
  const finalFreightQuote = Math.max(config.minimumFreightQuote || 500, Math.round(grossSubtotal));

  return {
    success: true,
    quoteUnavailable: false,
    supported: true,
    totalFreightQuote: finalFreightQuote,
    distanceKm: roundedDistKm,
    weightKg: roundedWeightKg,
    goodsCategory: categoryKey,
    currency: config.currency || 'INR',
    currencySymbol: config.currencySymbol || '₹',
    isEstimate: true,
    configVersion: config.version || 'v1.0-demo',
    breakdown: {
      distanceKm: roundedDistKm,
      baseRatePerKm: config.baseRatePerKm,
      distanceCharge,
      weightKg: roundedWeightKg,
      weightRatePerKg: config.weightRatePerKg,
      distanceFactor,
      weightCharge,
      goodsCategory: categoryKey,
      goodsCategoryName: categoryRules.displayName,
      goodsCategoryDescription: categoryRules.description,
      goodsHandlingCharge,
      handlingDetails: {
        flatFee: handlingFlatFee,
        percentRate: handlingPercentRate,
        percentAmount: handlingPercentFee,
        urgencyFee
      },
      quantity: parsedQty,
      packageCharge,
      grossSubtotal,
      totalFreightQuote: finalFreightQuote,
      minimumApplied: finalFreightQuote > grossSubtotal,
      minimumChargeApplied: finalFreightQuote > grossSubtotal,
      configVersion: config.version || 'v1.0-demo',
      calculatedAt: new Date()
    },
    minimumApplied: finalFreightQuote > grossSubtotal,
    minimumChargeApplied: finalFreightQuote > grossSubtotal,
    pricingFormulaDescription:
      `Freight Quote (₹${finalFreightQuote}) = Distance Charge (₹${distanceCharge}) + Weight Charge (₹${weightCharge}) + Goods Handling Charge (₹${goodsHandlingCharge})`
  };
};

/**
 * Calculate dynamic quote with verified road route geometry from routing service
 * @param {Object} source - { latitude, longitude } or combined options object
 * @param {Object} destination - { latitude, longitude }
 * @param {Object} cargoParams - { weightKg, goodsCategory, quantity }
 * @returns {Promise<Object>} Quotes for candidate road routes
 */
const getQuoteForCoordinates = async (source, destination, cargoParams = {}) => {
  // Support both (source, destination, cargoParams) and combined options object
  if (source && source.source && source.destination) {
    cargoParams = source;
    destination = source.destination;
    source = source.source;
  }

  const { weightKg, goodsCategory, quantity } = cargoParams;

  if (!source || !destination ||
      isNaN(parseFloat(source.latitude)) || isNaN(parseFloat(source.longitude)) ||
      isNaN(parseFloat(destination.latitude)) || isNaN(parseFloat(destination.longitude))) {
    return {
      success: false,
      quoteUnavailable: true,
      error: 'COORDINATES_MISSING',
      message: 'Freight quote unavailable. Pickup and delivery coordinates are missing or invalid.'
    };
  }

  const sLat = parseFloat(source.latitude);
  const sLng = parseFloat(source.longitude);
  const dLat = parseFloat(destination.latitude);
  const dLng = parseFloat(destination.longitude);

  if (Math.abs(sLat - dLat) < 0.0001 && Math.abs(sLng - dLng) < 0.0001) {
    return {
      success: false,
      quoteUnavailable: true,
      error: 'SAME_LOCATION',
      message: 'Freight quote unavailable. Pickup and delivery coordinates cannot be identical.'
    };
  }

  // Calculate real road candidate routes from OpenRouteService / OSRM
  let routeResults = null;
  try {
    routeResults = await routeService.calculateCandidateRoutes(
      { latitude: sLat, longitude: sLng },
      { latitude: dLat, longitude: dLng },
      'QUOTE-PREVIEW'
    );
  } catch (routeErr) {
    console.warn('[PricingService] Route calculation note:', routeErr.message);
    return {
      success: false,
      quoteUnavailable: true,
      error: 'ROUTING_SERVICE_FAILED',
      message: 'Freight quote unavailable. Routing service was unable to calculate verified road route for these locations.'
    };
  }

  if (!routeResults || !routeResults.routes || routeResults.routes.length === 0) {
    return {
      success: false,
      quoteUnavailable: true,
      error: 'NO_ROAD_ROUTE_FOUND',
      message: 'Freight quote unavailable. No road route corridor found connecting pickup and delivery destinations.'
    };
  }

  // Calculate freight quote for each candidate route
  const candidateQuotes = routeResults.routes.map((candidate, idx) => {
    const candidateQuote = calculateFreightQuote({
      distanceKm: candidate.distanceKm,
      weightKg,
      goodsCategory,
      quantity
    });

    return {
      routeIndex: idx,
      name: candidate.name,
      routeName: candidate.name,
      distanceKm: candidate.distanceKm,
      durationMinutes: candidate.durationMinutes,
      geometry: candidate.geometry,
      score: candidate.score,
      quote: candidateQuote
    };
  });

  const primaryCandidate = candidateQuotes[0];

  return {
    success: true,
    quoteUnavailable: primaryCandidate.quote.quoteUnavailable || false,
    selectedRouteIndex: 0,
    primaryQuote: primaryCandidate.quote,
    candidateQuotes,
    source: { latitude: sLat, longitude: sLng },
    destination: { latitude: dLat, longitude: dLng }
  };
};

module.exports = {
  calculateFreightQuote,
  getQuoteForCoordinates
};
