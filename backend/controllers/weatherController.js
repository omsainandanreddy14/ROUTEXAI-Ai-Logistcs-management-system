const weatherService = require('../services/weatherService');
const geocodingService = require('../services/geocodingService');
const Shipment = require('../models/Shipment');

// @desc    Get current weather for specific latitude & longitude
// @route   GET /api/weather/current?latitude=...&longitude=...
// @access  Private
const getCurrentWeather = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'latitude and longitude query parameters are required.'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude or longitude values provided.'
      });
    }

    const weatherData = await weatherService.getWeatherForLocation(lat, lng);

    res.json({
      success: true,
      data: weatherData
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: error.message || 'Weather data temporarily unavailable.'
    });
  }
};

// @desc    Get weather for pickup and delivery endpoints of a shipment
// @route   GET /api/weather/shipment/:id
// @access  Private
const getShipmentEndpointWeather = async (req, res, next) => {
  try {
    const shipment = await Shipment.findById(req.params.id);

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    const pCoords = shipment.pickupLocation?.coordinates;
    const dCoords = shipment.deliveryLocation?.coordinates;

    if (!pCoords || !dCoords || !Array.isArray(pCoords) || !Array.isArray(dCoords)) {
      return res.status(400).json({
        success: false,
        message: 'Shipment pickup or delivery coordinates are missing.'
      });
    }

    const pickupLat = parseFloat(pCoords[1]);
    const pickupLng = parseFloat(pCoords[0]);
    const deliveryLat = parseFloat(dCoords[1]);
    const deliveryLng = parseFloat(dCoords[0]);

    const [pickupResult, deliveryResult] = await Promise.allSettled([
      weatherService.getWeatherForLocation(pickupLat, pickupLng),
      weatherService.getWeatherForLocation(deliveryLat, deliveryLng)
    ]);

    const pickupWeather = pickupResult.status === 'fulfilled' ? pickupResult.value : null;
    const deliveryWeather = deliveryResult.status === 'fulfilled' ? deliveryResult.value : null;

    let endpointRisk = 'LOW';
    if (
      (pickupWeather && pickupWeather.weatherRisk === 'HIGH') ||
      (deliveryWeather && deliveryWeather.weatherRisk === 'HIGH')
    ) {
      endpointRisk = 'HIGH';
    } else if (
      (pickupWeather && pickupWeather.weatherRisk === 'MEDIUM') ||
      (deliveryWeather && deliveryWeather.weatherRisk === 'MEDIUM')
    ) {
      endpointRisk = 'MEDIUM';
    }

    // Dynamically derive authoritative city labels from exact coordinates
    const [pickupGeo, deliveryGeo] = await Promise.all([
      geocodingService.reverseGeocode(pickupLat, pickupLng),
      geocodingService.reverseGeocode(deliveryLat, deliveryLng)
    ]);

    const pickupCity = (typeof shipment.pickupAddress === 'object' && shipment.pickupAddress?.city)
      || shipment.pickupCity
      || pickupGeo.city
      || 'Customer Pickup';

    const deliveryCity = (typeof shipment.deliveryAddress === 'object' && shipment.deliveryAddress?.city)
      || shipment.deliveryCity
      || deliveryGeo.city
      || 'Customer Delivery';

    res.json({
      success: true,
      data: {
        shipmentId: shipment._id,
        trackingId: shipment.trackingId || shipment.trackingNumber,
        pickupCity,
        deliveryCity,
        pickupCoordinates: { latitude: pickupLat, longitude: pickupLng },
        deliveryCoordinates: { latitude: deliveryLat, longitude: deliveryLng },
        pickupWeather,
        deliveryWeather,
        endpointRisk,
        label: 'Weather at route endpoints'
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Weather data temporarily unavailable.'
    });
  }
};

module.exports = {
  getCurrentWeather,
  getShipmentEndpointWeather
};
