import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import LiveVehicleMap from '../../components/tracking/LiveVehicleMap';
import VehicleTrackingPanel from '../../components/tracking/VehicleTrackingPanel';
import {
  Radio,
  RefreshCw,
  Truck,
  ShieldCheck,
  AlertTriangle,
  WifiOff,
  Activity,
  AlertCircle,
  Navigation
} from 'lucide-react';

const REFRESH_INTERVAL_MS = 10000; // 10 seconds auto-refresh

const LiveTracking = () => {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [trackingData, setTrackingData] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

  // Fetch Live Vehicle Tracking Data from API
  const fetchLiveTrackingData = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    setErrorMsg('');
    try {
      const res = await axiosInstance.get('/tracking/vehicles/live');
      if (res.data && res.data.success) {
        setTrackingData(res.data.data);
        setLastRefreshedAt(new Date());

        // Update selectedVehicle reference if currently selected
        const items = res.data.data?.trackingItems || [];
        if (selectedVehicle) {
          const updatedSelected = items.find(
            (i) => String(i._id) === String(selectedVehicle._id) ||
                   (i.vehicleId && selectedVehicle.vehicleId && String(i.vehicleId) === String(selectedVehicle.vehicleId)) ||
                   (i.vehicle?._id && selectedVehicle.vehicle?._id && String(i.vehicle._id) === String(selectedVehicle.vehicle._id))
          );
          if (updatedSelected) {
            setSelectedVehicle(updatedSelected);
          } else if (items.length > 0) {
            setSelectedVehicle(items[0]);
          } else {
            setSelectedVehicle(null);
          }
        } else if (items.length > 0) {
          setSelectedVehicle(items[0]);
        }
      } else {
        setErrorMsg('Failed to fetch live vehicle telemetry.');
      }
    } catch (err) {
      console.error('Error fetching live tracking:', err);
      setErrorMsg(err.response?.data?.message || 'Unable to connect to live tracking service.');
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  // Initial fetch and auto-refresh interval with cleanup
  useEffect(() => {
    fetchLiveTrackingData(false);

    const timerId = setInterval(() => {
      fetchLiveTrackingData(true);
    }, REFRESH_INTERVAL_MS);

    // Prevent memory leaks on component unmount
    return () => {
      clearInterval(timerId);
    };
  }, []);

  const metrics = trackingData?.summaryMetrics || {
    totalTracked: 0,
    liveCount: 0,
    staleCount: 0,
    offlineCount: 0,
    inTransitCount: 0,
    availableCount: 0
  };

  const trackingItems = trackingData?.trackingItems || [];

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
              <Navigation className="w-7 h-7 text-cyan-400" />
              <span>Live Vehicle & Driver Tracking</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Phase 4A — Real-time fleet telemetry, GPS coordinate updates, driver status & telemetry vitality.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
            <span className="bg-slate-950 border border-slate-800 text-slate-400 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Auto-Refresh (10s): {lastRefreshedAt.toLocaleTimeString()}</span>
            </span>
            <button
              onClick={() => fetchLiveTrackingData(false)}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Refresh Now</span>
            </button>
            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-1.5 rounded-xl font-bold">
              PHASE 4A TELEMETRY
            </span>
          </div>
        </div>
      </div>

      {/* SUMMARY COUNTER METRICS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
            <Truck className="w-3 h-3 text-cyan-400" />
            <span>Total Tracked</span>
          </span>
          <div className="text-2xl font-black text-slate-100 font-mono">{metrics.totalTracked}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Active / Live</span>
          </span>
          <div className="text-2xl font-black text-emerald-400 font-mono">{metrics.liveCount}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Stale (&gt;5m)</span>
          </span>
          <div className="text-2xl font-black text-amber-300 font-mono">{metrics.staleCount}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
            <WifiOff className="w-3 h-3 text-rose-400" />
            <span>Offline (&gt;30m)</span>
          </span>
          <div className="text-2xl font-black text-rose-400 font-mono">{metrics.offlineCount}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
            <Activity className="w-3 h-3 text-purple-400" />
            <span>In Transit</span>
          </span>
          <div className="text-2xl font-black text-purple-300 font-mono">{metrics.inTransitCount}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
            <Truck className="w-3 h-3 text-slate-400" />
            <span>Available</span>
          </span>
          <div className="text-2xl font-black text-cyan-300 font-mono">{metrics.availableCount}</div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
          <RefreshCw className="w-9 h-9 animate-spin text-cyan-400" />
          <span className="text-xs font-mono">Loading live GPS fleet tracking data...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MAP CANVAS (2 COLS) */}
          <div className="lg:col-span-2 space-y-4">
            <LiveVehicleMap
              vehicles={trackingItems}
              selectedVehicleId={selectedVehicle?._id || selectedVehicle?.vehicleId}
              onSelectVehicle={(v) => setSelectedVehicle(v)}
              height="580px"
            />
          </div>

          {/* SIDEBAR PANEL (1 COL) */}
          <div className="space-y-4">
            <VehicleTrackingPanel
              vehicles={trackingItems}
              selectedVehicle={selectedVehicle}
              onSelectVehicle={(v) => setSelectedVehicle(v)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveTracking;
