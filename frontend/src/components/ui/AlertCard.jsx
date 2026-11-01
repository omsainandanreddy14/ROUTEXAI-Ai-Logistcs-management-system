import React from 'react';
import { AlertTriangle, CloudRain, ShieldAlert, Clock, ArrowRight } from 'lucide-react';

const AlertCard = ({ alert }) => {
  const getSeverityStyles = (sev) => {
    switch (sev) {
      case 'HIGH':
      case 'CRITICAL':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-300';
      case 'MEDIUM':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-300';
      default:
        return 'bg-blue-500/10 border-blue-500/30 text-blue-300';
    }
  };

  return (
    <div className={`border rounded-2xl p-4 space-y-2 transition ${getSeverityStyles(alert.severity)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <h4 className="font-bold text-xs">{alert.title}</h4>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-900/60 uppercase">
          {alert.severity}
        </span>
      </div>

      <p className="text-xs text-slate-300 font-medium">
        <span className="text-slate-400 font-normal">Impacted Corridor: </span>
        {alert.impactedRoute}
      </p>

      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 text-[11px] text-slate-300">
        <span className="font-semibold text-cyan-400">Recommendation: </span>
        {alert.recommendedAction}
      </div>

      <div className="flex justify-end text-[10px] text-slate-400 font-mono">
        {alert.timestamp}
      </div>
    </div>
  );
};

export default AlertCard;
