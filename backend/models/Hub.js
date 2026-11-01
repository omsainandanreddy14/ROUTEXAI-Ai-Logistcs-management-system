const mongoose = require('mongoose');

const hubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Hub name is required'],
      trim: true
    },
    code: {
      type: String,
      required: [true, 'Hub code is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    address: {
      type: String,
      required: [true, 'Address is required']
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },
    capacity: {
      type: Number,
      default: 1000 // In shipments/units
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

hubSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Hub', hubSchema);
