const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Shipment = require('./models/Shipment');
const Driver = require('./models/Driver');
const Vehicle = require('./models/Vehicle');

dotenv.config();

const clearShipmentsOnly = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/routexai';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB Atlas...');

    const deletedCount = await Shipment.deleteMany({});
    console.log(`Deleted ${deletedCount.deletedCount} shipments from MongoDB database.`);

    // Reset drivers and vehicles to AVAILABLE and unassigned
    await Driver.updateMany({}, { status: 'AVAILABLE', assignedVehicle: null });
    await Vehicle.updateMany({}, { status: 'AVAILABLE', assignedDriver: null });

    console.log('Reset all Drivers and Vehicles status to AVAILABLE.');
    console.log('Shipment collection is now completely EMPTY and ready for fresh lifecycle testing.');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing shipments:', error);
    process.exit(1);
  }
};

clearShipmentsOnly();
