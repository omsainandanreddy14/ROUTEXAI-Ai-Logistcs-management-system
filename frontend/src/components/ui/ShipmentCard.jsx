import React from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { MapPin, ArrowRight, Compass } from 'lucide-react';

const ShipmentCard = ({ shipment, onViewDetails, onAssign, showPlanRoute = false }) => {
  const formatAddr = (addr, defaultCity) => {
    if (!addr) return defaultCity || 'Location Details';
    if (typeof addr === 'string') return addr;
    return [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
  };

  const trackingText = shipment.trackingId || shipment.trackingNumber;
  const pickupCity = shipment.pickupAddress?.city || shipment.pickupCity || 'Customer Pickup Location';
  const deliveryCity = shipment.deliveryAddress?.city || shipment.deliveryCity || 'Customer Delivery Location';

  const pickupAddrText = formatAddr(shipment.pickupAddress, pickupCity);
  const deliveryAddrText = formatAddr(shipment.deliveryAddress, deliveryCity);

  const srcCoords = shipment.pickupLocation?.coordinates || [78.4867, 17.3850];
  const destCoords = shipment.deliveryLocation?.coordinates || [80.2707, 13.0827];

  const driverText = shipment.driverName || shipment.driver?.name || 'Unassigned';
  const vehicleText = shipment.vehicleReg || shipment.vehicle?.registrationNumber || 'Unassigned';
  const customerText = shipment.customerName || shipment.customer?.name || 'Customer Dispatch';

  const priorityColor =
    shipment.priority === 'URGENT'
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
      : shipment.priority === 'HIGH'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      : 'bg-slate-800 text-slate-400 border-slate-700';

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-cyan-400">{trackingText}</span>
          {shipment.priority && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${priorityColor}`}>
              {shipment.priority}
            </span>
          )}
          <span className="text-xs text-slate-400">• {customerText}</span>
        </div>
        <StatusBadge status={shipment.status} />
      </div>

      {/* Route & Location Cards */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Customer Pickup</span>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded font-bold">
                {shipment.pickupLocationType === 'COMPANY_HUB' ? 'Company Hub' : 'Customer Location'}
              </span>
            </div>
            <p className="font-bold text-slate-200">{pickupCity}</p>
            <p className="text-[11px] text-slate-400 truncate">{pickupAddrText}</p>
            <p className="text-[10px] font-mono text-emerald-400 font-semibold">
              Coords: {srcCoords[1]?.toFixed(4)}, {srcCoords[0]?.toFixed(4)}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Customer Delivery</span>
              <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.2 rounded font-bold">
                {shipment.deliveryLocationType === 'COMPANY_HUB' ? 'Company Hub' : 'Customer Location'}
              </span>
            </div>
            <p className="font-bold text-slate-200">{deliveryCity}</p>
            <p className="text-[11px] text-slate-400 truncate">{deliveryAddrText}</p>
            <p className="text-[10px] font-mono text-amber-400 font-semibold">
              Coords: {destCoords[1]?.toFixed(4)}, {destCoords[0]?.toFixed(4)}
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300 pt-1">
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Driver</span>
          <span className="font-medium text-slate-200 truncate block">{driverText}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Vehicle</span>
          <span className="font-mono text-slate-300 truncate block">{vehicleText}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Distance / ETA</span>
          <span className="font-medium text-cyan-400 truncate block">
            {shipment.estimatedDistanceKm ? `${shipment.estimatedDistanceKm} Km` : (shipment.eta || 'Calculating...')}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Est. Cost</span>
          <span className="font-bold text-slate-100 block">₹{shipment.estimatedCost}</span>
        </div>
      </div>

      {/* Footer / Actions */}
      <div className="pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <span className="text-[11px] text-slate-400 italic truncate max-w-[50%]">
          {shipment.cargoType ? `${shipment.cargoType} (${shipment.weightKg} Kg)` : `Weight: ${shipment.weightKg} Kg`}
        </span>

        <div className="flex gap-2">
          {onAssign && ['CREATED', 'PENDING', 'CONFIRMED'].includes(shipment.status) && (
            <button
              onClick={() => onAssign(shipment)}
              className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 rounded-lg text-xs font-semibold transition"
            >
              Assign Fleet
            </button>
          )}

          {showPlanRoute && (
            <Link
              to={`/owner/route-intelligence?shipmentId=${shipment._id}`}
              className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Plan Route</span>
            </Link>
          )}

          {onViewDetails && (
            <button
              onClick={() => onViewDetails(shipment)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
            >
              <span>Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShipmentCard;
