import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { AuthContext } from '../../context/AuthContext';
import LocationPickerModal from '../../components/ui/LocationPickerModal';
import { Package, MapPin, Compass, ArrowLeft, CheckCircle, Navigation, Edit3, Map, AlertCircle, RefreshCw, AlertTriangle, Info, Truck } from 'lucide-react';

const INDIAN_CITY_COORDS = {
  hyderabad: { lat: 17.3850, lng: 78.4867, state: 'Telangana', pincode: '500001' },
  chennai: { lat: 13.0827, lng: 80.2707, state: 'Tamil Nadu', pincode: '600001' },
  bengaluru: { lat: 12.9716, lng: 77.5946, state: 'Karnataka', pincode: '560001' },
  bangalore: { lat: 12.9716, lng: 77.5946, state: 'Karnataka', pincode: '560001' },
  mumbai: { lat: 19.0760, lng: 72.8777, state: 'Maharashtra', pincode: '400001' },
  delhi: { lat: 28.6139, lng: 77.2090, state: 'Delhi', pincode: '110001' },
  'new delhi': { lat: 28.6139, lng: 77.2090, state: 'Delhi', pincode: '110001' },
  kolkata: { lat: 22.5726, lng: 88.3639, state: 'West Bengal', pincode: '700001' },
  pune: { lat: 18.5204, lng: 73.8567, state: 'Maharashtra', pincode: '411001' },
  ahmedabad: { lat: 23.0225, lng: 72.5714, state: 'Gujarat', pincode: '380001' },
  jaipur: { lat: 26.9124, lng: 75.7873, state: 'Rajasthan', pincode: '302001' }
};

