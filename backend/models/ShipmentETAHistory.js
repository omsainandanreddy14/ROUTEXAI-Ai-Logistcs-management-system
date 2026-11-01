const mongoose = require('mongoose');

const shipmentETAHistorySchema = new mongoose.Schema(
  {
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      required: true,
      index: true
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null
    },
    currentETA: {
      type: Date,
      default: null
    },
    remainingDistanceKm: {
      type: Number,
      default: null
    },
    deviationDistanceKm: {
      type: Number,
      default: null
    },
    deviationStatus: {
      type: String,
      default: 'UNKNOWN'
    },
    delayMinutes: {
      type: Number,
      default: null
    },
    etaStatus: {
      type: String,
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
    trackingVitality: {
      type: String,
      default: 'UNKNOWN'
    }
  },
  {
    timestamps: true
  }
);

shipmentETAHistorySchema.index({ shipment: 1, calculatedAt: -1 });

module.exports = mongoose.model('ShipmentETAHistory', shipmentETAHistorySchema);
