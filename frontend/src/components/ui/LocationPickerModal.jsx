import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X, CheckCircle, RefreshCw } from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const customPinIcon = L.divIcon({
  className: 'custom-leaflet-marker-picker',
  html: `<div style="background-color: #06b6d4; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #020617; box-shadow: 0 0 14px rgba(6,182,212,0.9); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">📍</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const MapClickHandler = ({ onLocationSelected }) => {
  useMapEvents({
    click(e) {
      onLocationSelected(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
};

const LocationPickerModal = ({ isOpen, onClose, title = 'Select Location on Map', initialPos, onConfirm }) => {
  const defaultLat = initialPos?.lat || 17.3850; // Default Hyderabad
  const defaultLng = initialPos?.lng || 78.4867;

  const [position, setPosition] = useState({ lat: defaultLat, lng: defaultLng });
  const [addressDetails, setAddressDetails] = useState({
    street: 'Selected Location on Map',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500001'
  });
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (initialPos && initialPos.lat && initialPos.lng) {
      setPosition({ lat: initialPos.lat, lng: initialPos.lng });
      reverseGeocode(initialPos.lat, initialPos.lng);
    }
  }, [initialPos]);

  const reverseGeocode = async (lat, lng) => {
    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'User-Agent': 'RouteXAI Logistics Platform' }
      });
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        setAddressDetails({
          street: data.display_name?.split(',')[0] || addr.road || addr.suburb || 'Selected Location',
          city: addr.city || addr.town || addr.village || addr.county || addr.state_district || 'City',
          state: addr.state || 'State',
          pincode: addr.postcode || '500001'
        });
      }
    } catch (err) {
      console.log('Reverse geocoding fallback');
    } finally {
      setGeocoding(false);
    }
  };

  const handleMapClick = (lat, lng) => {
    setPosition({ lat, lng });
    reverseGeocode(lat, lng);
  };

  const handleConfirm = () => {
    onConfirm({
      latitude: position.lat,
      longitude: position.lng,
      street: addressDetails.street,
      city: addressDetails.city,
      state: addressDetails.state,
      pincode: addressDetails.pincode
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-100">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Click anywhere on the map to place the marker at your location.
        </p>

        <div className="h-80 w-full rounded-2xl overflow-hidden border border-slate-800">
          <MapContainer
            center={[position.lat, position.lng]}
            zoom={12}
            style={{ height: '100%', width: '100%', backgroundColor: '#020617' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onLocationSelected={handleMapClick} />
            <Marker position={[position.lat, position.lng]} icon={customPinIcon} />
          </MapContainer>
        </div>

        {/* Selected Location Details Preview */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
              Selected Coordinates & Address
            </span>
            {geocoding && (
              <span className="text-cyan-400 flex items-center gap-1 font-mono text-[10px]">
                <RefreshCw className="w-3 h-3 animate-spin" /> Reverse Geocoding...
              </span>
            )}
          </div>

          <p className="font-bold text-slate-100">{addressDetails.street}</p>
          <p className="text-slate-400">
            {addressDetails.city}, {addressDetails.state} {addressDetails.pincode ? `• ${addressDetails.pincode}` : ''}
          </p>
          <p className="font-mono text-cyan-400 font-semibold text-[11px] pt-1">
            Lat: {position.lat.toFixed(6)}, Lng: {position.lng.toFixed(6)}
          </p>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-1/2 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-semibold text-xs hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="w-1/2 py-2.5 bg-cyan-600 text-white rounded-xl font-bold text-xs hover:bg-cyan-500 transition shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Confirm Location</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPickerModal;