const CreateShipment = () => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const isDriver = (user?.role || '').toUpperCase() === 'DRIVER';

  const [submitting, setSubmitting] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Modals for map pickers
  const [pickupMapOpen, setPickupMapOpen] = useState(false);
  const [deliveryMapOpen, setDeliveryMapOpen] = useState(false);

  // Pickup Mode: 'MANUAL' | 'CURRENT' | 'MAP'
  const [pickupMode, setPickupMode] = useState('MANUAL');
  const [pickupData, setPickupData] = useState({
    street: 'Customer Warehouse, Jubilee Hills',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500001',
    latitude: 17.3850,
    longitude: 78.4867,
    locationType: 'CUSTOMER_LOCATION'
  });

  // Delivery Mode: 'MANUAL' | 'MAP'
  const [deliveryMode, setDeliveryMode] = useState('MANUAL');
  const [deliveryData, setDeliveryData] = useState({
    street: 'Commercial Retail Store, MG Road',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600001',
    latitude: 13.0827,
    longitude: 80.2707,
    locationType: 'CUSTOMER_LOCATION'
  });

  // Shipment Payload Details
  const [cargoDetails, setCargoDetails] = useState({
    weightKg: 250,
    quantity: 5,
    priority: 'MEDIUM',
    cargoType: 'Industrial Electronics',
    packageType: 'STANDARD',
    notes: 'Fragile handling required during transit'
  });

  // Dynamic Freight Pricing State
  const [pricingQuote, setPricingQuote] = useState(null);
  const [candidateRoutes, setCandidateRoutes] = useState([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [isHazmatBlocked, setIsHazmatBlocked] = useState(false);

  // Dynamic Freight Quote Recalculation Effect
  useEffect(() => {
    let isCancelled = false;

    // Fast-fail if category is HAZARDOUS
    if (cargoDetails.packageType === 'HAZARDOUS') {
      setIsHazmatBlocked(true);
      setPricingQuote(null);
      setQuoteError('Hazardous cargo transport is restricted. Standard automated booking is not supported for hazardous materials without specialized hazmat fleet compliance and regulatory permits.');
      setQuoteLoading(false);
      return;
    } else {
      setIsHazmatBlocked(false);
    }

    const wt = parseFloat(cargoDetails.weightKg);
    if (isNaN(wt) || wt <= 0) {
      setPricingQuote(null);
      setQuoteError('Please enter a valid cargo weight (> 0 kg) to calculate freight quote.');
      setQuoteLoading(false);
      return;
    }

    const sLat = parseFloat(pickupData.latitude);
    const sLng = parseFloat(pickupData.longitude);
    const dLat = parseFloat(deliveryData.latitude);
    const dLng = parseFloat(deliveryData.longitude);

    if (isNaN(sLat) || isNaN(sLng) || isNaN(dLat) || isNaN(dLng)) {
      setPricingQuote(null);
      setQuoteError('Pickup and delivery coordinates are required for route pricing.');
      setQuoteLoading(false);
      return;
    }

    if (Math.abs(sLat - dLat) < 0.0001 && Math.abs(sLng - dLng) < 0.0001) {
      setPricingQuote(null);
      setQuoteError('Pickup and delivery locations cannot be the same.');
      setQuoteLoading(false);
      return;
    }

    setQuoteLoading(true);
    setQuoteError('');

    const timer = setTimeout(async () => {
      try {
        const res = await axiosInstance.post('/pricing/quote', {
          source: { latitude: sLat, longitude: sLng },
          destination: { latitude: dLat, longitude: dLng },
          weightKg: wt,
          goodsCategory: cargoDetails.packageType,
          quantity: parseInt(cargoDetails.quantity, 10) || 1
        });

        if (isCancelled) return;

        if (res.data?.success && res.data.data) {
          const data = res.data.data;
          const candidates = data.candidateQuotes || [];
          setCandidateRoutes(candidates);
          const activeIdx = (selectedRouteIdx < candidates.length) ? selectedRouteIdx : 0;
          setSelectedRouteIdx(activeIdx);

          if (candidates.length > 0 && candidates[activeIdx]?.quote) {
            setPricingQuote(candidates[activeIdx].quote);
          } else if (data.primaryQuote) {
            setPricingQuote(data.primaryQuote);
          } else {
            setPricingQuote(data);
          }
          setQuoteError('');
        } else {
          setPricingQuote(null);
          setQuoteError(res.data?.message || 'Freight quote unavailable');
        }
      } catch (err) {
        if (isCancelled) return;
        setPricingQuote(null);
        if (err.response?.data?.error === 'HAZMAT_RESTRICTED') {
          setIsHazmatBlocked(true);
        }
        setQuoteError(err.response?.data?.message || 'Freight quote unavailable. Unable to calculate verified road route.');
      } finally {
        if (!isCancelled) {
          setQuoteLoading(false);
        }
      }
    }, 400);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    pickupData.latitude,
    pickupData.longitude,
    deliveryData.latitude,
    deliveryData.longitude,
    cargoDetails.weightKg,
    cargoDetails.packageType,
    cargoDetails.quantity
  ]);

  const handleSelectCandidateRoute = (idx) => {
    setSelectedRouteIdx(idx);
    if (candidateRoutes[idx]?.quote) {
      setPricingQuote(candidateRoutes[idx].quote);
    }
  };

  // Geolocation Handler using Browser API
  const handleUseCurrentLocation = () => {
    setErrorMessage('');
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser. Please enter your address manually.');
      return;
    }

    setGeolocating(true);
    setPickupMode('CURRENT');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setPickupData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng
        }));

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
            headers: { 'User-Agent': 'RouteXAI Platform' }
          });
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
            setPickupData({
              street: data.display_name?.split(',')[0] || addr.road || 'Current Customer Location',
              city: addr.city || addr.town || addr.village || addr.county || 'Bengaluru',
              state: addr.state || 'Karnataka',
              pincode: addr.postcode || '560001',
              latitude: lat,
              longitude: lng,
              locationType: 'CUSTOMER_LOCATION'
            });
          }
        } catch (err) {
          console.log('Reverse geocoding fallback');
        } finally {
          setGeolocating(false);
        }
      },
      (error) => {
        setGeolocating(false);
        setErrorMessage('Location permission was denied. Please enter your pickup address manually or select a location on the map.');
      }
    );
  };

  // Convert City/Address to Lat Lng coordinates
  const resolveCityCoordinates = (cityStr, isPickup = true) => {
    const key = cityStr.trim().toLowerCase();
    const cityMatch = INDIAN_CITY_COORDS[key];
    if (cityMatch) {
      if (isPickup) {
        setPickupData((prev) => ({
          ...prev,
          latitude: cityMatch.lat,
          longitude: cityMatch.lng,
          state: prev.state || cityMatch.state,
          pincode: prev.pincode || cityMatch.pincode
        }));
      } else {
        setDeliveryData((prev) => ({
          ...prev,
          latitude: cityMatch.lat,
          longitude: cityMatch.lng,
          state: prev.state || cityMatch.state,
          pincode: prev.pincode || cityMatch.pincode
        }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (isDriver) {
      setErrorMessage('Access restricted: You are currently signed in with a Driver account. Drivers cannot book freight orders. Please switch to a Customer account (e.g. aarav.retail@example.com) to confirm bookings.');
      return;
    }

    if (cargoDetails.packageType === 'HAZARDOUS') {
      setErrorMessage('Hazardous cargo transportation is restricted by platform policy. Automated booking cannot be confirmed.');
      return;
    }

    if (!pricingQuote || pricingQuote.quoteUnavailable) {
      setErrorMessage('Cannot confirm order: A valid verified freight quote is required before booking.');
      return;
    }

    if (!pickupData.street || !pickupData.city) {
      setErrorMessage('Please select or enter a valid pickup location.');
      return;
    }

    if (!deliveryData.street || !deliveryData.city) {
      setErrorMessage('Please select or enter a valid delivery location.');
      return;
    }

    if (
      Math.abs(pickupData.latitude - deliveryData.latitude) < 0.0001 &&
      Math.abs(pickupData.longitude - deliveryData.longitude) < 0.0001
    ) {
      setErrorMessage('Pickup and delivery locations cannot be the same.');
      return;
    }

    if (parseFloat(cargoDetails.weightKg) <= 0) {
      setErrorMessage('Cargo weight must be greater than zero.');
      return;
    }

    if (parseInt(cargoDetails.quantity) <= 0) {
      setErrorMessage('Quantity must be greater than zero.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        pickupAddress: {
          street: pickupData.street,
          city: pickupData.city,
          state: pickupData.state,
          pincode: pickupData.pincode
        },
        pickupLocation: {
          type: 'Point',
          coordinates: [pickupData.longitude, pickupData.latitude] // GeoJSON [longitude, latitude]
        },
        pickupLocationType: 'CUSTOMER_LOCATION',
        deliveryAddress: {
          street: deliveryData.street,
          city: deliveryData.city,
          state: deliveryData.state,
          pincode: deliveryData.pincode
        },
        deliveryLocation: {
          type: 'Point',
          coordinates: [deliveryData.longitude, deliveryData.latitude] // GeoJSON [longitude, latitude]
        },
        deliveryLocationType: 'CUSTOMER_LOCATION',
        weightKg: parseFloat(cargoDetails.weightKg),
        quantity: parseInt(cargoDetails.quantity, 10),
        priority: cargoDetails.priority,
        cargoType: cargoDetails.cargoType,
        packageType: cargoDetails.packageType,
        notes: cargoDetails.notes
      };

      await axiosInstance.post('/shipments', payload);
      navigate('/customer/dashboard');
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to create shipment order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Create New Freight Order</h1>
          <p className="text-xs text-slate-400 mt-0.5">Request pickup directly from your location anywhere across India</p>
        </div>
      </div>

      {isDriver && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-amber-300">Active Session: DRIVER ({user?.name || 'Driver'})</p>
              <p className="text-[11px] text-amber-200/80 mt-0.5">
                Driver accounts cannot submit freight bookings. Please sign in with a <strong>Customer</strong> account (e.g. <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-300 font-mono">aarav.retail@example.com</code>) or <strong>Owner</strong> account to create shipments.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 rounded-xl text-xs font-bold transition shrink-0 whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            Sign in as Customer
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PICKUP LOCATION SECTION */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>1. Customer Pickup Location</span>
            </h2>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-md font-bold uppercase">
              Your Location
            </span>
          </div>

          {/* Pickup Method Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={geolocating}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                pickupMode === 'CURRENT'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {geolocating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
              <span>Use My Location</span>
            </button>

            <button
              type="button"
              onClick={() => setPickupMode('MANUAL')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                pickupMode === 'MANUAL'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Enter Address</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPickupMode('MAP');
                setPickupMapOpen(true);
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                pickupMode === 'MAP'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Select on Map</span>
            </button>
          </div>

          {/* Form Fields for Manual Entry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1 font-semibold">Pickup Street Address / Landmark</label>
              <input
                type="text"
                required
                value={pickupData.street}
                onChange={(e) => setPickupData({ ...pickupData, street: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder-slate-500 focus:border-cyan-500"
                placeholder="e.g. Plot 45, Jubilee Hills Industrial Estate"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">City</label>
              <input
                type="text"
                required
                value={pickupData.city}
                onChange={(e) => {
                  const val = e.target.value;
                  setPickupData({ ...pickupData, city: val });
                  resolveCityCoordinates(val, true);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder-slate-500"
                placeholder="e.g. Hyderabad"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">State & Pincode</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={pickupData.state}
                  onChange={(e) => setPickupData({ ...pickupData, state: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  placeholder="State"
                />
                <input
                  type="text"
                  required
                  value={pickupData.pincode}
                  onChange={(e) => setPickupData({ ...pickupData, pincode: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono"
                  placeholder="500001"
                />
              </div>
            </div>
          </div>

          {/* Pickup Selected Preview Summary */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Confirmed Pickup Coordinates</span>
              <p className="font-bold text-slate-200">{pickupData.street}, {pickupData.city}</p>
            </div>
            <span className="font-mono text-cyan-400 font-bold bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-lg self-start sm:self-center">
              {pickupData.latitude.toFixed(4)}, {pickupData.longitude.toFixed(4)}
            </span>
          </div>
        </div>

        {/* DELIVERY LOCATION SECTION */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-400" />
              <span>2. Delivery Destination Location</span>
            </h2>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-md font-bold uppercase">
              Customer Destination
            </span>
          </div>

          {/* Delivery Method Options */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setDeliveryMode('MANUAL')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                deliveryMode === 'MANUAL'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Enter Address</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDeliveryMode('MAP');
                setDeliveryMapOpen(true);
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                deliveryMode === 'MAP'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Select on Map</span>
            </button>
          </div>

          {/* Form Fields for Delivery Entry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1 font-semibold">Delivery Street Address / Business Store</label>
              <input
                type="text"
                required
                value={deliveryData.street}
                onChange={(e) => setDeliveryData({ ...deliveryData, street: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder-slate-500 focus:border-amber-500"
                placeholder="e.g. Gate 3, Commercial Logistics Depot, MG Road"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Destination City</label>
              <input
                type="text"
                required
                value={deliveryData.city}
                onChange={(e) => {
                  const val = e.target.value;
                  setDeliveryData({ ...deliveryData, city: val });
                  resolveCityCoordinates(val, false);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder-slate-500"
                placeholder="e.g. Chennai"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">State & Pincode</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={deliveryData.state}
                  onChange={(e) => setDeliveryData({ ...deliveryData, state: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  placeholder="State"
                />
                <input
                  type="text"
                  required
                  value={deliveryData.pincode}
                  onChange={(e) => setDeliveryData({ ...deliveryData, pincode: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono"
                  placeholder="600001"
                />
              </div>
            </div>
          </div>

          {/* Delivery Selected Preview Summary */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Confirmed Delivery Coordinates</span>
              <p className="font-bold text-slate-200">{deliveryData.street}, {deliveryData.city}</p>
            </div>
            <span className="font-mono text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg self-start sm:self-center">
              {deliveryData.latitude.toFixed(4)}, {deliveryData.longitude.toFixed(4)}
            </span>
          </div>
        </div>

        {/* SHIPMENT & CARGO DETAILS SECTION */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 text-xs">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-cyan-400" />
            <span>3. Cargo & Freight Specification</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Cargo Weight (Kg)</label>
              <input
                type="number"
                required
                min="1"
                value={cargoDetails.weightKg}
                onChange={(e) => setCargoDetails({ ...cargoDetails, weightKg: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Quantity / Packages</label>
              <input
                type="number"
                required
                min="1"
                value={cargoDetails.quantity}
                onChange={(e) => setCargoDetails({ ...cargoDetails, quantity: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Dispatch Priority</label>
              <select
                value={cargoDetails.priority}
                onChange={(e) => setCargoDetails({ ...cargoDetails, priority: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-bold"
              >
                <option value="LOW">Low Priority</option>
                <option value="MEDIUM">Medium Standard</option>
                <option value="HIGH">High Express</option>
                <option value="URGENT">Urgent Critical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Cargo Description</label>
              <input
                type="text"
                required
                value={cargoDetails.cargoType}
                onChange={(e) => setCargoDetails({ ...cargoDetails, cargoType: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                placeholder="e.g. Industrial Electronics"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Handling Type</label>
              <select
                value={cargoDetails.packageType}
                onChange={(e) => setCargoDetails({ ...cargoDetails, packageType: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-medium"
              >
                <option value="STANDARD">Standard Goods (General Freight)</option>
                <option value="FRAGILE">Fragile Goods (Shock & Delicate Handling)</option>
                <option value="ELECTRONICS">Industrial Electronics (ESD & Climate Controlled)</option>
                <option value="PERISHABLE">Perishable Goods (Cold Chain / Reefer)</option>
                <option value="HAZARDOUS">Hazardous Material (Policy Restricted)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Special Instructions for Driver</label>
            <textarea
              rows={2}
              value={cargoDetails.notes}
              onChange={(e) => setCargoDetails({ ...cargoDetails, notes: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
              placeholder="e.g. Contact warehouse gate supervisor upon arrival"
            />
          </div>

          {/* Candidate Road Corridors Selector */}
          {candidateRoutes && candidateRoutes.length > 1 && !isHazmatBlocked && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  Candidate Road Corridors ({candidateRoutes.length})
                </span>
                <span className="text-[10px] text-slate-500">Select corridor to compare rates</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {candidateRoutes.map((cr, idx) => {
                  const isSelected = selectedRouteIdx === idx;
                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => handleSelectCandidateRoute(idx)}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500/60 shadow-sm shadow-cyan-500/10'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-200">
                          {cr.name || `Route ${String.fromCharCode(65 + idx)}`}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{cr.distanceKm?.toFixed(1)} km • {Math.floor((cr.durationMinutes || 0) / 60)}h {(cr.durationMinutes || 0) % 60}m</span>
                        <span className="font-bold text-cyan-400">₹{cr.quote?.totalFreightQuote?.toLocaleString('en-IN')}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hazardous Goods Platform Policy Warning */}
          {isHazmatBlocked && (
            <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>Hazardous Cargo Transport Restricted</span>
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed">
                Standard automated freight booking is not available for hazardous materials, flammable goods, or restricted chemicals without dedicated ADR-certified carrier fleets and government transit permits. Please contact platform operations to arrange specialized compliant transport.
              </p>
              <div className="pt-1 text-[11px] text-rose-400/80 font-mono">
                Policy Restriction: HAZMAT_RESTRICTED (Code 400)
              </div>
            </div>
          )}

          {/* Dynamic Quote Loading State */}
          {quoteLoading && !isHazmatBlocked && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-center gap-3 text-cyan-400 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span className="font-medium">Calculating verified road route and dynamic freight quote...</span>
            </div>
          )}

          {/* Quote Calculation Error / Fallback State */}
          {quoteError && !quoteLoading && !isHazmatBlocked && (
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 text-xs space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Freight Quote Unavailable</span>
              </div>
              <p className="text-amber-200/90">{quoteError}</p>
            </div>
          )}

          {/* Dynamic Itemized Freight Quote Breakdown */}
          {pricingQuote && !quoteLoading && !isHazmatBlocked && (
            <div className="bg-slate-950 border border-cyan-500/30 rounded-2xl p-5 space-y-4 shadow-xl shadow-cyan-950/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-800/80 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                    Dynamic Freight Quote
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-cyan-400">
                      ₹{pricingQuote.totalFreightQuote?.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      ({pricingQuote.distanceKm?.toFixed(1)} km Road Corridor)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Verified Road Route
                  </span>
                </div>
              </div>

              {/* Itemized Cost Breakdown */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Distance Charge</span>
                    <span className="text-[10px] text-slate-500">
                      ({pricingQuote.distanceKm?.toFixed(1)} km × ₹{pricingQuote.appliedRates?.baseRatePerKm}/km)
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-100">
                    ₹{pricingQuote.breakdown?.distanceCharge?.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Cargo Weight Charge</span>
                    <span className="text-[10px] text-slate-500">
                      ({pricingQuote.weightKg} kg × ₹{pricingQuote.appliedRates?.weightRatePerKg}/kg × factor {pricingQuote.breakdown?.distanceFactor?.toFixed(2)})
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-100">
                    ₹{pricingQuote.breakdown?.weightCharge?.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-300">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Goods Handling Surcharge</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                        {pricingQuote.goodsCategory}
                      </span>
                    </div>
                    {pricingQuote.breakdown?.categoryDetails && (
                      <span className="text-[10px] text-slate-500 mt-0.5">
                        {pricingQuote.breakdown.categoryDetails.description}
                        {pricingQuote.breakdown.categoryDetails.flatFee > 0 && ` (₹${pricingQuote.breakdown.categoryDetails.flatFee} flat)`}
                        {pricingQuote.breakdown.categoryDetails.percentageOfBaseRate > 0 && ` (+${(pricingQuote.breakdown.categoryDetails.percentageOfBaseRate * 100).toFixed(0)}% base)`}
                        {pricingQuote.breakdown.categoryDetails.urgencyFee > 0 && ` (+₹${pricingQuote.breakdown.categoryDetails.urgencyFee} expedited)`}
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-100">
                    ₹{pricingQuote.breakdown?.goodsHandlingCharge?.toLocaleString('en-IN')}
                  </span>
                </div>

                {pricingQuote.breakdown?.minimumChargeApplied && (
                  <div className="flex items-center justify-between text-amber-400/90 text-[11px] pt-1 border-t border-slate-800/60">
                    <span>Minimum Freight Guarantee Adjustment</span>
                    <span className="font-mono font-bold">₹{pricingQuote.appliedRates?.minimumFreightQuote}</span>
                  </div>
                )}
              </div>

              {/* Rate Model Notice */}
              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3 text-slate-400" />
                  Rate model: Config v{pricingQuote.configVersion || '1.0'} (Demonstration Base)
                </span>
                <span>Idempotent Calculation</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isDriver || submitting || quoteLoading || isHazmatBlocked || !pricingQuote || pricingQuote.quoteUnavailable}
            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2 text-sm cursor-pointer disabled:cursor-not-allowed"
          >
            {isDriver ? (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Driver Account (Switch to Customer to Book)</span>
              </>
            ) : submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Submitting Order...</span>
              </>
            ) : isHazmatBlocked ? (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Booking Restricted (Hazardous Cargo)</span>
              </>
            ) : quoteLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Calculating Route Quote...</span>
              </>
            ) : !pricingQuote || pricingQuote.quoteUnavailable ? (
              <span>Awaiting Valid Route Quote...</span>
            ) : (
              <span>Confirm Freight Order — ₹{pricingQuote.totalFreightQuote?.toLocaleString('en-IN')}</span>
            )}
          </button>
        </div>
      </form>

      {/* Map Selection Modals */}
      <LocationPickerModal
        isOpen={pickupMapOpen}
        onClose={() => setPickupMapOpen(false)}
        title="Select Customer Pickup Location on Map"
        initialPos={{ lat: pickupData.latitude, lng: pickupData.longitude }}
        onConfirm={(loc) => {
          setPickupData({
            street: loc.street,
            city: loc.city,
            state: loc.state,
            pincode: loc.pincode,
            latitude: loc.latitude,
            longitude: loc.longitude,
            locationType: 'CUSTOMER_LOCATION'
          });
        }}
      />

      <LocationPickerModal
        isOpen={deliveryMapOpen}
        onClose={() => setDeliveryMapOpen(false)}
        title="Select Delivery Destination Location on Map"
        initialPos={{ lat: deliveryData.latitude, lng: deliveryData.longitude }}
        onConfirm={(loc) => {
          setDeliveryData({
            street: loc.street,
            city: loc.city,
            state: loc.state,
            pincode: loc.pincode,
            latitude: loc.latitude,
            longitude: loc.longitude,
            locationType: 'CUSTOMER_LOCATION'
          });
        }}
      />
    </div>
  );
};

export default CreateShipment;
