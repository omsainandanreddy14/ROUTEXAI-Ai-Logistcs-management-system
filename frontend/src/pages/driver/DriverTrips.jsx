import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import ShipmentCard from '../../components/ui/ShipmentCard';
import EmptyState from '../../components/ui/EmptyState';
import { History, Package } from 'lucide-react';

const DriverTrips = () => {
  const [shipments, setShipments] = useState([]);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const res = await axiosInstance.get('/shipments');
        if (res.data && Array.isArray(res.data.data)) {
          setShipments(res.data.data);
        } else {
          setShipments([]);
        }
      } catch (err) {
        setShipments([]);
      }
    };
    fetchTrips();
    const interval = setInterval(fetchTrips, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-100 tracking-tight">Driver Trip History</h1>
        <p className="text-xs text-slate-400 mt-1">Past completed deliveries & transit records</p>
      </div>

      {shipments.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No Trips Found"
          description="There are currently no trip records assigned to your driver account."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shipments.map((s) => (
            <ShipmentCard key={s._id || s.trackingNumber} shipment={s} />
          ))}
        </div>
      )}
    </div>
  );
};

export default DriverTrips;
