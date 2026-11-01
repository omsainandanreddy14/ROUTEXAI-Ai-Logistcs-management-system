import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import StatCard from '../../components/ui/StatCard';
import StatusBadge from '../../components/ui/StatusBadge';
import AlertCard from '../../components/ui/AlertCard';
import { MOCK_ALERTS, MOCK_AI_INSIGHTS, MOCK_SHIPMENTS, MOCK_VEHICLES, MOCK_HUBS } from '../../data/mockData';
import {
  Package,
  Truck,
  Building2,
  Users,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  MapPin,
  Compass,
  AlertTriangle,
  Brain,
  Clock,
  Navigation,
  CheckCircle2,
  BarChart2
} from 'lucide-react';
import { Link } from 'react-router-dom';

const OwnerDashboard = () => {
  const [stats, setStats] = useState({
    totalShipments: 0,
    activeShipments: 0,
    deliveredShipments: 0,
    delayedShipments: 0,
    availableVehicles: 0,
    vehiclesInTransit: 0,
    totalDrivers: 0,
    activeRoutes: 0
  });

  const [recentShipments, setRecentShipments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLiveData = async () => {
      try {
        const [shipmentsRes, vehiclesRes, driversRes] = await Promise.all([
          axiosInstance.get('/shipments').catch(() => null),
          axiosInstance.get('/vehicles').catch(() => null),
          axiosInstance.get('/drivers').catch(() => null)
        ]);
        if (shipmentsRes && shipmentsRes.data && Array.isArray(shipmentsRes.data.data)) {
          const apiShipments = shipmentsRes.data.data;
          setRecentShipments(apiShipments);
          setStats((prev) => ({
            ...prev,
            totalShipments: apiShipments.length,
            activeShipments: apiShipments.filter(s => ['IN_TRANSIT', 'DISPATCHED', 'PICKED_UP', 'DELAYED', 'VEHICLE_ASSIGNED', 'CREATED', 'PENDING'].includes(s.status)).length,
            deliveredShipments: apiShipments.filter(s => s.status === 'DELIVERED').length,
            delayedShipments: apiShipments.filter(s => s.status === 'DELAYED').length,
          }));
        } else {
          setRecentShipments([]);
        }
        if (vehiclesRes && vehiclesRes.data && Array.isArray(vehiclesRes.data.data)) {
          const apiVehicles = vehiclesRes.data.data;
          setVehicles(apiVehicles);
          setStats((prev) => ({
            ...prev,
            availableVehicles: apiVehicles.filter(v => v.status === 'AVAILABLE').length,
            vehiclesInTransit: apiVehicles.filter(v => v.status === 'ON_TRIP').length,
          }));
        }
        if (driversRes && driversRes.data && Array.isArray(driversRes.data.data)) {
          setStats((prev) => ({
            ...prev,
            totalDrivers: driversRes.data.data.length
          }));
        }
      } catch (err) {
        setRecentShipments([]);
      }
    };
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Owner Command Center</h1>
          <p className="text-xs text-slate-400 mt-1">
            Pan-India Logistics Operations, Fleet Monitoring & AI Intelligence Network
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="w-4 h-4 animate-pulse" />
            National Network Active
          </span>
        </div>
      </div>

      {/* 8 KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Shipments" value={stats.totalShipments} icon={Package} color="cyan" change="+12% this week" />
        <StatCard title="Active Shipments" value={stats.activeShipments} icon={Navigation} color="blue" subtitle="In-transit across corridors" />
        <StatCard title="Delivered Orders" value={stats.deliveredShipments} icon={CheckCircle2} color="emerald" change="98.4% on-time" />
        <StatCard title="Delayed Dispatches" value={stats.delayedShipments} icon={AlertTriangle} color="amber" subtitle="Disruption alerts flagged" />
        <StatCard title="Available Vehicles" value={stats.availableVehicles} icon={Truck} color="emerald" subtitle="Ready for dispatch" />
        <StatCard title="Vehicles In Transit" value={stats.vehiclesInTransit} icon={Truck} color="purple" subtitle="Active on Pan-India routes" />
        <StatCard title="Registered Drivers" value={stats.totalDrivers} icon={Users} color="blue" subtitle="Assigned active staff" />
        <StatCard title="Active Corridors" value={stats.activeRoutes} icon={Compass} color="cyan" subtitle="Pan-India transit paths" />
      </div>

      {/* Main Grid: Interactive Map Placeholder + AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pan-India Map Placeholder (Spans 2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden min-h-[380px]">
          <div className="flex items-center justify-between z-10">
            <div>
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-bold text-slate-100">Pan-India Interactive Logistics Map</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Real-time hub nodes, active vehicles & transit corridors</p>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-mono px-2.5 py-1 rounded bg-slate-950 text-cyan-400 border border-cyan-500/30">
              Phase 2 Map Placement
            </span>
          </div>

          {/* Interactive Map Visual Placeholder */}
          <div className="my-6 flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden group">
            {/* Grid Pattern overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>

            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3 shadow-lg shadow-cyan-500/10 z-10">
              <MapPin className="w-8 h-8 animate-bounce" />
            </div>

            <h3 className="text-base font-bold text-slate-200 z-10">Interactive Leaflet / OpenStreetMap Integration Point</h3>
            <p className="text-xs text-slate-400 max-w-md mt-1 z-10">
              In Phase 2, this container will render live spatial routes across Delhi, Mumbai, Bengaluru, Chennai, Kolkata, Hyderabad, Guwahati & Pune.
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2 z-10">
              <span className="text-[11px] bg-slate-900 border border-slate-700 text-slate-300 px-3 py-1 rounded-lg">
                📍 8 Active Hub Nodes
              </span>
              <span className="text-[11px] bg-slate-900 border border-slate-700 text-slate-300 px-3 py-1 rounded-lg">
                🚚 15 Live GPS Fleet Stream
              </span>
              <span className="text-[11px] bg-slate-900 border border-slate-700 text-slate-300 px-3 py-1 rounded-lg">
                🛣️ Corridor Risk Heatmap
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3 z-10">
            <span>Status: Phase 1 Layout Verified</span>
            <Link to="/owner/live-tracking" className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1">
              <span>Open Live Tracking Console</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* AI Insights & Disruption Alerts Sidebar */}
        <div className="space-y-6">
          {/* AI Insights Placeholder */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-slate-100">AI Route Intelligence</h3>
              </div>
              <span className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded font-mono font-bold">
                Phase 3 Engine
              </span>
            </div>

            <div className="space-y-3">
              {MOCK_AI_INSIGHTS.map((ai) => (
                <div key={ai.id} className="bg-slate-950/80 border border-purple-500/20 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-purple-300">{ai.title}</span>
                    <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded font-mono">
                      Conf: {ai.confidence}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">"{ai.insight}"</p>
                </div>
              ))}
            </div>
          </div>

          {/* Logistics Alerts */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-100">Active Network Alerts</h3>
              </div>
              <Link to="/owner/alerts" className="text-xs text-cyan-400 hover:underline">View All</Link>
            </div>

            <div className="space-y-3">
              {MOCK_ALERTS.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Shipments & Vehicle Fleet Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Shipments Table (Spans 2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Recent Dispatches</h2>
              <p className="text-xs text-slate-400">Latest active shipments across Indian hubs</p>
            </div>
            <Link
              to="/owner/shipments"
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <span>Manage All Shipments</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Tracking ID</th>
                  <th className="py-3 px-4">Origin</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4">Driver</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {recentShipments.map((s) => (
                  <tr key={s._id || s.trackingNumber} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-semibold text-cyan-400">{s.trackingId || s.trackingNumber}</td>
                    <td className="py-3.5 px-4">{s.pickupAddress?.city || s.pickupCity || s.originCity || 'Customer Pickup'}</td>
                    <td className="py-3.5 px-4">{s.deliveryAddress?.city || s.deliveryCity || s.destinationCity || 'Customer Delivery'}</td>
                    <td className="py-3.5 px-4">{s.driverName || s.driver?.name || 'Unassigned'}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-200">₹{s.estimatedCost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vehicle Fleet Status Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100">Fleet Availability</h2>
            <Link to="/owner/vehicles" className="text-xs text-cyan-400 hover:underline">View Fleet</Link>
          </div>

          <div className="space-y-3">
            {vehicles.map((v) => (
              <div key={v._id || v.registrationNumber} className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-mono text-xs font-bold text-slate-100">{v.registrationNumber}</h4>
                    <p className="text-[10px] text-slate-500">{v.vehicleType} • {v.capacityKg} Kg</p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  v.status === 'AVAILABLE'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : v.status === 'ON_TRIP'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  {v.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboard;
