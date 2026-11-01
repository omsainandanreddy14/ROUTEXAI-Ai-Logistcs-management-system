/**
 * RouteXAI Fleet Status & Shipment Synchronization Reconciliation Script
 * 
 * Usage:
 *   node backend/scripts/reconcile_fleet_status.js --dry-run
 *   node backend/scripts/reconcile_fleet_status.js --repair
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Vehicle = require('../models/Vehicle');
const VehicleTracking = require('../models/VehicleTracking');
const Shipment = require('../models/Shipment');
const Driver = require('../models/Driver');
const User = require('../models/User');

const parseArguments = () => {
  const args = process.argv.slice(2);
  const isRepair = args.includes('--repair');
  const isDryRun = args.includes('--dry-run') || !isRepair;
  return { isRepair, isDryRun };
};

const reconcileFleet = async () => {
  const { isRepair, isDryRun } = parseArguments();

  console.log('======================================================================');
  console.log(`RouteXAI Fleet & Shipment Synchronization — ${isRepair ? 'REPAIR MODE' : 'DRY RUN AUDIT'}`);
  console.log('======================================================================');

  await connectDB();

  const vehicles = await Vehicle.find().populate('assignedDriver');
  const drivers = await Driver.find().populate('user');
  const activeShipments = await Shipment.find({
    status: { $nin: ['DELIVERED', 'CANCELLED', 'FAILED'] }
  }).populate('driver').populate('vehicle');

  console.log(`\nInventory:`);
  console.log(`- Total Fleet Vehicles: ${vehicles.length}`);
  console.log(`- Total Registered Drivers: ${drivers.length}`);
  console.log(`- Authoritative Active Shipments: ${activeShipments.length}`);

  const activeShipmentsByVehicle = new Map();
  const activeShipmentsByDriverUser = new Map();

  for (const s of activeShipments) {
    if (s.vehicle) {
      const vId = String(s.vehicle._id || s.vehicle);
      if (!activeShipmentsByVehicle.has(vId)) {
        activeShipmentsByVehicle.set(vId, []);
      }
      activeShipmentsByVehicle.get(vId).push(s);
    }
    if (s.driver) {
      const dUserId = String(s.driver._id || s.driver);
      if (!activeShipmentsByDriverUser.has(dUserId)) {
        activeShipmentsByDriverUser.set(dUserId, []);
      }
      activeShipmentsByDriverUser.get(dUserId).push(s);
    }
  }

  const vehicleIssues = [];
  const trackingIssues = [];
  const driverIssues = [];

  // 1. Audit Fleet Vehicles & VehicleTracking
  for (const v of vehicles) {
    const vId = String(v._id);
    const assignedActiveShipments = activeShipmentsByVehicle.get(vId) || [];
    const activeShipment = assignedActiveShipments[0] || null;

    let expectedVehicleStatus;
    let expectedVehicleDriverId;

    if (activeShipment) {
      expectedVehicleStatus = 'ON_TRIP';
      expectedVehicleDriverId = activeShipment.driver ? String(activeShipment.driver._id || activeShipment.driver) : null;
    } else if (v.status === 'MAINTENANCE' || v.status === 'OUT_OF_SERVICE') {
      expectedVehicleStatus = 'MAINTENANCE';
      expectedVehicleDriverId = null;
    } else {
      expectedVehicleStatus = 'AVAILABLE';
      expectedVehicleDriverId = null;
    }

    const currentAssignedDriverId = v.assignedDriver ? String(v.assignedDriver._id || v.assignedDriver) : null;

    if (v.status !== expectedVehicleStatus || currentAssignedDriverId !== expectedVehicleDriverId) {
      vehicleIssues.push({
        vehicleId: v._id,
        reg: v.registrationNumber,
        current: { status: v.status, driver: currentAssignedDriverId },
        expected: { status: expectedVehicleStatus, driver: expectedVehicleDriverId },
        activeShipmentCount: assignedActiveShipments.length
      });
    }

    // Check VehicleTracking document
    const vt = await VehicleTracking.findOne({ vehicle: v._id }).populate('shipment');
    let expectedTrackingStatus;
    if (activeShipment) {
      expectedTrackingStatus = ['IN_TRANSIT', 'PICKED_UP', 'DISPATCHED', 'NEAR_DESTINATION', 'AT_DESTINATION', 'OUT_FOR_DELIVERY'].includes(activeShipment.status)
        ? 'IN_TRANSIT'
        : 'ASSIGNED';
    } else if (expectedVehicleStatus === 'MAINTENANCE') {
      expectedTrackingStatus = 'MAINTENANCE';
    } else {
      expectedTrackingStatus = 'AVAILABLE';
    }

    const currentTrackingShipmentId = vt?.shipment ? String(vt.shipment._id || vt.shipment) : null;
    const currentTrackingDriverId = vt?.driver ? String(vt.driver) : null;
    const expectedTrackingShipmentId = activeShipment ? String(activeShipment._id) : null;

    if (!vt) {
      trackingIssues.push({
        type: 'MISSING_DOCUMENT',
        vehicleId: v._id,
        reg: v.registrationNumber,
        expected: {
          status: expectedTrackingStatus,
          shipment: expectedTrackingShipmentId,
          driver: expectedVehicleDriverId
        }
      });
    } else {
      const isTerminalAttached = vt.shipment && ['DELIVERED', 'CANCELLED', 'FAILED'].includes(vt.shipment.status);
      const isMismatch = (
        isTerminalAttached ||
        currentTrackingShipmentId !== expectedTrackingShipmentId ||
        (activeShipment && currentTrackingDriverId !== expectedVehicleDriverId) ||
        (!activeShipment && currentTrackingDriverId !== null && expectedTrackingStatus === 'AVAILABLE') ||
        (vt.status !== expectedTrackingStatus && vt.status !== 'OFFLINE')
      );

      if (isMismatch) {
        trackingIssues.push({
          type: 'DATA_MISMATCH',
          vehicleId: v._id,
          reg: v.registrationNumber,
          trackingId: vt._id,
          isTerminalAttached,
          current: {
            status: vt.status,
            shipment: currentTrackingShipmentId,
            shipmentNumber: vt.shipment?.trackingNumber || 'None',
            driver: currentTrackingDriverId
          },
          expected: {
            status: expectedTrackingStatus,
            shipment: expectedTrackingShipmentId,
            driver: expectedVehicleDriverId
          }
        });
      }
    }
  }

  // 2. Audit Drivers
  for (const d of drivers) {
    const dUserId = String(d.user?._id || d.user);
    const assignedActiveShipments = activeShipmentsByDriverUser.get(dUserId) || [];
    const activeShipment = assignedActiveShipments[0] || null;

    let expectedDriverStatus;
    let expectedVehicleId;

    if (activeShipment) {
      expectedDriverStatus = 'ON_TRIP';
      expectedVehicleId = activeShipment.vehicle ? String(activeShipment.vehicle._id || activeShipment.vehicle) : null;
    } else {
      expectedDriverStatus = 'AVAILABLE';
      expectedVehicleId = null;
    }

    const currentAssignedVehicleId = d.assignedVehicle ? String(d.assignedVehicle) : null;

    if (d.status !== expectedDriverStatus || currentAssignedVehicleId !== expectedVehicleId) {
      driverIssues.push({
        driverId: d._id,
        userId: dUserId,
        driverName: d.user?.name || 'Unknown',
        current: { status: d.status, assignedVehicle: currentAssignedVehicleId },
        expected: { status: expectedDriverStatus, assignedVehicle: expectedVehicleId },
        activeShipmentCount: assignedActiveShipments.length
      });
    }
  }

  // 3. Print Audit Report
  console.log('\n----------------------------------------------------------------------');
  console.log(`AUDIT FINDINGS (${vehicleIssues.length} Vehicle, ${trackingIssues.length} Tracking, ${driverIssues.length} Driver inconsistencies):`);
  console.log('----------------------------------------------------------------------');

  if (vehicleIssues.length === 0 && trackingIssues.length === 0 && driverIssues.length === 0) {
    console.log('✓ All Vehicles, Tracking, and Drivers are in 100% complete synchronization!');
  } else {
    if (vehicleIssues.length > 0) {
      console.log('\nVehicle Status Inconsistencies:');
      vehicleIssues.forEach((item, idx) => {
        console.log(`  [${idx + 1}] ${item.reg} (${item.vehicleId}):`);
        console.log(`      Current:  status=${item.current.status}, driver=${item.current.driver}`);
        console.log(`      Expected: status=${item.expected.status}, driver=${item.expected.driver}`);
        console.log(`      Active Shipments: ${item.activeShipmentCount}`);
      });
    }

    if (trackingIssues.length > 0) {
      console.log('\nVehicleTracking Telemetry Inconsistencies:');
      trackingIssues.forEach((item, idx) => {
        console.log(`  [${idx + 1}] ${item.reg} (${item.type}):`);
        if (item.current) {
          console.log(`      Current:  status=${item.current.status}, shipment=${item.current.shipmentNumber} (${item.current.shipment}), driver=${item.current.driver}`);
        }
        console.log(`      Expected: status=${item.expected.status}, shipment=${item.expected.shipment || 'None'}, driver=${item.expected.driver || 'None'}`);
      });
    }

    if (driverIssues.length > 0) {
      console.log('\nDriver Status Inconsistencies:');
      driverIssues.forEach((item, idx) => {
        console.log(`  [${idx + 1}] ${item.driverName} (${item.driverId}):`);
        console.log(`      Current:  status=${item.current.status}, vehicle=${item.current.assignedVehicle}`);
        console.log(`      Expected: status=${item.expected.status}, vehicle=${item.expected.assignedVehicle}`);
        console.log(`      Active Shipments: ${item.activeShipmentCount}`);
      });
    }
  }

  // 4. Perform Repair if requested
  if (isRepair) {
    console.log('\n----------------------------------------------------------------------');
    console.log('EXECUTING IDEMPOTENT REPAIR...');
    console.log('----------------------------------------------------------------------');

    // Repair Vehicles
    let repairedVehicles = 0;
    for (const item of vehicleIssues) {
      await Vehicle.findByIdAndUpdate(item.vehicleId, {
        status: item.expected.status,
        assignedDriver: item.expected.driver
      });
      repairedVehicles++;
    }
    console.log(`✓ Reconciled ${repairedVehicles} Vehicle documents.`);

    // Repair VehicleTracking
    let repairedTracking = 0;
    for (const item of trackingIssues) {
      if (item.type === 'MISSING_DOCUMENT') {
        const v = await Vehicle.findById(item.vehicleId);
        const lng = v?.currentLocation?.coordinates?.[0] ?? 77.2090;
        const lat = v?.currentLocation?.coordinates?.[1] ?? 28.6139;
        await VehicleTracking.create({
          vehicle: item.vehicleId,
          driver: item.expected.driver,
          shipment: item.expected.shipment,
          latitude: lat,
          longitude: lng,
          speed: 0,
          status: item.expected.status,
          location: { type: 'Point', coordinates: [lng, lat] },
          lastUpdated: new Date()
        });
      } else {
        const updatePayload = {
          shipment: item.expected.shipment,
          driver: item.expected.driver,
          status: item.expected.status
        };
        if (!item.expected.shipment && item.expected.status === 'AVAILABLE') {
          updatePayload.speed = 0;
        }
        await VehicleTracking.findByIdAndUpdate(item.trackingId, { $set: updatePayload });
      }
      repairedTracking++;
    }
    console.log(`✓ Reconciled ${repairedTracking} VehicleTracking documents (GPS telemetry preserved).`);

    // Repair Drivers
    let repairedDrivers = 0;
    for (const item of driverIssues) {
      await Driver.findByIdAndUpdate(item.driverId, {
        status: item.expected.status,
        assignedVehicle: item.expected.assignedVehicle
      });
      repairedDrivers++;
    }
    console.log(`✓ Reconciled ${repairedDrivers} Driver documents.`);

    console.log('\n✓ REPAIR COMPLETED SUCCESSFULLY.');
  } else {
    console.log('\n[Dry-run completed. To apply repairs, run with --repair flag.]');
  }

  console.log('======================================================================\n');
  process.exit(0);
};

reconcileFleet().catch((err) => {
  console.error('Reconciliation script failed:', err);
  process.exit(1);
});
