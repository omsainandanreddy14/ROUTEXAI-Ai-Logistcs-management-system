import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { User, Building, MapPin, Mail, Phone, FileText } from 'lucide-react';

const CustomerProfile = () => {
  const { user } = useContext(AuthContext);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-100 tracking-tight">Customer Account & Profile</h1>
        <p className="text-xs text-slate-400 mt-1">Manage company details, GSTIN & default billing address</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-bold text-xl text-white">
            {user?.name ? user.name[0] : 'A'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">{user?.name || 'Anita Sharma'}</h2>
            <span className="text-xs text-cyan-400 font-semibold">{user?.email || 'customer@routexai.com'}</span>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-300">
          <div className="flex justify-between py-2 border-b border-slate-800/60">
            <span className="text-slate-500">Company Name:</span>
            <span className="font-semibold text-slate-100">Apex Electronics Pvt Ltd</span>
          </div>

          <div className="flex justify-between py-2 border-b border-slate-800/60">
            <span className="text-slate-500">GSTIN Registration:</span>
            <span className="font-mono text-slate-100">27AAAAA0000A1Z5</span>
          </div>

          <div className="flex justify-between py-2 border-b border-slate-800/60">
            <span className="text-slate-500">Primary Contact Phone:</span>
            <span className="font-mono text-slate-100">{user?.phone || '+91 98989 89898'}</span>
          </div>

          <div className="flex justify-between py-2">
            <span className="text-slate-500">Default Origin Address:</span>
            <span className="font-medium text-slate-200">Electronic City, Bengaluru, Karnataka (560100)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerProfile;
