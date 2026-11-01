const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema(
  {
    trackingNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true
    },
    trackingId: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    originHub: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hub',
      default: null
    },
    destinationHub: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hub',
      default: null
    },
    pickupLocationType: {
      type: String,
      enum: ['CUSTOMER_LOCATION', 'COMPANY_HUB'],
      default: 'CUSTOMER_LOCATION'
    },
    pickupAddress: {
      street: String,
      city: String,
      state: String,
      pincode: String
    },
    pickupLocation: {
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
    deliveryLocationType: {
      type: String,
      enum: ['CUSTOMER_LOCATION', 'COMPANY_HUB'],
      default: 'CUSTOMER_LOCATION'
    },
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      pincode: String
    },
    deliveryLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [72.8777, 19.0760]
      }
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null
    },
    estimatedDistanceKm: {
      type: Number,
      default: 0
    },
    estimatedDurationMinutes: {
      type: Number,
      default: 0
    },
    selectedRouteGeometry: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    weightKg: {
      type: Number,
      required: [true, 'Weight in Kg is required']
    },
    quantity: {
      type: Number,
      default: 1
    },
    cargoType: {
      type: String,
      default: 'General Freight'
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    packageType: {
      type: String,
      enum: ['STANDARD', 'FRAGILE', 'ELECTRONICS', 'COLD_STORAGE', 'PERISHABLE', 'HAZARDOUS'],
      default: 'STANDARD'
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM'
    },
    status: {
      type: String,
      enum: [
        'CREATED',
        'CONFIRMED',
        'PICKUP_PENDING',
        'VEHICLE_ASSIGNED',
        'PICKED_UP',
        'DISPATCHED',
        'IN_TRANSIT',
        'NEAR_DESTINATION',
        'AT_DESTINATION',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
        'FAILED',
        'DELAYED',
        'PENDING'
      ],
      default: 'CREATED'
    },
    estimatedCost: {
      type: Number,
      default: 0
    },
    pricingDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    notes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

shipmentSchema.index({ pickupLocation: '2dsphere' });
shipmentSchema.index({ deliveryLocation: '2dsphere' });

module.exports = mongoose.model('Shipment', shipmentSchema);
