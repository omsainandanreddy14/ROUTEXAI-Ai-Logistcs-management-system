import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import ShipmentCard from '../../components/ui/ShipmentCard';
import EmptyState from '../../components/ui/EmptyState';
import { Package } from 'lucide-react';

const CustomerHistory = () => {
  const [shipments, setShipments] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axiosInstance.get('/shipments');
        if (res.data && Array.isArray(res.data.data)) {
          setShipments(res.data.data.filter((s) => s.status === 'DELIVERED'));
        }
      } catch (err) {
        setShipments([]);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-100 tracking-tight">Delivery Order History</h1>
        <p className="text-xs text-slate-400 mt-1">Past completed shipments & freight invoices</p>
      </div>

      {shipments.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No Delivered Orders Found"
          description="You currently have no completed or delivered shipments in your account history."
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

export default CustomerHistory;
