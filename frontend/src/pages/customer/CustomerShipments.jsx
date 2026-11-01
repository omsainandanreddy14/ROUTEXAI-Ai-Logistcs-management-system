import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import ShipmentCard from '../../components/ui/ShipmentCard';
import EmptyState from '../../components/ui/EmptyState';
import { Package } from 'lucide-react';

const CustomerShipments = () => {
  const [shipments, setShipments] = useState([]);

  useEffect(() => {
    const fetchShipments = async () => {
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
    fetchShipments();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-100 tracking-tight">My Active Freight Shipments</h1>
        <p className="text-xs text-slate-400 mt-1">All cargo orders placed on RouteXAI Pan-India network</p>
      </div>

      {shipments.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No Freight Shipments Placed"
          description="There are currently no active or historical shipments in your customer account."
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

export default CustomerShipments;
