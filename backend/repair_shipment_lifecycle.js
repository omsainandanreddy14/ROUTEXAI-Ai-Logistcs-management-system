const dotenv = require('dotenv');
const connectDB = require('./config/db');
const mongoose = require('mongoose');

dotenv.config();

const Shipment = require('./models/Shipment');
const ShipmentLifecycle = require('./models/ShipmentLifecycle');
const Vehicle = require('./models/Vehicle');
const User = require('./models/User');
const Hub = require('./models/Hub');
const Route = require('./models/Route');

const STAGE_ORDER = [
  'CREATED',
  'PICKUP_PENDING',
  'VEHICLE_ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_DESTINATION',
  'OUT_FOR_DELIVERY',
  'DELIVERED'
];

const repairLifecycleData = async () => {
  try {
    await connectDB();

    console.log('\n==================================================');
    console.log('PHASE 4B LIFECYCLE DATA REPAIR');
    console.log('==================================================\n');

    const shipments = await Shipment.find().populate('vehicle').populate('driver');
    console.log(`Analyzing ${shipments.length} shipments for lifecycle history repair...\n`);

    let totalCleanedRecords = 0;

    for (const shp of shipments) {
      const trackingId = shp.trackingId || shp.trackingNumber;
      const currentAuthoritativeStatus = shp.status;

      console.log(`Shipment: ${trackingId}`);
      console.log(`Authoritative Shipment.status: ${currentAuthoritativeStatus}`);

      // Fetch all history records sorted by timestamp
      const records = await ShipmentLifecycle.find({ shipment: shp._id }).sort({ timestamp: 1, createdAt: 1 });

      const invalidRecordIds = [];
      const seenStatuses = new Set();
      const currentIdx = STAGE_ORDER.indexOf(currentAuthoritativeStatus);

      let lastNormalIdx = -1;

      records.forEach((rec) => {
        let isInvalid = false;
        let reason = '';

        const recIdx = STAGE_ORDER.indexOf(rec.status);
        const prevIdx = STAGE_ORDER.indexOf(rec.previousStatus);

        // 1. Duplicate status check
        if (seenStatuses.has(rec.status)) {
          isInvalid = true;
          reason = `Duplicate status record for '${rec.status}'`;
        }
        // 2. Future stage check relative to authoritative status (if normal stage)
        else if (recIdx !== -1 && currentIdx !== -1 && recIdx > currentIdx) {
          isInvalid = true;
          reason = `Future stage record '${rec.status}' beyond current status '${currentAuthoritativeStatus}'`;
        }
        // 3. Backward transition check (e.g. OUT_FOR_DELIVERY -> IN_TRANSIT)
        else if (prevIdx !== -1 && recIdx !== -1 && recIdx < prevIdx) {
          isInvalid = true;
          reason = `Backward transition '${rec.previousStatus}' -> '${rec.status}'`;
        }
        // 4. Backward transition from previous recorded stage
        else if (recIdx !== -1 && lastNormalIdx !== -1 && recIdx < lastNormalIdx) {
          isInvalid = true;
          reason = `Backward sequence '${rec.status}' after stage index ${lastNormalIdx}`;
        }
        // 5. Skip check (e.g. CREATED -> DELIVERED when status is not DELIVERED)
        else if (rec.previousStatus === 'CREATED' && rec.status === 'DELIVERED' && currentAuthoritativeStatus !== 'DELIVERED') {
          isInvalid = true;
          reason = `Contradictory skip transition CREATED -> DELIVERED`;
        }

        if (isInvalid) {
          invalidRecordIds.push(rec._id);
          console.log(`  ⚠ Invalid history detected: ${rec.previousStatus || 'null'} → ${rec.status} (${reason})`);
        } else {
          seenStatuses.add(rec.status);
          if (recIdx !== -1) lastNormalIdx = recIdx;
          console.log(`  ✓ Valid history preserved: ${rec.previousStatus || 'INIT'} → ${rec.status}`);
        }
      });

      if (invalidRecordIds.length > 0) {
        await ShipmentLifecycle.deleteMany({ _id: { $in: invalidRecordIds } });
        totalCleanedRecords += invalidRecordIds.length;
        console.log(`  ✓ Removed ${invalidRecordIds.length} invalid lifecycle records for ${trackingId}.`);
      } else {
        console.log(`  ✓ Lifecycle history is clean.`);
      }

      // Ensure at least one initial CREATED record exists
      const hasCreated = await ShipmentLifecycle.findOne({ shipment: shp._id, status: 'CREATED' });
      if (!hasCreated) {
        await ShipmentLifecycle.create({
          shipment: shp._id,
          trackingId: trackingId,
          status: 'CREATED',
          previousStatus: null,
          timestamp: shp.createdAt || new Date(),
          note: 'Initial shipment creation record (Repaired)',
          vehicle: shp.vehicle?._id || null,
          driver: shp.driver?._id || null
        });
        console.log(`  ✓ Seeded missing initial CREATED record for ${trackingId}.`);
      }

      console.log(`  Repair completed for ${trackingId}.\n--------------------------------------------------`);
    }

    console.log(`\n==================================================`);
    console.log(`LIFECYCLE DATA REPAIR SUMMARY`);
    console.log(`Total Shipments Processed: ${shipments.length}`);
    console.log(`Total Contradictory/Duplicate Records Cleaned: ${totalCleanedRecords}`);
    console.log(`==================================================\n`);

    process.exit(0);
  } catch (err) {
    console.error('Repair Error:', err);
    process.exit(1);
  }
};

repairLifecycleData();
