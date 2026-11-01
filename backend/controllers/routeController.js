const mongoose = require('mongoose');
const Route = require('../models/Route');
const Shipment = require('../models/Shipment');
const routeService = require('../services/routeService');

const sendStatus = (res, code) => (typeof res.status === 'function' ? res.status(code) : res);

// @desc    Calculate candidate routes between source & destination
// @route   POST /api/routes/calculate
// @access  Private (OWNER only)
const calculateRoutes = async (req, res, next) => {
  try {
    let { source, destination, shipmentId } = req.body;
    let trackingInfo = null;

    let targetShipment = null;

    // If shipmentId is provided, extract coordinates from shipment
    if (shipmentId) {
      targetShipment = await Shipment.findById(shipmentId)
        .populate('vehicle')
        .populate('driver');

      if (!targetShipment) {
        return res.status(404).json({ success: false, message: 'Shipment not found' });
      }

      trackingInfo = targetShipment.trackingId || targetShipment.trackingNumber;

      const pCoords = targetShipment.pickupLocation?.coordinates;
      const dCoords = targetShipment.deliveryLocation?.coordinates;

      if (!pCoords || !Array.isArray(pCoords) || pCoords.length < 2 || pCoords[0] === null || pCoords[1] === null) {
        return res.status(400).json({
          success: false,
          message: 'Pickup location coordinates are required.'
        });
      }

      if (!dCoords || !Array.isArray(dCoords) || dCoords.length < 2 || dCoords[0] === null || dCoords[1] === null) {
        return res.status(400).json({
          success: false,
          message: 'Delivery location coordinates are required.'
        });
      }

      source = {
        latitude: parseFloat(pCoords[1]),
        longitude: parseFloat(pCoords[0]),
        address: typeof targetShipment.pickupAddress === 'object' ? (targetShipment.pickupAddress?.street || 'Customer Pickup') : (targetShipment.pickupAddress || 'Customer Pickup'),
        city: targetShipment.pickupAddress?.city || targetShipment.pickupCity || 'Customer Pickup Location'
      };

      destination = {
        latitude: parseFloat(dCoords[1]),
        longitude: parseFloat(dCoords[0]),
        address: typeof targetShipment.deliveryAddress === 'object' ? (targetShipment.deliveryAddress?.street || 'Customer Delivery') : (targetShipment.deliveryAddress || 'Customer Delivery'),
        city: targetShipment.deliveryAddress?.city || targetShipment.deliveryCity || 'Customer Delivery Location'
      };
    }

    if (!source || !destination || isNaN(parseFloat(source.latitude)) || isNaN(parseFloat(source.longitude)) || isNaN(parseFloat(destination.latitude)) || isNaN(parseFloat(destination.longitude))) {
      return res.status(400).json({
        success: false,
        message: 'Shipment pickup or delivery coordinates are missing or invalid.'
      });
    }

    const routeResults = await routeService.calculateCandidateRoutes(source, destination, trackingInfo);

    // If shipment is available, enrich candidate routes with dynamic multi-signal scores
    if (targetShipment && routeResults.routes && routeResults.routes.length > 0) {
      const weatherService = require('../services/weatherService');
      const etaService = require('../services/etaService');
      const delayRiskService = require('../services/delayRiskService');
      const accessibilityService = require('../services/accessibilityService');

      let weatherRisk = 'LOW';
      try {
        const weatherData = await weatherService.getWeatherForLocation(source.latitude, source.longitude);
        weatherRisk = weatherData?.weatherRisk || 'LOW';
      } catch (wErr) {
        console.warn('[RouteController] Weather fetch notice:', wErr.message);
      }
      const weatherScore = weatherRisk === 'LOW' ? 100 : (weatherRisk === 'MEDIUM' ? 60 : 20);

      const candidateEvaluations = await Promise.all(
        routeResults.routes.map(async (cand, idx) => {
          const isAlt = idx > 0;
          const qualityScore = isAlt ? 80 : 90;

          // 1. ML ETA Signal
          let etaDifference = 0;
          try {
            const etaRes = await etaService.predictShipmentETA(targetShipment, {
              distanceKm: cand.distanceKm,
              expectedDurationMin: cand.durationMinutes,
              routeScore: qualityScore
            });
            if (etaRes && etaRes.differenceFromBaselineMin !== undefined) {
              etaDifference = etaRes.differenceFromBaselineMin;
            }
          } catch (_) {}

          let etaEfficiency = 85;
          if (etaDifference <= 0) {
            etaEfficiency = 100;
          } else if (etaDifference <= 15) {
            etaEfficiency = 95;
          } else if (etaDifference <= 45) {
            etaEfficiency = 80;
          } else {
            etaEfficiency = 65;
          }

          // 2. ML Delay Risk Signal
          let delayProb = 25;
          try {
            const riskRes = await delayRiskService.predictShipmentDelayRisk(targetShipment, {
              distanceKm: cand.distanceKm,
              expectedDurationMin: cand.durationMinutes,
              routeScore: qualityScore
            });
            if (riskRes && riskRes.delayProbability !== undefined) {
              delayProb = Number(riskRes.delayProbability);
            }
          } catch (_) {}
          const delayRiskScore = Math.max(0, Math.min(100, Math.round((100 - delayProb) * 10) / 10));

          // 3. Accessibility Signal
          let accessibilityScore = 85;
          try {
            const accessRes = await accessibilityService.evaluateShipmentAccessibility(targetShipment, {
              distanceKm: cand.distanceKm,
              expectedDurationMin: cand.durationMinutes,
              durationMinutes: cand.durationMinutes,
              routeScore: qualityScore
            });
            if (accessRes && accessRes.score !== undefined) {
              accessibilityScore = accessRes.score;
            }
          } catch (_) {}

          // 4. Distance efficiency
          const distanceEfficiency = isAlt ? 85 : 95;

          // 5. Multi-Signal Formula
          const rawTotal = (
            qualityScore * 0.25 +
            etaEfficiency * 0.20 +
            delayRiskScore * 0.20 +
            accessibilityScore * 0.20 +
            distanceEfficiency * 0.10 +
            weatherScore * 0.05
          );

          const finalScore = Math.max(50, Math.min(99, Math.round(rawTotal)));

          return {
            ...cand,
            score: finalScore,
            weatherRisk,
            scoreBreakdown: {
              qualityScore: { raw: qualityScore, weight: 0.25, points: Math.round(qualityScore * 0.25 * 10) / 10 },
              etaEfficiency: { raw: Math.round(etaEfficiency * 10) / 10, weight: 0.20, points: Math.round(etaEfficiency * 0.20 * 10) / 10 },
              delayRiskScore: { raw: Math.round(delayRiskScore * 10) / 10, weight: 0.20, points: Math.round(delayRiskScore * 0.20 * 10) / 10 },
              accessibilityScore: { raw: Math.round(accessibilityScore * 10) / 10, weight: 0.20, points: Math.round(accessibilityScore * 0.20 * 10) / 10 },
              distanceEfficiency: { raw: Math.round(distanceEfficiency * 10) / 10, weight: 0.10, points: Math.round(distanceEfficiency * 0.10 * 10) / 10 },
              weatherScore: { raw: weatherScore, weight: 0.05, points: Math.round(weatherScore * 0.05 * 10) / 10 }
            }
          };
        })
      );

      // Check if targetShipment already has an active selected route
      let selectedRouteDoc = null;
      if (targetShipment.route) {
        selectedRouteDoc = await Route.findById(targetShipment.route).lean();
      }
      if (!selectedRouteDoc) {
        selectedRouteDoc = await Route.findOne({ shipment: targetShipment._id, status: 'SELECTED' }).lean();
      }

      routeResults.hasSelectedRoute = !!selectedRouteDoc;
      routeResults.selectedRouteId = selectedRouteDoc?._id?.toString() || null;
      routeResults.selectedRouteName = selectedRouteDoc?.routeName || null;

      routeResults.routes = candidateEvaluations.map((cand) => {
        const isMatched = selectedRouteDoc && (
          (cand.id && String(cand.id) === String(selectedRouteDoc._id)) ||
          (cand.name === selectedRouteDoc.routeName && Math.abs(cand.distanceKm - selectedRouteDoc.distanceKm) < 0.1) ||
          (selectedRouteDoc.routeName && cand.name && (
            cand.name.toLowerCase().includes(selectedRouteDoc.routeName.toLowerCase()) ||
            selectedRouteDoc.routeName.toLowerCase().includes(cand.name.toLowerCase())
          ))
        );
        return {
          ...cand,
          status: isMatched ? 'SELECTED' : 'CALCULATED',
          isSelected: !!isMatched
        };
      });
    }

    res.json({
      success: true,
      data: routeResults
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Select & save optimal route for a shipment (One-time selection)
// @route   POST /api/routes/select
// @access  Private (OWNER only)
const selectRoute = async (req, res, next) => {
  try {
    if (req.user && req.user.role !== 'OWNER') {
      return sendStatus(res, 403).json({
        success: false,
        message: 'Forbidden: Only owners can select routes.'
      });
    }

    const { shipmentId, routeData, source, destination } = req.body;

    if (!shipmentId || !routeData) {
      return sendStatus(res, 400).json({
        success: false,
        message: 'shipmentId and routeData are required.'
      });
    }

    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) {
      return sendStatus(res, 404).json({ success: false, message: 'Shipment not found' });
    }

    const routeDistance = parseFloat(routeData.distanceKm);
    const routeDuration = parseInt(routeData.durationMinutes, 10);
    const routeName = routeData.name || 'Optimal Logistics Route';

    // 1. One-time selection enforcement: Check if a route is already selected
    let existingSelectedRoute = await Route.findOne({
      shipment: shipment._id,
      status: 'SELECTED'
    });

    if (!existingSelectedRoute && shipment.route) {
      existingSelectedRoute = await Route.findById(shipment.route);
    }

    if (existingSelectedRoute) {
      // Check if user is clicking the exact same route repeatedly (idempotent success)
      const isSameRoute =
        (existingSelectedRoute.routeName === routeName &&
         Math.abs(existingSelectedRoute.distanceKm - routeDistance) < 0.1) ||
        (routeData.id && String(existingSelectedRoute._id) === String(routeData.id)) ||
        (routeData._id && String(existingSelectedRoute._id) === String(routeData._id)) ||
        (existingSelectedRoute.routeName && routeName && (
          existingSelectedRoute.routeName.toLowerCase().includes(routeName.toLowerCase()) ||
          routeName.toLowerCase().includes(existingSelectedRoute.routeName.toLowerCase())
        ));

      if (isSameRoute) {
        // Return existing selected route idempotently without creating duplicates
        const populatedShipment = await Shipment.findById(shipment._id)
          .populate('customer', 'name email phone')
          .populate('originHub', 'name code city state')
          .populate('destinationHub', 'name code city state')
          .populate('driver', 'name email phone')
          .populate('vehicle', 'registrationNumber vehicleType capacityKg')
          .populate('route');

        return sendStatus(res, 200).json({
          success: true,
          message: 'Route has already been selected for this shipment.',
          alreadySelected: true,
          data: {
            route: existingSelectedRoute,
            shipment: populatedShipment
          }
        });
      }

      // If user is attempting to select a DIFFERENT route after one has already been finalized:
      return sendStatus(res, 400).json({
        success: false,
        message: 'A route has already been selected for this shipment.'
      });
    }

    // Coordinates extraction & validation
    const pCoords = shipment.pickupLocation?.coordinates;
    const dCoords = shipment.deliveryLocation?.coordinates;

    if (!pCoords || !dCoords || !Array.isArray(pCoords) || !Array.isArray(dCoords)) {
      return res.status(400).json({
        success: false,
        message: 'Shipment pickup or delivery coordinates are missing.'
      });
    }

    const srcCoords = source || {
      latitude: parseFloat(pCoords[1]),
      longitude: parseFloat(pCoords[0]),
      address: typeof shipment.pickupAddress === 'object' ? shipment.pickupAddress?.street : (shipment.pickupAddress || 'Customer Pickup'),
      city: shipment.pickupAddress?.city || shipment.pickupCity || 'Customer Pickup Location'
    };

    const destCoords = destination || {
      latitude: parseFloat(dCoords[1]),
      longitude: parseFloat(dCoords[0]),
      address: typeof shipment.deliveryAddress === 'object' ? shipment.deliveryAddress?.street : (shipment.deliveryAddress || 'Customer Delivery'),
      city: shipment.deliveryAddress?.city || shipment.deliveryCity || 'Customer Delivery Location'
    };

    // 2. Atomically archive/deactivate any existing routes for this shipment
    await Route.updateMany(
      { shipment: shipment._id },
      { $set: { status: 'ARCHIVED', updatedAt: new Date() } }
    );

    // 3. Create or upsert the single SELECTED route document
    const routeDoc = await Route.create({
      shipment: shipment._id,
      vehicle: shipment.vehicle || null,
      driver: shipment.driver || null,
      source: srcCoords,
      destination: destCoords,
      distanceKm: routeDistance,
      estimatedDurationMinutes: routeDuration,
      score: routeData.score || 90,
      geometry: routeData.geometry || { type: 'LineString', coordinates: [] },
      routeName: routeName,
      status: 'SELECTED'
    });

    // 4. Link route reference to shipment & update metrics
    shipment.route = routeDoc._id;
    shipment.estimatedDistanceKm = routeDistance;
    shipment.estimatedDurationMinutes = routeDuration;
    shipment.selectedRouteGeometry = routeDoc.geometry;

    // Resynchronize freight pricing quote with finalized route distance
    try {
      const pricingService = require('../services/pricingService');
      const updatedQuote = pricingService.calculateFreightQuote({
        distanceKm: routeDistance,
        weightKg: shipment.weightKg,
        goodsCategory: shipment.packageType || 'STANDARD',
        quantity: shipment.quantity || 1
      });
      if (!updatedQuote.quoteUnavailable) {
        shipment.estimatedCost = updatedQuote.totalFreightQuote;
        shipment.pricingDetails = updatedQuote.breakdown;
      }
    } catch (priceErr) {
      console.warn('[RouteController] Pricing resync note:', priceErr.message);
    }

    if (['CREATED', 'PENDING'].includes(shipment.status)) {
      shipment.status = 'CONFIRMED';
    }

    await shipment.save();

    // 5. PHASE 4C: Recalculate ETA monitoring snapshot immediately
    try {
      const etaMonitoringService = require('../services/etaMonitoringService');
      await etaMonitoringService.recalculateShipmentETA(shipment._id, { force: true });
    } catch (etaErr) {
      console.warn('[RouteController] ETA snapshot update notice:', etaErr.message);
    }

    const populatedShipment = await Shipment.findById(shipment._id)
      .populate('customer', 'name email phone')
      .populate('originHub', 'name code city state')
      .populate('destinationHub', 'name code city state')
      .populate('driver', 'name email phone')
      .populate('vehicle', 'registrationNumber vehicleType capacityKg')
      .populate('route');

    return sendStatus(res, 200).json({
      success: true,
      message: `Route "${routeDoc.routeName}" successfully selected and locked for shipment ${shipment.trackingNumber || shipment.trackingId}.`,
      data: {
        route: routeDoc,
        shipment: populatedShipment
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get route by ID
// @route   GET /api/routes/:id
// @access  Private
const getRouteById = async (req, res, next) => {
  try {
    const routeDoc = await Route.findById(req.params.id)
      .populate('shipment')
      .populate('vehicle')
      .populate('driver', 'name email phone');

    if (!routeDoc) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    res.json({ success: true, data: routeDoc });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  calculateRoutes,
  selectRoute,
  getRouteById
};
