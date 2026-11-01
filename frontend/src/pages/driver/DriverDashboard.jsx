import React, { useState, useEffect, useContext } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { AuthContext } from '../../context/AuthContext';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { MOCK_DRIVERS, MOCK_SHIPMENTS } from '../../data/mockData';
import { Truck, Navigation, CheckCircle2, MapPin, Shield, AlertTriangle, ArrowRight, Package, Compass, Clock, WifiOff, X, AlertCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

const DriverDashboard = () => {
  const { user } = useContext(AuthContext);
  const [driverProfile, setDriverProfile] = useState(MOCK_DRIVERS[0]);
  const [shipments, setShipments] = useState([]);
  const [etaMonitoring, setEtaMonitoring] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmStatusModal, setConfirmStatusModal] = useState(null);
  const [notification, setNotification] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchDriverData = async () => {
      try {
        const [profileRes, shipmentsRes] = await Promise.all([
          axiosInstance.get('/drivers/me').catch(() => null),
          axiosInstance.get('/shipments').catch(() => null)
        ]);

        if (!isMounted) return;

        if (profileRes && profileRes.data && profileRes.data.data) {
          setDriverProfile(profileRes.data.data);
        }
        if (shipmentsRes && shipmentsRes.data && Array.isArray(shipmentsRes.data.data)) {
          const list = shipmentsRes.data.data;
          setShipments(list);

          const active = list.find(s => s && ['CREATED', 'PENDING', 'CONFIRMED', 'PICKUP_PENDING', 'VEHICLE_ASSIGNED', 'PICKED_UP', 'DISPATCHED', 'IN_TRANSIT', 'AT_DESTINATION', 'NEAR_DESTINATION', 'OUT_FOR_DELIVERY', 'DELAYED'].includes(s.status));
          if (active && active._id) {
            try {
              const etaRes = await axiosInstance.get(`/eta-monitoring/shipment/${active._id}`);
              if (isMounted && etaRes.data?.success) {
                setEtaMonitoring(etaRes.data.data);
              }
            } catch (etaErr) {
              // Non-blocking ETA fetch
            }
          }
        } else {
          setShipments([]);
        }
      } catch (err) {
        if (isMounted) setShipments([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDriverData();
    const interval = setInterval(fetchDriverData, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleDutyToggle = async (newStatus) => {
    try {
      setNotification(null);
      await axiosInstance.put('/drivers/status', { status: newStatus }).catch(() => {});
      setDriverProfile((prev) => (prev ? { ...prev, status: newStatus } : { status: newStatus }));
      setNotification({
        type: 'success',
        message: `Duty status updated to ${newStatus}.`
      });
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Duty status update failed';
      const isMismatch = errMsg.includes('not authorized') || errMsg.includes('Access denied');
      setNotification({
        type: 'error',
        message: isMismatch
          ? `Session role mismatch: ${errMsg}. Use the navbar to switch to the Driver profile.`
          : errMsg,
        isRoleMismatch: isMismatch
      });
    }
  };

  const handleStatusUpdate = async (shipmentId, newStatus) => {
    setUpdatingStatus(true);
    setNotification(null);
    try {
      const res = await axiosInstance.patch(`/shipment-lifecycle/${shipmentId}/status`, { status: newStatus })
        .catch(() => axiosInstance.put(`/shipments/${shipmentId}/status`, { status: newStatus }));

      if (newStatus === 'IN_TRANSIT') {
        await axiosInstance.put('/drivers/status', { status: 'ON_TRIP' }).catch(() => {});
        setDriverProfile((prev) => (prev ? { ...prev, status: 'ON_TRIP' } : { status: 'ON_TRIP' }));
      } else if (newStatus === 'DELIVERED') {
        await axiosInstance.put('/drivers/status', { status: 'AVAILABLE' }).catch(() => {});
        setDriverProfile((prev) => (prev ? { ...prev, status: 'AVAILABLE' } : { status: 'AVAILABLE' }));
      }

      const updatedShipmentData = res?.data?.data?.shipment || res?.data?.data;
      if (updatedShipmentData) {
        setShipments((prev) => prev.map((s) => (s._id === shipmentId ? { ...s, ...updatedShipmentData, status: newStatus } : s)));
      } else {
        setShipments((prev) => prev.map((s) => (s._id === shipmentId ? { ...s, status: newStatus } : s)));
      }
      setConfirmStatusModal(null);
      setNotification({
        type: 'success',
        message: `Shipment status successfully transitioned to ${newStatus}!`
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Status update failed';
      const isMismatch = errMsg.includes('not authorized') || errMsg.includes('Access denied');
      setNotification({
        type: 'error',
        message: isMismatch
          ? `Session role mismatch: ${errMsg}. Click below to switch to the Driver session.`
          : errMsg,
        isRoleMismatch: isMismatch
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return 'N/A';
    if (typeof addr === 'string') return addr;
    return [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
  };

  const activeShipment = shipments && shipments.length > 0
    ? shipments.find(s => s && ['CREATED', 'PENDING', 'CONFIRMED', 'PICKUP_PENDING', 'VEHICLE_ASSIGNED', 'PICKED_UP', 'DISPATCHED', 'IN_TRANSIT', 'AT_DESTINATION', 'NEAR_DESTINATION', 'OUT_FOR_DELIVERY', 'DELAYED'].includes(s.status)) || null
    : null;

  const getNextAction = (status) => {
    switch (status) {
      case 'CREATED':
      case 'PENDING':
        return { nextStatus: 'PICKUP_PENDING', label: 'Advance to PICKUP PENDING', icon: Package };
      case 'CONFIRMED':
      case 'PICKUP_PENDING':
      case 'VEHICLE_ASSIGNED':
        return { nextStatus: 'PICKED_UP', label: 'Confirm Pickup: PICKED UP', icon: CheckCircle2 };
      case 'PICKED_UP':
      case 'DISPATCHED':
        return { nextStatus: 'IN_TRANSIT', label: 'Start Trip: IN TRANSIT', icon: Navigation };
      case 'IN_TRANSIT':
        return { nextStatus: 'AT_DESTINATION', label: 'Arrived: AT DESTINATION', icon: MapPin };
      case 'AT_DESTINATION':
      case 'NEAR_DESTINATION':
        return { nextStatus: 'OUT_FOR_DELIVERY', label: 'Advance to OUT FOR DELIVERY', icon: Truck };
      case 'OUT_FOR_DELIVERY':
        return { nextStatus: 'DELIVERED', label: 'Complete Delivery: DELIVERED', icon: CheckCircle2, requiresConfirm: true };
      default:
        return null;
    }
  };

  const nextAction = activeShipment ? getNextAction(activeShipment.status) : null;

  return (
    <div className="space-y-6">
      {/* Header & Duty Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Driver Console</h1>
          <p className="text-xs text-slate-400 mt-1">
            Welcome back, {user?.name || driverProfile?.name || 'Driver'}. Active delivery operations.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shadow-lg">
          <span className="text-xs font-semibold text-slate-400 pl-2">Duty Status:</span>
          {['AVAILABLE', 'ON_TRIP', 'OFF_DUTY'].map((st) => (
            <button
              key={st}
              onClick={() => handleDutyToggle(st)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl transition ${
                driverProfile?.status === st
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Action Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-950/70 border border-emerald-600/50 text-emerald-200'
              : 'bg-rose-950/80 border border-rose-600/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="font-semibold">{notification.message}</span>
          </div>

          <button
            onClick={() => setNotification(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Driver Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Assigned Vehicle</p>
            <p className="font-bold font-mono text-slate-100">
              {loading ? (
                <span className="text-slate-500 text-xs font-sans animate-pulse">Loading assigned...</span>
              ) : (() => {
                const veh = activeShipment?.vehicle?.registrationNumber || activeShipment?.vehicleReg || (driverProfile?.status === 'ON_TRIP' && (driverProfile?.assignedVehicle?.registrationNumber || driverProfile?.assignedVehicleReg));
                return veh || 'Unassigned';
              })()}
            </p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-semibold">License Number</p>
            <p className="font-bold font-mono text-slate-100">{driverProfile?.licenseNumber || 'DL-DEMO-458921'}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Experience Rating</p>
            <p className="font-bold text-amber-400">{driverProfile?.rating || 4.9} ★ ({driverProfile?.experienceYears || 7} Years)</p>
          </div>
        </div>
      </div>

      {/* Active Shipment Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-100">Current Assigned Shipment</h2>

        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 flex flex-col items-center justify-center space-y-3 shadow-xl">
            <div className="w-9 h-9 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-300">Loading active dispatch details...</p>
            <p className="text-xs text-slate-500">Connecting to telemetry and vehicle assignment records</p>
          </div>
        ) : !activeShipment ? (
          <EmptyState
            icon={Package}
            title="No Active Shipment Assigned"
            description="You are currently available on duty. New dispatches assigned by the Owner will appear here."
          />
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Shipment Tracking ID</span>
                <p className="font-mono text-xl font-bold text-cyan-400">{activeShipment.trackingNumber}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Telemetry Vitality Status Badge */}
                {etaMonitoring && (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1.5 font-mono ${
                    etaMonitoring.trackingVitality === 'LIVE'
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                      : etaMonitoring.trackingVitality === 'STALE'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}>
                    {etaMonitoring.trackingVitality === 'LIVE' ? (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    ) : etaMonitoring.trackingVitality === 'STALE' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    <span>GPS: {etaMonitoring.trackingVitality || 'OFFLINE'}</span>
                    {(etaMonitoring.gpsTimestamp || etaMonitoring.lastGpsTimestamp) && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({new Date(etaMonitoring.gpsTimestamp || etaMonitoring.lastGpsTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    )}
                  </span>
                )}
                <StatusBadge status={activeShipment.status} />
              </div>
            </div>

            {/* Source & Destination Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                  <MapPin className="w-4 h-4" />
                  <span>Customer Pickup Location</span>
                </div>
                <p className="font-bold text-slate-200 text-sm">
                  {activeShipment.pickupAddress?.city || activeShipment.pickupCity || activeShipment.originCity || 'Customer Pickup'}
                </p>
                <p className="text-xs text-slate-400">{formatAddress(activeShipment.pickupAddress)}</p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                  <MapPin className="w-4 h-4" />
                  <span>Customer Delivery Location</span>
                </div>
                <p className="font-bold text-slate-200 text-sm">
                  {activeShipment.deliveryAddress?.city || activeShipment.deliveryCity || activeShipment.destinationCity || 'Customer Delivery'}
                </p>
                <p className="text-xs text-slate-400">{formatAddress(activeShipment.deliveryAddress)}</p>
              </div>
            </div>

            {/* GPS Telemetry Status Banners */}
            {etaMonitoring?.trackingVitality === 'OFFLINE' ? (
              <div className="bg-slate-800/80 border border-slate-700 text-slate-300 p-3 rounded-2xl text-xs flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Vehicle GPS telemetry is OFFLINE
                  {etaMonitoring.gpsTimestamp || etaMonitoring.lastGpsTimestamp
                    ? ` (last received ${new Date(etaMonitoring.gpsTimestamp || etaMonitoring.lastGpsTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                    : ''
                  }. Live route corridor monitoring and ETA recalculation paused. Showing historical snapshot.
                </span>
              </div>
            ) : etaMonitoring?.trackingVitality === 'STALE' ? (
              <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 p-3 rounded-2xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  GPS telemetry is STALE (last recorded at {etaMonitoring.gpsTimestamp || etaMonitoring.lastGpsTimestamp ? new Date(etaMonitoring.gpsTimestamp || etaMonitoring.lastGpsTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'earlier'}). Live route corridor monitoring and ETA recalculation paused. Displaying last known delivery ETA.
                </span>
              </div>
            ) : null}

            {/* Active Route Deviation Warning Banner (Active ONLY when LIVE) */}
            {etaMonitoring?.trackingVitality === 'LIVE' && etaMonitoring?.deviationStatus === 'DEVIATED' && (
              <div className="bg-rose-500/15 border border-rose-500/40 text-rose-300 p-3.5 rounded-2xl text-xs flex items-center justify-between gap-3 animate-pulse">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  <div>
                    <p className="font-bold">Active Route Deviation Warning</p>
                    <p className="text-[11px] text-rose-300/80">
                      Vehicle is {etaMonitoring.deviationDistanceKm} Km outside the planned highway corridor. Return to designated route.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 shrink-0">
                  DEVIATED
                </span>
              </div>
            )}

            {/* Historical Route Deviation Warning (When STALE or OFFLINE, if vehicle was deviated prior to signal loss) */}
            {(etaMonitoring?.trackingVitality === 'STALE' || etaMonitoring?.trackingVitality === 'OFFLINE') &&
             (etaMonitoring?.lastDetectedDeviationStatus === 'DEVIATED' || (etaMonitoring?.deviationStatus === 'DEVIATED' && !etaMonitoring?.lastDetectedDeviationStatus)) && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3.5 rounded-2xl text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-bold">Historical Route Deviation Detected (Corridor Paused)</p>
                    <p className="text-[11px] text-amber-200/80">
                      Vehicle was detected {etaMonitoring.lastDetectedDeviationKm ?? etaMonitoring.deviationDistanceKm} Km outside the planned highway corridor prior to GPS signal pause
                      {etaMonitoring.lastDetectedDeviationTimestamp ? ` (Last detected at ${new Date(etaMonitoring.lastDetectedDeviationTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}.
                      Live corridor monitoring paused until fresh GPS telemetry is received.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 shrink-0">
                  LAST KNOWN DEVIATED
                </span>
              </div>
            )}

            {/* Intelligence metrics */}
            {(() => {
              const isOffline = etaMonitoring?.trackingVitality === 'OFFLINE';
              const isStale = etaMonitoring?.trackingVitality === 'STALE';
              const isHistorical = isOffline || isStale;
              const displayEta = etaMonitoring?.currentETA || etaMonitoring?.lastKnownETA;
              const formattedEta = displayEta
                ? new Date(displayEta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : (activeShipment.eta || '14 Hours');

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
                  {/* Delivery ETA Tile */}
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      {isHistorical ? 'Last Known Delivery ETA' : 'Live Delivery ETA'}
                    </span>
                    <span className="font-bold text-cyan-400 text-sm">
                      {formattedEta} {isHistorical && <span className="text-[10px] font-normal text-slate-400">(Historical)</span>}
                    </span>
                    {isOffline ? (
                      <span className="text-[10px] font-bold block text-slate-500">
                        PAUSED (GPS OFFLINE)
                      </span>
                    ) : isStale ? (
                      <span className="text-[10px] font-bold block text-amber-400">
                        PAUSED (GPS STALE)
                      </span>
                    ) : etaMonitoring?.delayMinutes !== null && etaMonitoring?.delayMinutes !== undefined ? (
                      <span className={`text-[10px] font-bold block ${etaMonitoring.delayMinutes > 15 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {etaMonitoring.delayMinutes > 15
                          ? `${etaMonitoring.delayMinutes}m DELAYED`
                          : etaMonitoring.delayMinutes < 0
                          ? `${Math.abs(etaMonitoring.delayMinutes)}m EARLY`
                          : 'ON TIME'}
                      </span>
                    ) : null}
                  </div>

                  {/* Remaining Distance Tile */}
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      {isHistorical ? 'Last Known Distance' : 'Remaining Distance'}
                    </span>
                    <span className="font-bold text-slate-200 text-sm">
                      {etaMonitoring?.remainingDistanceKm !== null && etaMonitoring?.remainingDistanceKm !== undefined
                        ? `${etaMonitoring.remainingDistanceKm} Km`
                        : `${activeShipment.estimatedDistanceKm || 280} Km`}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {isOffline ? 'Paused (Offline)' : isStale ? 'Paused (Stale)' : 'Live road route'}
                    </span>
                  </div>

                  {/* Route Corridor Tile */}
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Route Corridor</span>
                    <span className={`font-bold text-sm ${
                      isHistorical
                        ? (etaMonitoring?.lastDetectedDeviationStatus === 'DEVIATED' ? 'text-amber-400' : 'text-slate-400')
                        : etaMonitoring?.deviationStatus === 'DEVIATED'
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}>
                      {isHistorical
                        ? 'PAUSED'
                        : etaMonitoring?.deviationStatus === 'DEVIATED'
                        ? 'DEVIATED'
                        : 'ON ROUTE'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {isHistorical
                        ? (etaMonitoring?.lastDetectedDeviationStatus === 'DEVIATED' && (etaMonitoring?.lastDetectedDeviationKm ?? etaMonitoring?.deviationDistanceKm) !== null
                            ? `Last Detected: ${etaMonitoring.lastDetectedDeviationKm ?? etaMonitoring.deviationDistanceKm} Km off`
                            : (isOffline ? 'GPS Offline' : 'GPS Stale'))
                        : etaMonitoring?.deviationDistanceKm !== null && etaMonitoring?.deviationDistanceKm !== undefined
                        ? `${etaMonitoring.deviationDistanceKm} Km dev.`
                        : 'Corridor OK'}
                    </span>
                  </div>

                  {/* Risk Level Tile */}
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Route Risk Level</span>
                    <span className="font-bold text-emerald-400 text-sm">{activeShipment.routeRisk || 'LOW (12%)'}</span>
                    <span className="text-[10px] text-slate-500 block">Phase 3D AI Risk</span>
                  </div>
                </div>
              );
            })()}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap gap-3">
              {nextAction && (
                <button
                  disabled={updatingStatus}
                  onClick={() => {
                    if (nextAction.requiresConfirm) {
                      setConfirmStatusModal(activeShipment);
                    } else {
                      handleStatusUpdate(activeShipment._id, nextAction.nextStatus);
                    }
                  }}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {updatingStatus ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Updating Status...</span>
                    </>
                  ) : (
                    <>
                      <nextAction.icon className="w-4 h-4" />
                      <span>{nextAction.label}</span>
                    </>
                  )}
                </button>
              )}

              <Link
                to="/driver/route"
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-4 py-3 rounded-xl transition flex items-center gap-2"
              >
                <Compass className="w-4 h-4" />
                <span>View Route Navigation</span>
              </Link>

              <Link
                to="/driver/report-issue"
                className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 font-semibold text-xs px-4 py-3 rounded-xl transition flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Report Road Disruption</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(confirmStatusModal)}
        title="Confirm Delivery Completion"
        message={`Are you sure you want to mark shipment ${confirmStatusModal?.trackingNumber} as DELIVERED to recipient?`}
        confirmText="Confirm Delivered"
        onConfirm={() => confirmStatusModal && handleStatusUpdate(confirmStatusModal._id, 'DELIVERED')}
        onClose={() => setConfirmStatusModal(null)}
      />
    </div>
  );
};

export default DriverDashboard;
