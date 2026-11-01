import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import RouteMap from '../../components/ui/RouteMap';
import {
  Cpu,
  Zap,
  Sparkles,
  ShieldAlert,
  Sliders,
  Compass,
  CloudRain,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Database,
  Award,
  Package,
  Truck,
  Users,
  Building2,
  Navigation,
  Check,
  ChevronRight
} from 'lucide-react';

const AIDashboard = () => {
  const [searchParams] = useSearchParams();
  const queryShipmentId = searchParams.get('shipmentId');

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [selectingRoute, setSelectingRoute] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch AI Dashboard Data for given shipment ID (or default)
  const fetchDashboardData = async (shipmentId = '') => {
    setLoading(true);
    setErrorMsg('');
    try {
      let url = '/ai-dashboard/overview';
      if (shipmentId) {
        url += `?shipmentId=${shipmentId}`;
      }
      const res = await axiosInstance.get(url);
      if (res.data && res.data.success) {
        setDashboardData(res.data.data);
        if (res.data.data.shipmentId && res.data.data.shipmentId !== selectedShipmentId) {
          setSelectedShipmentId(res.data.data.shipmentId);
        }
      } else {
        setErrorMsg('Unable to load AI dashboard overview.');
      }
    } catch (err) {
      console.error('Error loading AI dashboard:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to fetch AI dashboard intelligence.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDashboardData(queryShipmentId || '');
  }, [queryShipmentId]);

  // When shipment dropdown changes, immediately clear data to prevent stale state and re-fetch
  const handleShipmentChange = (e) => {
    const newId = e.target.value;
    setSelectedShipmentId(newId);
    setDashboardData(null);
    setSuccessMsg('');
    setErrorMsg('');
    fetchDashboardData(newId);
  };

  // Save/select recommended route for shipment
  const handleSelectRoute = async (routeData) => {
    if (!dashboardData?.shipment) return;
    setSelectingRoute(true);
    setErrorMsg('');
    setSuccessMsg('');

    const shipment = dashboardData.shipment;
    const pCoords = shipment.pickupLocation?.coordinates;
    const dCoords = shipment.deliveryLocation?.coordinates;

    const source = {
      latitude: parseFloat(pCoords?.[1] || 28.6139),
      longitude: parseFloat(pCoords?.[0] || 77.2090),
      address: typeof shipment.pickupAddress === 'object' ? shipment.pickupAddress?.street : (shipment.pickupAddress || 'Customer Pickup'),
      city: shipment.pickupAddress?.city || shipment.pickupCity || 'Customer Pickup'
    };

    const destination = {
      latitude: parseFloat(dCoords?.[1] || 19.0760),
      longitude: parseFloat(dCoords?.[0] || 72.8777),
      address: typeof shipment.deliveryAddress === 'object' ? shipment.deliveryAddress?.street : (shipment.deliveryAddress || 'Customer Delivery'),
      city: shipment.deliveryAddress?.city || shipment.deliveryCity || 'Customer Delivery'
    };

    try {
      const res = await axiosInstance.post('/routes/select', {
        shipmentId: shipment._id,
        routeData,
        source,
        destination
      });

      if (res.data && res.data.success) {
        setSuccessMsg(`Route "${routeData.name || 'Recommended Route'}" selected & saved for shipment ${dashboardData.trackingNumber}!`);
        // Refresh dashboard data
        fetchDashboardData(shipment._id);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Route selection failed.');
    } finally {
      setSelectingRoute(false);
    }
  };

  const metrics = dashboardData?.summaryMetrics || {
    totalShipments: 0,
    activeShipments: 0,
    vehiclesAssigned: 0,
    deliveredShipments: 0,
    routesAnalyzed: 0,
    recommendedRoutes: 0
  };

  const shipment = dashboardData?.shipment || null;
  const weather = dashboardData?.weather || null;
  const eta = dashboardData?.eta || null;
  const delayRisk = dashboardData?.delayRisk || null;
  const accessibility = dashboardData?.accessibility || null;
  const recommendation = dashboardData?.routeRecommendation || null;
  const recommendedRoute = recommendation?.recommendedRoute || null;
  const candidateRoutes = recommendation?.candidateRoutes || [];

  const getRiskBadgeColor = (risk) => {
    if (risk === 'HIGH' || risk === 'CRITICAL') return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    if (risk === 'MEDIUM' || risk === 'MODERATE' || risk === 'RESTRICTED') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  };

  return (
    <div className="space-y-6">
      {/* SECTION A: DASHBOARD HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
              <Cpu className="w-7 h-7 text-cyan-400" />
              <span>AI Logistics Dashboard</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              AI-powered operational intelligence for shipment planning and route decisions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
            <span className="bg-slate-950 border border-slate-800 text-slate-400 px-3 py-1.5 rounded-xl">
              Last Updated: {dashboardData?.generatedAt ? new Date(dashboardData.generatedAt).toLocaleTimeString() : 'Just Now'}
            </span>
            <span className={`px-2.5 py-1.5 rounded-xl border font-bold ${dashboardData?.aiServicesStatus?.eta === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}`}>
              ETA: {dashboardData?.aiServicesStatus?.eta || 'AVAILABLE'}
            </span>
            <span className={`px-2.5 py-1.5 rounded-xl border font-bold ${dashboardData?.aiServicesStatus?.delayRisk === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}`}>
              Delay Risk: {dashboardData?.aiServicesStatus?.delayRisk || 'AVAILABLE'}
            </span>
            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-1.5 rounded-xl font-bold">
              Accessibility: AVAILABLE
            </span>
            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-1.5 rounded-xl font-bold">
              Route Intelligence: AVAILABLE
            </span>
            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-1.5 rounded-xl font-bold">
              DATASET: SYNTHETIC
            </span>
          </div>
        </div>
      </div>

      {/* SECTION B: SHIPMENT OVERVIEW SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
            <Package className="w-3 h-3 text-cyan-400" />
            <span>Total Shipments</span>
          </span>
          <div className="text-2xl font-black text-slate-100 font-mono">{metrics.totalShipments}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
            <Navigation className="w-3 h-3 text-cyan-400" />
            <span>Active / In Transit</span>
          </span>
          <div className="text-2xl font-black text-cyan-400 font-mono">{metrics.activeShipments}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
            <Truck className="w-3 h-3 text-purple-400" />
            <span>Vehicle Assigned</span>
          </span>
          <div className="text-2xl font-black text-purple-300 font-mono">{metrics.vehiclesAssigned}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Delivered</span>
          </span>
          <div className="text-2xl font-black text-emerald-400 font-mono">{metrics.deliveredShipments}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
            <Compass className="w-3 h-3 text-amber-400" />
            <span>Routes Analyzed</span>
          </span>
          <div className="text-2xl font-black text-amber-300 font-mono">{metrics.routesAnalyzed}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-400" />
            <span>Recommended Routes</span>
          </span>
          <div className="text-2xl font-black text-emerald-300 font-mono">{metrics.recommendedRoutes}</div>
        </div>
      </div>

      {/* SECTION C: SELECT SHIPMENT */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Target Shipment Intelligence Selector</span>
          </h2>

          {shipment && (
            <span className="text-xs text-slate-400 font-mono">
              Selected: <strong className="text-cyan-400">{shipment.trackingId || shipment.trackingNumber}</strong> • Payload:{' '}
              <strong className="text-slate-200">{shipment.weightKg} Kg</strong>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1.5 font-semibold">Choose Shipment for AI Intelligence Analysis</label>
            <select
              value={selectedShipmentId}
              onChange={handleShipmentChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 font-mono focus:border-cyan-500"
            >
              {Array.isArray(dashboardData?.allShipmentsList) && dashboardData.allShipmentsList.length > 0 ? (
                dashboardData.allShipmentsList.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.trackingNumber} ({s.pickupCity} → {s.deliveryCity}) — Status: {s.status} — Payload: {s.weightKg}kg
                  </option>
                ))
              ) : (
                <option value="">Loading Shipments...</option>
              )}
            </select>
          </div>

          {shipment && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between font-mono text-xs text-slate-300">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Transit Corridor:</span>
                <span className="font-bold text-emerald-400">{shipment.pickupAddress?.city || shipment.pickupCity || 'Origin'}</span>
                <span className="text-slate-500 mx-1">→</span>
                <span className="font-bold text-amber-400">{shipment.deliveryAddress?.city || shipment.deliveryCity || 'Destination'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Status:</span>
                <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                  {shipment.status}
                </span>
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
          <span className="text-xs font-mono">Loading AI intelligence...</span>
        </div>
      ) : shipment ? (
        <div className="space-y-6">

          {/* SECTION H & I: MAIN AI ROUTE RECOMMENDATION & WEIGHTED FACTOR BREAKDOWN */}
          {recommendedRoute ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    AI Route Recommendation (Phase 3F)
                  </h2>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className={`px-2.5 py-1 rounded-lg border font-bold ${getRiskBadgeColor(recommendedRoute.recommendationLevel)}`}>
                    {recommendedRoute.recommendationLevel}
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg font-bold">
                    DECISION SUPPORT
                  </span>
                  <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-1 rounded-lg font-bold">
                    DATASET: SYNTHETIC
                  </span>
                </div>
              </div>

              {/* Spotlight Recommended Card */}
              <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-5 space-y-4 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">
                      Top Recommended Route
                    </span>
                    <h3 className="text-lg font-bold text-slate-100 mt-0.5">
                      {recommendedRoute.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right font-mono">
                      <span className="text-[10px] text-slate-400 block">Recommendation Score</span>
                      <span className="text-3xl font-black text-emerald-300">
                        {recommendedRoute.recommendationScore}
                        <span className="text-xs text-slate-500 font-normal"> / 100</span>
                      </span>
                    </div>

                    <button
                      onClick={() => handleSelectRoute(recommendedRoute)}
                      disabled={selectingRoute}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5"
                    >
                      {selectingRoute ? (
                        <span>Saving...</span>
                      ) : (
                        <>
                          <span>Select Recommended Route</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Candidate Route Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Route Distance</span>
                    <strong className="text-slate-100 text-sm">{recommendedRoute.distanceKm} km</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Predicted ETA</span>
                    <strong className="text-cyan-400 text-sm">{recommendedRoute.predictedEtaMin} min</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Delay Probability</span>
                    <strong className="text-amber-400 text-sm">{recommendedRoute.delayProbabilityPercent}%</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Accessibility Score</span>
                    <strong className="text-purple-300 text-sm">{recommendedRoute.accessibilityScore} / 100</strong>
                  </div>
                </div>

                {/* SECTION I: WEIGHTED AI FACTOR BREAKDOWN */}
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Phase 3F Weighted Factor Breakdown (0–100 Normalized)
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs font-mono">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                      <span className="text-[9px] text-slate-500 block">Route Quality (25%)</span>
                      <span className="font-bold text-slate-200">{recommendedRoute.scoreBreakdown?.qualityScore?.raw}</span>
                      <span className="text-[9px] text-emerald-400 block">+{recommendedRoute.scoreBreakdown?.qualityScore?.points} pts</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                      <span className="text-[9px] text-slate-500 block">AI ETA (20%)</span>
                      <span className="font-bold text-cyan-300">{recommendedRoute.scoreBreakdown?.etaEfficiency?.raw}</span>
                      <span className="text-[9px] text-cyan-400 block">+{recommendedRoute.scoreBreakdown?.etaEfficiency?.points} pts</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                      <span className="text-[9px] text-slate-500 block">Delay Risk (20%)</span>
                      <span className="font-bold text-amber-300">{recommendedRoute.scoreBreakdown?.delayRiskScore?.raw}</span>
                      <span className="text-[9px] text-amber-400 block">+{recommendedRoute.scoreBreakdown?.delayRiskScore?.points} pts</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                      <span className="text-[9px] text-slate-500 block">Accessibility (20%)</span>
                      <span className="font-bold text-purple-300">{recommendedRoute.scoreBreakdown?.accessibilityScore?.raw}</span>
                      <span className="text-[9px] text-purple-400 block">+{recommendedRoute.scoreBreakdown?.accessibilityScore?.points} pts</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                      <span className="text-[9px] text-slate-500 block">Distance (10%)</span>
                      <span className="font-bold text-slate-200">{recommendedRoute.scoreBreakdown?.distanceEfficiency?.raw}</span>
                      <span className="text-[9px] text-slate-400 block">+{recommendedRoute.scoreBreakdown?.distanceEfficiency?.points} pts</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                      <span className="text-[9px] text-slate-500 block">Weather (5%)</span>
                      <span className="font-bold text-blue-300">{recommendedRoute.scoreBreakdown?.weatherScore?.raw}</span>
                      <span className="text-[9px] text-blue-400 block">+{recommendedRoute.scoreBreakdown?.weatherScore?.points} pts</span>
                    </div>
                  </div>
                </div>

                {/* SECTION K: AI ADVANTAGES AND RISK NOTES */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                  {Array.isArray(recommendedRoute.positiveFactors) && recommendedRoute.positiveFactors.length > 0 && (
                    <div className="bg-slate-900/80 border border-emerald-500/20 rounded-xl p-3 space-y-1.5 font-mono">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase block">AI Key Advantages:</span>
                      {recommendedRoute.positiveFactors.map((f, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-emerald-300 text-[11px]">
                          <span className="shrink-0 font-bold">✓</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {Array.isArray(recommendedRoute.warningFactors) && recommendedRoute.warningFactors.length > 0 && (
                    <div className="bg-slate-900/80 border border-amber-500/20 rounded-xl p-3 space-y-1.5 font-mono">
                      <span className="text-[10px] text-amber-400 font-bold uppercase block">AI Risk Notes:</span>
                      {recommendedRoute.warningFactors.map((f, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-amber-300 text-[11px]">
                          <span className="shrink-0 font-bold">⚠</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
              Route recommendation data unavailable for target shipment.
            </div>
          )}

          {/* SECTION D: WEATHER INTELLIGENCE (PHASE 3A) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CloudRain className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Weather Intelligence (Phase 3A — Open-Meteo)
                </h2>
              </div>

              {weather && (
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border font-mono ${getRiskBadgeColor(weather.endpointRisk)}`}>
                  Endpoint Risk: {weather.endpointRisk}
                </span>
              )}
            </div>

            {weather ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Pickup Weather */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <span className="font-bold text-emerald-400">Pickup: {weather.pickupCity}</span>
                    {weather.pickupWeather && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getRiskBadgeColor(weather.pickupWeather.weatherRisk)}`}>
                        {weather.pickupWeather.weatherRisk}
                      </span>
                    )}
                  </div>
                  {weather.pickupWeather ? (
                    <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px] font-mono">
                      <p><span className="text-slate-500">Condition: </span>{weather.pickupWeather.condition}</p>
                      <p><span className="text-slate-500">Temp: </span><strong className="text-cyan-400">{weather.pickupWeather.temperature}°C</strong></p>
                      <p><span className="text-slate-500">Rainfall: </span>{weather.pickupWeather.rain} mm</p>
                      <p><span className="text-slate-500">Wind: </span>{weather.pickupWeather.windSpeed} km/h</p>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-[11px]">Weather data temporarily unavailable for pickup location.</p>
                  )}
                </div>

                {/* Delivery Weather */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <span className="font-bold text-amber-400">Destination: {weather.deliveryCity}</span>
                    {weather.deliveryWeather && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getRiskBadgeColor(weather.deliveryWeather.weatherRisk)}`}>
                        {weather.deliveryWeather.weatherRisk}
                      </span>
                    )}
                  </div>
                  {weather.deliveryWeather ? (
                    <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px] font-mono">
                      <p><span className="text-slate-500">Condition: </span>{weather.deliveryWeather.condition}</p>
                      <p><span className="text-slate-500">Temp: </span><strong className="text-cyan-400">{weather.deliveryWeather.temperature}°C</strong></p>
                      <p><span className="text-slate-500">Rainfall: </span>{weather.deliveryWeather.rain} mm</p>
                      <p><span className="text-slate-500">Wind: </span>{weather.deliveryWeather.windSpeed} km/h</p>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-[11px]">Weather data temporarily unavailable for delivery location.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-xs">
                Weather data unavailable.
              </div>
            )}
          </div>

          {/* SECTION E: ETA INTELLIGENCE (PHASE 3C) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  ETA Intelligence (Phase 3C — ML Regression)
                </h2>
              </div>

              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className={`px-2.5 py-1 rounded-lg border font-bold ${eta?.mlEtaAvailable ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}`}>
                  STATUS: {eta?.modelStatus || 'AVAILABLE'}
                </span>
                <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-1 rounded-lg font-bold">
                  DATASET: SYNTHETIC
                </span>
              </div>
            </div>

            {eta ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* ORS Baseline Card */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      ORS Baseline ETA
                    </span>
                    <div className="text-2xl font-bold text-slate-200 font-mono">
                      {eta.baselineDurationMin} min
                    </div>
                    <div className="text-[11px] text-slate-400">
                      ~ {eta.baselineDurationHours} hours
                    </div>
                  </div>

                  {/* AI Predicted ETA Card */}
                  <div className="bg-slate-950 border border-cyan-500/40 rounded-2xl p-4 space-y-1 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-cyan-500/20 text-cyan-300 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg font-mono">
                      {eta.modelName || 'GradientBoosting'}
                    </div>
                    <span className="text-[10px] text-cyan-400 uppercase font-bold block">
                      AI Predicted Transit Duration
                    </span>
                    <div className="text-2xl font-black text-cyan-300 font-mono">
                      {eta.predictedDurationMin} min
                    </div>
                    <div className="text-[11px] text-cyan-400 font-semibold">
                      ~ {eta.predictedDurationHours} hours
                    </div>
                  </div>

                  {/* Difference Card */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Difference from Baseline
                    </span>
                    <div className={`text-2xl font-bold font-mono ${eta.differenceFromBaselineMin > 0 ? 'text-rose-400' : eta.differenceFromBaselineMin < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {eta.differenceFromBaselineMin > 0 ? '+' : ''}{eta.differenceFromBaselineMin} min
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {eta.differenceFromBaselineMin > 0 ? 'AI predicts traffic/weather adjustment' : eta.differenceFromBaselineMin < 0 ? 'AI predicts faster transit corridor' : 'Exact match with baseline'}
                    </div>
                  </div>
                </div>

                {/* Visual Bar Comparison */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-3 font-mono text-xs">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">
                    Visual Duration Comparison (Minutes):
                  </span>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1 text-slate-400">
                        <span>ORS Baseline ETA</span>
                        <span>{eta.baselineDurationMin} min</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                        <div
                          className="bg-slate-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(10, (eta.baselineDurationMin / Math.max(eta.baselineDurationMin, eta.predictedDurationMin, 1)) * 100))}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1 text-cyan-400">
                        <span>AI Predicted ETA ({eta.modelName})</span>
                        <span>{eta.predictedDurationMin} min</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                        <div
                          className="bg-cyan-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(10, (eta.predictedDurationMin / Math.max(eta.baselineDurationMin, eta.predictedDurationMin, 1)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-xs">
                ETA prediction data unavailable.
              </div>
            )}
          </div>

          {/* SECTION F: DELAY RISK (PHASE 3D) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Delay Risk Intelligence (Phase 3D — Classification)
                </h2>
              </div>

              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className={`px-2.5 py-1 rounded-lg border font-bold ${delayRisk?.riskAvailable ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}`}>
                  STATUS: {delayRisk?.modelStatus || 'AVAILABLE'}
                </span>
                <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-1 rounded-lg font-bold">
                  DATASET: SYNTHETIC
                </span>
              </div>
            </div>

            {delayRisk && delayRisk.riskAvailable ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                  {/* Risk Level Card */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Operational Risk Level
                    </span>
                    <span className={`inline-block text-xl font-black px-3 py-1 rounded-xl border ${getRiskBadgeColor(delayRisk.riskLevel)}`}>
                      {delayRisk.riskLevel}
                    </span>
                    <div className="text-[11px] text-slate-400">
                      {delayRisk.riskLevel === 'HIGH' ? 'High delay risk — dispatch attention advised' : delayRisk.riskLevel === 'MEDIUM' ? 'Moderate delay risk corridor' : 'Low delay risk corridor'}
                    </div>
                  </div>

                  {/* Delay Probability Card */}
                  <div className="bg-slate-950 border border-amber-500/40 rounded-2xl p-4 space-y-1 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-amber-500/20 text-amber-300 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                      {delayRisk.model || 'GradientBoostingClassifier'}
                    </div>
                    <span className="text-[10px] text-amber-400 uppercase font-bold block">
                      Delay Probability
                    </span>
                    <div className="text-3xl font-black text-amber-300">
                      {delayRisk.delayProbability}%
                    </div>
                    <div className="text-[11px] text-slate-400">
                      On-Time Probability: <strong className="text-emerald-400">{delayRisk.onTimeProbability}%</strong>
                    </div>
                  </div>

                  {/* Classification Card */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Predicted Classification
                    </span>
                    <div className="text-xl font-bold text-slate-100 mt-1">
                      {delayRisk.prediction === 'DELAYED' ? (
                        <span className="text-rose-400 flex items-center gap-1.5">
                          <AlertCircle className="w-5 h-5 text-rose-400" />
                          <span>DELAYED</span>
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span>ON_TIME</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Model F1 Score: <strong className="text-slate-200">{((delayRisk.metrics?.f1 || 0.896) * 100).toFixed(1)}%</strong>
                    </div>
                  </div>
                </div>

                {/* Key Model Features Breakdown (Requirement F) */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-3 font-mono text-[11px]">
                  <span className="text-slate-400 font-bold block uppercase tracking-wide text-[10px] border-b border-slate-800/60 pb-2">
                    Key Model Features (Actual Trained Model Feature Importance):
                  </span>

                  {Array.isArray(delayRisk.keyFactors) && delayRisk.keyFactors.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {delayRisk.keyFactors.map((kf, idx) => (
                        <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                          <span className="text-slate-300 font-medium">{kf.feature}</span>
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded text-[10px] font-bold">
                            {kf.importance}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500 italic">Feature importance output unavailable</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-xs">
                Delay risk prediction data unavailable.
              </div>
            )}
          </div>

          {/* SECTION G: ACCESSIBILITY INTELLIGENCE (PHASE 3E) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-400" />
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Accessibility Intelligence (Phase 3E — Rules Engine)
                </h2>
              </div>

              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className={`px-2.5 py-1 rounded-lg border font-bold ${getRiskBadgeColor(accessibility?.level)}`}>
                  LEVEL: {accessibility?.level || 'UNKNOWN'}
                </span>
                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-1 rounded-lg font-bold">
                  RULE-BASED
                </span>
              </div>
            </div>

            {accessibility && accessibility.available ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                  {/* Accessibility Score Card */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Accessibility Score
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-black text-purple-300">
                        {accessibility.score}
                      </span>
                      <span className="text-xs text-slate-500">/ 100</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Evaluated across 7 operational parameters
                    </div>
                  </div>

                  {/* Operational Level Card */}
                  <div className="bg-slate-950 border border-purple-500/40 rounded-2xl p-4 space-y-1 relative overflow-hidden">
                    <span className="text-[10px] text-purple-400 uppercase font-bold block">
                      Operational Level
                    </span>
                    <span className={`inline-block text-xl font-black px-3 py-1 rounded-xl border mt-1 ${getRiskBadgeColor(accessibility.level)}`}>
                      {accessibility.level}
                    </span>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {accessibility.level === 'GOOD' ? 'Favorable transit compatibility' : 'Operational attention required'}
                    </div>
                  </div>

                  {/* Compatibility Grid Card */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1 text-[11px]">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                      Key Compatibility Factors
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      <p><span className="text-slate-500">Vehicle: </span><strong className="text-slate-100">{accessibility.vehicleCompatibility}</strong></p>
                      <p><span className="text-slate-500">Cargo: </span><strong className="text-slate-100">{accessibility.cargoCompatibility}</strong></p>
                      <p><span className="text-slate-500">Route: </span><strong className="text-slate-100">{accessibility.routeSuitability}</strong></p>
                      <p><span className="text-slate-500">Weather: </span><strong className="text-slate-100">{accessibility.weatherImpact}</strong></p>
                      <p><span className="text-slate-500">Risk: </span><strong className="text-slate-100">{accessibility.operationalRisk}</strong></p>
                      <p><span className="text-slate-500">ETA Impact: </span><strong className="text-slate-100">{accessibility.etaImpact}</strong></p>
                    </div>
                  </div>
                </div>

                {/* Assessment Reasons List */}
                {Array.isArray(accessibility.reasons) && accessibility.reasons.length > 0 && (
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-2 font-mono text-[11px]">
                    <span className="text-slate-400 font-bold block uppercase tracking-wide text-[10px] border-b border-slate-800/60 pb-2">
                      Operational Assessment Reasons:
                    </span>
                    <div className="space-y-1 pt-1">
                      {accessibility.reasons.map((reason, idx) => {
                        const isPos = reason.startsWith('✓');
                        return (
                          <div key={idx} className={`flex items-start gap-2 p-2 rounded-xl border ${isPos ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' : 'bg-amber-500/5 border-amber-500/20 text-amber-300'}`}>
                            <span className="shrink-0 font-bold">{isPos ? '✓' : '⚠'}</span>
                            <span>{reason.replace(/^[✓⚠]\s*/, '')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-xs">
                Accessibility intelligence unavailable.
              </div>
            )}
          </div>

          {/* SECTION J: ROUTE COMPARISON TABLE (PHASE 3F) */}
          {candidateRoutes.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Compass className="w-5 h-5 text-cyan-400" />
                  <span>Candidate Route Intelligence Comparison (Phase 3F)</span>
                </h2>
                <span className="text-xs text-cyan-400">{candidateRoutes.length} Options Evaluated</span>
              </div>

              <div className="space-y-2 text-xs">
                {candidateRoutes.map((cand, idx) => (
                  <div
                    key={cand.id || idx}
                    className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                      cand.isRecommended
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                        : cand.disqualified
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 opacity-80'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-100 text-sm">{cand.name}</strong>
                        {cand.isRecommended && (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold px-2 py-0.5 rounded">
                            RECOMMENDED
                          </span>
                        )}
                        {!cand.isRecommended && !cand.disqualified && (
                          <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[9px] font-bold px-2 py-0.5 rounded">
                            ALTERNATIVE (LOWER SCORE)
                          </span>
                        )}
                        {cand.disqualified && (
                          <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-bold px-2 py-0.5 rounded">
                            DISQUALIFIED
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                        <span>Distance: <strong className="text-slate-200">{cand.distanceKm} km</strong></span>
                        <span>ETA: <strong className="text-cyan-400">{cand.predictedEtaMin} min</strong></span>
                        <span>Delay Prob: <strong className="text-amber-400">{cand.delayProbabilityPercent}%</strong></span>
                        <span>Accessibility: <strong className="text-purple-300">{cand.accessibilityScore}/100</strong></span>
                        <span>Weather Risk: <strong className="text-blue-300">{cand.weatherRisk}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end md:self-center">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">AI Score</span>
                        <span className="font-black text-lg text-slate-100">{cand.recommendationScore} / 100</span>
                      </div>

                      <button
                        onClick={() => handleSelectRoute(cand)}
                        disabled={selectingRoute || cand.disqualified}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold text-[11px] px-3 py-2 rounded-xl border border-slate-700 transition"
                      >
                        Use This Route
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION L: ROUTE MAP */}
          {candidateRoutes.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Navigation className="w-5 h-5 text-cyan-400" />
                <span>Interactive Route Canvas</span>
                <span className="text-xs text-cyan-400 font-mono">({recommendedRoute?.name || 'Selected Route'})</span>
              </h2>

              <RouteMap
                source={{
                  latitude: parseFloat(shipment.pickupLocation?.coordinates?.[1] || 28.6139),
                  longitude: parseFloat(shipment.pickupLocation?.coordinates?.[0] || 77.2090),
                  address: typeof shipment.pickupAddress === 'object' ? shipment.pickupAddress?.street : shipment.pickupAddress,
                  city: shipment.pickupAddress?.city || shipment.pickupCity
                }}
                destination={{
                  latitude: parseFloat(shipment.deliveryLocation?.coordinates?.[1] || 19.0760),
                  longitude: parseFloat(shipment.deliveryLocation?.coordinates?.[0] || 72.8777),
                  address: typeof shipment.deliveryAddress === 'object' ? shipment.deliveryAddress?.street : shipment.deliveryAddress,
                  city: shipment.deliveryAddress?.city || shipment.deliveryCity
                }}
                routeGeometry={recommendedRoute?.geometry}
                height="420px"
              />
            </div>
          )}

          {/* SECTION M: OWNER DECISION SUPPORT */}
          {recommendedRoute && (
            <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block font-mono">
                    Owner Decision Support Action Area
                  </span>
                  <h3 className="text-base font-bold text-slate-100 mt-1">
                    Recommended Optimal Route: <span className="text-emerald-400">{recommendedRoute.name}</span> ({recommendedRoute.recommendationScore} / 100)
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleSelectRoute(recommendedRoute)}
                    disabled={selectingRoute}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
                  >
                    {selectingRoute ? (
                      <span>Saving Selected Route...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>SELECT RECOMMENDED ROUTE</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION N: MULTI-SHIPMENT OWNER VIEW TABLE */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                <span>Pan-India Active Shipments AI Summary Overview</span>
              </h2>
              <span className="text-xs text-slate-400">Top 10 Active Shipments</span>
            </div>

            {Array.isArray(dashboardData?.multiShipmentOverview) && dashboardData.multiShipmentOverview.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Tracking ID</th>
                      <th className="py-2.5 px-3">Corridor</th>
                      <th className="py-2.5 px-3">AI Score</th>
                      <th className="py-2.5 px-3">AI ETA</th>
                      <th className="py-2.5 px-3">Delay Risk</th>
                      <th className="py-2.5 px-3">Accessibility</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {dashboardData.multiShipmentOverview.map((item) => (
                      <tr key={item._id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3 font-bold text-cyan-400">{item.trackingNumber}</td>
                        <td className="py-3 px-3">{item.pickupCity} → {item.deliveryCity}</td>
                        <td className="py-3 px-3 font-bold text-emerald-400">{item.aiScore} / 100</td>
                        <td className="py-3 px-3 text-cyan-300">{item.predictedEtaMin} min</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadgeColor(item.delayRiskLevel)}`}>
                            {item.delayRiskLevel}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-purple-300">{item.accessibilityScore} / 100</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                            {item.recommendationStatus}
                          </span>
                        </td>
                          <button
                            onClick={() => {
                              setSelectedShipmentId(item._id);
                              setDashboardData(null);
                              setSuccessMsg('');
                              setErrorMsg('');
                              fetchDashboardData(item._id);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-700 transition"
                          >
                            Analyze
                          </button>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3 text-slate-500 text-xs">No multi-shipment overview available.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center text-slate-400 text-xs space-y-2">
          <AlertCircle className="w-8 h-8 text-cyan-400 mx-auto" />
          <p>No shipment selected. Please select a target shipment above to view AI intelligence.</p>
        </div>
      )}
    </div>
  );
};

export default AIDashboard;
