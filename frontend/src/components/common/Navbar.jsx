import React, { useContext, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { LogOut, Compass, Bell } from 'lucide-react';
import ConfirmModal from '../ui/ConfirmModal';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'DRIVER':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'CUSTOMER':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      default:
        return 'bg-slate-700 text-slate-300';
    }
  };

  return (
    <>
      <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Compass className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
              RouteXAI
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
              SMART LOGISTICS & ROUTE INTELLIGENCE
            </p>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            {/* Quick alert badge */}
            <div className="relative p-2 bg-slate-800/60 border border-slate-700/60 rounded-xl text-slate-400 hover:text-slate-200 transition cursor-pointer">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </div>

            {/* Profile tag */}
            <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/60 px-3 py-1.5 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 uppercase">
                {user.name ? user.name[0] : 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-200">{user.name}</div>
                <span className={`text-[10px] px-2 py-0.5 rounded border font-bold tracking-wide ${getRoleBadge(user.role)}`}>
                  {user.role}
                </span>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-3 py-2 rounded-xl transition"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </header>

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

export default Navbar;
