const path = require('path');
const fs = require('fs');

const backendNodeModules = 'C:/Users/putlu/OneDrive/Desktop/RouteXAI/backend/node_modules';
const backendPath = 'C:/Users/putlu/OneDrive/Desktop/RouteXAI/backend';

require('module').globalPaths.push(backendNodeModules);
module.paths.push(backendNodeModules);

const mongoose = require(path.join(backendNodeModules, 'mongoose'));
const dotenv = require(path.join(backendNodeModules, 'dotenv'));

dotenv.config({ path: path.join(backendPath, '.env') });

const Route = require(path.join(backendPath, 'models/Route'));
const Shipment = require(path.join(backendPath, 'models/Shipment'));
const ShipmentETA = require(path.join(backendPath, 'models/ShipmentETA'));
const ShipmentETAHistory = require(path.join(backendPath, 'models/ShipmentETAHistory'));
const ShipmentLifecycle = require(path.join(backendPath, 'models/ShipmentLifecycle'));

const args = process.argv.slice(2);
const isExecute = args.includes('--execute');
const isBackup = args.includes('--backup') || isExecute;

async function repairDatabase() {
  console.log('======================================================================');
  console.log(`ROUTE XAI — DATABASE INTEGRITY REPAIR UTILITY [${isExecute ? 'EXECUTE MODE' : 'DRY RUN MODE'}]`);
  console.log('======================================================================\n');

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas.\n');

    // Fetch collections
    const [shipments, routes, etas, etaHistories, lifecycles] = await Promise.all([
      Shipment.find().lean(),
      Route.find().lean(),
      ShipmentETA.find().lean(),
      ShipmentETAHistory.find().lean(),
      ShipmentLifecycle.find().lean()
    ]);

    const shipmentMap = new Map(shipments.map(s => [s._id.toString(), s]));
    console.log(`Loaded: ${shipments.length} Shipments, ${routes.length} Routes, ${etas.length} ETAs, ${etaHistories.length} ETAHistories, ${lifecycles.length} Lifecycles.\n`);

    // 1. Identify Orphaned Records
    const orphanedRoutes = routes.filter(r => !r.shipment || !shipmentMap.has(r.shipment.toString()));
    const orphanedETAs = etas.filter(e => !e.shipment || !shipmentMap.has(e.shipment.toString()));
    const orphanedETAHistories = etaHistories.filter(h => !h.shipment || !shipmentMap.has(h.shipment.toString()));
    const orphanedLifecycles = lifecycles.filter(l => !l.shipment || !shipmentMap.has(l.shipment.toString()));

    console.log(`--- Orphaned Records Scan ---`);
    console.log(`- Orphaned Routes: ${orphanedRoutes.length}`);
    console.log(`- Orphaned ShipmentETA Snapshots: ${orphanedETAs.length}`);
    console.log(`- Orphaned ShipmentETAHistory Records: ${orphanedETAHistories.length}`);
    console.log(`- Orphaned ShipmentLifecycle Records: ${orphanedLifecycles.length}\n`);

    // 2. Identify Multiple SELECTED Routes per Shipment
    const routesByShipment = new Map();
    for (const r of routes) {
      if (!r.shipment || !shipmentMap.has(r.shipment.toString())) continue;
      const sId = r.shipment.toString();
      if (!routesByShipment.has(sId)) routesByShipment.set(sId, []);
      routesByShipment.get(sId).push(r);
    }

    const multiSelectedShipments = [];
    const routesToArchive = [];
    const routesToKeepSelected = [];

    for (const [sId, rList] of routesByShipment.entries()) {
      const shipment = shipmentMap.get(sId);
      const selectedRoutes = rList.filter(r => r.status === 'SELECTED');

      if (selectedRoutes.length > 1) {
        multiSelectedShipments.push({
          shipmentId: sId,
          trackingNumber: shipment.trackingNumber,
          currentRoutePointer: shipment.route ? shipment.route.toString() : null,
          selectedCount: selectedRoutes.length,
          routes: selectedRoutes
        });

        // Determine which route to keep as SELECTED
        let keepRoute = null;
        if (shipment.route) {
          keepRoute = selectedRoutes.find(r => r._id.toString() === shipment.route.toString());
        }

        // If pointer does not match any selected route, pick the newest selected route
        if (!keepRoute) {
          selectedRoutes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          keepRoute = selectedRoutes[0];
        }

        routesToKeepSelected.push(keepRoute);

        // Mark all others to be archived
        for (const r of selectedRoutes) {
          if (r._id.toString() !== keepRoute._id.toString()) {
            routesToArchive.push({
              routeId: r._id.toString(),
              shipmentId: sId,
              trackingNumber: shipment.trackingNumber,
              routeName: r.routeName,
              createdAt: r.createdAt
            });
          }
        }
      } else if (selectedRoutes.length === 1) {
        routesToKeepSelected.push(selectedRoutes[0]);
      }
    }

    console.log(`--- Multi-Selected Routes Scan ---`);
    console.log(`- Shipments with multiple SELECTED routes: ${multiSelectedShipments.length}`);
    for (const m of multiSelectedShipments) {
      console.log(`  * Shipment ${m.trackingNumber} (${m.shipmentId}): ${m.selectedCount} routes marked SELECTED. Current pointer: ${m.currentRoutePointer}`);
    }
    console.log(`- Total redundant SELECTED routes to archive: ${routesToArchive.length}\n`);

    // 3. Backup Action
    if (isBackup) {
      const backupDir = path.join(backendPath, 'backup');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `pre_repair_backup_${timestamp}.json`);

      const backupPayload = {
        metadata: {
          timestamp: new Date().toISOString(),
          dryRun: !isExecute,
          totalShipments: shipments.length,
          totalRoutes: routes.length
        },
        orphanedRoutes,
        orphanedETAs,
        orphanedETAHistories,
        orphanedLifecycles,
        multiSelectedShipments,
        routesToArchive
      };

      fs.writeFileSync(backupPath, JSON.stringify(backupPayload, null, 2), 'utf-8');
      console.log(`✓ Backup successfully created at:\n  ${backupPath}\n`);
    }

    // 4. Execute Actions (if --execute flag passed)
    if (isExecute) {
      console.log('--- Executing Database Repairs ---');

      // A. Archive redundant selected routes
      if (routesToArchive.length > 0) {
        const archiveIds = routesToArchive.map(r => new mongoose.Types.ObjectId(r.routeId));
        const archiveRes = await Route.updateMany(
          { _id: { $in: archiveIds } },
          { $set: { status: 'ARCHIVED', updatedAt: new Date() } }
        );
        console.log(`✓ Archived ${archiveRes.modifiedCount} redundant routes (status set to 'ARCHIVED').`);
      }

      // B. Ensure shipment.route points to the single SELECTED route
      for (const keepRoute of routesToKeepSelected) {
        const s = shipmentMap.get(keepRoute.shipment.toString());
        if (s && (!s.route || s.route.toString() !== keepRoute._id.toString())) {
          await Shipment.updateOne(
            { _id: s._id },
            {
              $set: {
                route: keepRoute._id,
                selectedRouteGeometry: keepRoute.geometry,
                estimatedDistanceKm: keepRoute.distanceKm,
                estimatedDurationMinutes: keepRoute.estimatedDurationMinutes
              }
            }
          );
          console.log(`✓ Synchronized Shipment ${s.trackingNumber} route pointer to ${keepRoute._id} ("${keepRoute.routeName}").`);
        }
      }

      // C. Remove orphaned test records
      if (orphanedRoutes.length > 0) {
        const oRIds = orphanedRoutes.map(r => r._id);
        const delRoutes = await Route.deleteMany({ _id: { $in: oRIds } });
        console.log(`✓ Removed ${delRoutes.deletedCount} orphaned routes.`);
      }

      if (orphanedETAs.length > 0) {
        const oEIds = orphanedETAs.map(e => e._id);
        const delETAs = await ShipmentETA.deleteMany({ _id: { $in: oEIds } });
        console.log(`✓ Removed ${delETAs.deletedCount} orphaned ShipmentETA snapshots.`);
      }

      if (orphanedETAHistories.length > 0) {
        const oHIds = orphanedETAHistories.map(h => h._id);
        const delHist = await ShipmentETAHistory.deleteMany({ _id: { $in: oHIds } });
        console.log(`✓ Removed ${delHist.deletedCount} orphaned ShipmentETAHistory records.`);
      }

      if (orphanedLifecycles.length > 0) {
        const oLIds = orphanedLifecycles.map(l => l._id);
        const delLife = await ShipmentLifecycle.deleteMany({ _id: { $in: oLIds } });
        console.log(`✓ Removed ${delLife.deletedCount} orphaned ShipmentLifecycle records.`);
      }

      console.log('\n======================================================================');
      console.log('DATABASE REPAIR COMPLETED SUCCESSFULLY!');
      console.log('======================================================================\n');
    } else {
      console.log('DRY RUN COMPLETE: No documents were modified. Run with --execute to apply changes.');
    }

  } catch (err) {
    console.error('Repair execution error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

repairDatabase();
