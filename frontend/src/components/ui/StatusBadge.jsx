import React from 'react';
import { Clock, Truck, CheckCircle2, AlertTriangle, XCircle, Navigation, ShieldCheck, Box } from 'lucide-react';

const StatusBadge = ({ status }) => {
  const getStatusConfig = (st) => {
    switch (st) {
      case 'CREATED':
        return {
          label: 'Created',
          styles: 'bg-slate-800 text-slate-300 border-slate-700',
          icon: Box
        };
      case 'CONFIRMED':
        return {
          label: 'Confirmed',
          styles: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          icon: ShieldCheck
        };
      case 'VEHICLE_ASSIGNED':
        return {
          label: 'Vehicle Assigned',
          styles: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          icon: Truck
        };
      case 'PICKED_UP':
        return {
          label: 'Picked Up',
          styles: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
          icon: Clock
        };
      case 'IN_TRANSIT':
      case 'DISPATCHED':
        return {
          label: 'In Transit',
          styles: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse',
          icon: Navigation
        };
      case 'DELAYED':
        return {
          label: 'Delayed',
          styles: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          icon: AlertTriangle
        };
      case 'NEAR_DESTINATION':
        return {
          label: 'Near Destination',
          styles: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
          icon: Navigation
        };
      case 'DELIVERED':
        return {
          label: 'Delivered',
          styles: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: CheckCircle2
        };
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          styles: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          icon: XCircle
        };
      default:
        return {
          label: st || 'Pending',
          styles: 'bg-slate-800 text-slate-400 border-slate-700',
          icon: Clock
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${config.styles}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{config.label}</span>
    </span>
  );
};

export default StatusBadge;
