import React, { useState } from 'react';
import { Truck, User, Package, Navigation, Clock, Activity, Search, ShieldCheck, AlertTriangle, WifiOff } from 'lucide-react';

const VehicleTrackingPanel = ({ vehicles = [], selectedVehicle, onSelectVehicle }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVehicles = vehicles.filter((v) => {
    const query = searchQuery.toLowerCase();
    const regNo = (v.vehicle?.registrationNumber || v.vehicleId || '').toLowerCase();
    const driverName = (v.driver?.name || '').toLowerCase();
    const shipmentId = (v.shipment?.trackingNumber || v.shipment?.trackingId || '').toLowerCase();
    const status = (v.status || '').toLowerCase();
    return regNo.includes(query) || driverName.includes(query) || shipmentId.includes(query) || status.includes(query);
  });

  const getStatusBadgeClass = (status) => {
    if (status === 'IN_TRANSIT') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (status === 'ASSIGNED') return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    if (status === 'IDLE') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (status === 'MAINTENANCE') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (status === 'OFFLINE') return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
  };

  const getVitalityIcon = (vitality) => {
    if (vitality === 'LIVE') return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
    if (vitality === 'STALE') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
    return <WifiOff className="w-3.5 h-3.5 text-rose-400" />;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Truck className="w-5 h-5 text-cyan-400" />
          <span>Active Fleet Telemetry Stream</span>
        </h2>
        <span className="text-xs font-mono text-cyan-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
          {vehicles.length} Monitored
        </span>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter vehicle reg, driver, or shipment..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
        />
      </div>

      {/* Selected Vehicle Overview Spotlight Card */}
      {selectedVehicle && (
        <div className="bg-slate-950 border border-cyan-500/40 rounded-2xl p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <span className="text-[10px] text-cyan-400 uppercase font-bold block">Selected Vehicle Details</span>
              <h3 className="text-base font-bold text-slate-100 mt-0.5">
                {selectedVehicle.vehicle?.registrationNumber || selectedVehicle.vehicleId}
              </h3>
            </div>
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${getStatusBadgeClass(selectedVehicle.status)}`}>
              {selectedVehicle.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px]">
            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Driver:</span>
              <strong className="text-slate-100">{selectedVehicle.driver?.name || 'Unassigned'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Shipment:</span>
              <strong className="text-purple-300">{selectedVehicle.shipment?.trackingNumber || selectedVehicle.shipment?.trackingId || 'None'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Current Speed:</span>
              <strong className="text-emerald-400 text-sm">{selectedVehicle.speed} km/h</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Telemetry State:</span>
              <div className="flex items-center gap-1">
                {getVitalityIcon(selectedVehicle.trackingVitality)}
                <strong className={selectedVehicle.trackingVitality === 'LIVE' ? 'text-emerald-400' : selectedVehicle.trackingVitality === 'STALE' ? 'text-amber-400' : 'text-rose-400'}>
                  {selectedVehicle.trackingVitality}
                </strong>
              </div>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 block text-[9px] uppercase">
                {selectedVehicle.trackingVitality === 'LIVE' ? 'GPS Coordinates:' : 'Last Known GPS Coordinates:'}
              </span>
              <span className="text-slate-300">{selectedVehicle.latitude?.toFixed(4)}, {selectedVehicle.longitude?.toFixed(4)}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 block text-[9px] uppercase">Last Updated:</span>
              <span className="text-slate-400">
                {new Date(selectedVehicle.lastUpdated).toLocaleString()}
                {selectedVehicle.trackingVitality === 'OFFLINE' && <span className="text-rose-400 font-bold ml-1.5">(Offline)</span>}
                {selectedVehicle.trackingVitality === 'STALE' && <span className="text-amber-400 font-bold ml-1.5">(Stale)</span>}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle List */}
      <div className="space-y-2.5 overflow-y-auto max-h-[340px] pr-1">
        {filteredVehicles.length > 0 ? (
          filteredVehicles.map((item) => {
            const isSelected = selectedVehicle && (
              String(selectedVehicle._id) === String(item._id) ||
              (selectedVehicle.vehicleId && item.vehicleId && String(selectedVehicle.vehicleId) === String(item.vehicleId)) ||
              (selectedVehicle.vehicle?._id && item.vehicle?._id && String(selectedVehicle.vehicle._id) === String(item.vehicle._id))
            );
            return (
              <div
                key={item._id}
                onClick={() => onSelectVehicle && onSelectVehicle(item)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col space-y-2 ${
                  isSelected
                    ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" />
                    <span>{item.vehicle?.registrationNumber || item.vehicleId}</span>
                  </span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getStatusBadgeClass(item.status)}`}>
                      {item.status}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                      item.trackingVitality === 'LIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : item.trackingVitality === 'STALE'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      {getVitalityIcon(item.trackingVitality)}
                      <span>{item.trackingVitality}</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
                  <div className="flex items-center gap-1.5 text-slate-400 truncate">
                    <User className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="truncate">{item.driver?.name || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 truncate">
                    <Package className="w-3 h-3 text-purple-400 shrink-0" />
                    <span className="truncate text-purple-300">{item.shipment?.trackingNumber || item.shipment?.trackingId || 'No Cargo'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 font-bold">{item.speed} km/h</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>
                      {new Date(item.lastUpdated).toLocaleTimeString()}
                      {item.trackingVitality === 'OFFLINE' && <span className="text-rose-400 text-[9px] ml-1">(Offline)</span>}
                      {item.trackingVitality === 'STALE' && <span className="text-amber-400 text-[9px] ml-1">(Stale)</span>}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-center text-slate-500 text-xs font-mono">
            No active vehicles match search criteria.
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleTrackingPanel;
