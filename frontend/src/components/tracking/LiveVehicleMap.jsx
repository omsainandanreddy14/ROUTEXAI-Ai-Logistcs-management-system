import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon paths in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// Helper component to auto-fit map bounds when vehicles change
const MapBoundsFitter = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 0) {
      try {
        if (positions.length === 1) {
          map.setView(positions[0], 10);
        } else {
          map.fitBounds(positions, { padding: [50, 50] });
        }
      } catch (e) {
        // Fallback catch
      }
    }
  }, [positions, map]);
  return null;
};

// Create dynamic SVG/div marker icons based on vehicle status and vitality
const getVehicleIcon = (status, trackingVitality, isSelected) => {
  let color = '#06b6d4'; // cyan default
  const isOffline = trackingVitality === 'OFFLINE';
  if (isOffline) {
    color = '#64748b'; // slate
  } else if (trackingVitality === 'STALE') {
    color = '#f59e0b'; // amber
  } else if (status === 'IN_TRANSIT') {
    color = '#10b981'; // emerald
  } else if (status === 'ASSIGNED') {
    color = '#a855f7'; // purple
  } else if (status === 'IDLE') {
    color = '#eab308'; // yellow
  }

  const borderSize = isSelected ? '4px solid #38bdf8' : (isOffline ? '2px dashed #94a3b8' : '2px solid #020617');
  const pulseEffect = trackingVitality === 'LIVE' ? 'animation: pulse 2s infinite;' : '';
  const shadow = isOffline ? 'none' : `0 0 12px ${color}`;
  const opacity = isOffline ? '0.75' : '1.0';

  const html = `
    <div style="
      background-color: ${color};
      width: ${isSelected ? '28px' : '22px'};
      height: ${isSelected ? '28px' : '22px'};
      border-radius: 50%;
      border: ${borderSize};
      box-shadow: ${shadow};
      opacity: ${opacity};
      display: flex;
      align-items: center;
      justify-content: center;
      ${pulseEffect}
    ">
      <div style="background-color: ${isOffline ? '#cbd5e1' : '#ffffff'}; width: 6px; height: 6px; border-radius: 50%;"></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-vehicle-gps-marker',
    html,
    iconSize: [isSelected ? 28 : 22, isSelected ? 28 : 22],
    iconAnchor: [isSelected ? 14 : 11, isSelected ? 14 : 11]
  });
};

const LiveVehicleMap = ({ vehicles = [], selectedVehicleId, onSelectVehicle, height = '520px' }) => {
  const validVehicles = vehicles.filter(
    (v) => typeof v.latitude === 'number' && typeof v.longitude === 'number' && !isNaN(v.latitude) && !isNaN(v.longitude)
  );

  const positions = validVehicles.map((v) => [v.latitude, v.longitude]);
  const defaultCenter = positions.length > 0 ? positions[0] : [20.5937, 78.9629]; // Center of India fallback

  return (
    <div className="w-full rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative z-0" style={{ height }}>
      {/* Map Legend Overlay */}
      <div className="absolute top-3 right-3 z-[1000] bg-slate-950/90 backdrop-blur border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-3 text-[10px] font-mono text-slate-300 shadow-xl pointer-events-none">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Live ({validVehicles.filter(v => v.trackingVitality === 'LIVE').length})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>Stale ({validVehicles.filter(v => v.trackingVitality === 'STALE').length})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-500"></span>
          <span>Last-Known ({validVehicles.filter(v => v.trackingVitality === 'OFFLINE').length})</span>
        </span>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={5}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', backgroundColor: '#020617' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {positions.length > 0 && <MapBoundsFitter positions={positions} />}

        {validVehicles.map((item) => {
          const isSelected = selectedVehicleId && (
            String(item._id) === String(selectedVehicleId) ||
            (item.vehicleId && String(item.vehicleId) === String(selectedVehicleId)) ||
            (item.vehicle?._id && String(item.vehicle._id) === String(selectedVehicleId))
          );
          const regNo = item.vehicle?.registrationNumber || item.vehicleId || 'Unknown Vehicle';
          const driverName = item.driver?.name || 'Unassigned Driver';
          const shipmentId = item.shipment?.trackingNumber || item.shipment?.trackingId || 'No Active Cargo';

          return (
            <Marker
              key={item._id}
              position={[item.latitude, item.longitude]}
              icon={getVehicleIcon(item.status, item.trackingVitality, isSelected)}
              eventHandlers={{
                click: () => onSelectVehicle && onSelectVehicle(item)
              }}
            >
              <Popup className="custom-vehicle-popup">
                <div className="text-xs font-mono p-1 space-y-1.5 min-w-[200px]">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                    <div>
                      <strong className="text-cyan-400 font-bold text-sm block">{regNo}</strong>
                      {item.trackingVitality === 'OFFLINE' && (
                        <span className="text-[9px] text-slate-400 block font-normal">Last Known Location (Offline)</span>
                      )}
                      {item.trackingVitality === 'STALE' && (
                        <span className="text-[9px] text-amber-400 block font-normal">Last Known Location (Stale)</span>
                      )}
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        item.trackingVitality === 'LIVE'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : item.trackingVitality === 'STALE'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      }`}
                    >
                      {item.trackingVitality}
                    </span>
                  </div>

                  <div className="space-y-1 text-slate-200 text-[11px]">
                    <p><span className="text-slate-400">Driver: </span><strong>{driverName}</strong></p>
                    <p><span className="text-slate-400">Shipment: </span><strong className="text-purple-300">{shipmentId}</strong></p>
                    <p><span className="text-slate-400">Status: </span><strong className="text-cyan-300">{item.status}</strong></p>
                    <p><span className="text-slate-400">Speed: </span><strong className="text-emerald-300">{item.speed} km/h</strong></p>
                    <p><span className="text-slate-400">Last Update: </span>{new Date(item.lastUpdated).toLocaleTimeString()}</p>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default LiveVehicleMap;
