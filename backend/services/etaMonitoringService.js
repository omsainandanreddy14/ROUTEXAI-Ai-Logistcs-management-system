const Shipment = require('../models/Shipment');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const VehicleTracking = require('../models/VehicleTracking');
const ShipmentETA = require('../models/ShipmentETA');
const ShipmentETAHistory = require('../models/ShipmentETAHistory');
const Route = require('../models/Route');
const routeService = require('./routeService');
const etaService = require('./etaService');
const { calculateHaversineDistance, calculateDistanceToPolyline } = require('../utils/geoUtils');

// Configurable Monitoring Settings
let monitoringConfig = {
  corridorThresholdKm: 1.0,          // Distance from planned route to consider outside corridor
  delayThresholdMinutes: 15,         // > 15 mins delay classified as DELAYED, <= 15 mins ON_TIME
  consecutiveDeviationThreshold: 2,  // Number of consecutive updates outside corridor to trigger DEVIATED
  staleThresholdMinutes: 5,          // Phase 4A STALE threshold
  offlineThresholdMinutes: 30,       // Phase 4A OFFLINE threshold
  recalculationCooldownMs: 5000      // 5 seconds cooldown per shipment
};

const getMonitoringConfig = () => ({ ...monitoringConfig });

const updateMonitoringConfig = (newConfig = {}) => {
  if (typeof newConfig.corridorThresholdKm === 'number' && newConfig.corridorThresholdKm > 0) {
    monitoringConfig.corridorThresholdKm = newConfig.corridorThresholdKm;
  }
  if (typeof newConfig.delayThresholdMinutes === 'number') {
    monitoringConfig.delayThresholdMinutes = newConfig.delayThresholdMinutes;
  }
  if (typeof newConfig.consecutiveDeviationThreshold === 'number' && newConfig.consecutiveDeviationThreshold > 0) {
    monitoringConfig.consecutiveDeviationThreshold = Math.round(newConfig.consecutiveDeviationThreshold);
  }
  if (typeof newConfig.staleThresholdMinutes === 'number' && newConfig.staleThresholdMinutes > 0) {
    monitoringConfig.staleThresholdMinutes = newConfig.staleThresholdMinutes;
  }
  if (typeof newConfig.offlineThresholdMinutes === 'number' && newConfig.offlineThresholdMinutes > 0) {
    monitoringConfig.offlineThresholdMinutes = newConfig.offlineThresholdMinutes;
  }
  return { ...monitoringConfig };
};

/**
 * Authoritatively resolve planned route geometry and route document ID for a shipment
 */
const resolvePlannedRouteGeometry = async (shipment) => {
  if (!shipment) {
    return { hasRouteGeometry: false, plannedCoords: null, routeDoc: null, routeId: null };
  }

  let plannedCoords = null;
  let routeDoc = null;
  let routeId = shipment.route?._id || (typeof shipment.route === 'object' && shipment.route !== null ? shipment.route._id : shipment.route) || null;

  // 1. Direct GeoJSON LineString coordinates on shipment
  if (shipment.selectedRouteGeometry) {
    if (Array.isArray(shipment.selectedRouteGeometry.coordinates) && shipment.selectedRouteGeometry.coordinates.length >= 2) {
      plannedCoords = shipment.selectedRouteGeometry.coordinates;
    } else if (Array.isArray(shipment.selectedRouteGeometry) && shipment.selectedRouteGeometry.length >= 2) {
      plannedCoords = shipment.selectedRouteGeometry;
    }
  }

  // 2. Populated route object on shipment
  if (!plannedCoords && shipment.route && typeof shipment.route === 'object') {
    if (Array.isArray(shipment.route.geometry?.coordinates) && shipment.route.geometry.coordinates.length >= 2) {
      plannedCoords = shipment.route.geometry.coordinates;
      routeDoc = shipment.route;
      routeId = shipment.route._id;
    }
  }

  // 3. Fallback: Query Route model by routeId if route is unpopulated or coordinates were omitted
  if (!plannedCoords && routeId) {
    try {
      const found = await Route.findById(routeId).select('geometry distanceKm estimatedDurationMinutes routeName status');
      if (found && Array.isArray(found.geometry?.coordinates) && found.geometry.coordinates.length >= 2) {
        plannedCoords = found.geometry.coordinates;
        routeDoc = found;
      }
    } catch (e) {
      // Non-blocking query catch
    }
  }

  // 4. Fallback: Query latest SELECTED route document by shipment reference
  if (!plannedCoords && shipment._id) {
    try {
      const found = await Route.findOne({ shipment: shipment._id, status: 'SELECTED' })
        .sort({ updatedAt: -1 })
        .select('geometry distanceKm estimatedDurationMinutes routeName status');
      if (found && Array.isArray(found.geometry?.coordinates) && found.geometry.coordinates.length >= 2) {
        plannedCoords = found.geometry.coordinates;
        routeDoc = found;
        routeId = found._id;
      }
    } catch (e) {
      // Non-blocking query catch
    }
  }

  // Validate coordinates: must be an array of at least 2 points where each point is [number, number]
  const isValid = Array.isArray(plannedCoords) &&
    plannedCoords.length >= 2 &&
    plannedCoords.every(pt => Array.isArray(pt) && pt.length >= 2 && !isNaN(Number(pt[0])) && !isNaN(Number(pt[1])));

  return {
    hasRouteGeometry: isValid,
    plannedCoords: isValid ? plannedCoords : null,
    routeDoc,
    routeId
  };
};

