// Centralized Pan-India Logistics Demo Data for RouteXAI Platform

export const MOCK_HUBS = [
  {
    _id: 'hub-01',
    code: 'BLR-01',
    name: 'Bengaluru Tech Logistics Hub',
    city: 'Bengaluru',
    state: 'Karnataka',
    address: 'Electronic City Phase 2, Hosur Road, Bengaluru - 560100',
    location: { type: 'Point', coordinates: [77.6743, 12.8452] },
    capacity: 5000,
    currentUtilization: 3420,
    activeShipments: 48,
    vehicleCount: 14,
    status: 'ACTIVE'
  },
  {
    _id: 'hub-02',
    code: 'MAA-01',
    name: 'Chennai Port Express Hub',
    city: 'Chennai',
    state: 'Tamil Nadu',
    address: 'Sriperumbudur Industrial Corridor, Chennai - 602105',
    location: { type: 'Point', coordinates: [79.9419, 12.9692] },
    capacity: 4500,
    currentUtilization: 2900,
    activeShipments: 36,
    vehicleCount: 10,
    status: 'ACTIVE'
  },
  {
    _id: 'hub-03',
    code: 'DEL-01',
    name: 'Delhi National Hub',
    city: 'New Delhi',
    state: 'Delhi',
    address: 'Sector 18, Dwarka Freight & Cargo Complex, New Delhi - 110075',
    location: { type: 'Point', coordinates: [77.0688, 28.5921] },
    capacity: 6500,
    currentUtilization: 5200,
    activeShipments: 84,
    vehicleCount: 22,
    status: 'ACTIVE'
  },
  {
    _id: 'hub-04',
    code: 'CCU-01',
    name: 'Kolkata Eastern Hub',
    city: 'Kolkata',
    state: 'West Bengal',
    address: 'Dankuni Freight Terminal, NH-19, Kolkata - 712311',
    location: { type: 'Point', coordinates: [88.2985, 22.6854] },
    capacity: 3500,
    currentUtilization: 2100,
    activeShipments: 28,
    vehicleCount: 8,
    status: 'ACTIVE'
  },
  {
    _id: 'hub-05',
    code: 'BOM-01',
    name: 'Mumbai Central Gateway Hub',
    city: 'Mumbai',
    state: 'Maharashtra',
    address: 'Bhiwandi Integrated Logistics Park, Mumbai - 421302',
    location: { type: 'Point', coordinates: [73.0645, 19.2968] },
    capacity: 7000,
    currentUtilization: 6100,
    activeShipments: 95,
    vehicleCount: 25,
    status: 'ACTIVE'
  },
  {
    _id: 'hub-06',
    code: 'GAU-01',
    name: 'Guwahati Logistics Hub',
    city: 'Guwahati',
    state: 'Assam',
    address: 'Amingaon Inland Container Depot, Guwahati - 781031',
    location: { type: 'Point', coordinates: [91.6845, 26.1923] },
    capacity: 3000,
    currentUtilization: 1850,
    activeShipments: 19,
    vehicleCount: 6,
    status: 'ACTIVE'
  },
  {
    _id: 'hub-07',
    code: 'HYD-01',
    name: 'Hyderabad Distribution Hub',
    city: 'Hyderabad',
    state: 'Telangana',
    address: 'Shamshabad Airport Cargo Zone, Hyderabad - 500108',
    location: { type: 'Point', coordinates: [78.4294, 17.2403] },
    capacity: 4800,
    currentUtilization: 3100,
    activeShipments: 42,
    vehicleCount: 12,
    status: 'ACTIVE'
  },
  {
    _id: 'hub-08',
    code: 'PNE-01',
    name: 'Pune Logistics Hub',
    city: 'Pune',
    state: 'Maharashtra',
    address: 'Chakan Industrial Phase 3, Pune - 410501',
    location: { type: 'Point', coordinates: [73.8567, 18.7604] },
    capacity: 4000,
    currentUtilization: 2400,
    activeShipments: 31,
    vehicleCount: 9,
    status: 'ACTIVE'
  }
];

