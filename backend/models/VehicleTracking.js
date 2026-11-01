const mongoose = require('mongoose');

const vehicleTrackingSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle ID is required'],
      unique: true
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      default: null
    },
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90'],
      default: 28.6139
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180'],
      default: 77.2090
    },
    speed: {
      type: Number,
      required: [true, 'Speed is required'],
      min: [0, 'Speed must be non-negative'],
      default: 0
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'IDLE', 'OFFLINE'],
      default: 'AVAILABLE'
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [77.2090, 28.6139]
      }
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

vehicleTrackingSchema.index({ location: '2dsphere' });
vehicleTrackingSchema.index({ lastUpdated: -1 });

module.exports = mongoose.model('VehicleTracking', vehicleTrackingSchema);
