import React from 'react';
import { BarChart3, TrendingUp, DollarSign, PackageCheck, Clock } from 'lucide-react';
import StatCard from '../../components/ui/StatCard';

const AnalyticsView = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-100 tracking-tight">Logistics Analytics & Reports</h1>
        <p className="text-xs text-slate-400 mt-1">Fleet utilization metrics, delivery efficiency & regional performance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="On-Time Delivery Rate" value="98.4%" icon={TrendingUp} color="emerald" change="+2.1% this month" />
        <StatCard title="Average Transit Speed" value="58 Km/h" icon={Clock} color="cyan" subtitle="Pan-India average" />
        <StatCard title="Fleet Utilization" value="84.2%" icon={BarChart3} color="purple" subtitle="Active cargo capacity" />
        <StatCard title="Total Freight Revenue" value="₹14.8 L" icon={DollarSign} color="blue" change="+18.5% YoY" />
      </div>

      {/* Analytics Chart Placeholder */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-slate-100">Regional Delivery Throughput (Monthly)</h2>
        <div className="h-64 bg-slate-950 border border-slate-800 rounded-2xl p-6 flex items-center justify-center text-center">
          <div className="space-y-2">
            <BarChart3 className="w-12 h-12 text-purple-400 mx-auto animate-pulse" />
            <p className="text-sm font-bold text-slate-200">Recharts Analytics Integration Placeholder</p>
            <p className="text-xs text-slate-400">Interactive freight volume charts across Delhi, Mumbai, Bengaluru & Chennai hubs</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsView;
