import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import {
  FileText,
  Package,
  Truck,
  User,
  CheckCircle2,
  Clock,
  MapPin,
  Sliders,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Activity,
  AlertTriangle,
  XCircle,
  ChevronRight
} from 'lucide-react';

const ShipmentLifecycle = () => {
  const [searchParams] = useSearchParams();
  const queryShipmentId = searchParams.get('shipmentId');

  const [loading, setLoading] = useState(true);
  const [overviewData, setOverviewData] = useState(null);
  const [lifecycleData, setLifecycleData] = useState(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch overview & shipment lifecycle
  const fetchData = async (shipmentId = '') => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Fetch overview summary counters
      const overviewRes = await axiosInstance.get('/shipment-lifecycle/overview').catch(() => null);
      if (overviewRes?.data?.success) {
        setOverviewData(overviewRes.data.data);
      }

      // 2. Determine target shipment ID
      let targetId = shipmentId || selectedShipmentId || queryShipmentId;
      if (!targetId && overviewRes?.data?.data?.shipmentList?.length > 0) {
        targetId = overviewRes.data.data.shipmentList[0]._id;
      }

      if (targetId) {
        setSelectedShipmentId(targetId);
        const detailRes = await axiosInstance.get(`/shipment-lifecycle/${targetId}`);
        if (detailRes?.data?.success) {
          setLifecycleData(detailRes.data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching shipment lifecycle:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load shipment lifecycle intelligence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(queryShipmentId || '');
    const interval = setInterval(() => {
      fetchData(selectedShipmentId || queryShipmentId || '');
    }, 8000);
    return () => clearInterval(interval);
  }, [queryShipmentId, selectedShipmentId]);

  const handleShipmentChange = (e) => {
    const newId = e.target.value;
    setSelectedShipmentId(newId);
    setLifecycleData(null);
    setSuccessMsg('');
    setErrorMsg('');
    fetchData(newId);
  };

  const handleStatusUpdate = async (nextStatus) => {
    if (!lifecycleData?.shipment?._id) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await axiosInstance.patch(`/shipment-lifecycle/${lifecycleData.shipment._id}/status`, {
        status: nextStatus,
        note: `Status updated by Owner to ${nextStatus}`
      });

      if (res.data && res.data.success) {
        setSuccessMsg(`Shipment status successfully transitioned to ${nextStatus}!`);
        setLifecycleData(res.data.data);
        // Refresh overview counters
        const overviewRes = await axiosInstance.get('/shipment-lifecycle/overview').catch(() => null);
        if (overviewRes?.data?.success) {
          setOverviewData(overviewRes.data.data);
        }
      }
    } catch (err) {
      console.error('Status transition error:', err);
      setErrorMsg(err.response?.data?.message || 'Status transition failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const metrics = overviewData?.summaryMetrics || {
    totalShipments: 0,
    CREATED: 0,
    PICKUP_PENDING: 0,
    VEHICLE_ASSIGNED: 0,
    PICKED_UP: 0,
    IN_TRANSIT: 0,
    AT_DESTINATION: 0,
    OUT_FOR_DELIVERY: 0,
    DELIVERED: 0,
    DELAYED: 0,
    CANCELLED: 0,
    FAILED: 0
  };

  const shipmentList = overviewData?.shipmentList || [];
  const shipment = lifecycleData?.shipment;
  const timeline = lifecycleData?.timeline || [];
  const history = lifecycleData?.history || [];
  const vehicle = lifecycleData?.assignedVehicle;
  const driver = lifecycleData?.assignedDriver;
  const telemetry = vehicle?.telemetry;

  const getStatusBadgeColor = (st) => {
    if (st === 'DELIVERED') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (st === 'IN_TRANSIT' || st === 'OUT_FOR_DELIVERY') return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    if (st === 'VEHICLE_ASSIGNED' || st === 'PICKUP_PENDING') return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    if (st === 'DELAYED') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (st === 'CANCELLED' || st === 'FAILED') return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  // Determine SINGLE strictly allowed next normal stage from current status
  const currentStatus = shipment?.currentStatus || 'CREATED';

  const getNextNormalStage = (cur) => {
    const sequenceMap = {
      CREATED: 'PICKUP_PENDING',
      PENDING: 'PICKUP_PENDING',
      CONFIRMED: 'PICKUP_PENDING',
      PICKUP_PENDING: 'VEHICLE_ASSIGNED',
      VEHICLE_ASSIGNED: 'PICKED_UP',
      PICKED_UP: 'IN_TRANSIT',
      DISPATCHED: 'IN_TRANSIT',
      IN_TRANSIT: 'AT_DESTINATION',
      NEAR_DESTINATION: 'AT_DESTINATION',
      AT_DESTINATION: 'OUT_FOR_DELIVERY',
      OUT_FOR_DELIVERY: 'DELIVERED',
      DELAYED: 'IN_TRANSIT'
    };
    return sequenceMap[cur] || null;
  };

  const nextStage = getNextNormalStage(currentStatus);
  const isTerminalState = ['DELIVERED', 'CANCELLED', 'FAILED'].includes(currentStatus);

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
              <FileText className="w-7 h-7 text-cyan-400" />
              <span>Shipment Lifecycle Tracking</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Phase 4B — Strict sequential state machine tracking from booking through pickup, transit & delivery.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
            <span className="bg-slate-950 border border-slate-800 text-slate-400 px-3 py-1.5 rounded-xl">
              Database Logged: Strict State Machine
            </span>
            <button
              onClick={() => fetchData(selectedShipmentId)}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Refresh</span>
            </button>
            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-1.5 rounded-xl font-bold">
              PHASE 4B LIFECYCLE
            </span>
          </div>
        </div>
      </div>

      {/* OVERVIEW METRICS COUNTERS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase font-bold block">Total Dispatches</span>
          <div className="text-xl font-black text-slate-100 font-mono">{metrics.totalShipments}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase font-bold block">Created</span>
          <div className="text-xl font-black text-slate-300 font-mono">{metrics.CREATED}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase font-bold block">Assigned</span>
          <div className="text-xl font-black text-purple-300 font-mono">{metrics.VEHICLE_ASSIGNED}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase font-bold block">Picked Up</span>
          <div className="text-xl font-black text-cyan-300 font-mono">{metrics.PICKED_UP}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase font-bold block">In Transit</span>
          <div className="text-xl font-black text-emerald-400 font-mono">{metrics.IN_TRANSIT}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase font-bold block">Out for Delivery</span>
          <div className="text-xl font-black text-amber-300 font-mono">{metrics.OUT_FOR_DELIVERY}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase font-bold block">Delivered</span>
          <div className="text-xl font-black text-emerald-300 font-mono">{metrics.DELIVERED}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1">
          <span className="text-[9px] text-slate-500 uppercase font-bold block">Delayed / Alert</span>
          <div className="text-xl font-black text-rose-400 font-mono">{metrics.DELAYED}</div>
        </div>
      </div>

      {/* TARGET SHIPMENT SELECTOR TOOLBAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Target Shipment Lifecycle Selector</span>
          </h2>

          {shipment && (
            <span className="text-xs text-slate-400 font-mono">
              Selected: <strong className="text-cyan-400">{shipment.trackingId}</strong> • Route:{' '}
              <strong className="text-slate-200">{shipment.origin} → {shipment.destination}</strong>
            </span>
          )}
        </div>

        <div>
          <label className="block text-slate-400 mb-1.5 font-semibold text-xs">Choose Shipment for Lifecycle Timeline Inspection</label>
          <select
            value={selectedShipmentId}
            onChange={handleShipmentChange}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 font-mono text-xs focus:border-cyan-500"
          >
            {shipmentList.length > 0 ? (
              shipmentList.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.trackingId} ({s.origin} → {s.destination}) — Status: {s.status} — Weight: {s.weightKg}kg
                </option>
              ))
            ) : (
              <option value="">Loading Shipments...</option>
            )}
          </select>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
          <span className="text-xs font-mono">Loading shipment lifecycle timeline...</span>
        </div>
      ) : shipment ? (
        <div className="space-y-6">

          {/* SHIPMENT CORRIDOR SUMMARY & STATUS CARD */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] text-cyan-400 uppercase font-bold tracking-wider block font-mono">
                  Shipment Tracking Identifier
                </span>
                <h2 className="text-2xl font-black text-slate-100 font-mono mt-0.5 flex items-center gap-2">
                  <span>{shipment.trackingId}</span>
                  <span className={`text-xs px-3 py-1 rounded-xl font-bold border ${getStatusBadgeColor(shipment.currentStatus)}`}>
                    {shipment.currentStatus}
                  </span>
                </h2>
              </div>

              <div className="text-right font-mono text-xs space-y-1">
                <div><span className="text-slate-500">Corridor: </span><strong className="text-emerald-400">{shipment.origin}</strong> <span className="text-slate-500">→</span> <strong className="text-amber-400">{shipment.destination}</strong></div>
                <div><span className="text-slate-500">Payload Weight: </span><strong className="text-slate-200">{shipment.weightKg} Kg</strong></div>
                <div><span className="text-slate-500">Est Distance: </span><strong className="text-cyan-300">{shipment.estimatedDistanceKm || 0} Km</strong></div>
              </div>
            </div>

            {/* STRICT SINGLE NEXT STAGE TRANSITION ACTION BAR */}
            <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-3 font-mono text-xs">
              <span className="text-slate-400 font-bold block uppercase tracking-wide text-[10px]">
                Owner Status Transition Actions (Strict Sequential Progression):
              </span>

              <div className="flex flex-wrap items-center gap-3">
                {nextStage ? (
                  <button
                    onClick={() => handleStatusUpdate(nextStage)}
                    disabled={actionLoading}
                    className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg shadow-cyan-500/20"
                  >
                    <span>Advance to {nextStage.replace(/_/g, ' ')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="text-slate-400 font-bold px-3 py-2 bg-slate-900 rounded-xl border border-slate-800 text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Shipment {shipment.currentStatus} — Terminal State Achieved (No Further Transitions Allowed)</span>
                  </span>
                )}

                {/* Exception Stage Controls */}
                {!isTerminalState && currentStatus !== 'DELAYED' && (
                  <button
                    onClick={() => handleStatusUpdate('DELAYED')}
                    disabled={actionLoading}
                    className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Flag DELAYED</span>
                  </button>
                )}

                {!isTerminalState && (
                  <button
                    onClick={() => handleStatusUpdate('CANCELLED')}
                    disabled={actionLoading}
                    className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel Shipment</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 8-STAGE LIFECYCLE TIMELINE SECTION */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                <span>Operational Lifecycle Progress Timeline</span>
              </h2>
              <span className="text-xs font-mono text-cyan-400">8 Standard Stages</span>
            </div>

            {/* TIMELINE VISUAL STAGE FLOW */}
            <div className="space-y-3">
              {timeline.map((item, idx) => {
                const isLast = idx === timeline.length - 1;

                return (
                  <div key={item.stage} className="flex items-start gap-4 font-mono">
                    {/* ICON STATUS INDICATOR */}
                    <div className="flex flex-col items-center shrink-0 mt-0.5">
                      {item.isCurrent ? (
                        <div className="w-8 h-8 rounded-full bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 flex items-center justify-center font-bold text-sm shadow-lg shadow-cyan-500/20 animate-pulse">
                          ●
                        </div>
                      ) : item.completed ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 text-emerald-400 flex items-center justify-center font-bold text-sm">
                          ✓
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-950 border-2 border-slate-800 text-slate-600 flex items-center justify-center font-bold text-sm">
                          ○
                        </div>
                      )}
                      {!isLast && (
                        <div className={`w-0.5 h-10 ${item.completed ? 'bg-emerald-500/40' : 'bg-slate-800'}`} />
                      )}
                    </div>

                    {/* STAGE DESCRIPTION BOX */}
                    <div className={`flex-1 p-3.5 rounded-2xl border ${
                      item.isCurrent
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200 shadow-md shadow-cyan-500/10'
                        : item.completed
                        ? 'bg-slate-950 border-slate-800 text-slate-200'
                        : 'bg-slate-950/40 border-slate-800/40 text-slate-500'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">{item.label}</span>
                        {item.timestamp && (
                          <span className="text-[11px] text-slate-400">
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {item.note && (
                        <p className="text-xs text-slate-400 mt-1 font-mono">{item.note}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* VEHICLE & DRIVER INTEGRATION (PHASE 4A TELEMETRY) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Assigned Vehicle & GPS */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                <Truck className="w-4 h-4 text-purple-400" />
                <span>Assigned Fleet Vehicle & GPS Telemetry</span>
              </h3>

              {vehicle ? (
                <div className="space-y-2 text-slate-300 text-[11px]">
                  <p><span className="text-slate-500">Registration: </span><strong className="text-purple-300 text-sm">{vehicle.registrationNumber}</strong></p>
                  <p><span className="text-slate-500">Vehicle Type: </span><strong>{vehicle.vehicleType}</strong></p>
                  <p><span className="text-slate-500">Payload Capacity: </span><strong>{vehicle.capacityKg} Kg</strong></p>
                  {telemetry ? (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5 mt-2">
                      <span className="text-[10px] text-cyan-400 uppercase font-bold block">Phase 4A Telemetry Stream:</span>
                      <p><span className="text-slate-500">Status: </span><strong className="text-emerald-400">{telemetry.status}</strong></p>
                      <p><span className="text-slate-500">Speed: </span><strong className="text-cyan-300">{telemetry.speed} km/h</strong></p>
                      <p><span className="text-slate-500">Coordinates: </span><span>{telemetry.latitude?.toFixed(4)}, {telemetry.longitude?.toFixed(4)}</span></p>
                      <p><span className="text-slate-500">Last Telemetry: </span><span>{new Date(telemetry.lastUpdated).toLocaleTimeString()}</span></p>
                    </div>
                  ) : (
                    <p className="text-slate-500 italic mt-2">No Phase 4A GPS telemetry received yet for this vehicle.</p>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 italic">No fleet vehicle assigned yet.</p>
              )}
            </div>

            {/* Assigned Driver */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                <User className="w-4 h-4 text-cyan-400" />
                <span>Assigned Fleet Driver</span>
              </h3>

              {driver ? (
                <div className="space-y-2 text-slate-300 text-[11px]">
                  <p><span className="text-slate-500">Driver Name: </span><strong className="text-cyan-300 text-sm">{driver.name}</strong></p>
                  <p><span className="text-slate-500">Phone Contact: </span><strong>{driver.phone || 'Available'}</strong></p>
                  <p><span className="text-slate-500">Email: </span><strong>{driver.email}</strong></p>
                </div>
              ) : (
                <p className="text-slate-500 italic">No driver assigned yet.</p>
              )}
            </div>
          </div>

          {/* AUDIT LOG HISTORY TRAIL TABLE */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <span>Database Audit Trail Logs (`ShipmentLifecycle`)</span>
              </h2>
              <span className="text-xs text-slate-400">{history.length} Database Log Entries</span>
            </div>

            {history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Stage / Status</th>
                      <th className="py-2.5 px-3">Previous State</th>
                      <th className="py-2.5 px-3">Note / Event</th>
                      <th className="py-2.5 px-3">Updated By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {history.map((log) => (
                      <tr key={log._id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3 text-cyan-300">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadgeColor(log.status)}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400">{log.previousStatus || '—'}</td>
                        <td className="py-3 px-3 text-slate-200">{log.note || 'Status update'}</td>
                        <td className="py-3 px-3 text-purple-300">{log.updatedBy?.name || 'System Auto'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3 text-slate-500 text-xs">No audit logs available.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center text-slate-400 text-xs space-y-2">
          <AlertCircle className="w-8 h-8 text-cyan-400 mx-auto" />
          <p>No shipment selected. Please select a target shipment above to view lifecycle timeline.</p>
        </div>
      )}
    </div>
  );
};

export default ShipmentLifecycle;
