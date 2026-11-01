/**
 * RouteXAI — Dynamic Freight Pricing Configuration
 *
 * Configurable demonstration rates for distance charges, weight charges,
 * and goods handling surcharges. These defaults serve as demonstration rates
 * until official corporate pricing schedules are established.
 */

const DEFAULT_PRICING_CONFIG = {
  version: 'v1.0-demo',
  currency: 'INR',
  currencySymbol: '₹',

  // Base Road Distance Charge (Distance Charge = Road Distance km * baseRatePerKm)
  baseRatePerKm: 18.0, // Demonstration default: ₹18.00 / km

  // Cargo Weight Charge (Weight Charge = Weight kg * weightRatePerKg * (Distance km / distanceFactorDivisor))
  weightRatePerKg: 1.50, // Demonstration default: ₹1.50 / kg per 100 km distance factor
  distanceFactorDivisor: 100,

  // Absolute Minimum Freight Booking Base Charge
  minimumFreightQuote: 500, // ₹500 minimum freight quote

  // Optional multi-package handling surcharge (for quantity > 1)
  packageHandlingFeePerUnit: 25, // ₹25 per additional package unit

  // Goods Category & Special Handling Configurations
  categoryRates: {
    STANDARD: {
      categoryCode: 'STANDARD',
      displayName: 'Standard Goods',
      description: 'General freight cargo without special handling requirements',
      handlingFeeFlat: 0,
      handlingFeePercent: 0, // 0% surcharge
      urgencySurcharge: 0,
      supported: true
    },
    FRAGILE: {
      categoryCode: 'FRAGILE',
      displayName: 'Fragile Goods',
      description: 'Delicate items requiring protective padding, shock isolation, and careful stowage',
      handlingFeeFlat: 450, // ₹450 flat handling fee
      handlingFeePercent: 0.08, // 8% surcharge on base (distance + weight) charge
      urgencySurcharge: 0,
      supported: true
    },
    ELECTRONICS: {
      categoryCode: 'ELECTRONICS',
      displayName: 'Industrial Electronics',
      description: 'High-value electronics requiring electrostatic, climate, and security protection',
      handlingFeeFlat: 650, // ₹650 flat handling fee
      handlingFeePercent: 0.10, // 10% surcharge on base charge
      urgencySurcharge: 0,
      supported: true
    },
    PERISHABLE: {
      categoryCode: 'PERISHABLE',
      displayName: 'Perishable Goods',
      description: 'Temperature-sensitive foodstuffs & pharma requiring expedited reefer transit',
      handlingFeeFlat: 850, // ₹850 flat cold storage fee
      handlingFeePercent: 0.15, // 15% surcharge
      urgencySurcharge: 300, // ₹300 urgency dispatch fee
      supported: true
    },
    COLD_STORAGE: {
      categoryCode: 'COLD_STORAGE',
      displayName: 'Perishable / Cold Storage',
      description: 'Temperature-sensitive cargo requiring cold chain logistics and expedited transit',
      handlingFeeFlat: 850,
      handlingFeePercent: 0.15,
      urgencySurcharge: 300,
      supported: true
    },
    HAZARDOUS: {
      categoryCode: 'HAZARDOUS',
      displayName: 'Hazardous Materials',
      description: 'Dangerous goods (flammable, toxic, corrosive) subject to Hazmat regulations',
      handlingFeeFlat: 0,
      handlingFeePercent: 0,
      urgencySurcharge: 0,
      supported: false, // RESTRICTED from automated customer booking
      policyMessage: 'Hazardous cargo transport is restricted. Standard automated booking is not supported for hazardous materials without specialized hazmat fleet compliance and regulatory permits. Please contact operations support.'
    }
  }
};

let activePricingConfig = JSON.parse(JSON.stringify(DEFAULT_PRICING_CONFIG));

const getPricingConfig = () => JSON.parse(JSON.stringify(activePricingConfig));

const updatePricingConfig = (newConfig = {}) => {
  if (typeof newConfig.baseRatePerKm === 'number' && newConfig.baseRatePerKm > 0) {
    activePricingConfig.baseRatePerKm = newConfig.baseRatePerKm;
  }
  if (typeof newConfig.weightRatePerKg === 'number' && newConfig.weightRatePerKg > 0) {
    activePricingConfig.weightRatePerKg = newConfig.weightRatePerKg;
  }
  if (typeof newConfig.minimumFreightQuote === 'number' && newConfig.minimumFreightQuote >= 0) {
    activePricingConfig.minimumFreightQuote = newConfig.minimumFreightQuote;
  }
  if (typeof newConfig.packageHandlingFeePerUnit === 'number' && newConfig.packageHandlingFeePerUnit >= 0) {
    activePricingConfig.packageHandlingFeePerUnit = newConfig.packageHandlingFeePerUnit;
  }
  if (newConfig.categoryRates && typeof newConfig.categoryRates === 'object') {
    Object.keys(newConfig.categoryRates).forEach((catKey) => {
      if (activePricingConfig.categoryRates[catKey]) {
        activePricingConfig.categoryRates[catKey] = {
          ...activePricingConfig.categoryRates[catKey],
          ...newConfig.categoryRates[catKey]
        };
      }
    });
  }
  return getPricingConfig();
};

const resetPricingConfig = () => {
  activePricingConfig = JSON.parse(JSON.stringify(DEFAULT_PRICING_CONFIG));
  return getPricingConfig();
};

module.exports = {
  DEFAULT_PRICING_CONFIG,
  getPricingConfig,
  updatePricingConfig,
  resetPricingConfig
};
