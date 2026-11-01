const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Customer = require('./models/Customer');
const Driver = require('./models/Driver');
const Vehicle = require('./models/Vehicle');
const Hub = require('./models/Hub');
const Shipment = require('./models/Shipment');
const Route = require('./models/Route');
const VehicleTracking = require('./models/VehicleTracking');
const ShipmentETA = require('./models/ShipmentETA');
const ShipmentETAHistory = require('./models/ShipmentETAHistory');
const ShipmentLifecycle = require('./models/ShipmentLifecycle');

dotenv.config();

const DEMO_PASSWORD = 'RouteXAI@123';

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/routexai';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB Atlas for Data Seeding...\n');

    // 1. Clear existing collections cleanly
    await User.deleteMany({});
    await Customer.deleteMany({});
    await Driver.deleteMany({});
    await Vehicle.deleteMany({});
    await Hub.deleteMany({});
    await Shipment.deleteMany({});
    await Route.deleteMany({});
    await VehicleTracking.deleteMany({});
    await ShipmentETA.deleteMany({});
    await ShipmentETAHistory.deleteMany({});
    await ShipmentLifecycle.deleteMany({});

    console.log('Cleared existing data in all 11 collections.');

    // 2. Create 10 Users (1 Owner, 4 Drivers, 5 Customers)
    const ownerUser = await User.create({
      name: 'Vikramaditya Rao',
      email: 'owner@routexai.com',
      password: DEMO_PASSWORD,
      role: 'OWNER',
      phone: '+91 90000 00001',
      isActive: true
    });

    const driverUsersData = [
      { name: 'Rajesh Kumar', email: 'rajesh.driver@routexai.com', phone: '+91 98123 45671' },
      { name: 'Suresh Patel', email: 'suresh.driver@routexai.com', phone: '+91 98123 45672' },
      { name: 'Vikram Singh', email: 'vikram.driver@routexai.com', phone: '+91 98123 45673' },
      { name: 'Mani Kandan', email: 'mani.driver@routexai.com', phone: '+91 98123 45674' }
    ];

    const driverUsers = [];
    for (const d of driverUsersData) {
      const u = await User.create({
        name: d.name,
        email: d.email,
        password: DEMO_PASSWORD,
        role: 'DRIVER',
        phone: d.phone,
        isActive: true
      });
      driverUsers.push(u);
    }

    const customerUsersData = [
      { name: 'Aarav Sharma', email: 'aarav.retail@example.com', phone: '+91 99000 00011', company: 'Aarav Retail Solutions' },
      { name: 'Priya Deshmukh', email: 'priya.aero@example.com', phone: '+91 99000 00012', company: 'AeroTech Systems India' },
      { name: 'Ananya Banerjee', email: 'ananya.pharma@example.com', phone: '+91 99000 00013', company: 'Himalayan Pharma Labs' },
      { name: 'Rohan Reddy', email: 'rohan.deccan@example.com', phone: '+91 99000 00014', company: 'Deccan Commercial Goods' },
      { name: 'Kavita Patel', email: 'kavita.textiles@example.com', phone: '+91 99000 00015', company: 'Apex Silk & Textiles' }
    ];

    const customerUsers = [];
    for (const c of customerUsersData) {
      const u = await User.create({
        name: c.name,
        email: c.email,
        password: DEMO_PASSWORD,
        role: 'CUSTOMER',
        phone: c.phone,
        isActive: true
      });
      customerUsers.push(u);
    }

    console.log(`Created 10 Users (1 Owner, ${driverUsers.length} Drivers, ${customerUsers.length} Customers).`);

    // 3. Create 5 Customer Profiles
    const customers = [];
    const customerCities = [
      { city: 'New Delhi', state: 'Delhi', pincode: '110001', street: 'MG Road 45' },
      { city: 'Mumbai', state: 'Maharashtra', pincode: '400001', street: 'Nariman Point 12' },
      { city: 'Bengaluru', state: 'Karnataka', pincode: '560001', street: 'Electronic City Phase 1' },
      { city: 'Hyderabad', state: 'Telangana', pincode: '500001', street: 'HITEC City Phase 2' },
      { city: 'Kolkata', state: 'West Bengal', pincode: '700001', street: 'Park Street 88' }
    ];

    for (let i = 0; i < customerUsers.length; i++) {
      const cust = await Customer.create({
        user: customerUsers[i]._id,
        companyName: customerUsersData[i].company,
        gstin: `27AAAAA${1000 + i}A1Z5`,
        defaultAddress: {
          street: customerCities[i].street,
          city: customerCities[i].city,
          state: customerCities[i].state,
          pincode: customerCities[i].pincode
        }
      });
      customers.push(cust);
    }
    console.log(`Created ${customers.length} Customer Profiles.`);

    // 4. Create 8 Vehicles
    const vehicleDataList = [
      { reg: 'DL-01-RT-1001', type: 'HEAVY_TRUCK', capacity: 12000, fuel: 'DIESEL', status: 'ON_TRIP', loc: [77.0688, 28.5921] },
      { reg: 'MH-04-AZ-8899', type: 'CONTAINER_TRUCK', capacity: 16000, fuel: 'DIESEL', status: 'ON_TRIP', loc: [73.0645, 19.2968] },
      { reg: 'KA-01-MJ-4321', type: 'MEDIUM_VAN', capacity: 3500, fuel: 'CNG', status: 'AVAILABLE', loc: [77.6743, 12.8452] },
      { reg: 'TN-09-CB-7711', type: 'HEAVY_TRUCK', capacity: 10000, fuel: 'DIESEL', status: 'ON_TRIP', loc: [79.9419, 12.9692] },
      { reg: 'WB-02-EX-5544', type: 'CONTAINER_TRUCK', capacity: 14000, fuel: 'DIESEL', status: 'ON_TRIP', loc: [88.2985, 22.6854] },
      { reg: 'DL-01-EV-2024', type: 'LIGHT_EV', capacity: 1500, fuel: 'EV', status: 'AVAILABLE', loc: [77.0688, 28.5921] },
      { reg: 'TS-07-HG-9900', type: 'MEDIUM_VAN', capacity: 4000, fuel: 'DIESEL', status: 'AVAILABLE', loc: [78.4294, 17.2403] },
      { reg: 'GJ-01-MN-3344', type: 'HEAVY_TRUCK', capacity: 11000, fuel: 'DIESEL', status: 'MAINTENANCE', loc: [72.5714, 23.0225] }
    ];

    const vehicles = [];
    for (let i = 0; i < vehicleDataList.length; i++) {
      const vData = vehicleDataList[i];
      // Assign drivers to first 4 vehicles
      const driverRef = i < driverUsers.length ? driverUsers[i]._id : null;
      const v = await Vehicle.create({
        registrationNumber: vData.reg,
        vehicleType: vData.type,
        capacityKg: vData.capacity,
        fuelType: vData.fuel,
        status: vData.status,
        assignedDriver: driverRef,
        currentLocation: {
          type: 'Point',
          coordinates: vData.loc
        }
      });
      vehicles.push(v);
    }
    console.log(`Created ${vehicles.length} Vehicles.`);

    // 5. Create 4 Drivers linked to DRIVER Users and Vehicles
    const driverProfiles = [];
    const driverDetails = [
      { license: 'DL-DEMO-458921', exp: 7, rating: 4.9, status: 'ON_TRIP', vehIndex: 0, loc: [77.0688, 28.5921] },
      { license: 'MH-DEMO-982134', exp: 5, rating: 4.8, status: 'ON_TRIP', vehIndex: 1, loc: [73.0645, 19.2968] },
      { license: 'KA-DEMO-112233', exp: 8, rating: 5.0, status: 'AVAILABLE', vehIndex: 2, loc: [77.6743, 12.8452] },
      { license: 'TN-DEMO-778899', exp: 6, rating: 4.7, status: 'ON_TRIP', vehIndex: 3, loc: [79.9419, 12.9692] }
    ];

    for (let i = 0; i < driverUsers.length; i++) {
      const dDet = driverDetails[i];
      const drv = await Driver.create({
        user: driverUsers[i]._id,
        licenseNumber: dDet.license,
        experienceYears: dDet.exp,
        rating: dDet.rating,
        status: dDet.status,
        assignedVehicle: vehicles[dDet.vehIndex]._id,
        currentLocation: {
          type: 'Point',
          coordinates: dDet.loc
        }
      });
      driverProfiles.push(drv);
    }
    console.log(`Created ${driverProfiles.length} Driver Profiles.`);

    // 6. Create 10 PAN-INDIA Logistics Hubs
    const hubDataList = [
      { code: 'DEL-01', name: 'Delhi National Logistics Hub', city: 'New Delhi', state: 'Delhi', address: 'Sector 18, Dwarka Cargo Complex, New Delhi', loc: [77.0688, 28.5921], cap: 8000 },
      { code: 'BOM-01', name: 'Mumbai Central Gateway Hub', city: 'Mumbai', state: 'Maharashtra', address: 'Bhiwandi Freight Corridor, Mumbai', loc: [73.0645, 19.2968], cap: 10000 },
      { code: 'BLR-01', name: 'Bengaluru Tech Logistics Hub', city: 'Bengaluru', state: 'Karnataka', address: 'Electronic City Phase 2, Hosur Road, Bengaluru', loc: [77.6743, 12.8452], cap: 6500 },
      { code: 'MAA-01', name: 'Chennai Port Express Hub', city: 'Chennai', state: 'Tamil Nadu', address: 'Sriperumbudur Industrial Corridor, Chennai', loc: [79.9419, 12.9692], cap: 5000 },
      { code: 'CCU-01', name: 'Kolkata Eastern Freight Hub', city: 'Kolkata', state: 'West Bengal', address: 'Dankuni Inland Container Depot, Kolkata', loc: [88.2985, 22.6854], cap: 4000 },
      { code: 'HYD-01', name: 'Hyderabad Distribution Hub', city: 'Hyderabad', state: 'Telangana', address: 'Shamshabad Air Cargo Zone, Hyderabad', loc: [78.4294, 17.2403], cap: 5000 },
      { code: 'PNE-01', name: 'Pune Regional Logistics Hub', city: 'Pune', state: 'Maharashtra', address: 'Chakan Industrial Phase 3, Pune', loc: [73.8567, 18.7604], cap: 4000 },
      { code: 'AMD-01', name: 'Ahmedabad West Transit Hub', city: 'Ahmedabad', state: 'Gujarat', address: 'Sanand Industrial Estate, Ahmedabad', loc: [72.5714, 23.0225], cap: 5000 },
      { code: 'GAU-01', name: 'Guwahati North-East Hub', city: 'Guwahati', state: 'Assam', address: 'Amingaon Inland Container Depot, Guwahati', loc: [91.6845, 26.1923], cap: 3000 },
      { code: 'JAI-01', name: 'Jaipur Commerce Distribution Hub', city: 'Jaipur', state: 'Rajasthan', address: 'Sitapura Industrial Zone, Jaipur', loc: [75.7873, 26.9124], cap: 3500 }
    ];

    const hubs = [];
    for (const h of hubDataList) {
      const hubDoc = await Hub.create({
        name: h.name,
        code: h.code,
        city: h.city,
        state: h.state,
        address: h.address,
        location: {
          type: 'Point',
          coordinates: h.loc // [longitude, latitude]
        },
        capacity: h.cap,
        isActive: true
      });
      hubs.push(hubDoc);
    }
    console.log(`Created ${hubs.length} PAN-INDIA Hubs.`);

    // 7. Create 20 Realistic Shipments
    // Dashboard status distribution:
    // DELIVERED: 8, IN_TRANSIT: 5, DISPATCHED: 3, PENDING: 3, CANCELLED: 1
    const shipmentTemplates = [
      // DELIVERED (8)
      { tracking: 'RTX-100001', custIdx: 0, origIdx: 0, destIdx: 1, drvIdx: 0, vehIdx: 0, weight: 1500, pkg: 'STANDARD', status: 'DELIVERED', cost: 22500, notes: 'Electronics components' },
      { tracking: 'RTX-100002', custIdx: 1, origIdx: 2, destIdx: 3, drvIdx: 1, vehIdx: 1, weight: 850, pkg: 'FRAGILE', status: 'DELIVERED', cost: 13200, notes: 'Precision optical sensors' },
      { tracking: 'RTX-100003', custIdx: 2, origIdx: 5, destIdx: 6, drvIdx: 2, vehIdx: 2, weight: 2400, pkg: 'COLD_STORAGE', status: 'DELIVERED', cost: 36000, notes: 'Vaccines & temperature sensitive meds' },
      { tracking: 'RTX-100004', custIdx: 3, origIdx: 1, destIdx: 7, drvIdx: 3, vehIdx: 3, weight: 3100, pkg: 'STANDARD', status: 'DELIVERED', cost: 46500, notes: 'Automobile spare parts' },
      { tracking: 'RTX-100005', custIdx: 4, origIdx: 9, destIdx: 0, drvIdx: 0, vehIdx: 0, weight: 1200, pkg: 'STANDARD', status: 'DELIVERED', cost: 18000, notes: 'Textile fabrics' },
      { tracking: 'RTX-100006', custIdx: 0, origIdx: 3, destIdx: 5, drvIdx: 1, vehIdx: 1, weight: 950, pkg: 'FRAGILE', status: 'DELIVERED', cost: 14250, notes: 'Consumer audio electronics' },
      { tracking: 'RTX-100007', custIdx: 1, origIdx: 6, destIdx: 2, drvIdx: 2, vehIdx: 2, weight: 4200, pkg: 'STANDARD', status: 'DELIVERED', cost: 63000, notes: 'Heavy industrial machinery parts' },
      { tracking: 'RTX-100008', custIdx: 2, origIdx: 7, destIdx: 1, drvIdx: 3, vehIdx: 3, weight: 1800, pkg: 'HAZARDOUS', status: 'DELIVERED', cost: 28000, notes: 'Industrial chemical solvents' },

      // IN_TRANSIT (5)
      { tracking: 'RTX-100009', custIdx: 3, origIdx: 0, destIdx: 8, drvIdx: 0, vehIdx: 0, weight: 2100, pkg: 'STANDARD', status: 'IN_TRANSIT', cost: 31500, notes: 'Telecommunication hardware' },
      { tracking: 'RTX-100010', custIdx: 4, origIdx: 4, destIdx: 8, drvIdx: 1, vehIdx: 1, weight: 3500, pkg: 'COLD_STORAGE', status: 'IN_TRANSIT', cost: 52500, notes: 'Perishable agro food products' },
      { tracking: 'RTX-100011', custIdx: 0, origIdx: 1, destIdx: 2, drvIdx: 2, vehIdx: 2, weight: 1600, pkg: 'STANDARD', status: 'IN_TRANSIT', cost: 24000, notes: 'FMCG packaged goods' },
      { tracking: 'RTX-100012', custIdx: 1, origIdx: 2, destIdx: 5, drvIdx: 3, vehIdx: 3, weight: 2900, pkg: 'FRAGILE', status: 'IN_TRANSIT', cost: 43500, notes: 'Medical diagnostic equipment' },
      { tracking: 'RTX-100013', custIdx: 2, origIdx: 8, destIdx: 4, drvIdx: 0, vehIdx: 4, weight: 1100, pkg: 'STANDARD', status: 'IN_TRANSIT', cost: 16500, notes: 'Organic tea leaves shipment' },

      // DISPATCHED (3)
      { tracking: 'RTX-100014', custIdx: 3, origIdx: 3, destIdx: 1, drvIdx: 1, vehIdx: 1, weight: 2700, pkg: 'STANDARD', status: 'DISPATCHED', cost: 40500, notes: 'Leather goods freight' },
      { tracking: 'RTX-100015', custIdx: 4, origIdx: 5, destIdx: 2, drvIdx: 2, vehIdx: 2, weight: 1400, pkg: 'STANDARD', status: 'DISPATCHED', cost: 21000, notes: 'Solar panel components' },
      { tracking: 'RTX-100016', custIdx: 0, origIdx: 7, destIdx: 0, drvIdx: 3, vehIdx: 3, weight: 3800, pkg: 'HAZARDOUS', status: 'DISPATCHED', cost: 57000, notes: 'Battery energy storage packs' },

      // PENDING (3)
      { tracking: 'RTX-100017', custIdx: 1, origIdx: 0, destIdx: 6, drvIdx: null, vehIdx: null, weight: 900, pkg: 'STANDARD', status: 'PENDING', cost: 13500, notes: 'Retail clothing garments' },
      { tracking: 'RTX-100018', custIdx: 2, origIdx: 2, destIdx: 3, drvIdx: null, vehIdx: null, weight: 1750, pkg: 'FRAGILE', status: 'PENDING', cost: 26250, notes: 'Glassware & ceramics shipment' },
      { tracking: 'RTX-100019', custIdx: 3, origIdx: 9, destIdx: 1, drvIdx: null, vehIdx: null, weight: 2200, pkg: 'STANDARD', status: 'PENDING', cost: 33000, notes: 'Handicrafts freight' },

      // CANCELLED (1)
      { tracking: 'RTX-100020', custIdx: 4, origIdx: 4, destIdx: 0, drvIdx: null, vehIdx: null, weight: 500, pkg: 'STANDARD', status: 'CANCELLED', cost: 7500, notes: 'Order cancelled by customer' }
    ];

    const shipments = [];
    for (const st of shipmentTemplates) {
      const custUser = customerUsers[st.custIdx];
      const origHub = hubs[st.origIdx];
      const destHub = hubs[st.destIdx];
      const drvUser = st.drvIdx !== null ? driverUsers[st.drvIdx] : null;
      const vehDoc = st.vehIdx !== null ? vehicles[st.vehIdx] : null;

      const shipmentDoc = await Shipment.create({
        trackingNumber: st.tracking,
        customer: custUser._id,
        originHub: origHub._id,
        destinationHub: destHub._id,
        pickupLocation: {
          type: 'Point',
          coordinates: [origHub.location.coordinates[0], origHub.location.coordinates[1]]
        },
        deliveryLocation: {
          type: 'Point',
          coordinates: [destHub.location.coordinates[0], destHub.location.coordinates[1]]
        },
        pickupAddress: {
          street: `Hub Exit Gate ${st.origIdx + 1}`,
          city: origHub.city,
          state: origHub.state,
          pincode: '110001'
        },
        deliveryAddress: {
          street: `Cargo Terminal Entry Gate ${st.destIdx + 1}`,
          city: destHub.city,
          state: destHub.state,
          pincode: '400001'
        },
        driver: drvUser ? drvUser._id : null,
        vehicle: vehDoc ? vehDoc._id : null,
        weightKg: st.weight,
        dimensions: { length: 120, width: 80, height: 100 },
        packageType: st.pkg,
        status: st.status,
        estimatedCost: st.cost,
        notes: st.notes
      });
      shipments.push(shipmentDoc);
    }

    console.log(`Created ${shipments.length} Shipments.`);

    console.log('\n=================================');
    console.log('RouteXAI Demo Data Seed Complete');
    console.log('=================================');
    console.log(`Users:     ${await User.countDocuments()}`);
    console.log(`Customers: ${await Customer.countDocuments()}`);
    console.log(`Drivers:   ${await Driver.countDocuments()}`);
    console.log(`Vehicles:  ${await Vehicle.countDocuments()}`);
    console.log(`Hubs:      ${await Hub.countDocuments()}`);
    console.log(`Shipments: ${await Shipment.countDocuments()}`);
    console.log(`Database:  ${mongoose.connection.name || 'routexai'}`);
    console.log('=================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
