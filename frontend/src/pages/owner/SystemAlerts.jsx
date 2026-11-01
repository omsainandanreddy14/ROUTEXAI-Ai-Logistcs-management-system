import React from 'react';
import { AlertTriangle, Bell, ShieldCheck } from 'lucide-react';
import { MOCK_ALERTS } from '../../data/mockData';
import AlertCard from '../../components/ui/AlertCard';

const SystemAlerts = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-100 tracking-tight">System & Network Alerts</h1>
        <p className="text-xs text-slate-400 mt-1">Real-time logistics notifications, weather warnings & corridor bottlenecks</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MOCK_ALERTS.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  );
};

export default SystemAlerts;
