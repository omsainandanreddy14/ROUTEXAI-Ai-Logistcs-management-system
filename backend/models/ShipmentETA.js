const mongoose = require('mongoose');

const shipmentETASchema = new mongoose.Schema(
  {
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      required: [true, 'Shipment reference is required']
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null
    },
    plannedETA: {
      type: Date,
      default: null
    },
    currentETA: {
      type: Date,
      default: null
    },
    previousETA: {
      type: Date,
      default: null
    },
    remainingDistanceKm: {
      type: Number,
      default: null
    },
    elapsedDistanceKm: {
      type: Number,
      default: null
    },
    deviationDistanceKm: {
      type: Number,
      default: null
    },
    deviationStatus: {
      type: String,
      enum: ['ON_ROUTE', 'DEVIATED', 'PAUSED', 'UNKNOWN'],
      default: 'UNKNOWN'
    },
    consecutiveDeviations: {
      type: Number,
      default: 0
    },
    delayMinutes: {
      type: Number,
      default: null
    },
    etaStatus: {
      type: String,
      enum: ['ON_TIME', 'DELAYED', 'PAUSED', 'UNKNOWN'],
      default: 'UNKNOWN'
    },
    gpsTimestamp: {
      type: Date,
      default: null
    },
    calculatedAt: {
      type: Date,
      default: Date.now
    },
    dataSource: {
      type: String,
      default: 'UNKNOWN'
    },
    availability: {
      type: String,
      enum: ['AVAILABLE', 'UNAVAILABLE'],
      default: 'AVAILABLE'
    },
    unavailableReason: {
      type: String,
      default: null
    },
    trackingVitality: {
      type: String,
      enum: ['LIVE', 'STALE', 'OFFLINE', 'UNKNOWN'],
      default: 'UNKNOWN'
    },
    hasRouteGeometry: {
      type: Boolean,
      default: false
    },
    corridorStatusReason: {
      type: String,
      default: null
    },
    lastKnownETA: {
      type: Date,
      default: null
    },
    lastKnownETATimestamp: {
      type: Date,
      default: null
    },
    lastDetectedDeviationKm: {
      type: Number,
      default: null
    },
    lastDetectedDeviationStatus: {
      type: String,
      enum: ['ON_ROUTE', 'DEVIATED', 'PAUSED', 'UNKNOWN'],
      default: 'UNKNOWN'
    },
    lastDetectedDeviationTimestamp: {
      type: Date,
      default: null
    },
    lastGpsTimestamp: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

shipmentETASchema.index({ shipment: 1 }, { unique: true });
shipmentETASchema.index({ etaStatus: 1 });
shipmentETASchema.index({ deviationStatus: 1 });
shipmentETASchema.index({ calculatedAt: -1 });

module.exports = mongoose.model('ShipmentETA', shipmentETASchema);
