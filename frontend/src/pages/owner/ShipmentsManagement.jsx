import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import ShipmentCard from '../../components/ui/ShipmentCard';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import { MOCK_SHIPMENTS, MOCK_DRIVERS, MOCK_VEHICLES } from '../../data/mockData';
import { Package, Search, Filter, PlusCircle, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const ShipmentsManagement = () => {
  const [shipments, setShipments] = useState([]);
  const [driversList, setDriversList] = useState(MOCK_DRIVERS);
  const [vehiclesList, setVehiclesList] = useState(MOCK_VEHICLES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [assignModal, setAssignModal] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [notification, setNotification] = useState(null);

  const fetchAllData = async () => {
    try {
      const [shipRes, drvRes, vehRes] = await Promise.all([
        axiosInstance.get('/shipments').catch(() => null),
        axiosInstance.get('/drivers').catch(() => null),
        axiosInstance.get('/vehicles').catch(() => null)
      ]);
      if (shipRes && shipRes.data && Array.isArray(shipRes.data.data)) {
        setShipments(shipRes.data.data);
      } else {
        setShipments([]);
      }
      if (drvRes && drvRes.data && Array.isArray(drvRes.data.data)) {
        setDriversList(drvRes.data.data);
      }
      if (vehRes && vehRes.data && Array.isArray(vehRes.data.data)) {
        setVehiclesList(vehRes.data.data);
      }
    } catch (err) {
      setShipments([]);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignModal || !selectedDriver || !selectedVehicle || assigning) return;

    setAssigning(true);
    setModalError(null);

    try {
      const res = await axiosInstance.put(`/shipments/${assignModal._id}/assign`, {
        driverId: selectedDriver,
        vehicleId: selectedVehicle
      });

      const trackingCode = assignModal.trackingId || assignModal.trackingNumber || 'Shipment';
      await fetchAllData();
      setAssignModal(null);
      setSelectedDriver('');
      setSelectedVehicle('');
      setNotification({
        type: 'success',
        message: `${trackingCode} successfully dispatched! Status transitioned to VEHICLE_ASSIGNED.`
      });
      setTimeout(() => setNotification(null), 6000);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Assignment failed. Please verify driver and vehicle availability.';
      setModalError(errMsg);
    } finally {
      setAssigning(false);
    }
  };

  const availableDrivers = driversList.filter((d) => d.status === 'AVAILABLE');
  const availableVehicles = vehiclesList.filter((v) => v.status === 'AVAILABLE');

  const filteredShipments = shipments.filter((s) => {
    const matchesSearch =
      s.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.customerName && s.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.originCity && s.originCity.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.destinationCity && s.destinationCity.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = selectedStatus === 'ALL' || s.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Pan-India Freight Dispatches</h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor, assign fleet drivers, and oversee shipment lifecycle across all hubs
          </p>
        </div>
        <Link
          to="/customer/create-shipment"
          className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Book New Shipment</span>
        </Link>
      </div>

      {/* Success Notification Banner */}
      {notification && (
        <div className="p-3.5 bg-emerald-950/70 border border-emerald-700/60 rounded-2xl text-emerald-200 text-xs flex items-center justify-between shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-400 hover:text-emerald-200 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Tracking ID (e.g. RTX-998811), Customer or City..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="font-semibold">Lifecycle Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="CREATED">Created</option>
            <option value="VEHICLE_ASSIGNED">Vehicle Assigned</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="DELAYED">Delayed</option>
            <option value="DELIVERED">Delivered</option>
          </select>
        </div>
      </div>

      {/* Shipments Grid */}
      {filteredShipments.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No Freight Dispatches Found"
          description="There are currently no active shipments in the database. New shipments created by Customers will appear here for assignment."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredShipments.map((s) => (
            <ShipmentCard
              key={s._id || s.trackingNumber}
              shipment={s}
              onAssign={(shp) => {
                setAssignModal(shp);
                setModalError(null);
                setSelectedDriver('');
                setSelectedVehicle('');
              }}
              showPlanRoute={true}
            />
          ))}
        </div>
      )}

      {/* Dispatch Assignment Modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100">Assign Driver & Fleet Vehicle</h2>
              <button
                onClick={() => {
                  setAssignModal(null);
                  setModalError(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Shipment <span className="font-mono text-cyan-400 font-bold">{assignModal.trackingId || assignModal.trackingNumber}</span> ({assignModal.pickupAddress?.city || assignModal.pickupCity || assignModal.originCity || 'Customer Pickup'} → {assignModal.deliveryAddress?.city || assignModal.deliveryCity || assignModal.destinationCity || 'Customer Delivery'})
            </p>

            {modalError && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-red-300">Assignment Error</p>
                  <p className="mt-0.5 text-red-200/90 leading-relaxed">{modalError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Select Driver</label>
                <select
                  required
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                >
                  <option value="">-- Select Available Driver ({availableDrivers.length} Available) --</option>
                  {availableDrivers.length === 0 ? (
                    <option value="" disabled>No drivers available (all on trip or off duty)</option>
                  ) : (
                    availableDrivers.map((d) => {
                      const userId = d.user?._id || d.user || d._id;
                      const name = d.user?.name || d.name || 'Driver';
                      return (
                        <option key={d._id || userId} value={userId}>
                          {name} (Exp: {d.experienceYears || 5} Yrs • Rating {d.rating || 4.9} ★)
                        </option>
                      );
                    })
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Select Vehicle</label>
                <select
                  required
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                >
                  <option value="">-- Select Available Vehicle ({availableVehicles.length} Ready) --</option>
                  {availableVehicles.length === 0 ? (
                    <option value="" disabled>No fleet vehicles available (all in transit or maintenance)</option>
                  ) : (
                    availableVehicles.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.registrationNumber} - {v.vehicleType} ({v.capacityKg} Kg Payload)
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssignModal(null);
                    setModalError(null);
                  }}
                  className="w-1/2 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-semibold hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedDriver || !selectedVehicle}
                  className="w-1/2 py-2.5 bg-cyan-600 text-white rounded-xl font-semibold hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
                >
                  {assigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    'Confirm Dispatch'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShipmentsManagement;
