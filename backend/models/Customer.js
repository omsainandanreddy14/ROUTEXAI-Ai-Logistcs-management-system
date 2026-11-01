const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    companyName: {
      type: String,
      default: ''
    },
    gstin: {
      type: String,
      default: ''
    },
    defaultAddress: {
      street: String,
      city: String,
      state: String,
      pincode: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Customer', customerSchema);
