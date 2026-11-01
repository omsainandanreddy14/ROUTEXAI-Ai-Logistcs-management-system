import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { MOCK_DRIVERS } from '../../data/mockData';
import { Users, Shield, Star, Phone, Mail, Award, Truck } from 'lucide-react';

const DriversManagement = () => {
  const [drivers, setDrivers] = useState(MOCK_DRIVERS);

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const res = await axiosInstance.get('/drivers');
        if (res.data && Array.isArray(res.data.data)) {
          setDrivers(res.data.data);
        }
      } catch (err) {
        console.log('Using mock drivers fallback');
      }
    };
    fetchDrivers();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-100 tracking-tight">Driver Personnel Directory</h1>
        <p className="text-xs text-slate-400 mt-1">
          Pan-India commercial driver licenses, experience ratings & trip status
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map((d) => (
          <div key={d._id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                  {d.name ? d.name[0] : 'D'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-100">{d.name || d.user?.name}</h3>
                  <span className="text-[10px] text-slate-400 font-mono">{d.licenseNumber}</span>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                d.status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {d.status}
              </span>
            </div>

            <div className="text-xs text-slate-300 space-y-2 pt-2 border-t border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Rating & Experience:</span>
                <span className="font-bold text-amber-400">{d.rating || 4.9} ★ ({d.experienceYears} Years)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contact Phone:</span>
                <span className="font-mono text-slate-200">{d.phone || d.user?.phone || '+91 98123 45678'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Transport:</span>
                {(() => {
                  const isAssigned = d.status === 'ON_TRIP' && (d.assignedVehicleReg || d.assignedVehicle?.registrationNumber);
                  const vehReg = d.assignedVehicleReg || d.assignedVehicle?.registrationNumber;
                  return (
                    <span className={`font-mono ${isAssigned && vehReg && vehReg !== 'Unassigned' ? 'text-cyan-400 font-bold' : 'text-slate-400'}`}>
                      {isAssigned && vehReg && vehReg !== 'Unassigned' ? vehReg : 'Unassigned'}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DriversManagement;
