import React from 'react';
import { Settings, Shield, Bell, Database, Lock } from 'lucide-react';

const SettingsView = () => {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black text-slate-100 tracking-tight">Platform System Settings</h1>
        <p className="text-xs text-slate-400 mt-1">Configure RouteXAI system parameters, API keys & database preferences</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-100">Primary Database Engine</h3>
              <p className="text-slate-400">MongoDB Atlas Cloud Connection</p>
            </div>
            <span className="text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-lg font-bold">
              Connected (cluster0)
            </span>
          </div>

          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-100">Authentication & JWT Security</h3>
              <p className="text-slate-400">Bearer JWT token validation & bcrypt hashing</p>
            </div>
            <span className="text-[11px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3 py-1 rounded-lg font-bold">
              Enforced
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-100">Operating Scope</h3>
              <p className="text-slate-400">Pan-India Single-Company Logistics Management</p>
            </div>
            <span className="text-[11px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-3 py-1 rounded-lg font-bold">
              Pan-India Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