export const MOCK_VEHICLES = [
  {
    _id: 'veh-01',
    registrationNumber: 'MH-04-AZ-8899',
    vehicleType: 'HEAVY_TRUCK',
    capacityKg: 10000,
    fuelType: 'DIESEL',
    status: 'ON_TRIP',
    assignedDriverName: 'Rajesh Kumar',
    currentLocationName: 'NH-48, near Vadodara'
  },
  {
    _id: 'veh-02',
    registrationNumber: 'KA-01-MJ-4321',
    vehicleType: 'CONTAINER_TRUCK',
    capacityKg: 16000,
    fuelType: 'DIESEL',
    status: 'AVAILABLE',
    assignedDriverName: 'Unassigned',
    currentLocationName: 'Bengaluru Tech Logistics Hub'
  },
  {
    _id: 'veh-03',
    registrationNumber: 'DL-01-EV-2024',
    vehicleType: 'LIGHT_EV',
    capacityKg: 1500,
    fuelType: 'EV',
    status: 'AVAILABLE',
    assignedDriverName: 'Unassigned',
    currentLocationName: 'Delhi National Hub'
  },
  {
    _id: 'veh-04',
    registrationNumber: 'TN-09-CB-7711',
    vehicleType: 'MEDIUM_VAN',
    capacityKg: 3500,
    fuelType: 'CNG',
    status: 'AVAILABLE',
    assignedDriverName: 'Unassigned',
    currentLocationName: 'NH-44, near Salem'
  },
  {
    _id: 'veh-05',
    registrationNumber: 'WB-02-EX-5544',
    vehicleType: 'HEAVY_TRUCK',
    capacityKg: 12000,
    fuelType: 'DIESEL',
    status: 'MAINTENANCE',
    assignedDriverName: 'Unassigned',
    currentLocationName: 'Kolkata Eastern Hub Depot'
  }
];

export const MOCK_DRIVERS = [
  {
    _id: 'drv-01',
    name: 'Rajesh Kumar',
    email: 'driver@routexai.com',
    phone: '+91 98123 45678',
    licenseNumber: 'DL-0420110098765',
    experienceYears: 7,
    status: 'AVAILABLE',
    assignedVehicleReg: 'Unassigned',
    rating: 4.9
  },
  {
    _id: 'drv-02',
    name: 'Suresh Patel',
    email: 'suresh.p@routexai.com',
    phone: '+91 98765 11223',
    licenseNumber: 'KA-0220180012345',
    experienceYears: 5,
    status: 'AVAILABLE',
    assignedVehicleReg: 'Unassigned',
    rating: 4.8
  },
  {
    _id: 'drv-03',
    name: 'Vikram Singh',
    email: 'vikram.s@routexai.com',
    phone: '+91 99887 66554',
    licenseNumber: 'DL-0120150077889',
    experienceYears: 8,
    status: 'AVAILABLE',
    assignedVehicleReg: 'Unassigned',
    rating: 5.0
  }
];

export const MOCK_SHIPMENTS = [];

export const MOCK_ALERTS = [
  {
    id: 'alt-01',
    title: 'Siliguri Corridor Heavy Rainfall Warning',
    type: 'WEATHER',
    severity: 'HIGH',
    impactedRoute: 'Kolkata -> Guwahati (NH-27)',
    recommendedAction: 'Reroute via Cooch Behar or hold dispatch at Malda Hub',
    timestamp: '25 mins ago'
  },
  {
    id: 'alt-02',
    title: 'High Congestion at Vadodara Expressway Toll',
    type: 'TRAFFIC',
    severity: 'MEDIUM',
    impactedRoute: 'Delhi -> Mumbai (NH-48)',
    recommendedAction: 'Expected delay 35 mins. Alternate bypass active',
    timestamp: '1 hour ago'
  }
];

export const MOCK_AI_INSIGHTS = [
  {
    id: 'ai-01',
    title: 'Corridor Risk Alert',
    insight: 'Delhi–Guwahati corridor shows increased delay probability due to monsoonal landslide history near Jalpaiguri.',
    category: 'ROUTE_RISK',
    confidence: '92%'
  },
  {
    id: 'ai-02',
    title: 'Optimal Fleet Allocation',
    insight: 'Vehicle V102 (Container Truck) is 98% suitable for the upcoming 12-ton Bengaluru shipment based on payload efficiency.',
    category: 'FLEET_OPTIMIZATION',
    confidence: '95%'
  },
  {
    id: 'ai-03',
    title: 'ETA Adjustment Recommendation',
    insight: 'Shipment RTX-665533 ETA extended by +4.5 hours due to dynamic road accessibility index update in Assam sector.',
    category: 'ETA_PREDICTION',
    confidence: '89%'
  }
];
