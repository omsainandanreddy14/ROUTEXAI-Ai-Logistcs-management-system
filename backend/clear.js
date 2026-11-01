const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Customer = require('./models/Customer');
const Driver = require('./models/Driver');
const Vehicle = require('./models/Vehicle');
const Hub = require('./models/Hub');
const Shipment = require('./models/Shipment');

dotenv.config();

const clearDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/routexai');
    console.log('Connected to MongoDB Atlas...');

    await User.deleteMany({});
    await Customer.deleteMany({});
    await Driver.deleteMany({});
    await Vehicle.deleteMany({});
    await Hub.deleteMany({});
    await Shipment.deleteMany({});

    console.log('--- ALL PREVIOUS DATABASE DATA REMOVED SUCCESSFULLY ---');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing database:', error);
    process.exit(1);
  }
};

clearDatabase();
