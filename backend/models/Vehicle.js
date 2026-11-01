const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    registrationNumber: {
      type: String,
      required: [true, 'Vehicle registration number is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    vehicleType: {
      type: String,
      enum: ['HEAVY_TRUCK', 'MEDIUM_VAN', 'LIGHT_EV', 'CONTAINER_TRUCK'],
      required: [true, 'Vehicle type is required']
    },
    capacityKg: {
      type: Number,
      required: [true, 'Capacity in Kg is required']
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'ON_TRIP', 'MAINTENANCE', 'OUT_OF_SERVICE'],
      default: 'AVAILABLE'
    },
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [77.2090, 28.6139] // Default New Delhi
      }
    },
    fuelType: {
      type: String,
      enum: ['DIESEL', 'PETROL', 'EV', 'CNG'],
      default: 'DIESEL'
    }
  },
  {
    timestamps: true
  }
);

vehicleSchema.index({ currentLocation: '2dsphere' });

module.exports = mongoose.model('Vehicle', vehicleSchema);
