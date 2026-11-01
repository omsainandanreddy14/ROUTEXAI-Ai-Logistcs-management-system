const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema(
  {
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      required: true
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
    source: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String, default: '' },
      city: { type: String, default: '' }
    },
    destination: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String, default: '' },
      city: { type: String, default: '' }
    },
    distanceKm: {
      type: Number,
      required: true
    },
    estimatedDurationMinutes: {
      type: Number,
      required: true
    },
    score: {
      type: Number,
      default: 90
    },
    geometry: {
      type: {
        type: String,
        enum: ['LineString'],
        default: 'LineString'
      },
      coordinates: {
        type: Array,
        required: true,
        default: []
      }
    },
    routeName: {
      type: String,
      default: 'Optimal Logistics Route'
    },
    status: {
      type: String,
      enum: ['CALCULATED', 'SELECTED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'],
      default: 'CALCULATED'
    }
  },
  {
    timestamps: true
  }
);

routeSchema.index({ geometry: '2dsphere' });
routeSchema.index({ shipment: 1 }, { unique: true, partialFilterExpression: { status: 'SELECTED' } });

module.exports = mongoose.model('Route', routeSchema);
