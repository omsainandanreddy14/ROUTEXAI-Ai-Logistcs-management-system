import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon paths in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// Custom Green Icon for Source
const sourceIcon = L.divIcon({
  className: 'custom-leaflet-marker-src',
  html: `<div style="background-color: #10b981; width: 24px; height: 24px; border-radius: 50%; border: 3px solid #020617; box-shadow: 0 0 10px rgba(16,185,129,0.8);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Custom Red Icon for Destination
const destIcon = L.divIcon({
  className: 'custom-leaflet-marker-dest',
  html: `<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid #020617; box-shadow: 0 0 10px rgba(239,68,68,0.8);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Helper component to auto-center & fit map bounds
const MapBoundsFitter = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      try {
        map.fitBounds(bounds, { padding: [40, 40] });
      } catch (e) {
        // Fallback catch for bounds calculation
      }
    }
  }, [bounds, map]);
  return null;
};

const RouteMap = ({ source, destination, routeGeometry, height = '400px' }) => {
  const srcLat = Number(source?.latitude ?? source?.lat);
  const srcLng = Number(source?.longitude ?? source?.lng);
  const destLat = Number(destination?.latitude ?? destination?.lat);
  const destLng = Number(destination?.longitude ?? destination?.lng);

  const isValidCoords =
    !isNaN(srcLat) && !isNaN(srcLng) && !isNaN(destLat) && !isNaN(destLng) &&
    srcLat >= -90 && srcLat <= 90 && destLat >= -90 && destLat <= 90 &&
    srcLng >= -180 && srcLng <= 180 && destLng >= -180 && destLng <= 180;

  const [polylineCoords, setPolylineCoords] = React.useState([]);

  React.useEffect(() => {
    let initialCoords = [];
    if (routeGeometry) {
      if (routeGeometry.coordinates && Array.isArray(routeGeometry.coordinates)) {
        initialCoords = routeGeometry.coordinates
          .filter((c) => Array.isArray(c) && c.length >= 2 && !isNaN(Number(c[0])) && !isNaN(Number(c[1])))
          .map((c) => [Number(c[1]), Number(c[0])]);
      } else if (Array.isArray(routeGeometry)) {
        initialCoords = routeGeometry
          .filter((c) => Array.isArray(c) && c.length >= 2 && !isNaN(Number(c[0])) && !isNaN(Number(c[1])))
          .map((c) => [Number(c[1]), Number(c[0])]);
      }
    }

    if (initialCoords.length >= 2) {
      setPolylineCoords(initialCoords);
    } else {
      setPolylineCoords([]);
    }
  }, [srcLat, srcLng, destLat, destLng, routeGeometry]);

  if (!isValidCoords) {
    return (
      <div
        className="w-full rounded-2xl border border-slate-800 bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2 shadow-inner"
        style={{ height }}
      >
        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-1">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-slate-300">Shipment coordinates unavailable or invalid</span>
        <span className="text-xs text-slate-500">Please select an active shipment with valid GPS pickup and delivery coordinates.</span>
      </div>
    );
  }

  const bounds = polylineCoords.length > 0 ? polylineCoords : [[srcLat, srcLng], [destLat, destLng]];
  const polyKey = JSON.stringify(polylineCoords.slice(0, 3)) + polylineCoords.length;

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-slate-800 shadow-xl relative z-0" style={{ height }}>
      {/* Route Status Overlay Banner */}
      <div className="absolute top-3 right-3 z-[1000] bg-slate-950/90 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl text-[11px] font-mono shadow-lg flex items-center gap-2">
        {polylineCoords.length > 0 ? (
          <>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-slate-300">Route Geometry: <strong className="text-cyan-300">{polylineCoords.length}</strong> waypoints</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="text-slate-400">Route path not yet calculated</span>
          </>
        )}
      </div>

      <MapContainer
        center={[srcLat, srcLng]}
        zoom={6}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', backgroundColor: '#020617' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBoundsFitter bounds={bounds} />

        <Marker position={[srcLat, srcLng]} icon={sourceIcon}>
          <Popup>
            <div className="text-xs">
              <strong className="text-emerald-400 block font-bold">Pickup Location</strong>
              <span className="text-slate-200">{source?.address || source?.city || 'Origin Point'}</span>
              <span className="text-[10px] text-slate-500 block font-mono mt-0.5">[{srcLat.toFixed(4)}, {srcLng.toFixed(4)}]</span>
            </div>
          </Popup>
        </Marker>

        <Marker position={[destLat, destLng]} icon={destIcon}>
          <Popup>
            <div className="text-xs">
              <strong className="text-rose-400 block font-bold">Delivery Destination</strong>
              <span className="text-slate-200">{destination?.address || destination?.city || 'Destination Point'}</span>
              <span className="text-[10px] text-slate-500 block font-mono mt-0.5">[{destLat.toFixed(4)}, {destLng.toFixed(4)}]</span>
            </div>
          </Popup>
        </Marker>

        {polylineCoords.length > 0 && (
          <Polyline
            key={polyKey}
            positions={polylineCoords}
            pathOptions={{ color: '#06b6d4', weight: 5, opacity: 0.85, lineJoin: 'round' }}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default RouteMap;