/**
 * Recalculate Live ETA and Route Deviation for a Shipment (Phase 4C)
 */
const recalculateShipmentETA = async (shipmentIdOrTracking, options = {}) => {
  const idStr = String(shipmentIdOrTracking);
  const shipment = await Shipment.findOne({
    $or: [
      { _id: idStr.match(/^[0-9a-fA-F]{24}$/) ? idStr : null },
      { trackingNumber: idStr.toUpperCase() },
      { trackingId: idStr.toUpperCase() }
    ]
  })
    .populate('customer', 'name email phone')
    .populate('driver', 'name email phone')
    .populate('vehicle', 'registrationNumber vehicleType capacityKg fuelType')
    .populate('route');

  // 1. Shipment Existence
  if (!shipment) {
    const notFoundErr = new Error(`Shipment not found with identifier: ${shipmentIdOrTracking}`);
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  // Authoritatively resolve route geometry upfront
  const { hasRouteGeometry, plannedCoords, routeDoc, routeId } = await resolvePlannedRouteGeometry(shipment);

  // 2. Terminal State Check: Delivered, Cancelled, Failed stop active ETA calculation
  if (['DELIVERED', 'CANCELLED', 'FAILED'].includes(shipment.status)) {
    const existing = await ShipmentETA.findOne({ shipment: shipment._id })
      .populate('shipment', 'trackingNumber trackingId status pickupAddress deliveryAddress')
      .populate('vehicle', 'registrationNumber vehicleType capacityKg')
      .populate('driver', 'name email phone');

    if (existing) {
      existing.availability = 'UNAVAILABLE';
      existing.unavailableReason = `Shipment is in terminal status '${shipment.status}'. Active ETA monitoring stopped.`;
      existing.hasRouteGeometry = hasRouteGeometry;
      if (routeId) existing.route = routeId;
      await existing.save();
      return existing;
    }

    return {
      shipment: shipment._id,
      trackingNumber: shipment.trackingNumber,
      availability: 'UNAVAILABLE',
      unavailableReason: `Shipment is in terminal status '${shipment.status}'. Active ETA monitoring stopped.`,
      etaStatus: 'UNKNOWN',
      deviationStatus: 'UNKNOWN',
      currentETA: null,
      plannedETA: null,
      hasRouteGeometry,
      calculatedAt: new Date()
    };
  }

  // Load existing ETA snapshot
  const existing = await ShipmentETA.findOne({ shipment: shipment._id });

  // Baseline Planned ETA Calculation
  let plannedETA = existing?.plannedETA || null;
  if (!plannedETA) {
    if (shipment.estimatedDurationMinutes && shipment.estimatedDurationMinutes > 0) {
      const baseTime = shipment.createdAt ? new Date(shipment.createdAt).getTime() : Date.now();
      plannedETA = new Date(baseTime + shipment.estimatedDurationMinutes * 60000);
    } else if (routeDoc?.estimatedDurationMinutes && routeDoc.estimatedDurationMinutes > 0) {
      const baseTime = shipment.createdAt ? new Date(shipment.createdAt).getTime() : Date.now();
      plannedETA = new Date(baseTime + routeDoc.estimatedDurationMinutes * 60000);
    } else if (shipment.route?.estimatedDurationMinutes && shipment.route.estimatedDurationMinutes > 0) {
      const baseTime = shipment.createdAt ? new Date(shipment.createdAt).getTime() : Date.now();
      plannedETA = new Date(baseTime + shipment.route.estimatedDurationMinutes * 60000);
    } else if (shipment.route?.durationMinutes && shipment.route.durationMinutes > 0) {
      const baseTime = shipment.createdAt ? new Date(shipment.createdAt).getTime() : Date.now();
      plannedETA = new Date(baseTime + shipment.route.durationMinutes * 60000);
    } else {
      plannedETA = null;
    }
  }

  const routeInfo = { hasRouteGeometry, plannedCoords, routeId, plannedETA };

  // 3. Validate Delivery Coordinates
  const dCoords = shipment.deliveryLocation?.coordinates;
  if (!dCoords || !Array.isArray(dCoords) || dCoords.length < 2) {
    return handleUnavailableETA(shipment, 'Missing or incomplete delivery location coordinates', 'UNKNOWN', routeInfo);
  }

  const destLng = Number(dCoords[0]);
  const destLat = Number(dCoords[1]);
  if (isNaN(destLat) || isNaN(destLng) || destLat < -90 || destLat > 90 || destLng < -180 || destLng > 180) {
    return handleUnavailableETA(shipment, 'Invalid delivery destination latitude/longitude bounds', 'UNKNOWN', routeInfo);
  }

  // 4. Validate Vehicle Assignment
  if (!shipment.vehicle) {
    return handleUnavailableETA(shipment, 'No fleet vehicle is assigned to this shipment', 'UNKNOWN', routeInfo);
  }

  // 5. Query Vehicle GPS Telemetry from Phase 4A
  const tracking = await VehicleTracking.findOne({ vehicle: shipment.vehicle._id });
  if (!tracking) {
    return handleUnavailableETA(shipment, 'No vehicle GPS telemetry record found for assigned vehicle', 'UNKNOWN', routeInfo);
  }

  // Validate GPS coordinates
  const lat = Number(tracking.latitude);
  const lng = Number(tracking.longitude);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return handleUnavailableETA(shipment, 'Invalid GPS coordinates received from vehicle telemetry', 'UNKNOWN', routeInfo);
  }

  // Verify telemetry belongs to the assigned vehicle
  if (String(tracking.vehicle) !== String(shipment.vehicle._id)) {
    return handleUnavailableETA(shipment, 'Telemetry vehicle reference does not match assigned shipment vehicle', 'UNKNOWN', routeInfo);
  }

  // 6. Check GPS Vitality (LIVE / STALE / OFFLINE)
  const gpsTimestamp = tracking.lastUpdated || tracking.updatedAt || new Date();
  const diffMinutes = Math.max(0, (Date.now() - new Date(gpsTimestamp).getTime()) / (1000 * 60));

  let trackingVitality = 'LIVE';
  if (tracking.status === 'OFFLINE' || diffMinutes >= monitoringConfig.offlineThresholdMinutes) {
    trackingVitality = 'OFFLINE';
  } else if (diffMinutes >= monitoringConfig.staleThresholdMinutes) {
    trackingVitality = 'STALE';
  } else {
    trackingVitality = 'LIVE';
  }

  // Handle OFFLINE GPS: Do not claim vehicle is at current location; preserve last known ETA if available
  if (trackingVitality === 'OFFLINE') {
    if (existing && (existing.currentETA || existing.lastKnownETA)) {
      const histETA = existing.lastKnownETA || existing.currentETA;
      const histDeviationKm = existing.lastDetectedDeviationKm !== undefined && existing.lastDetectedDeviationKm !== null
        ? existing.lastDetectedDeviationKm
        : (existing.deviationDistanceKm ?? null);
      const histDevStatus = existing.lastDetectedDeviationStatus || (existing.deviationStatus === 'DEVIATED' ? 'DEVIATED' : 'ON_ROUTE');
      const histDevTime = existing.lastDetectedDeviationTimestamp || existing.gpsTimestamp;

      existing.availability = 'UNAVAILABLE';
      existing.trackingVitality = 'OFFLINE';
      existing.etaStatus = 'PAUSED';
      existing.deviationStatus = 'PAUSED';
      existing.currentETA = histETA;
      existing.lastKnownETA = histETA;
      existing.lastKnownETATimestamp = existing.lastKnownETATimestamp || existing.calculatedAt || gpsTimestamp;
      existing.lastDetectedDeviationKm = histDeviationKm;
      existing.lastDetectedDeviationStatus = histDevStatus;
      existing.lastDetectedDeviationTimestamp = histDevTime;
      existing.lastGpsTimestamp = gpsTimestamp;
      existing.deviationDistanceKm = histDeviationKm;
      existing.unavailableReason = `Vehicle GPS telemetry is OFFLINE (${Math.round(diffMinutes)} mins old). Live ETA recalculation paused.`;
      existing.calculatedAt = new Date();
      existing.hasRouteGeometry = hasRouteGeometry;
      existing.corridorStatusReason = hasRouteGeometry
        ? (histDevStatus === 'DEVIATED'
            ? `GPS telemetry offline; corridor monitoring paused. Last detected deviation: ${histDeviationKm} km off route at ${new Date(histDevTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
            : 'GPS telemetry offline; corridor monitoring paused')
        : 'No planned route geometry attached to shipment';
      if (routeId) existing.route = routeId;
      if (plannedETA && !existing.plannedETA) existing.plannedETA = plannedETA;
      await existing.save();
      return existing.populate([
        { path: 'shipment', select: 'trackingNumber trackingId status pickupAddress deliveryAddress' },
        { path: 'vehicle', select: 'registrationNumber vehicleType capacityKg' },
        { path: 'driver', select: 'name email phone' }
      ]);
    }
    return handleUnavailableETA(
      shipment,
      `Vehicle GPS telemetry is OFFLINE (${Math.round(diffMinutes)} mins old). Live ETA unavailable.`,
      trackingVitality,
      routeInfo
    );
  }

  // Check cooldown if not forced
  if (!options.force && existing && existing.calculatedAt) {
    const elapsedSinceCalc = Date.now() - new Date(existing.calculatedAt).getTime();
    const sameGpsTime = existing.gpsTimestamp && new Date(existing.gpsTimestamp).getTime() === new Date(gpsTimestamp).getTime();
    const sameGeometryStatus = existing.hasRouteGeometry === hasRouteGeometry;
    if (elapsedSinceCalc < monitoringConfig.recalculationCooldownMs && sameGpsTime && sameGeometryStatus) {
      return existing.populate([
        { path: 'shipment', select: 'trackingNumber trackingId status pickupAddress deliveryAddress' },
        { path: 'vehicle', select: 'registrationNumber vehicleType capacityKg' },
        { path: 'driver', select: 'name email phone' }
      ]);
    }
  }

  // 9. Route Deviation & ETA Variables
  let deviationDistanceKm = null;
  let deviationStatus = 'UNKNOWN';
  let consecutiveDeviations = existing?.consecutiveDeviations || 0;
  let corridorStatusReason = null;

  let remainingDistanceKm = null;
  let remainingDurationMinutes = null;
  let dataSource = 'ORS_LIVE_TELEMETRY';
  let currentETA = null;
  let unavailableReason = null;
  let delayMinutes = null;
  let etaStatus = 'UNKNOWN';

  let lastKnownETA = existing?.lastKnownETA || existing?.currentETA || null;
  let lastKnownETATimestamp = existing?.lastKnownETATimestamp || existing?.calculatedAt || null;
  let lastDetectedDeviationKm = existing?.lastDetectedDeviationKm !== undefined && existing?.lastDetectedDeviationKm !== null
    ? existing.lastDetectedDeviationKm
    : (existing?.deviationDistanceKm ?? null);
  let lastDetectedDeviationStatus = existing?.lastDetectedDeviationStatus ||
    (existing?.deviationStatus === 'DEVIATED' ? 'DEVIATED' : (existing?.deviationStatus === 'ON_ROUTE' ? 'ON_ROUTE' : 'UNKNOWN'));
  let lastDetectedDeviationTimestamp = existing?.lastDetectedDeviationTimestamp || existing?.gpsTimestamp || null;
  let lastGpsTimestamp = gpsTimestamp;

  if (trackingVitality === 'STALE') {
    // =========================================================================
    // RULE 1: When GPS age reaches STALE threshold, PAUSE live recalculations
    // =========================================================================
    deviationStatus = 'PAUSED';
    etaStatus = 'PAUSED';

    // RULE 2: Preserve last known ETA and last detected deviation in DB
    currentETA = existing?.lastKnownETA || existing?.currentETA || null;
    lastKnownETA = currentETA;
    lastKnownETATimestamp = existing?.lastKnownETATimestamp || existing?.calculatedAt || gpsTimestamp;

    deviationDistanceKm = existing?.lastDetectedDeviationKm !== undefined && existing?.lastDetectedDeviationKm !== null
      ? existing.lastDetectedDeviationKm
      : (existing?.deviationDistanceKm ?? null);
    lastDetectedDeviationKm = deviationDistanceKm;
    lastDetectedDeviationStatus = existing?.lastDetectedDeviationStatus ||
      (existing?.deviationStatus === 'DEVIATED' ? 'DEVIATED' : 'ON_ROUTE');
    lastDetectedDeviationTimestamp = existing?.lastDetectedDeviationTimestamp || existing?.gpsTimestamp || gpsTimestamp;

    remainingDistanceKm = existing?.remainingDistanceKm ?? null;
    remainingDurationMinutes = currentETA ? Math.max(0, Math.round((new Date(currentETA).getTime() - Date.now()) / 60000)) : null;
    dataSource = existing?.dataSource && existing.dataSource !== 'UNAVAILABLE' ? existing.dataSource : 'LAST_KNOWN_STALE';
    delayMinutes = existing?.delayMinutes ?? (currentETA && plannedETA ? Math.round((new Date(currentETA).getTime() - new Date(plannedETA).getTime()) / 60000) : null);

    // RULE 5: Retain historical deviation warning with timestamp without claiming current active deviation
    if (lastDetectedDeviationStatus === 'DEVIATED') {
      const devTimeStr = lastDetectedDeviationTimestamp
        ? new Date(lastDetectedDeviationTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'prior update';
      corridorStatusReason = `GPS telemetry is STALE (${Math.round(diffMinutes)} mins old). Corridor monitoring paused. Last detected deviation: ${deviationDistanceKm} km off route at ${devTimeStr}.`;
    } else {
      corridorStatusReason = `GPS telemetry is STALE (${Math.round(diffMinutes)} mins old). Live corridor monitoring paused. Displaying last known corridor status.`;
    }
    unavailableReason = `Vehicle GPS telemetry is STALE (${Math.round(diffMinutes)} mins old). Live ETA recalculation paused. Displaying last known delivery ETA.`;
  } else {
    // =========================================================================
    // RULE 6: Fresh LIVE GPS Telemetry Recalculation
    // =========================================================================
    if (!hasRouteGeometry) {
      deviationStatus = 'UNKNOWN';
      deviationDistanceKm = null;
      consecutiveDeviations = 0;
      corridorStatusReason = 'No planned route geometry attached to shipment';
    } else {
      deviationDistanceKm = calculateDistanceToPolyline(lat, lng, plannedCoords);

      if (deviationDistanceKm <= monitoringConfig.corridorThresholdKm) {
        consecutiveDeviations = 0;
        deviationStatus = 'ON_ROUTE';
        corridorStatusReason = `Vehicle is within ${monitoringConfig.corridorThresholdKm} km highway corridor (${deviationDistanceKm} km off)`;
      } else {
        consecutiveDeviations += 1;
        if (consecutiveDeviations >= monitoringConfig.consecutiveDeviationThreshold) {
          deviationStatus = 'DEVIATED';
          corridorStatusReason = `Vehicle confirmed DEVIATED outside corridor (${deviationDistanceKm} km off, ${consecutiveDeviations} consecutive checks)`;
        } else {
          deviationStatus = existing?.deviationStatus === 'DEVIATED' ? 'DEVIATED' : 'ON_ROUTE';
          corridorStatusReason = `Single GPS point outside corridor (${deviationDistanceKm} km off, filtered as potential noise)`;
        }
      }

      lastDetectedDeviationKm = deviationDistanceKm;
      lastDetectedDeviationStatus = deviationStatus;
      lastDetectedDeviationTimestamp = gpsTimestamp;
    }

    // Fresh LIVE calculation via ORS & Phase 3C
    let roadCandidate = null;
    try {
      const roadCalc = await routeService.calculateCandidateRoutes(
        { latitude: lat, longitude: lng },
        { latitude: destLat, longitude: destLng },
        shipment.trackingNumber
      );
      if (roadCalc && roadCalc.routes && roadCalc.routes.length > 0) {
        roadCandidate = roadCalc.routes[0];
        remainingDistanceKm = roadCandidate.distanceKm;
        remainingDurationMinutes = roadCandidate.durationMinutes;
      }
    } catch (routeErr) {
      console.warn('[ETA Monitoring] ORS candidate route calculation note:', routeErr.message);
    }

    if (!roadCandidate || remainingDistanceKm === null) {
      const directKm = calculateHaversineDistance(lat, lng, destLat, destLng);
      remainingDistanceKm = parseFloat((directKm * 1.25).toFixed(2));
      remainingDurationMinutes = Math.max(1, Math.round((remainingDistanceKm / 60) * 60));
      dataSource = 'ORS_FALLBACK';
    }

    try {
      const aiRes = await etaService.predictShipmentETA(shipment, {
        distanceKm: remainingDistanceKm,
        expectedDurationMin: remainingDurationMinutes,
        routeScore: roadCandidate?.score || 85
      });

      if (aiRes && aiRes.mlEtaAvailable && aiRes.predictedDurationMin) {
        remainingDurationMinutes = aiRes.predictedDurationMin;
        dataSource = 'AI_ETA_HYBRID';
      }
    } catch (aiErr) {
      console.warn('[ETA Monitoring] Phase 3C ETA model unavailable, using ORS road duration:', aiErr.message);
    }

    currentETA = new Date(Date.now() + remainingDurationMinutes * 60000);
    lastKnownETA = currentETA;
    lastKnownETATimestamp = new Date();
    lastGpsTimestamp = gpsTimestamp;
    unavailableReason = null;

    if (currentETA && plannedETA) {
      delayMinutes = Math.round((new Date(currentETA).getTime() - new Date(plannedETA).getTime()) / 60000);
      etaStatus = delayMinutes > monitoringConfig.delayThresholdMinutes ? 'DELAYED' : 'ON_TIME';
    }
  }

  // Elapsed Distance
  const initialDistance = shipment.estimatedDistanceKm || remainingDistanceKm;
  const elapsedDistanceKm = Math.max(0, parseFloat((initialDistance - (remainingDistanceKm || 0)).toFixed(2)));

  // 12. Save Snapshot to ShipmentETA
  const previousETA = existing?.currentETA || currentETA;

  const updatePayload = {
    shipment: shipment._id,
    vehicle: shipment.vehicle._id,
    driver: shipment.driver ? (shipment.driver._id || shipment.driver) : null,
    route: shipment.route ? (shipment.route._id || shipment.route) : null,
    plannedETA,
    currentETA,
    previousETA,
    lastKnownETA,
    lastKnownETATimestamp,
    remainingDistanceKm,
    elapsedDistanceKm,
    deviationDistanceKm,
    deviationStatus,
    lastDetectedDeviationKm,
    lastDetectedDeviationStatus,
    lastDetectedDeviationTimestamp,
    consecutiveDeviations,
    delayMinutes,
    etaStatus,
    gpsTimestamp,
    lastGpsTimestamp,
    calculatedAt: new Date(),
    dataSource,
    availability: 'AVAILABLE',
    unavailableReason,
    trackingVitality,
    hasRouteGeometry,
    corridorStatusReason
  };

  const savedETA = await ShipmentETA.findOneAndUpdate(
    { shipment: shipment._id },
    { $set: updatePayload },
    { upsert: true, new: true, runValidators: true }
  )
    .populate('shipment', 'trackingNumber trackingId status pickupAddress deliveryAddress pickupCity deliveryCity')
    .populate('vehicle', 'registrationNumber vehicleType capacityKg fuelType')
    .populate('driver', 'name email phone');

  // Record history on significant ETA change or deviation status change
  if (
    !existing ||
    existing.deviationStatus !== deviationStatus ||
    existing.etaStatus !== etaStatus ||
    Math.abs(Math.round(((new Date(currentETA).getTime() - new Date(previousETA).getTime()) / 60000))) >= 5
  ) {
    try {
      await ShipmentETAHistory.create({
        shipment: shipment._id,
        vehicle: shipment.vehicle._id,
        currentETA,
        remainingDistanceKm,
        deviationDistanceKm,
        deviationStatus,
        delayMinutes,
        etaStatus,
        gpsTimestamp,
        calculatedAt: new Date(),
        dataSource
      });
    } catch (histErr) {
      // Non-blocking history record catch
    }
  }

  return savedETA;
};

/**
 * Handle and persist controlled unavailable ETA state
 */
const handleUnavailableETA = async (shipment, reason, vitality = 'UNKNOWN', routeInfo = null) => {
  const existing = await ShipmentETA.findOne({ shipment: shipment._id });

  let hasRouteGeom = false;
  let resolvedRouteId = null;
  let plannedETA = existing?.plannedETA || null;

  if (routeInfo && typeof routeInfo.hasRouteGeometry === 'boolean') {
    hasRouteGeom = routeInfo.hasRouteGeometry;
    resolvedRouteId = routeInfo.routeId || null;
    if (routeInfo.plannedETA) plannedETA = routeInfo.plannedETA;
  } else {
    const resolved = await resolvePlannedRouteGeometry(shipment);
    hasRouteGeom = resolved.hasRouteGeometry;
    resolvedRouteId = resolved.routeId;
  }

  // Baseline plannedETA computation if not already set
  if (!plannedETA) {
    if (shipment.estimatedDurationMinutes && shipment.estimatedDurationMinutes > 0) {
      const baseTime = shipment.createdAt ? new Date(shipment.createdAt).getTime() : Date.now();
      plannedETA = new Date(baseTime + shipment.estimatedDurationMinutes * 60000);
    } else if (shipment.route?.estimatedDurationMinutes && shipment.route.estimatedDurationMinutes > 0) {
      const baseTime = shipment.createdAt ? new Date(shipment.createdAt).getTime() : Date.now();
      plannedETA = new Date(baseTime + shipment.route.estimatedDurationMinutes * 60000);
    } else if (shipment.route?.durationMinutes && shipment.route.durationMinutes > 0) {
      const baseTime = shipment.createdAt ? new Date(shipment.createdAt).getTime() : Date.now();
      plannedETA = new Date(baseTime + shipment.route.durationMinutes * 60000);
    }
  }

  let corridorReason = reason;
  if (!hasRouteGeom) {
    corridorReason = 'No planned route geometry attached to shipment';
  } else if (vitality === 'OFFLINE') {
    corridorReason = 'GPS telemetry offline; corridor monitoring paused';
  } else if (!shipment.vehicle) {
    corridorReason = 'Corridor monitoring pending vehicle assignment';
  } else {
    corridorReason = reason;
  }

  const histDeviationKm = existing?.lastDetectedDeviationKm !== undefined && existing?.lastDetectedDeviationKm !== null
    ? existing.lastDetectedDeviationKm
    : (existing?.deviationDistanceKm ?? null);
  const histDevStatus = existing?.lastDetectedDeviationStatus || (existing?.deviationStatus === 'DEVIATED' ? 'DEVIATED' : (existing?.deviationStatus === 'ON_ROUTE' ? 'ON_ROUTE' : 'UNKNOWN'));
  const histDevTime = existing?.lastDetectedDeviationTimestamp || existing?.gpsTimestamp || null;
  const histETA = existing?.lastKnownETA || existing?.currentETA || null;
  const histETATime = existing?.lastKnownETATimestamp || existing?.calculatedAt || null;

  const payload = {
    shipment: shipment._id,
    vehicle: shipment.vehicle?._id || shipment.vehicle || null,
    driver: shipment.driver?._id || shipment.driver || null,
    route: resolvedRouteId || shipment.route?._id || shipment.route || existing?.route || null,
    plannedETA: plannedETA,
    currentETA: existing?.currentETA || histETA || null,
    previousETA: existing?.previousETA || null,
    lastKnownETA: histETA,
    lastKnownETATimestamp: histETATime,
    remainingDistanceKm: existing?.remainingDistanceKm || null,
    elapsedDistanceKm: existing?.elapsedDistanceKm || null,
    deviationDistanceKm: histDeviationKm,
    deviationStatus: (vitality === 'OFFLINE' || vitality === 'STALE') ? 'PAUSED' : (existing?.deviationStatus || 'UNKNOWN'),
    lastDetectedDeviationKm: histDeviationKm,
    lastDetectedDeviationStatus: histDevStatus,
    lastDetectedDeviationTimestamp: histDevTime,
    consecutiveDeviations: existing?.consecutiveDeviations || 0,
    delayMinutes: existing?.delayMinutes !== undefined ? existing.delayMinutes : null,
    etaStatus: (vitality === 'OFFLINE' || vitality === 'STALE') ? 'PAUSED' : (existing?.etaStatus || 'UNKNOWN'),
    gpsTimestamp: existing?.gpsTimestamp || null,
    lastGpsTimestamp: existing?.lastGpsTimestamp || existing?.gpsTimestamp || null,
    calculatedAt: new Date(),
    dataSource: existing?.dataSource && existing.dataSource !== 'UNAVAILABLE' ? existing.dataSource : 'UNAVAILABLE',
    availability: 'UNAVAILABLE',
    unavailableReason: reason,
    trackingVitality: vitality,
    hasRouteGeometry: hasRouteGeom,
    corridorStatusReason: corridorReason
  };

  const saved = await ShipmentETA.findOneAndUpdate(
    { shipment: shipment._id },
    { $set: payload },
    { upsert: true, new: true }
  )
    .populate('shipment', 'trackingNumber trackingId status pickupAddress deliveryAddress')
    .populate('vehicle', 'registrationNumber vehicleType capacityKg')
    .populate('driver', 'name email phone');

  return saved;
};

/**
 * Retrieve ETA monitoring for a single shipment with authorization check
 */
const getShipmentETAMonitoring = async (shipmentIdOrTracking, user) => {
  const idStr = String(shipmentIdOrTracking);
  const shipment = await Shipment.findOne({
    $or: [
      { _id: idStr.match(/^[0-9a-fA-F]{24}$/) ? idStr : null },
      { trackingNumber: idStr.toUpperCase() },
      { trackingId: idStr.toUpperCase() }
    ]
  }).populate('route');

  if (!shipment) {
    const notFoundErr = new Error(`Shipment not found with identifier: ${shipmentIdOrTracking}`);
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  // Authorization check
  if (user) {
    if (user.role === 'CUSTOMER') {
      const custId = shipment.customer?.toString();
      const userId = user._id?.toString();
      if (custId && userId && custId !== userId) {
        const forbiddenErr = new Error('Access denied: You can only view ETA monitoring for your own shipments.');
        forbiddenErr.statusCode = 403;
        throw forbiddenErr;
      }
    } else if (user.role === 'DRIVER') {
      const drvId = shipment.driver?.toString();
      const userId = user._id?.toString();
      if (drvId && userId && drvId !== userId) {
        const forbiddenErr = new Error('Access denied: You can only view ETA monitoring for shipments assigned to you.');
        forbiddenErr.statusCode = 403;
        throw forbiddenErr;
      }
    }
  }

  // Check if shipment is active and needs fresh calculation
  const isActive = !['DELIVERED', 'CANCELLED', 'FAILED'].includes(shipment.status);
  let etaRecord = await ShipmentETA.findOne({ shipment: shipment._id })
    .populate('shipment', 'trackingNumber trackingId status pickupAddress deliveryAddress pickupCity deliveryCity')
    .populate('vehicle', 'registrationNumber vehicleType capacityKg')
    .populate('driver', 'name email phone');

  const shipmentHasRoute = !!(shipment.selectedRouteGeometry || shipment.route);
  const needsSyncRecalc = !etaRecord || (shipmentHasRoute && etaRecord.hasRouteGeometry === false);

  if (isActive && needsSyncRecalc) {
    try {
      etaRecord = await recalculateShipmentETA(shipment._id, { force: true });
    } catch (calcErr) {
      console.warn('[ETA Monitoring Service] Recalculate notice:', calcErr.message);
    }
  } else if (isActive && etaRecord && (Date.now() - new Date(etaRecord.calculatedAt).getTime() > 60000)) {
    // Non-blocking background recalculation if snapshot is older than 60s
    recalculateShipmentETA(shipment._id, { force: false }).catch(err => {
      console.warn('[ETA Monitoring Service] Background recalculation notice:', err.message);
    });
  }

  return etaRecord;
};

/**
 * Retrieve Owner Fleet-Wide ETA Monitoring Overview
 */
const getMonitoringOverview = async (options = {}) => {
  const query = {
    status: { $nin: ['DELIVERED', 'CANCELLED', 'FAILED'] }
  };

  // Exclude test-only shipments from normal owner monitoring overview unless explicitly requested
  if (!options.includeTest) {
    query.trackingNumber = { $not: /^TEST-/i };
  }

  const activeShipments = await Shipment.find(query)
    .populate('vehicle')
    .populate('driver', 'name email phone')
    .populate('customer', 'name email')
    .populate('route')
    .sort({ updatedAt: -1 });

  // Recalculate or load latest ETA records for active shipments
  const monitoringItems = [];
  let onTimeCount = 0;
  let delayedCount = 0;
  let deviatedCount = 0;
  let staleDeviatedCount = 0;
  let liveCount = 0;
  let staleCount = 0;
  let offlineCount = 0;

  for (const s of activeShipments) {
    let etaRecord = await ShipmentETA.findOne({ shipment: s._id })
      .populate('shipment', 'trackingNumber trackingId status pickupAddress deliveryAddress pickupCity deliveryCity')
      .populate('vehicle', 'registrationNumber vehicleType capacityKg fuelType')
      .populate('driver', 'name email phone');

    // Auto-recalculate if:
    // 1. Snapshot is missing
    // 2. Shipment has route geometry but snapshot still marks hasRouteGeometry as false
    // 3. Fresh vehicle telemetry has arrived since last calculation
    // 4. Existing snapshot is older than 30 seconds
    const shipmentHasRoute = !!(s.selectedRouteGeometry || s.route);
    let hasNewTelemetry = false;
    if (s.vehicle && etaRecord?.calculatedAt) {
      const trackingDoc = await VehicleTracking.findOne({ vehicle: s.vehicle._id }).select('lastUpdated');
      if (trackingDoc?.lastUpdated && new Date(trackingDoc.lastUpdated).getTime() > new Date(etaRecord.calculatedAt).getTime()) {
        hasNewTelemetry = true;
      }
    }
    const isSnapshotStale = etaRecord?.calculatedAt && (Date.now() - new Date(etaRecord.calculatedAt).getTime() > 30000);
    const needsRecalc = !etaRecord || (shipmentHasRoute && etaRecord.hasRouteGeometry === false) || hasNewTelemetry || isSnapshotStale;

    if (needsRecalc) {
      if (s.vehicle) {
        try {
          etaRecord = await recalculateShipmentETA(s._id, { force: true });
        } catch (e) {
          // Skip uncalculable
        }
      } else {
        try {
          etaRecord = await handleUnavailableETA(s, 'Awaiting vehicle assignment', 'UNKNOWN', { hasRouteGeometry: shipmentHasRoute });
        } catch (e) {
          // Skip
        }
      }
    }

    if (etaRecord) {
      // Ensure OFFLINE and STALE telemetry always reflect PAUSED status
      if (etaRecord.trackingVitality === 'OFFLINE' || etaRecord.trackingVitality === 'STALE') {
        etaRecord.etaStatus = 'PAUSED';
        etaRecord.deviationStatus = 'PAUSED';
      }

      // Non-offline/stale shipments with confirmed ETA variance
      if (etaRecord.trackingVitality === 'LIVE' && etaRecord.availability === 'AVAILABLE') {
        if (etaRecord.etaStatus === 'ON_TIME') onTimeCount++;
        if (etaRecord.etaStatus === 'DELAYED') delayedCount++;
      }

      // Qualified route deviation: only confirmed LIVE telemetry counts as active deviation
      if (etaRecord.trackingVitality === 'LIVE' && etaRecord.deviationStatus === 'DEVIATED') {
        deviatedCount++;
      } else if (etaRecord.trackingVitality === 'STALE' && (etaRecord.deviationStatus === 'DEVIATED' || etaRecord.lastDetectedDeviationStatus === 'DEVIATED')) {
        staleDeviatedCount++;
      }

      if (etaRecord.trackingVitality === 'LIVE') liveCount++;
      if (etaRecord.trackingVitality === 'STALE') staleCount++;
      if (etaRecord.trackingVitality === 'OFFLINE') offlineCount++;

      monitoringItems.push(etaRecord);
    }
  }

  return {
    summaryMetrics: {
      totalMonitored: monitoringItems.length,
      onTimeCount,
      delayedCount,
      deviatedCount,
      staleDeviatedCount,
      liveCount,
      staleCount,
      offlineCount
    },
    thresholds: getMonitoringConfig(),
    monitoringItems,
    generatedAt: new Date()
  };
};

module.exports = {
  recalculateShipmentETA,
  getShipmentETAMonitoring,
  getMonitoringOverview,
  getMonitoringConfig,
  updateMonitoringConfig,
  handleUnavailableETA
};
