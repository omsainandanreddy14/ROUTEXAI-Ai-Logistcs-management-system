import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import axiosInstance from '../../api/axiosInstance';
import { User, Shield, Star, Award, Phone, Mail } from 'lucide-react';
import { MOCK_DRIVERS } from '../../data/mockData';

const DriverProfile = () => {
  const { user } = useContext(AuthContext);
  const [driverProfile, setDriverProfile] = useState(MOCK_DRIVERS[0]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axiosInstance.get('/drivers/me');
        if (res.data && res.data.data) {
          setDriverProfile(res.data.data);
        }
      } catch (err) {
        console.log('Using mock driver profile fallback');
      }
    };
    fetchProfile();
  }, []);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-100 tracking-tight">Driver Personnel Profile</h1>
        <p className="text-xs text-slate-400 mt-1">Verified commercial transport driver credentials</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-bold text-xl text-white">
            {user?.name ? user.name[0] : 'R'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">{user?.name || driverProfile?.name || driverProfile?.user?.name}</h2>
            <span className="text-xs text-cyan-400 font-semibold">{user?.email || driverProfile?.email || driverProfile?.user?.email}</span>
            <div className="flex items-center gap-1 mt-1 text-xs text-amber-400 font-bold">
              <Star className="w-4 h-4 fill-amber-400" />
              <span>{driverProfile?.rating || 4.9} Rating (5.0 Max)</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-300">
          <div className="flex justify-between py-2 border-b border-slate-800/60">
            <span className="text-slate-500">Commercial License No:</span>
            <span className="font-mono font-bold text-slate-100">{driverProfile?.licenseNumber || 'DL-DEMO-458921'}</span>
          </div>

          <div className="flex justify-between py-2 border-b border-slate-800/60">
            <span className="text-slate-500">Driving Experience:</span>
            <span className="font-semibold text-slate-100">{driverProfile?.experienceYears || 7} Years Commercial Driving</span>
          </div>

          <div className="flex justify-between py-2 border-b border-slate-800/60">
            <span className="text-slate-500">Registered Mobile:</span>
            <span className="font-mono text-slate-100">{user?.phone || driverProfile?.user?.phone || '+91 98123 45671'}</span>
          </div>

          <div className="flex justify-between py-2">
            <span className="text-slate-500">Assigned Fleet Vehicle:</span>
            <span className="font-mono font-bold text-cyan-400">
              {(() => {
                const veh = driverProfile?.status === 'ON_TRIP' && (driverProfile?.assignedVehicle?.registrationNumber || driverProfile?.assignedVehicleReg);
                return veh && veh !== 'DL-01-RT-1001' ? veh : 'Unassigned';
              })()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverProfile;
