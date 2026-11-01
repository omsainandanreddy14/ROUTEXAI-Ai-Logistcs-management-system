import React, { useState, useEffect, useContext } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { AuthContext } from '../../context/AuthContext';
import ShipmentCard from '../../components/ui/ShipmentCard';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import { MOCK_SHIPMENTS } from '../../data/mockData';
import { Package, Search, PlusCircle, MapPin, ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const CustomerDashboard = () => {
  const { user } = useContext(AuthContext);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTracking, setSearchTracking] = useState('');
  const [trackedResult, setTrackedResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [selectedDetails, setSelectedDetails] = useState(null);

  useEffect(() => {
    const fetchCustomerShipments = async () => {
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
    fetchCustomerShipments();
  }, []);

  const [trackedEta, setTrackedEta] = useState(null);

  const handleTrackSearch = async (e) => {
    e.preventDefault();
    if (!searchTracking.trim()) return;
    setSearchError('');
    setTrackedResult(null);
    setTrackedEta(null);

    let found = shipments.find(s => s.trackingNumber.toUpperCase() === searchTracking.trim().toUpperCase());
    if (!found) {
      try {
        const res = await axiosInstance.get(`/shipments/${searchTracking.trim()}`);
        if (res.data.data) {
          found = res.data.data;
        }
      } catch (err) {
        setSearchError('No shipment dispatch found matching this tracking ID.');
      }
    }

    if (found) {
      setTrackedResult(found);
      try {
        const etaRes = await axiosInstance.get(`/eta-monitoring/shipment/${found._id || found.trackingNumber}`);
        if (etaRes.data?.success) {
          setTrackedEta(etaRes.data.data);
        }
      } catch (e) {
        // Non-blocking ETA fetch
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Customer Logistics Portal</h1>
          <p className="text-xs text-slate-400 mt-1">Book freight dispatches and track shipments across India</p>
        </div>
        <Link
          to="/customer/create-shipment"
          className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-5 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Book New Freight Shipment</span>
        </Link>
      </div>

      {/* Instant Tracker Input */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Instant Shipment Tracker</h2>
        <form onSubmit={handleTrackSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTracking}
              onChange={(e) => setSearchTracking(e.target.value)}
              placeholder="Enter Tracking ID (e.g. RTX-998811 or RTX-774422)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-11 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition"
          >
            Track Shipment
          </button>
        </form>

        {searchError && <p className="text-xs text-rose-400 font-medium">{searchError}</p>}

        {trackedResult && (
          <div className="bg-slate-950 border border-cyan-500/30 rounded-2xl p-5 mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Tracking Number</span>
                <p className="font-mono text-lg font-bold text-cyan-400">{trackedResult.trackingNumber}</p>
              </div>
              <StatusBadge status={trackedResult.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300 pt-2 border-t border-slate-800">
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-semibold">Customer Pickup Location</span>
                <p className="font-semibold text-slate-200">{trackedResult.pickupAddress?.city || trackedResult.pickupCity || trackedResult.originCity || 'Customer Pickup'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-semibold">Customer Delivery Location</span>
                <p className="font-semibold text-slate-200">{trackedResult.deliveryAddress?.city || trackedResult.deliveryCity || trackedResult.destinationCity || 'Customer Delivery'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-semibold">Planned Delivery Arrival</span>
                <p className="font-semibold text-slate-300">
                  {trackedEta?.plannedETA
                    ? new Date(trackedEta.plannedETA).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                    : (trackedResult.eta || 'Scheduled')}
                </p>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-semibold">Live Estimated Arrival</span>
                <p className="font-semibold text-cyan-400">
                  {trackedEta?.currentETA
                    ? new Date(trackedEta.currentETA).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                    : (trackedResult.eta || 'In Transit')}
                </p>
                {trackedEta && (
                  <div className="flex items-center gap-2 mt-0.5">
                    {trackedEta.trackingVitality === 'OFFLINE' ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        PAUSED (GPS OFFLINE)
                      </span>
                    ) : (
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${trackedEta.delayMinutes > 15 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        {trackedEta.delayMinutes > 15
                          ? `${trackedEta.delayMinutes}m DELAYED`
                          : trackedEta.delayMinutes < 0
                          ? `${Math.abs(trackedEta.delayMinutes)}m EARLY`
                          : 'ON TIME'}
                      </span>
                    )}
                    <span className="text-[9px] text-slate-500">
                      {trackedEta.trackingVitality === 'OFFLINE' ? 'Last Known Snapshot' : `Updated: ${new Date(trackedEta.calculatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Customer Shipments */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">Your Recent Shipments</h2>
          <Link to="/customer/shipments" className="text-xs text-cyan-400 hover:underline">View All Orders</Link>
        </div>

        {shipments.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No Active Freight Shipments"
            description="Your shipments database is currently empty. Click 'Book New Freight Shipment' above to create one."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shipments.map((s) => (
              <ShipmentCard
                key={s._id || s.trackingNumber}
                shipment={s}
                onViewDetails={(shp) => setSelectedDetails(shp)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Shipment Details Modal */}
      {selectedDetails && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-cyan-400 font-mono font-bold">TRACKING ID</span>
                <h2 className="text-lg font-bold text-slate-100 font-mono">{selectedDetails.trackingNumber}</h2>
              </div>
              <button onClick={() => setSelectedDetails(null)} className="p-1 text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs text-slate-300">
              <p><span className="text-slate-500">Customer Pickup: </span>{selectedDetails.pickupAddress?.city || selectedDetails.pickupCity || selectedDetails.originCity || 'Customer Pickup'}</p>
              <p><span className="text-slate-500">Customer Delivery: </span>{selectedDetails.deliveryAddress?.city || selectedDetails.deliveryCity || selectedDetails.destinationCity || 'Customer Delivery'}</p>
              <p><span className="text-slate-500">Cargo Weight: </span>{selectedDetails.weightKg} Kg</p>
              <p><span className="text-slate-500">Package Type: </span>{selectedDetails.packageType}</p>
              <p><span className="text-slate-500">Status: </span><span className="text-cyan-400 font-semibold">{selectedDetails.status}</span></p>
              <p><span className="text-slate-500">ETA: </span>{selectedDetails.eta || 'Tomorrow 10:30 AM'}</p>
              <p><span className="text-slate-500">Freight Charge: </span>₹{selectedDetails.estimatedCost}</p>
            </div>

            <button
              onClick={() => setSelectedDetails(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;
