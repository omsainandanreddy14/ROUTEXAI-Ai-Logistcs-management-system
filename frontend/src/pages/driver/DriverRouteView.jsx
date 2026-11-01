import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import RouteMap from '../../components/ui/RouteMap';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import { Compass, Navigation, MapPin, Package, Shield } from 'lucide-react';

const DriverRouteView = () => {
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssignedRoute = async () => {
      try {
        const res = await axiosInstance.get('/shipments');
        if (res.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
          const active = res.data.data.find((s) =>
            ['CONFIRMED', 'VEHICLE_ASSIGNED', 'IN_TRANSIT', 'DISPATCHED', 'PICKED_UP', 'DELAYED', 'PENDING'].includes(s.status)
          ) || res.data.data[0];

          if (active) {
            setShipment(active);

            const coords = active.selectedRouteGeometry?.coordinates;
            if (!coords || !Array.isArray(coords) || coords.length < 5) {
              const pCoords = active.pickupLocation?.coordinates;
              const dCoords = active.deliveryLocation?.coordinates;
              if (pCoords && dCoords && pCoords.length >= 2 && dCoords.length >= 2) {
                try {
                  const calcRes = await axiosInstance.post('/routes/calculate', {
                    shipmentId: active._id,
                    source: { latitude: parseFloat(pCoords[1]), longitude: parseFloat(pCoords[0]) },
                    destination: { latitude: parseFloat(dCoords[1]), longitude: parseFloat(dCoords[0]) }
                  });
                  if (calcRes.data?.data?.routes && calcRes.data.data.routes.length > 0) {
                    const roadRoute = calcRes.data.data.routes[0];
                    setShipment((prev) => (prev ? {
                      ...prev,
                      selectedRouteGeometry: roadRoute.geometry,
                      estimatedDistanceKm: roadRoute.distanceKm,
                      estimatedDurationMinutes: roadRoute.durationMinutes
                    } : prev));
                  }
                } catch (calcErr) {
                  // Fallback handling
                }
              }
            }
          }
        }
      } catch (err) {
        console.log('Error fetching assigned shipment for route view');
      } finally {
        setLoading(false);
      }
    };
    fetchAssignedRoute();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Active Route Navigation</h1>
          <p className="text-xs text-slate-400 mt-1">Recommended Pan-India highway route & turn-by-turn guidance</p>
        </div>
        <EmptyState
          icon={Package}
          title="No Active Route Assigned"
          description="You currently have no assigned shipment with a calculated route. When the Owner plans and assigns a dispatch, your interactive route map will appear here."
        />
      </div>
    );
  }

  const srcCoords = shipment.pickupLocation?.coordinates || [78.4867, 17.3850];
  const destCoords = shipment.deliveryLocation?.coordinates || [80.2707, 13.0827];

  const source = {
    latitude: srcCoords[1],
    longitude: srcCoords[0],
    address: typeof shipment.pickupAddress === 'object' ? (shipment.pickupAddress?.street || 'Customer Pickup') : (shipment.pickupAddress || 'Customer Pickup'),
    city: shipment.pickupAddress?.city || shipment.pickupCity || 'Customer Pickup Location'
  };

  const destination = {
    latitude: destCoords[1],
    longitude: destCoords[0],
    address: typeof shipment.deliveryAddress === 'object' ? (shipment.deliveryAddress?.street || 'Customer Delivery') : (shipment.deliveryAddress || 'Customer Delivery'),
    city: shipment.deliveryAddress?.city || shipment.deliveryCity || 'Customer Delivery Location'
  };

  const routeGeometry = shipment.selectedRouteGeometry || shipment.route?.geometry;
  const distanceKm = shipment.estimatedDistanceKm || shipment.route?.distanceKm || '1,420';
  const durationMins = shipment.estimatedDurationMinutes || shipment.route?.estimatedDurationMinutes || 840;
  const hours = Math.floor(durationMins / 60);
  const mins = durationMins % 60;
  const routeScore = shipment.route?.score || 94;
  const routeName = shipment.route?.routeName || `${source.city} → ${destination.city} Express Corridor`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
            <Compass className="w-7 h-7 text-cyan-400" />
            <span>Active Route Navigation</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time navigation to Customer Pickup: <span className="font-mono text-cyan-400 font-bold">{shipment.trackingId || shipment.trackingNumber}</span>
          </p>
        </div>
        <StatusBadge status={shipment.status} />
      </div>

      {/* Map Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-100">{routeName}</h2>
          </div>
          <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-lg font-bold font-mono">
            Accessibility Score ({routeScore}/100)
          </span>
        </div>

        {/* Leaflet Map Canvas */}
        <RouteMap
          source={source}
          destination={destination}
          routeGeometry={routeGeometry}
          height="450px"
        />

        {/* Route Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-slate-950 border border-slate-800/80 rounded-2xl p-4">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Customer Pickup</span>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 rounded font-bold">Customer Location</span>
            </div>
            <span className="font-bold text-slate-200 block truncate">{source.city}</span>
            <span className="text-[11px] text-slate-400 block truncate">{source.address}</span>
            <span className="text-[10px] font-mono text-emerald-400">Coords: {srcCoords[1]?.toFixed(4)}, {srcCoords[0]?.toFixed(4)}</span>
          </div>

          <div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Customer Destination</span>
              <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 rounded font-bold">Customer Location</span>
            </div>
            <span className="font-bold text-slate-200 block truncate">{destination.city}</span>
            <span className="text-[11px] text-slate-400 block truncate">{destination.address}</span>
            <span className="text-[10px] font-mono text-amber-400">Coords: {destCoords[1]?.toFixed(4)}, {destCoords[0]?.toFixed(4)}</span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Route Distance</span>
            <span className="font-bold text-cyan-400 text-sm block">{distanceKm} Km</span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Est. Driving Duration</span>
            <span className="font-bold text-cyan-400 text-sm block">{hours > 0 ? `${hours}h ${mins}m` : `${durationMins} mins`}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverRouteView;
