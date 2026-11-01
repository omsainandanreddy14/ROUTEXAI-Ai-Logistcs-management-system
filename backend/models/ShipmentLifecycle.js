const mongoose = require('mongoose');

const shipmentLifecycleSchema = new mongoose.Schema(
  {
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      required: [true, 'Shipment ID is required']
    },
    trackingId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    status: {
      type: String,
      required: [true, 'Status is required']
    },
    previousStatus: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      address: { type: String, default: '' }
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
    note: {
      type: String,
      default: ''
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

shipmentLifecycleSchema.index({ shipment: 1, timestamp: -1 });
shipmentLifecycleSchema.index({ trackingId: 1, timestamp: -1 });
shipmentLifecycleSchema.index({ timestamp: -1 });

module.exports = mongoose.model('ShipmentLifecycle', shipmentLifecycleSchema);
