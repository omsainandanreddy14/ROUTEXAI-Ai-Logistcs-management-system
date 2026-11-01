import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import {
  CloudRain,
  Wind,
  Thermometer,
  Eye,
  Droplets,
  Shield,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Package,
  CheckCircle2,
  Compass,
  Zap
} from 'lucide-react';

const CITIES = [
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867, state: 'Telangana' },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707, state: 'Tamil Nadu' },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946, state: 'Karnataka' },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777, state: 'Maharashtra' },
  { name: 'New Delhi', lat: 28.6139, lng: 77.2090, state: 'Delhi' },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639, state: 'West Bengal' },
  { name: 'Pune', lat: 18.5204, lng: 73.8567, state: 'Maharashtra' },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714, state: 'Gujarat' }
];

const WeatherAlerts = () => {
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [weatherError, setWeatherError] = useState('');

  // Shipment Endpoint Weather State
  const [shipments, setShipments] = useState([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [shipmentWeather, setShipmentWeather] = useState(null);
  const [loadingShipmentWeather, setLoadingShipmentWeather] = useState(false);

  // Fetch current weather for selected location
  const fetchWeather = async (city) => {
    setLoadingWeather(true);
    setWeatherError('');
    try {
      const res = await axiosInstance.get(`/weather/current?latitude=${city.lat}&longitude=${city.lng}`);
      if (res.data && res.data.success) {
        setCurrentWeather(res.data.data);
      } else {
        setWeatherError('Weather data temporarily unavailable.');
      }
    } catch (err) {
      setWeatherError(err.response?.data?.message || 'Weather data temporarily unavailable.');
    } finally {
      setLoadingWeather(false);
    }
  };

  // Fetch shipments on mount
  useEffect(() => {
    fetchWeather(selectedCity);

    const fetchShipments = async () => {
      try {
        const res = await axiosInstance.get('/shipments');
        if (res.data && Array.isArray(res.data.data)) {
          setShipments(res.data.data);
          if (res.data.data.length > 0) {
            setSelectedShipmentId(res.data.data[0]._id);
          }
        }
      } catch (err) {
        console.log('Error fetching shipments for weather inspection');
      }
    };
    fetchShipments();
  }, []);

  // Fetch shipment endpoint weather when selected shipment changes
  useEffect(() => {
    if (!selectedShipmentId) return;
    const fetchEndpointWeather = async () => {
      setLoadingShipmentWeather(true);
      try {
        const res = await axiosInstance.get(`/weather/shipment/${selectedShipmentId}`);
        if (res.data && res.data.success) {
          setShipmentWeather(res.data.data);
        }
      } catch (err) {
        console.log('Shipment endpoint weather error');
      } finally {
        setLoadingShipmentWeather(false);
      }
    };
    fetchEndpointWeather();
  }, [selectedShipmentId]);

  const getRiskBadgeColor = (risk) => {
    if (risk === 'HIGH') return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    if (risk === 'MEDIUM') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
            <CloudRain className="w-7 h-7 text-cyan-400" />
            <span>Weather Intelligence Dashboard</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Open-Meteo weather telemetry & endpoint transit risk analysis
          </p>
        </div>

        {/* Location Dropdown */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-2xl">
          <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
          <select
            value={selectedCity.name}
            onChange={(e) => {
              const city = CITIES.find((c) => c.name === e.target.value);
              if (city) {
                setSelectedCity(city);
                fetchWeather(city);
              }
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-semibold focus:outline-none focus:border-cyan-500"
          >
            {CITIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.state})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Weather Telemetry Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100">{selectedCity.name} Weather Station</h2>
              <span className="text-xs text-slate-500">({selectedCity.state})</span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Lat: {selectedCity.lat.toFixed(4)}, Lng: {selectedCity.lng.toFixed(4)} • Data: Open-Meteo API
            </p>
          </div>

          {currentWeather && (
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border font-mono ${getRiskBadgeColor(currentWeather.weatherRisk)}`}>
                Weather Risk: {currentWeather.weatherRisk}
              </span>
            </div>
          )}
        </div>

        {loadingWeather ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
            <span className="text-xs font-semibold">Fetching Open-Meteo Weather Telemetry...</span>
          </div>
        ) : weatherError ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{weatherError}</span>
          </div>
        ) : currentWeather ? (
          <div className="space-y-6">
            {/* Condition Banner */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                  <CloudRain className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">WMO Condition Standard</span>
                  <p className="text-lg font-bold text-slate-100">{currentWeather.condition}</p>
                </div>
              </div>

              <div className="text-xs bg-slate-900 border border-slate-800 rounded-xl p-3 max-w-sm">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Risk Threshold Reason</span>
                <p className="text-slate-300 font-medium">{currentWeather.riskReason}</p>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <Thermometer className="w-4 h-4" />
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Temperature</span>
                </div>
                <p className="text-xl font-bold text-slate-100">{currentWeather.temperature}°C</p>
                <p className="text-[10px] text-slate-500">Feels like {currentWeather.apparentTemperature}°C</p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-blue-400">
                  <Droplets className="w-4 h-4" />
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Humidity</span>
                </div>
                <p className="text-xl font-bold text-slate-100">{currentWeather.humidity}%</p>
                <p className="text-[10px] text-slate-500">Relative Humidity</p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-indigo-400">
                  <CloudRain className="w-4 h-4" />
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Rainfall</span>
                </div>
                <p className="text-xl font-bold text-slate-100">{currentWeather.rain} mm</p>
                <p className="text-[10px] text-slate-500">Precipitation depth</p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-teal-400">
                  <Wind className="w-4 h-4" />
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Wind Speed</span>
                </div>
                <p className="text-xl font-bold text-slate-100">{currentWeather.windSpeed} km/h</p>
                <p className="text-[10px] text-slate-500">Dir: {currentWeather.windDirection}°</p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Eye className="w-4 h-4" />
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Visibility</span>
                </div>
                <p className="text-xl font-bold text-slate-100">{currentWeather.visibilityKm} km</p>
                <p className="text-[10px] text-slate-500">{currentWeather.visibility} meters</p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-purple-400">
                  <Zap className="w-4 h-4" />
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Cloud Cover</span>
                </div>
                <p className="text-xl font-bold text-slate-100">{currentWeather.cloudCover}%</p>
                <p className="text-[10px] text-slate-500">Sky coverage</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Shipment Route Endpoint Weather Inspection Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-400" />
              <span>Shipment Route Endpoint Weather Inspection</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Side-by-side weather telemetry comparing Pickup Location vs Delivery Destination
            </p>
          </div>

          <div className="w-full sm:w-72">
            <select
              value={selectedShipmentId}
              onChange={(e) => setSelectedShipmentId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono focus:border-cyan-500"
            >
              <option value="">-- Select Shipment --</option>
              {shipments.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.trackingId || s.trackingNumber} ({s.pickupAddress?.city || s.originCity || 'Origin'} → {s.deliveryAddress?.city || s.destinationCity || 'Dest'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadingShipmentWeather ? (
          <div className="py-8 flex items-center justify-center text-slate-500 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-cyan-400 mr-2" />
            <span>Retrieving endpoint weather data...</span>
          </div>
        ) : shipmentWeather ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                  {shipmentWeather.label}
                </span>
                <span className="font-mono text-cyan-400 font-bold">({shipmentWeather.trackingId})</span>
              </div>

              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border font-mono ${getRiskBadgeColor(shipmentWeather.endpointRisk)}`}>
                Endpoint Risk: {shipmentWeather.endpointRisk}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pickup Location Weather Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div>
                    <span className="text-[10px] text-emerald-400 uppercase font-bold block">Pickup Location</span>
                    <h3 className="font-bold text-slate-100 text-sm">{shipmentWeather.pickupCity}</h3>
                  </div>
                  {shipmentWeather.pickupWeather && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getRiskBadgeColor(shipmentWeather.pickupWeather.weatherRisk)}`}>
                      {shipmentWeather.pickupWeather.weatherRisk}
                    </span>
                  )}
                </div>

                {shipmentWeather.pickupWeather ? (
                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Condition</span>
                      <span className="font-bold text-slate-100">{shipmentWeather.pickupWeather.condition}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Temperature</span>
                      <span className="font-bold text-cyan-400">{shipmentWeather.pickupWeather.temperature}°C</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Rainfall</span>
                      <span className="font-bold text-blue-400">{shipmentWeather.pickupWeather.rain} mm</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Wind Speed</span>
                      <span className="font-bold text-teal-400">{shipmentWeather.pickupWeather.windSpeed} km/h</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Weather data temporarily unavailable for pickup location.</p>
                )}
              </div>

              {/* Delivery Destination Weather Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div>
                    <span className="text-[10px] text-amber-400 uppercase font-bold block">Delivery Destination</span>
                    <h3 className="font-bold text-slate-100 text-sm">{shipmentWeather.deliveryCity}</h3>
                  </div>
                  {shipmentWeather.deliveryWeather && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getRiskBadgeColor(shipmentWeather.deliveryWeather.weatherRisk)}`}>
                      {shipmentWeather.deliveryWeather.weatherRisk}
                    </span>
                  )}
                </div>

                {shipmentWeather.deliveryWeather ? (
                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Condition</span>
                      <span className="font-bold text-slate-100">{shipmentWeather.deliveryWeather.condition}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Temperature</span>
                      <span className="font-bold text-cyan-400">{shipmentWeather.deliveryWeather.temperature}°C</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Rainfall</span>
                      <span className="font-bold text-blue-400">{shipmentWeather.deliveryWeather.rain} mm</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Wind Speed</span>
                      <span className="font-bold text-teal-400">{shipmentWeather.deliveryWeather.windSpeed} km/h</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Weather data temporarily unavailable for delivery location.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Select a shipment above to inspect route endpoint weather.</p>
        )}
      </div>
    </div>
  );
};

export default WeatherAlerts;
