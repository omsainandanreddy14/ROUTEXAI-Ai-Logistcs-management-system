import React from 'react';
import { Building2, MapPin, Truck, Package, ArrowUpRight } from 'lucide-react';

const HubCard = ({ hub, onViewDetails }) => {
  const utilizationPercent = hub.capacity > 0 ? Math.round((hub.currentUtilization / hub.capacity) * 100) : 0;

  const getUtilizationColor = (pct) => {
    if (pct > 85) return 'bg-rose-500';
    if (pct > 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg space-y-4 transition">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100">{hub.name}</h3>
            <span className="text-[10px] bg-slate-800 text-cyan-400 px-2 py-0.5 rounded font-mono font-semibold">
              ID: {hub.code || hub.name.slice(0, 3).toUpperCase()}
            </span>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {hub.status || 'ACTIVE'}
        </span>
      </div>

      <div className="text-xs text-slate-400 space-y-1.5 pt-1">
        <div className="flex items-center gap-1.5 text-slate-300">
          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>{hub.city}, {hub.state}</span>
        </div>
        <p className="text-[11px] text-slate-500 pl-5 truncate">{hub.address}</p>
      </div>

      {/* Utilization Bar */}
      <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400 font-medium">Storage Capacity Utilization</span>
          <span className="font-semibold text-slate-200">{utilizationPercent}% ({hub.currentUtilization} / {hub.capacity})</span>
        </div>
        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getUtilizationColor(utilizationPercent)}`}
            style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 flex items-center gap-2">
          <Package className="w-4 h-4 text-cyan-400 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 uppercase">Active Shipments</p>
            <p className="font-bold text-slate-200">{hub.activeShipments || 0}</p>
          </div>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 uppercase">Assigned Fleet</p>
            <p className="font-bold text-slate-200">{hub.vehicleCount || 0} Vehicles</p>
          </div>
        </div>
      </div>

      {onViewDetails && (
        <div className="pt-2">
          <button
            onClick={() => onViewDetails(hub)}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition"
          >
            <span>View Hub Details</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default HubCard;
