import React from 'react';
import { Truck, ShieldCheck, Fuel, User } from 'lucide-react';

const VehicleCard = ({ vehicle, onEdit }) => {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'ON_TRIP':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'MAINTENANCE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg space-y-3 transition">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold font-mono text-slate-100">{vehicle.registrationNumber}</h3>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">{vehicle.vehicleType}</span>
          </div>
        </div>
        <span className={`px-2.5 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadge(vehicle.status)}`}>
          {vehicle.status}
        </span>
      </div>

      <div className="text-xs text-slate-400 space-y-2 pt-2 border-t border-slate-800">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">Payload Capacity:</span>
          <span className="font-semibold text-slate-200">{vehicle.capacityKg} Kg</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">Fuel Type:</span>
          <span className="font-semibold text-slate-200">{vehicle.fuelType}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">Assigned Driver:</span>
          {(() => {
            const isAssigned = vehicle.status === 'ON_TRIP' && (vehicle.assignedDriverName || vehicle.assignedDriver?.name || vehicle.assignedDriver?.user?.name);
            const driverName = vehicle.assignedDriverName || vehicle.assignedDriver?.name || vehicle.assignedDriver?.user?.name;
            return (
              <span className={`font-semibold ${isAssigned && driverName && driverName !== 'Unassigned' ? 'text-cyan-400' : 'text-slate-400 font-mono'}`}>
                {isAssigned && driverName && driverName !== 'Unassigned' ? driverName : 'Unassigned'}
              </span>
            );
          })()}
        </div>
        {vehicle.currentLocationName && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Location:</span>
            <span className="font-medium text-slate-300 truncate max-w-[150px]">{vehicle.currentLocationName}</span>
          </div>
        )}
      </div>

      {onEdit && (
        <button
          onClick={() => onEdit(vehicle)}
          className="w-full mt-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
        >
          Manage Vehicle
        </button>
      )}
    </div>
  );
};

export default VehicleCard;
