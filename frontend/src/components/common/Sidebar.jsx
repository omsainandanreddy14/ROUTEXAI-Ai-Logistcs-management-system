import React, { useContext, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Package,
  Compass,
  Navigation,
  Truck,
  Users,
  Building2,
  CloudRain,
  AlertTriangle,
  BarChart3,
  Brain,
  Settings,
  LogOut,
  PlusCircle,
  Search,
  History,
  User,
  Shield,
  FileText,
  Clock
} from 'lucide-react';
import ConfirmModal from '../ui/ConfirmModal';

const Sidebar = () => {
  const { user, logout } = useContext(AuthContext);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  if (!user) return null;

  const ownerLinks = [
    { name: 'Dashboard', path: '/owner/dashboard', icon: LayoutDashboard },
    { name: 'AI Dashboard', path: '/owner/ai-dashboard', icon: Brain },
    { name: 'Shipments', path: '/owner/shipments', icon: Package },
    { name: 'Book Shipment', path: '/customer/create-shipment', icon: PlusCircle },
    { name: 'Shipment Lifecycle', path: '/owner/shipment-lifecycle', icon: FileText },
    { name: 'Live ETA & Deviation', path: '/owner/eta-monitoring', icon: Clock },
    { name: 'Route Intelligence', path: '/owner/route-intelligence', icon: Compass },
    { name: 'Live Tracking', path: '/owner/live-tracking', icon: Navigation },
    { name: 'Vehicles', path: '/owner/vehicles', icon: Truck },
    { name: 'Drivers', path: '/owner/drivers', icon: Users },
    { name: 'Hubs', path: '/owner/hubs', icon: Building2 },
    { name: 'Weather', path: '/owner/weather', icon: CloudRain },
    { name: 'Alerts', path: '/owner/alerts', icon: AlertTriangle },
    { name: 'Analytics', path: '/owner/analytics', icon: BarChart3 },
    { name: 'AI Insights', path: '/owner/ai-insights', icon: Brain },
  ];

  const driverLinks = [
    { name: 'Dashboard', path: '/driver/dashboard', icon: LayoutDashboard },
    { name: 'My Trips', path: '/driver/trips', icon: History },
    { name: 'Current Shipment', path: '/driver/current-shipment', icon: Package },
    { name: 'Route', path: '/driver/route', icon: Navigation },
    { name: 'Report Issue', path: '/driver/report-issue', icon: AlertTriangle },
    { name: 'Profile', path: '/driver/profile', icon: User },
  ];

  const customerLinks = [
    { name: 'Dashboard', path: '/customer/dashboard', icon: LayoutDashboard },
    { name: 'Create Shipment', path: '/customer/create-shipment', icon: PlusCircle },
    { name: 'My Shipments', path: '/customer/shipments', icon: Package },
    { name: 'Track Shipment', path: '/customer/track', icon: Search },
    { name: 'Delivery History', path: '/customer/history', icon: History },
    { name: 'Profile', path: '/customer/profile', icon: User },
  ];

  const links =
    user.role === 'OWNER'
      ? ownerLinks
      : user.role === 'DRIVER'
      ? driverLinks
      : customerLinks;

  return (
    <>
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between py-5 px-3 shrink-0 hidden md:flex min-h-[calc(100vh-4rem)]">
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">
              Pan-India Navigation ({user.role})
            </p>
            <nav className="space-y-1">
              {links.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{link.name}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {user.role === 'OWNER' && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">
                System Administration
              </p>
              <nav className="space-y-1">
                <NavLink
                  to="/owner/settings"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  <span>Settings</span>
                </NavLink>
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Logout</span>
                </button>
              </nav>
            </div>
          )}
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-400">
          <div className="flex items-center gap-2 font-bold text-slate-200 mb-1">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>National Platform</span>
          </div>
          <p className="text-[10px] text-slate-500">Pan-India Operations Active</p>
        </div>
      </aside>

      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Confirm Logout"
        message="Are you sure you want to end your current RouteXAI session?"
        confirmText="Yes, Logout"
        isDanger={true}
        onConfirm={logout}
        onClose={() => setShowLogoutConfirm(false)}
      />
    </>
  );
};

export default Sidebar;
