import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import {
  Clock,
  Compass,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Truck,
  User,
  MapPin,
  Activity,
  Sliders,
  Search,
  Filter,
  ShieldCheck,
  Radio,
  WifiOff,
  ArrowRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

const REFRESH_INTERVAL_MS = 30000; // 30 seconds controlled polling

const ETAMonitoring = () => {
  const [loading, setLoading] = useState(true);
  const [recalculatingId, setRecalculatingId] = useState(null);
  const [overviewData, setOverviewData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [etaFilter, setEtaFilter] = useState('ALL');
  const [deviationFilter, setDeviationFilter] = useState('ALL');
  const [includeTestShipments, setIncludeTestShipments] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({
    corridorThresholdKm: 1.0,
    delayThresholdMinutes: 15,
    consecutiveDeviationThreshold: 2
  });

  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setErrorMsg('');
    try {
      const url = includeTestShipments
        ? '/eta-monitoring/overview?includeTest=true'
        : '/eta-monitoring/overview';
      const res = await axiosInstance.get(url);
      if (res.data?.success) {
        setOverviewData(res.data.data);
        if (res.data.data?.thresholds) {
          setConfigForm((prev) => ({
            ...prev,
            ...res.data.data.thresholds
          }));
        }
      } else {
        setErrorMsg('Failed to load ETA monitoring data.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error connecting to ETA monitoring service.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [includeTestShipments]);

  const handleRecalculate = async (shipmentId) => {
    setRecalculatingId(shipmentId);
    try {
      await axiosInstance.post(`/eta-monitoring/recalculate/${shipmentId}`);
      await fetchData(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Recalculation failed');
    } finally {
      setRecalculatingId(null);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.patch('/eta-monitoring/config', configForm);
      setShowConfigModal(false);
      await fetchData(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update configuration');
    }
  };

  const formatDateTime = (dateVal) => {
    if (!dateVal) return 'N/A';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  /**
   * Helper to format ETA delay/early presentation according to specifications:
   * - delayMinutes > 15: DELAYED, e.g. "45m delayed" or "1h 15m delayed"
   * - 0 <= delayMinutes <= 15: ON TIME, e.g. "ON TIME · 10m variance" or "ON TIME · On Schedule"
   * - delayMinutes < 0: EARLY, e.g. "5h 29m early"
   */
  const formatDelayPresentation = (delayMinutes) => {
    if (delayMinutes === null || delayMinutes === undefined) {
      return {
        label: 'N/A',
        statusText: 'ETA UNKNOWN',
        badgeBg: 'bg-slate-800 text-slate-400 border-slate-700',
        textColor: 'text-slate-500'
      };
    }

    const absMin = Math.abs(delayMinutes);
    const hours = Math.floor(absMin / 60);
    const mins = absMin % 60;
    const durationStr = hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`;

    if (delayMinutes > (configForm.delayThresholdMinutes || 15)) {
      return {
        label: `${durationStr} delayed`,
        statusText: 'DELAYED',
        badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        textColor: 'text-amber-400'
      };
    } else if (delayMinutes < 0) {
      return {
        label: `${durationStr} early`,
        statusText: 'EARLY',
        badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        textColor: 'text-emerald-400'
      };
    } else {
      return {
        label: mins === 0 ? 'ON TIME · On Schedule' : `ON TIME · ${durationStr} variance`,
        statusText: 'ON TIME',
        badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        textColor: 'text-emerald-400'
      };
    }
  };

  const metrics = overviewData?.summaryMetrics || {
    totalMonitored: 0,
    onTimeCount: 0,
    delayedCount: 0,
    deviatedCount: 0,
    staleDeviatedCount: 0,
    liveCount: 0,
    staleCount: 0,
    offlineCount: 0
  };

  const items = overviewData?.monitoringItems || [];

  const filteredItems = items.filter((item) => {
    const s = item.shipment;
    const v = item.vehicle;
    const d = item.driver;

    const matchesSearch =
      !searchQuery.trim() ||
      (s?.trackingNumber && s.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s?.trackingId && s.trackingId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s?.pickupCity && s.pickupCity.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s?.deliveryCity && s.deliveryCity.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v?.registrationNumber && v.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d?.name && d.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesEta =
      etaFilter === 'ALL' ||
      (etaFilter === 'PAUSED' && (item.trackingVitality === 'OFFLINE' || item.etaStatus === 'PAUSED')) ||
      (item.trackingVitality !== 'OFFLINE' && (
        (etaFilter === 'EARLY' && item.delayMinutes < 0) ||
        (etaFilter === 'ON_TIME' && item.delayMinutes >= 0 && item.delayMinutes <= (configForm.delayThresholdMinutes || 15)) ||
        (etaFilter === 'DELAYED' && item.delayMinutes > (configForm.delayThresholdMinutes || 15)) ||
        (etaFilter === 'UNKNOWN' && (item.delayMinutes === null || item.etaStatus === 'UNKNOWN'))
      ));

    const matchesDeviation =
      deviationFilter === 'ALL' ||
      (deviationFilter === 'PAUSED' && (item.trackingVitality === 'OFFLINE' || item.deviationStatus === 'PAUSED')) ||
      (item.trackingVitality !== 'OFFLINE' && (
        (deviationFilter === 'ON_ROUTE' && item.deviationStatus === 'ON_ROUTE') ||
        (deviationFilter === 'DEVIATED' && item.deviationStatus === 'DEVIATED') ||
        (deviationFilter === 'NO_ROUTE' && item.hasRouteGeometry === false) ||
        (deviationFilter === 'UNKNOWN' && item.deviationStatus === 'UNKNOWN')
      ));

    return matchesSearch && matchesEta && matchesDeviation;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">Live ETA & Deviation Monitoring</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              Phase 4C
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time ORS road tracking, AI arrival recalculation, and route corridor deviation detection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Thresholds</span>
          </button>

          <button
            onClick={() => fetchData(false)}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active Shipments</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-slate-100">{metrics.totalMonitored}</p>
          <p className="text-[11px] text-slate-500">Live corridor telemetry</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">On-Time Dispatches</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">{metrics.onTimeCount}</p>
          <p className="text-[11px] text-slate-500">&le; {configForm.delayThresholdMinutes} mins estimated variance</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Delayed Deliveries</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400">{metrics.delayedCount}</p>
          <p className="text-[11px] text-slate-500">&gt; {configForm.delayThresholdMinutes} mins estimated delay</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">Route Deviated</span>
            <Compass className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400">{metrics.deviatedCount}</p>
          <p className="text-[11px] text-slate-500">
            {metrics.staleDeviatedCount > 0
              ? `+${metrics.staleDeviatedCount} stale last-known`
              : `> ${configForm.corridorThresholdKm} km off planned highway`}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Tracking ID, City, Vehicle, Driver..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold">ETA Status:</span>
            <select
              value={etaFilter}
              onChange={(e) => setEtaFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All ETA</option>
              <option value="ON_TIME">On Time (&le; 15m)</option>
              <option value="EARLY">Early (&lt; 0m)</option>
              <option value="DELAYED">Delayed (&gt; 15m)</option>
              <option value="PAUSED">Paused (Offline)</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="font-semibold">Corridor:</span>
            <select
              value={deviationFilter}
              onChange={(e) => setDeviationFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Corridor</option>
              <option value="ON_ROUTE">On Route</option>
              <option value="DEVIATED">Deviated</option>
              <option value="PAUSED">Paused (Offline)</option>
              <option value="NO_ROUTE">No Route Geometry</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>

          {/* Test Shipments Toggle */}
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none pl-2 border-l border-slate-800">
            <input
              type="checkbox"
              checked={includeTestShipments}
              onChange={(e) => setIncludeTestShipments(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0 cursor-pointer"
            />
            <span className="text-[11px] text-slate-500 hover:text-slate-300">Show Test Data</span>
          </label>
        </div>
      </div>

      {/* Monitoring Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <Compass className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-200">No Active Shipments Matching Filters</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Live ETA and route deviation tracking is computed for active in-transit freight dispatches.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const shp = item.shipment;
            const veh = item.vehicle;
            const drv = item.driver;
            const isRecalc = recalculatingId === shp?._id;
            const delayInfo = formatDelayPresentation(item.delayMinutes);
            const isOffline = item.trackingVitality === 'OFFLINE';
            const isStale = item.trackingVitality === 'STALE';
            const isLive = item.trackingVitality === 'LIVE';

            return (
              <div
                key={item._id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-3xl p-5 shadow-xl transition space-y-4"
              >
                {/* Header row: Tracking ID & Badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Shipment Tracking ID</span>
                    <p className="font-mono text-base font-bold text-cyan-400">{shp?.trackingNumber || shp?.trackingId}</p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Deviation Status Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                        item.hasRouteGeometry === false
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : isOffline
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : isStale
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : item.deviationStatus === 'ON_ROUTE'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : item.deviationStatus === 'DEVIATED'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      <Compass className="w-3 h-3" />
                      {item.hasRouteGeometry === false
                        ? 'NO ROUTE GEOMETRY'
                        : isOffline
                        ? 'CORRIDOR PAUSED'
                        : isStale
                        ? (item.lastDetectedDeviationStatus === 'DEVIATED' || item.deviationStatus === 'DEVIATED' ? 'LAST KNOWN DEVIATED' : 'CORRIDOR PAUSED')
                        : item.deviationStatus === 'ON_ROUTE'
                        ? 'ON ROUTE'
                        : item.deviationStatus === 'DEVIATED'
                        ? 'DEVIATED'
                        : 'CORRIDOR UNKNOWN'}
                    </span>

                    {/* ETA Status Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                        isOffline || isStale
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : delayInfo.badgeBg
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {isOffline ? 'ETA PAUSED (OFFLINE)' : isStale ? 'ETA PAUSED (STALE)' : delayInfo.statusText}
                    </span>

                    {/* GPS Vitality Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                        isLive
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                          : isStale
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {isLive ? (
                        <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                      ) : isStale ? (
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                      ) : (
                        <WifiOff className="w-3 h-3 text-rose-400" />
                      )}
                      {item.trackingVitality || 'OFFLINE'}
                    </span>
                  </div>
                </div>

                {/* Explanatory Info Banners */}
                {item.hasRouteGeometry === false && (
                  <div className="bg-slate-800/60 border border-slate-700/60 text-slate-300 text-[11px] p-2.5 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>No planned route geometry attached: Corridor monitoring requires an assigned Phase 2 road route.</span>
                  </div>
                )}

                {isStale && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] p-2.5 rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      GPS telemetry is STALE (last recorded at {formatDateTime(item.gpsTimestamp || item.lastGpsTimestamp)}). Live corridor and ETA monitoring paused. Displaying last known state.
                    </span>
                  </div>
                )}

                {isOffline && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] p-2.5 rounded-xl flex items-center gap-2">
                    <WifiOff className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Vehicle GPS telemetry is OFFLINE ({formatDateTime(item.gpsTimestamp || item.lastGpsTimestamp)}). Live recalculation paused. Showing historical snapshot.
                    </span>
                  </div>
                )}

                {!isOffline && !isStale && item.unavailableReason && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] p-2.5 rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.unavailableReason}</span>
                  </div>
                )}

                {/* Origin -> Destination Route Details */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-2xl border border-slate-800/60">
                  <div>
                    <div className="flex items-center gap-1 text-emerald-400 font-semibold text-[10px]">
                      <MapPin className="w-3 h-3" />
                      <span>Origin Pickup</span>
                    </div>
                    <p className="font-bold text-slate-200 mt-0.5">{shp?.pickupCity || shp?.pickupAddress?.city || 'Origin'}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-amber-400 font-semibold text-[10px]">
                      <MapPin className="w-3 h-3" />
                      <span>Destination Delivery</span>
                    </div>
                    <p className="font-bold text-slate-200 mt-0.5">{shp?.deliveryCity || shp?.deliveryAddress?.city || 'Destination'}</p>
                  </div>
                </div>

                {/* ETA Comparison Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Planned Arrival</span>
                    <span className="text-xs font-bold text-slate-300">{formatDateTime(item.plannedETA)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      {(isOffline || isStale) ? 'Last Known ETA' : 'Current Recalculated ETA'}
                    </span>
                    <span className="text-xs font-bold text-cyan-400">
                      {item.currentETA || item.lastKnownETA ? (
                        <>
                          {formatDateTime(item.currentETA || item.lastKnownETA)}
                          {(isOffline || isStale) && <span className="block text-[9px] text-slate-500 font-normal">Historical</span>}
                        </>
                      ) : (
                        'Unavailable'
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Delay Variance</span>
                    <span className={`text-xs font-bold font-mono ${(isOffline || isStale) ? 'text-slate-400' : delayInfo.textColor}`}>
                      {isOffline ? 'Paused (GPS Offline)' : isStale ? 'Paused (GPS Stale)' : delayInfo.label}
                    </span>
                  </div>
                </div>

                {/* Distance & Deviation Details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-slate-950/40 p-2.5 rounded-2xl border border-slate-800/40">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Remaining Dist</span>
                    <span className="font-bold text-slate-200">
                      {(isOffline || isStale)
                        ? (item.remainingDistanceKm !== null ? `Last Known: ${item.remainingDistanceKm} Km (Paused)` : isOffline ? 'Paused (Offline)' : 'Paused (Stale)')
                        : (item.remainingDistanceKm !== null ? `${item.remainingDistanceKm} Km` : 'N/A')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      {isStale || isOffline ? 'Last Detected Deviation' : 'Corridor Deviation'}
                    </span>
                    <span
                      className={`font-bold ${
                        item.hasRouteGeometry === false
                          ? 'text-slate-400'
                          : isOffline
                          ? 'text-slate-400'
                          : isStale
                          ? ((item.lastDetectedDeviationStatus === 'DEVIATED' || item.deviationStatus === 'DEVIATED') ? 'text-amber-400' : 'text-slate-400')
                          : item.deviationDistanceKm > configForm.corridorThresholdKm
                          ? 'text-rose-400'
                          : 'text-slate-200'
                      }`}
                    >
                      {item.hasRouteGeometry === false
                        ? 'No Planned Route'
                        : isOffline
                        ? (item.lastDetectedDeviationKm !== null && item.lastDetectedDeviationKm !== undefined
                            ? `${item.lastDetectedDeviationKm} Km (Paused)`
                            : item.deviationDistanceKm !== null
                            ? `${item.deviationDistanceKm} Km (Paused)`
                            : 'GPS Offline')
                        : isStale
                        ? (item.lastDetectedDeviationKm !== null && item.lastDetectedDeviationKm !== undefined
                            ? `${item.lastDetectedDeviationKm} Km (Paused)`
                            : item.deviationDistanceKm !== null
                            ? `${item.deviationDistanceKm} Km (Paused)`
                            : 'GPS Stale')
                        : item.deviationDistanceKm !== null
                        ? `${item.deviationDistanceKm} Km`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Assigned Fleet</span>
                    <span className="font-bold text-slate-200 truncate block">
                      {veh?.registrationNumber || 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Assigned Driver</span>
                    <span className="font-bold text-slate-200 truncate block">
                      {drv?.name || 'Unassigned'}
                    </span>
                  </div>
                </div>

                {/* Footer metadata & Action button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[10px] text-slate-500">
                  <div className="space-y-0.5">
                    <p>
                      Source: <span className="text-slate-300 font-semibold">{item.dataSource}</span> • GPS: {formatDateTime(item.gpsTimestamp)}
                    </p>
                    <p>Calculated: {formatDateTime(item.calculatedAt)}</p>
                  </div>

                  <button
                    onClick={() => handleRecalculate(shp?._id)}
                    disabled={isRecalc || isOffline}
                    title={isOffline ? 'Recalculation paused while vehicle GPS telemetry is offline' : 'Force live ETA recalculation'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border font-semibold rounded-xl transition self-end sm:self-auto ${
                      isOffline
                        ? 'bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-cyan-600/10 hover:bg-cyan-600/20 border-cyan-500/30 text-cyan-300'
                    } disabled:opacity-50`}
                  >
                    <RefreshCw className={`w-3 h-3 ${isRecalc ? 'animate-spin' : ''}`} />
                    <span>{isRecalc ? 'Recalculating...' : isOffline ? 'Recalculation Paused' : 'Recalculate ETA'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Thresholds Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>Configure Monitoring Thresholds</span>
              </h2>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-500 hover:text-slate-300 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Route Corridor Deviation Threshold (Km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="50"
                  value={configForm.corridorThresholdKm}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, corridorThresholdKm: parseFloat(e.target.value) || 1.0 })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Vehicles farther than this distance from the planned polyline will trigger a deviation alert.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  ETA Delay Threshold (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={configForm.delayThresholdMinutes}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, delayThresholdMinutes: parseInt(e.target.value, 10) || 15 })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Deliveries with arrival delay exceeding this threshold will be flagged as DELAYED.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Consecutive Deviation Updates Required
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={configForm.consecutiveDeviationThreshold}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, consecutiveDeviationThreshold: parseInt(e.target.value, 10) || 2 })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Number of consecutive GPS updates outside corridor required to trigger DEVIATED alert (filters noisy GPS).
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition shadow-lg shadow-cyan-500/20"
                >
                  Save Thresholds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ETAMonitoring;
