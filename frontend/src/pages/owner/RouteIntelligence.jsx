import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import RouteMap from '../../components/ui/RouteMap';
import {
  Compass,
  Navigation,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Zap,
  RefreshCw,
  AlertCircle,
  CloudRain,
  Thermometer,
  Wind,
  Droplets,
  Clock,
  Sparkles,
  Cpu,
  Sliders
} from 'lucide-react';

const RouteIntelligence = () => {
  const [searchParams] = useSearchParams();
  const queryShipmentId = searchParams.get('shipmentId');

  const [shipments, setShipments] = useState([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [selectedShipment, setSelectedShipment] = useState(null);
  const prevShipmentIdRef = useRef(selectedShipmentId);
  const mapSectionRef = useRef(null);

  const [source, setSource] = useState({ latitude: 28.6139, longitude: 77.2090, address: 'Delhi National Hub', city: 'New Delhi' });
  const [destination, setDestination] = useState({ latitude: 19.0760, longitude: 72.8777, address: 'Mumbai Central Gateway Hub', city: 'Mumbai' });

  const [calculating, setCalculating] = useState(false);
  const [candidateRoutes, setCandidateRoutes] = useState([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);

  const [selecting, setSelecting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Weather Endpoint State
  const [endpointWeather, setEndpointWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // Phase 3C ML ETA Prediction State
  const [etaPrediction, setEtaPrediction] = useState(null);
  const [loadingEta, setLoadingEta] = useState(false);

  // Phase 3D ML Delay Risk Prediction State
  const [delayRiskData, setDelayRiskData] = useState(null);
  const [loadingDelayRisk, setLoadingDelayRisk] = useState(false);

  // Phase 3E Accessibility Intelligence State
  const [accessibilityData, setAccessibilityData] = useState(null);
  const [loadingAccessibility, setLoadingAccessibility] = useState(false);

  // Phase 3F AI Route Recommendation State
  const [recommendationData, setRecommendationData] = useState(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);

  // Fetch all shipments on load
  useEffect(() => {
    const fetchShipments = async () => {
      try {
        const res = await axiosInstance.get('/shipments');
        if (res.data && Array.isArray(res.data.data)) {
          setShipments(res.data.data);
          if (queryShipmentId) {
            const match = res.data.data.find(
              (s) => s._id === queryShipmentId || s.trackingNumber === queryShipmentId || s.trackingId === queryShipmentId
            );
            if (match) {
              setSelectedShipmentId(match._id);
            }
          } else if (res.data.data.length > 0) {
            setSelectedShipmentId(res.data.data[0]._id);
          }
        }
      } catch (err) {
        console.log('Error fetching shipments for route intelligence');
      }
    };
    fetchShipments();
  }, [queryShipmentId]);

  // When selected shipment changes, update source & destination inputs and fetch endpoint weather, ETA, Delay Risk, Accessibility, and Recommendation
  useEffect(() => {
    if (!selectedShipmentId) return;
    const shipment = shipments.find((s) => s._id === selectedShipmentId);
    if (shipment) {
      setSelectedShipment(shipment);

      // Only clear success message and candidate routes if the shipment actually changed
      if (prevShipmentIdRef.current !== selectedShipmentId) {
        setSuccessMsg('');
        setActiveRouteIndex(0);
        prevShipmentIdRef.current = selectedShipmentId;

        // If the shipment already has an assigned route in DB, persist and display it
        if (shipment.route && typeof shipment.route === 'object' && shipment.route.geometry?.coordinates?.length) {
          setCandidateRoutes([
            {
              id: String(shipment.route._id || shipment.route.id),
              _id: String(shipment.route._id || shipment.route.id),
              name: shipment.route.routeName || 'Assigned Logistics Route',
              distanceKm: shipment.route.distanceKm,
              durationMinutes: shipment.route.estimatedDurationMinutes || shipment.route.durationMinutes || 0,
              score: shipment.route.score || 90,
              geometry: shipment.route.geometry,
              status: 'SELECTED',
              isSelected: true,
              trafficStatus: shipment.route.trafficStatus || 'Normal Highway Flow'
            }
          ]);
        } else {
          setCandidateRoutes([]);
        }
      } else if (candidateRoutes.length === 0 && shipment.route && typeof shipment.route === 'object' && shipment.route.geometry?.coordinates?.length) {
        setCandidateRoutes([
          {
            id: String(shipment.route._id || shipment.route.id),
            _id: String(shipment.route._id || shipment.route.id),
            name: shipment.route.routeName || 'Assigned Logistics Route',
            distanceKm: shipment.route.distanceKm,
            durationMinutes: shipment.route.estimatedDurationMinutes || shipment.route.durationMinutes || 0,
            score: shipment.route.score || 90,
            geometry: shipment.route.geometry,
            status: 'SELECTED',
            isSelected: true,
            trafficStatus: shipment.route.trafficStatus || 'Normal Highway Flow'
          }
        ]);
      }
      setErrorMsg('');

      // Clear previous prediction state immediately to prevent showing stale data
      setEndpointWeather(null);
      setEtaPrediction(null);
      setDelayRiskData(null);
      setAccessibilityData(null);
      setRecommendationData(null);

      const srcCoords = shipment.pickupLocation?.coordinates;
      const destCoords = shipment.deliveryLocation?.coordinates;

      if (srcCoords && Array.isArray(srcCoords) && srcCoords.length >= 2 && srcCoords[0] !== null) {
        setSource({
          latitude: parseFloat(srcCoords[1]),
          longitude: parseFloat(srcCoords[0]),
          address: typeof shipment.pickupAddress === 'object' ? (shipment.pickupAddress?.street || 'Customer Pickup Address') : (shipment.pickupAddress || 'Customer Pickup Address'),
          city: shipment.pickupAddress?.city || shipment.pickupCity || 'Customer Pickup'
        });
      } else {
        setErrorMsg('Shipment pickup location coordinates are missing.');
      }

      if (destCoords && Array.isArray(destCoords) && destCoords.length >= 2 && destCoords[0] !== null) {
        setDestination({
          latitude: parseFloat(destCoords[1]),
          longitude: parseFloat(destCoords[0]),
          address: typeof shipment.deliveryAddress === 'object' ? (shipment.deliveryAddress?.street || 'Customer Delivery Address') : (shipment.deliveryAddress || 'Customer Delivery Address'),
          city: shipment.deliveryAddress?.city || shipment.deliveryCity || 'Customer Delivery'
        });
      } else {
        setErrorMsg('Shipment delivery location coordinates are missing.');
      }

      // Fetch weather at route endpoints
      fetchRouteEndpointWeather(shipment._id);
      // Fetch Phase 3C ML ETA Prediction
      fetchEtaPrediction(shipment._id);
      // Fetch Phase 3D ML Delay Risk Prediction
      fetchDelayRiskPrediction(shipment._id);
      // Fetch Phase 3E Accessibility Intelligence
      fetchAccessibilityData(shipment._id);
      // Fetch Phase 3F AI Route Recommendation
      fetchRouteRecommendation(shipment._id);
    }
  }, [selectedShipmentId, shipments]);

  const fetchRouteEndpointWeather = async (shipmentId) => {
    setLoadingWeather(true);
    try {
      const res = await axiosInstance.get(`/weather/shipment/${shipmentId}`);
      if (res.data && res.data.success) {
        setEndpointWeather(res.data.data);
        if (res.data.data.pickupCity) {
          setSource((prev) => ({ ...prev, city: res.data.data.pickupCity }));
        }
        if (res.data.data.deliveryCity) {
          setDestination((prev) => ({ ...prev, city: res.data.data.deliveryCity }));
        }
      }
    } catch (err) {
      console.log('Endpoint weather unavailable');
      setEndpointWeather(null);
    } finally {
      setLoadingWeather(false);
    }
  };

  const fetchEtaPrediction = async (shipmentId, routeOptions = null) => {
    setLoadingEta(true);
    try {
      let url = `/eta/shipment/${shipmentId}`;
      if (routeOptions) {
        const params = new URLSearchParams();
        if (routeOptions.distanceKm) params.append('distanceKm', routeOptions.distanceKm);
        if (routeOptions.expectedDurationMin) params.append('expectedDurationMin', routeOptions.expectedDurationMin);
        if (routeOptions.routeScore) params.append('routeScore', routeOptions.routeScore);
        const qStr = params.toString();
        if (qStr) url += `?${qStr}`;
      }
      const res = await axiosInstance.get(url);
      if (res.data && res.data.success) {
        setEtaPrediction(res.data);
      }
    } catch (err) {
      console.log('ETA prediction fetch unavailable');
      setEtaPrediction(null);
    } finally {
      setLoadingEta(false);
    }
  };

  const fetchDelayRiskPrediction = async (shipmentId, routeOptions = null) => {
    setLoadingDelayRisk(true);
    try {
      let url = `/delay-risk/shipment/${shipmentId}`;
      if (routeOptions) {
        const params = new URLSearchParams();
        if (routeOptions.distanceKm) params.append('distanceKm', routeOptions.distanceKm);
        if (routeOptions.expectedDurationMin) params.append('expectedDurationMin', routeOptions.expectedDurationMin);
        if (routeOptions.routeScore) params.append('routeScore', routeOptions.routeScore);
        const qStr = params.toString();
        if (qStr) url += `?${qStr}`;
      }
      const res = await axiosInstance.get(url);
      if (res.data && res.data.success) {
        setDelayRiskData(res.data);
      }
    } catch (err) {
      console.log('Delay Risk prediction fetch unavailable');
      setDelayRiskData(null);
    } finally {
      setLoadingDelayRisk(false);
    }
  };

  const fetchAccessibilityData = async (shipmentId, routeOptions = null) => {
    if (!shipmentId) return;
    setLoadingAccessibility(true);
    try {
      let url = `/accessibility/shipment/${shipmentId}`;
      if (routeOptions) {
        const params = new URLSearchParams();
        if (typeof routeOptions === 'number') {
          params.append('routeScore', routeOptions);
        } else if (typeof routeOptions === 'object') {
          if (routeOptions.routeScore !== undefined) params.append('routeScore', routeOptions.routeScore);
          if (routeOptions.distanceKm !== undefined) params.append('distanceKm', routeOptions.distanceKm);
          if (routeOptions.expectedDurationMin !== undefined) {
            params.append('expectedDurationMin', routeOptions.expectedDurationMin);
            params.append('durationMinutes', routeOptions.expectedDurationMin);
          }
        }
        const qStr = params.toString();
        if (qStr) url += `?${qStr}`;
      }
      const res = await axiosInstance.get(url);
      if (res.data && res.data.success) {
        setAccessibilityData(res.data);
      }
    } catch (err) {
      console.log('Accessibility intelligence fetch unavailable');
      setAccessibilityData(null);
    } finally {
      setLoadingAccessibility(false);
    }
  };

  const fetchRouteRecommendation = async (shipmentId) => {
    if (!shipmentId) return;
    setLoadingRecommendation(true);
    try {
      const res = await axiosInstance.get(`/route-recommendation/shipment/${shipmentId}`);
      if (res.data && res.data.success) {
        setRecommendationData(res.data.data);
      }
    } catch (err) {
      console.log('Route recommendation fetch unavailable');
      setRecommendationData(null);
    } finally {
      setLoadingRecommendation(false);
    }
  };

  // Re-evaluate all AI ML models on demand (e.g. after starting microservice)
  const handleRetryML = () => {
    if (!selectedShipmentId) return;
    const activeRt = candidateRoutes[activeRouteIndex];
    const routeOpts = activeRt ? {
      distanceKm: activeRt.distanceKm || activeRt.distance,
      expectedDurationMin: activeRt.durationMinutes || (activeRt.duration ? Math.round(activeRt.duration / 60) : undefined),
      routeScore: activeRt.score
    } : null;
    fetchEtaPrediction(selectedShipmentId, routeOpts);
    fetchDelayRiskPrediction(selectedShipmentId, routeOpts);
    fetchAccessibilityData(selectedShipmentId, routeOpts);
  };

  // When active candidate route changes, update accessibility assessment, ETA, and delay risk with candidate route params
  useEffect(() => {
    if (!selectedShipmentId) return;
    const activeRt = candidateRoutes[activeRouteIndex];
    if (activeRt) {
      const routeOpts = {
        distanceKm: activeRt.distanceKm || activeRt.distance,
        expectedDurationMin: activeRt.durationMinutes || (activeRt.duration ? Math.round(activeRt.duration / 60) : undefined),
        routeScore: activeRt.score
      };
      fetchAccessibilityData(selectedShipmentId, routeOpts);
      fetchEtaPrediction(selectedShipmentId, routeOpts);
      fetchDelayRiskPrediction(selectedShipmentId, routeOpts);
    }
  }, [activeRouteIndex, candidateRoutes]);

  // Calculate Routes via OpenRouteService API
  const handleCalculateRoutes = async () => {
    if (!selectedShipmentId) {
      setErrorMsg('Please select a shipment first.');
      return;
    }
    setCalculating(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await axiosInstance.post('/routes/calculate', {
        source,
        destination,
        shipmentId: selectedShipmentId
      });

      if (res.data && res.data.data && res.data.data.routes) {
        const routes = res.data.data.routes;
        setCandidateRoutes(routes);
        const selIdx = routes.findIndex((r) => r.isSelected || r.status === 'SELECTED');
        setActiveRouteIndex(selIdx >= 0 ? selIdx : 0);

        // Smoothly scroll map & candidate routes section into view without jumping to bottom
        setTimeout(() => {
          mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      } else {
        setErrorMsg('Unable to calculate routes. Please check location coordinates.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Route calculation failed. Please verify network or coordinates.');
    } finally {
      setCalculating(false);
    }
  };

  // Derive selected route info
  const selectedRouteDoc = selectedShipment?.route && typeof selectedShipment.route === 'object'
    ? selectedShipment.route
    : null;

  const hasSelectedRoute = Boolean(
    selectedRouteDoc?._id ||
    (selectedShipment?.route && typeof selectedShipment.route === 'string') ||
    candidateRoutes.some((r) => r.isSelected || r.status === 'SELECTED')
  );

  const selectedRouteId = (
    selectedRouteDoc?._id?.toString() ||
    (typeof selectedShipment?.route === 'string' ? selectedShipment.route : null) ||
    candidateRoutes.find((r) => r.isSelected || r.status === 'SELECTED')?.id ||
    candidateRoutes.find((r) => r.isSelected || r.status === 'SELECTED')?._id ||
    null
  );

  const selectedRouteName = (
    selectedRouteDoc?.routeName ||
    candidateRoutes.find((r) => r.isSelected || r.status === 'SELECTED')?.name ||
    null
  );

  // Save selected route to MongoDB Atlas (One-time selection)
  const handleSelectRoute = async (routeData) => {
    if (!selectedShipmentId) {
      setErrorMsg('Please select a shipment first.');
      return;
    }

    const isAlreadyThisRoute = Boolean(
      routeData.isSelected ||
      routeData.status === 'SELECTED' ||
      (selectedRouteId && (String(routeData.id) === String(selectedRouteId) || String(routeData._id) === String(selectedRouteId))) ||
      (selectedRouteName && (
        routeData.name === selectedRouteName ||
        (routeData.name && selectedRouteName && (
          routeData.name.toLowerCase().includes(selectedRouteName.toLowerCase()) ||
          selectedRouteName.toLowerCase().includes(routeData.name.toLowerCase())
        ))
      ))
    );

    // If shipment already has another route selected, block selection in UI
    if (hasSelectedRoute && !isAlreadyThisRoute) {
      setErrorMsg('A route has already been selected for this shipment.');
      return;
    }

    // Repeated clicks on the already selected route handled gracefully & idempotently
    if (isAlreadyThisRoute) {
      setSuccessMsg(`Route "${routeData.name}" is already the active selected route for this shipment.`);
      return;
    }

    setSelecting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await axiosInstance.post('/routes/select', {
        shipmentId: selectedShipmentId,
        routeData,
        source,
        destination
      });

      if (res.data && res.data.success) {
        setSuccessMsg(
          res.data.message ||
          `Route "${routeData.name}" successfully calculated & linked to shipment ${
            selectedShipment?.trackingId || selectedShipment?.trackingNumber
          }!`
        );

        // Mark this route as selected in local candidateRoutes state
        setCandidateRoutes((prev) =>
          prev.map((r) => {
            const isMatch =
              (r.id && (r.id === routeData.id || r.id === routeData._id)) ||
              (r._id && (r._id === routeData._id || r._id === routeData.id)) ||
              r.name === routeData.name;
            return {
              ...r,
              isSelected: isMatch,
              status: isMatch ? 'SELECTED' : 'CALCULATED'
            };
          })
        );

        // Refresh shipments & predictions
        const refreshed = await axiosInstance.get('/shipments');
        if (refreshed.data && Array.isArray(refreshed.data.data)) {
          setShipments(refreshed.data.data);
          const updatedShp = refreshed.data.data.find((s) => s._id === selectedShipmentId);
          if (updatedShp) {
            setSelectedShipment(updatedShp);
          }
        }
        fetchEtaPrediction(selectedShipmentId);
        fetchDelayRiskPrediction(selectedShipmentId);
        fetchAccessibilityData(selectedShipmentId);
        fetchRouteRecommendation(selectedShipmentId);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Route selection failed.');
    } finally {
      setSelecting(false);
    }
  };

  const getRiskBadgeColor = (risk) => {
    if (risk === 'HIGH') return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    if (risk === 'MEDIUM') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  };

  const activeRoute = candidateRoutes[activeRouteIndex] || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
          <Compass className="w-7 h-7 text-cyan-400" />
          <span>Route Intelligence Engine</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Evaluate candidate transit routes across distance, ETA, and rule-based scoring before dispatch
        </p>
      </div>

      {/* Control Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Shipment & Location Parameters</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Select Target Shipment</label>
            <select
              value={selectedShipmentId}
              onChange={(e) => setSelectedShipmentId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono focus:border-cyan-500"
            >
              <option value="">-- Choose Shipment --</option>
              {shipments.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.trackingId || s.trackingNumber} ({s.pickupAddress?.city || s.originCity || 'Origin'} →{' '}
                  {s.deliveryAddress?.city || s.destinationCity || 'Dest'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Origin Coordinates (Lat, Lng)</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                value={source.latitude}
                onChange={(e) => setSource({ ...source, latitude: parseFloat(e.target.value) })}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono"
                placeholder="Lat"
              />
              <input
                type="number"
                step="any"
                value={source.longitude}
                onChange={(e) => setSource({ ...source, longitude: parseFloat(e.target.value) })}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono"
                placeholder="Lng"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Destination Coordinates (Lat, Lng)</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                value={destination.latitude}
                onChange={(e) => setDestination({ ...destination, latitude: parseFloat(e.target.value) })}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono"
                placeholder="Lat"
              />
              <input
                type="number"
                step="any"
                value={destination.longitude}
                onChange={(e) => setDestination({ ...destination, longitude: parseFloat(e.target.value) })}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono"
                placeholder="Lng"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <button
            onClick={handleCalculateRoutes}
            disabled={calculating}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white text-xs font-bold px-6 py-3 rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center gap-2"
          >
            {calculating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Calculating Route...</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                <span>Calculate Routes</span>
              </>
            )}
          </button>

          {selectedShipment && (
            <span className="text-xs text-slate-400 font-mono">
              Status: <span className="text-cyan-400 font-bold">{selectedShipment.status}</span> • Payload:{' '}
              <span className="text-slate-200">{selectedShipment.weightKg} Kg</span>
            </span>
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

      {/* MAP & CANDIDATE ROUTES SECTION (Positioned immediately below Calculate Routes) */}
      <div ref={mapSectionRef} className="space-y-6">
        {candidateRoutes.length > 0 ? (
          <div className="space-y-6">
            {/* Interactive Route Canvas */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Interactive Route Canvas
                  </h2>
                  <span className="text-xs text-cyan-400 font-mono">
                    ({activeRoute?.name || 'Selected Corridor'})
                  </span>
                </div>
                {activeRoute && (
                  <div className="flex items-center gap-2">
                    {Boolean(
                      activeRoute.isSelected ||
                      activeRoute.status === 'SELECTED' ||
                      (selectedRouteId && (String(activeRoute.id) === String(selectedRouteId) || String(activeRoute._id) === String(selectedRouteId))) ||
                      (selectedRouteName && (
                        activeRoute.name === selectedRouteName ||
                        (activeRoute.name && selectedRouteName && (
                          activeRoute.name.toLowerCase().includes(selectedRouteName.toLowerCase()) ||
                          selectedRouteName.toLowerCase().includes(activeRoute.name.toLowerCase())
                        ))
                      ))
                    ) ? (
                      <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ACTIVE SELECTED ROUTE
                      </span>
                    ) : hasSelectedRoute ? (
                      <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-400 rounded-lg text-xs font-bold font-mono">
                        PREVIEW ONLY (ALTERNATIVE)
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-lg text-xs font-bold font-mono">
                        CANDIDATE PREVIEW
                      </span>
                    )}
                  </div>
                )}
              </div>

              <RouteMap
                source={source}
                destination={destination}
                routeGeometry={activeRoute?.geometry}
                height="420px"
              />
            </div>

            {/* Candidate Route Options Cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>Candidate Route Options</span>
                  <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                    {candidateRoutes.length} Available
                  </span>
                </h2>
                {hasSelectedRoute && (
                  <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Route selection locked for this shipment
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {candidateRoutes.map((rt, idx) => {
                  const isActive = activeRouteIndex === idx;
                  const isThisRouteSelected = Boolean(
                    rt.isSelected ||
                    rt.status === 'SELECTED' ||
                    (selectedRouteId && (String(rt.id) === String(selectedRouteId) || String(rt._id) === String(selectedRouteId))) ||
                    (selectedRouteName && (
                      rt.name === selectedRouteName ||
                      (rt.name && selectedRouteName && (
                        rt.name.toLowerCase().includes(selectedRouteName.toLowerCase()) ||
                        selectedRouteName.toLowerCase().includes(rt.name.toLowerCase())
                      ))
                    ))
                  );

                  const hours = Math.floor((rt.durationMinutes || 0) / 60);
                  const mins = (rt.durationMinutes || 0) % 60;

                  return (
                    <div
                      key={rt.id || rt._id || idx}
                      onClick={() => setActiveRouteIndex(idx)}
                      className={`cursor-pointer rounded-2xl p-5 border transition space-y-4 ${
                        isThisRouteSelected
                          ? 'bg-slate-900 border-emerald-500/80 shadow-xl shadow-emerald-500/10'
                          : isActive
                          ? 'bg-slate-900 border-cyan-500/80 shadow-xl shadow-cyan-500/10'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2 truncate">
                          <span>{rt.name}</span>
                        </h3>

                        {isThisRouteSelected ? (
                          <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>ROUTE SELECTED</span>
                          </span>
                        ) : hasSelectedRoute ? (
                          <span className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-400 rounded-lg text-xs font-bold font-mono shrink-0">
                            NOT SELECTED
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-lg text-xs font-bold font-mono shrink-0">
                            Score: {rt.score}/100
                          </span>
                        )}
                      </div>

                      {rt.scoreBreakdown && (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 font-mono text-[10px]">
                          <div className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center">
                            <span className="text-slate-500 block text-[9px]">Quality</span>
                            <span className="text-emerald-400 font-bold">{rt.scoreBreakdown.qualityScore?.raw}</span>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center">
                            <span className="text-slate-500 block text-[9px]">AI ETA</span>
                            <span className="text-cyan-400 font-bold">{rt.scoreBreakdown.etaEfficiency?.raw}</span>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center">
                            <span className="text-slate-500 block text-[9px]">Delay Risk</span>
                            <span className="text-amber-400 font-bold">{rt.scoreBreakdown.delayRiskScore?.raw}</span>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center">
                            <span className="text-slate-500 block text-[9px]">Access</span>
                            <span className="text-purple-400 font-bold">{rt.scoreBreakdown.accessibilityScore?.raw}</span>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center">
                            <span className="text-slate-500 block text-[9px]">Distance</span>
                            <span className="text-slate-300 font-bold">{rt.scoreBreakdown.distanceEfficiency?.raw}</span>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center">
                            <span className="text-slate-500 block text-[9px]">Weather</span>
                            <span className="text-blue-400 font-bold">{rt.scoreBreakdown.weatherScore?.raw}</span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-slate-300">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block">Distance</span>
                          <span className="font-bold text-slate-100">{rt.distanceKm} Km</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block">Estimated Travel Time</span>
                          <span className="font-bold text-cyan-400">
                            {hours}h {mins}m
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block">Traffic Standard</span>
                          <span className="font-medium text-emerald-400">{rt.trafficStatus || 'Normal Flow'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block">Endpoint Weather Risk</span>
                          <span className="font-medium text-amber-400">{endpointWeather?.endpointRisk || 'LOW'}</span>
                        </div>
                      </div>

                      {isThisRouteSelected ? (
                        <button
                          disabled
                          className="w-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold text-xs py-2.5 rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Selected</span>
                        </button>
                      ) : hasSelectedRoute ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setErrorMsg('A route has already been selected for this shipment.');
                          }}
                          title="A route has already been selected for this shipment."
                          className="w-full bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-500 hover:text-rose-400 hover:border-rose-500/40 font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-not-allowed"
                        >
                          <ShieldAlert className="w-4 h-4" />
                          <span>Selection Locked</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRoute(rt);
                          }}
                          disabled={selecting}
                          className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-2"
                        >
                          {selecting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Saving Route...</span>
                            </>
                          ) : (
                            <>
                              <span>Select This Route</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 bg-slate-900/50 border border-slate-800/80 border-dashed rounded-3xl text-center space-y-2">
            <Navigation className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No Routes Calculated Yet</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Click <strong className="text-cyan-400">Calculate Routes</strong> above to generate candidate transit corridors with real-time geometry, AI ETA, delay probability, and accessibility intelligence.
            </p>
          </div>
        )}
      </div>

      {/* DEV DEBUG INFORMATION PANEL */}
      <div className="bg-slate-950 border border-cyan-500/30 rounded-2xl p-4 text-xs font-mono space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-cyan-400 font-bold uppercase tracking-wider">Route Intelligence Debug Info</span>
          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded">DEV MODE</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-slate-300">
          <div>
            <span className="text-slate-500 block text-[10px]">Route Source:</span>
            <span className="text-emerald-400 font-bold">Customer Pickup</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Route Destination:</span>
            <span className="text-rose-400 font-bold">Customer Delivery</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Pickup Coordinates:</span>
            <span>{source?.latitude?.toFixed(4)}, {source?.longitude?.toFixed(4)}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Delivery Coordinates:</span>
            <span>{destination?.latitude?.toFixed(4)}, {destination?.longitude?.toFixed(4)}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Hub Waypoints:</span>
            <span className="text-purple-400 font-bold">0</span>
          </div>
        </div>
      </div>

      {/* WEATHER AT ROUTE ENDPOINTS SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <CloudRain className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Weather at route endpoints</h2>
          </div>

          {endpointWeather && (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border font-mono ${getRiskBadgeColor(endpointWeather.endpointRisk)}`}>
              Endpoint Risk: {endpointWeather.endpointRisk}
            </span>
          )}
        </div>

        {loadingWeather ? (
          <div className="py-4 flex items-center justify-center text-slate-500 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400 mr-2" />
            <span>Loading weather at route endpoints...</span>
          </div>
        ) : endpointWeather ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Origin Pickup Weather */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="font-bold text-emerald-400">Pickup: {endpointWeather.pickupCity}</span>
                {endpointWeather.pickupWeather && (
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getRiskBadgeColor(endpointWeather.pickupWeather.weatherRisk)}`}>
                    {endpointWeather.pickupWeather.weatherRisk}
                  </span>
                )}
              </div>

              {endpointWeather.pickupWeather ? (
                <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px]">
                  <p><span className="text-slate-500">Condition: </span>{endpointWeather.pickupWeather.condition}</p>
                  <p><span className="text-slate-500">Temp: </span><strong className="text-cyan-400">{endpointWeather.pickupWeather.temperature}°C</strong></p>
                  <p><span className="text-slate-500">Rainfall: </span>{endpointWeather.pickupWeather.rain} mm</p>
                  <p><span className="text-slate-500">Wind: </span>{endpointWeather.pickupWeather.windSpeed} km/h</p>
                </div>
              ) : (
                <p className="text-slate-500 text-[11px]">Weather data temporarily unavailable for pickup location.</p>
              )}
            </div>

            {/* Destination Delivery Weather */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="font-bold text-amber-400">Destination: {endpointWeather.deliveryCity}</span>
                {endpointWeather.deliveryWeather && (
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getRiskBadgeColor(endpointWeather.deliveryWeather.weatherRisk)}`}>
                    {endpointWeather.deliveryWeather.weatherRisk}
                  </span>
                )}
              </div>

              {endpointWeather.deliveryWeather ? (
                <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px]">
                  <p><span className="text-slate-500">Condition: </span>{endpointWeather.deliveryWeather.condition}</p>
                  <p><span className="text-slate-500">Temp: </span><strong className="text-cyan-400">{endpointWeather.deliveryWeather.temperature}°C</strong></p>
                  <p><span className="text-slate-500">Rainfall: </span>{endpointWeather.deliveryWeather.rain} mm</p>
                  <p><span className="text-slate-500">Wind: </span>{endpointWeather.deliveryWeather.windSpeed} km/h</p>
                </div>
              ) : (
                <p className="text-slate-500 text-[11px]">Weather data temporarily unavailable for delivery location.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Weather data temporarily unavailable.</p>
        )}
      </div>

      {/* ML FALLBACK BANNER & QUICK RETRY */}
      {(etaPrediction?.modelStatus === 'FALLBACK' || delayRiskData?.modelStatus === 'FALLBACK') && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start gap-3 text-xs text-amber-300">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <div className="font-bold text-amber-200 text-sm">AI Prediction Microservice Offline (Fallback Mode)</div>
              <p className="text-amber-400/80 mt-1">
                GradientBoosting ETA and Delay Risk models are currently running in ORS baseline fallback mode.
                Ensure <code className="px-1.5 py-0.5 bg-amber-500/20 rounded font-mono text-[11px] text-amber-200">start-all.bat</code> or <code className="px-1.5 py-0.5 bg-amber-500/20 rounded font-mono text-[11px] text-amber-200">py -m uvicorn ml.services.eta_api:app --host 127.0.0.1 --port 8000</code> is active.
              </p>
            </div>
          </div>
          <button
            onClick={handleRetryML}
            disabled={loadingEta || loadingDelayRisk}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 shadow"
          >
            <RefreshCw className={`w-4 h-4 ${loadingEta || loadingDelayRisk ? 'animate-spin' : ''}`} />
            <span>Reconnect ML Models</span>
          </button>
        </div>
      )}

      {/* PHASE 3C: AI-POWERED ETA PREDICTION SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              AI-Powered ETA Prediction (Phase 3C)
            </h2>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px]">
            {etaPrediction && (
              <span
                className={`px-2.5 py-1 rounded-lg border font-bold ${
                  etaPrediction.mlEtaAvailable
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                STATUS: {etaPrediction.modelStatus || 'AVAILABLE'}
              </span>
            )}
            {etaPrediction && etaPrediction.modelStatus === 'FALLBACK' && (
              <button
                onClick={handleRetryML}
                disabled={loadingEta}
                className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold transition flex items-center gap-1"
                title="Retry ML Connection"
              >
                <RefreshCw className={`w-3 h-3 ${loadingEta ? 'animate-spin' : ''}`} />
                <span>RETRY</span>
              </button>
            )}
            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-1 rounded-lg font-bold">
              DATASET: SYNTHETIC
            </span>
          </div>
        </div>

        {loadingEta ? (
          <div className="py-4 flex items-center justify-center text-slate-500 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400 mr-2" />
            <span>Evaluating ML Pipeline & Transit Parameters...</span>
          </div>
        ) : etaPrediction ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Baseline ORS Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  ORS Speed Baseline ETA
                </span>
                <div className="text-xl font-bold text-slate-200">
                  {etaPrediction.baselineDurationMin} min
                </div>
                <div className="text-[11px] text-slate-400">
                  ~ {etaPrediction.baselineDurationHours} hours
                </div>
              </div>

              {/* AI Predicted ETA Card */}
              <div className="bg-slate-950 border border-cyan-500/40 rounded-2xl p-4 space-y-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-cyan-500/20 text-cyan-300 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                  {etaPrediction.modelName || 'GradientBoosting'}
                </div>
                <span className="text-[10px] text-cyan-400 uppercase font-bold block">
                  AI Predicted Transit Duration
                </span>
                <div className="text-2xl font-black text-cyan-300">
                  {etaPrediction.predictedDurationMin} min
                </div>
                <div className="text-[11px] text-cyan-400 font-semibold">
                  ~ {etaPrediction.predictedDurationHours} hours
                </div>
              </div>

              {/* Difference / Adjustment Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  AI vs Baseline Difference
                </span>
                <div
                  className={`text-xl font-bold ${
                    etaPrediction.differenceFromBaselineMin > 0
                      ? 'text-rose-400'
                      : etaPrediction.differenceFromBaselineMin < 0
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  {etaPrediction.differenceFromBaselineMin > 0 ? '+' : ''}
                  {etaPrediction.differenceFromBaselineMin} min
                </div>
                <div className="text-[11px] text-slate-400">
                  {etaPrediction.differenceFromBaselineMin > 0
                    ? 'AI factors traffic/weather delay'
                    : etaPrediction.differenceFromBaselineMin < 0
                    ? 'AI predicts faster transit corridor'
                    : 'Exact match with baseline'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950 border border-slate-800/80 rounded-xl p-3 font-mono">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>Engine: <strong>{etaPrediction.modelName}</strong></span>
              </span>
              <span>
                Weather Context: <strong className="text-slate-200">{etaPrediction.weatherContext?.condition || 'Clear'} ({etaPrediction.weatherContext?.temperature}°C)</strong>
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Select a shipment to evaluate AI ETA prediction.</p>
        )}
      </div>

      {/* PHASE 3D: AI DELAY RISK PREDICTION SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              AI Delay Risk Prediction (Phase 3D)
            </h2>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px]">
            {delayRiskData && (
              <span
                className={`px-2.5 py-1 rounded-lg border font-bold ${
                  delayRiskData.riskAvailable
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                STATUS: {delayRiskData.modelStatus || 'AVAILABLE'}
              </span>
            )}
            {delayRiskData && !delayRiskData.riskAvailable && (
              <button
                onClick={handleRetryML}
                disabled={loadingDelayRisk}
                className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold transition flex items-center gap-1"
                title="Retry ML Connection"
              >
                <RefreshCw className={`w-3 h-3 ${loadingDelayRisk ? 'animate-spin' : ''}`} />
                <span>RETRY</span>
              </button>
            )}
            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-1 rounded-lg font-bold">
              DATASET: SYNTHETIC
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Delay risk is estimated from route quality, traffic, weather parameters, vehicle specs, cargo weight, and driver-related pre-delivery features. Model trained on synthetic logistics data.
        </p>

        {loadingDelayRisk ? (
          <div className="py-4 flex items-center justify-center text-slate-500 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400 mr-2" />
            <span>Evaluating Classification Pipeline & Delay Risk Probabilities...</span>
          </div>
        ) : delayRiskData && delayRiskData.riskAvailable ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Delay Risk Level Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Operational Risk Level
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xl font-black px-3 py-1 rounded-xl border ${
                      delayRiskData.riskLevel === 'HIGH'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : delayRiskData.riskLevel === 'MEDIUM'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {delayRiskData.riskLevel}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {delayRiskData.riskLevel === 'HIGH'
                    ? 'High delay probability — dispatch attention recommended'
                    : delayRiskData.riskLevel === 'MEDIUM'
                    ? 'Moderate risk — standard transit corridor'
                    : 'Low risk — optimal corridor conditions'}
                </div>
              </div>

              {/* Delay Probability Card */}
              <div className="bg-slate-950 border border-amber-500/40 rounded-2xl p-4 space-y-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-amber-500/20 text-amber-300 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                  {delayRiskData.modelName || 'GradientBoostingClassifier'}
                </div>
                <span className="text-[10px] text-amber-400 uppercase font-bold block">
                  Delay Probability
                </span>
                <div className="text-2xl font-black text-amber-300">
                  {delayRiskData.delayProbability}%
                </div>
                <div className="text-[11px] text-slate-400">
                  On-Time Probability: <strong className="text-emerald-400">{delayRiskData.onTimeProbability}%</strong>
                </div>
              </div>

              {/* Predicted Classification Status */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Predicted Classification Status
                </span>
                <div className="text-xl font-bold text-slate-200 mt-1">
                  {delayRiskData.prediction === 'DELAYED' ? (
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
                  Model F1 Score: <strong className="text-slate-200">{((delayRiskData.metrics?.f1 || 0.896) * 100).toFixed(1)}%</strong>
                </div>
              </div>
            </div>

            {/* Model Metadata & Dynamic Key Model Features */}
            <div className="space-y-3 bg-slate-950 border border-slate-800/80 rounded-2xl p-4 font-mono text-[11px] text-slate-400">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/60">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  <span>Engine: <strong>{delayRiskData.modelName || 'GradientBoostingClassifier'}</strong> ({delayRiskData.modelVersion || '3D-v1'})</span>
                </span>
                <span className="text-slate-400">
                  Model F1 Score: <strong className="text-emerald-400">{((delayRiskData.metrics?.f1 || 0.896) * 100).toFixed(1)}%</strong>
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block mb-2 uppercase tracking-wide text-[10px]">Key Model Features:</span>
                {Array.isArray(delayRiskData.keyFactors) && delayRiskData.keyFactors.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {delayRiskData.keyFactors.map((kf, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-[11px]"
                      >
                        <span>{kf.feature}</span>
                        <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded text-[10px] font-bold">
                          {kf.importance}%
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500 italic">Key model features unavailable</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <div>
                <div className="font-semibold text-amber-200">Delay Risk ML Prediction Unavailable (Fallback Mode)</div>
                <div className="text-[11px] text-amber-400/80 mt-0.5">{delayRiskData?.reason || 'FastAPI microservice offline or unreachable'}</div>
              </div>
            </div>
            <button
              onClick={handleRetryML}
              disabled={loadingDelayRisk}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDelayRisk ? 'animate-spin' : ''}`} />
              <span>Retry ML</span>
            </button>
          </div>
        )}
      </div>

      {/* PHASE 3E: ACCESSIBILITY INTELLIGENCE SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              AI Accessibility Intelligence (Phase 3E)
            </h2>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px]">
            {accessibilityData && (
              <span
                className={`px-2.5 py-1 rounded-lg border font-bold ${
                  accessibilityData.level === 'GOOD'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : accessibilityData.level === 'MODERATE'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : accessibilityData.level === 'RESTRICTED'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    : accessibilityData.level === 'CRITICAL'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                LEVEL: {accessibilityData.level || 'UNKNOWN'}
              </span>
            )}
            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-1 rounded-lg font-bold">
              RULE-BASED
            </span>
            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-1 rounded-lg font-bold">
              DATASET: SYNTHETIC
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Accessibility Intelligence evaluates shipment payload against vehicle capacity, route quality score, weather risk, operational delay risk, driver experience, and vehicle age using transparent project-defined rules.
        </p>

        {loadingAccessibility ? (
          <div className="py-4 flex items-center justify-center text-slate-500 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-400 mr-2" />
            <span>Evaluating Accessibility Rules & Operational Compatibility...</span>
          </div>
        ) : accessibilityData && accessibilityData.available ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Accessibility Score Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Accessibility Score
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black text-purple-300">
                    {accessibilityData.score}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">/ 100</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Evaluated across 7 operational parameters
                </div>
              </div>

              {/* Operational Compatibility Level Card */}
              <div className="bg-slate-950 border border-purple-500/40 rounded-2xl p-4 space-y-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-purple-500/20 text-purple-300 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                  Decision Support Layer
                </div>
                <span className="text-[10px] text-purple-400 uppercase font-bold block">
                  Operational Level
                </span>
                <div className="mt-1">
                  <span
                    className={`text-xl font-black px-3 py-1 rounded-xl border ${
                      accessibilityData.level === 'GOOD'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : accessibilityData.level === 'MODERATE'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : accessibilityData.level === 'RESTRICTED'
                        ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    {accessibilityData.level}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-2">
                  {accessibilityData.level === 'GOOD'
                    ? 'Favorable transit compatibility across all parameters'
                    : accessibilityData.level === 'MODERATE'
                    ? 'Acceptable operational parameters with minor risk flags'
                    : accessibilityData.level === 'RESTRICTED'
                    ? 'Restricted conditions — payload or weather attention advised'
                    : 'Critical operational incompatibility or vehicle overload detected'}
                </div>
              </div>

              {/* Compatibility Breakdown Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                  Key Compatibility Factors
                </span>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[9px]">Vehicle:</span>
                    <strong className={accessibilityData.vehicleCompatibility === 'INCOMPATIBLE' ? 'text-rose-400' : 'text-slate-200'}>
                      {accessibilityData.vehicleCompatibility}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">Cargo Utilization:</span>
                    <strong className={accessibilityData.cargoCompatibility === 'INCOMPATIBLE' ? 'text-rose-400' : 'text-slate-200'}>
                      {accessibilityData.cargoCompatibility}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">Route Suitability:</span>
                    <strong className="text-slate-200">{accessibilityData.routeSuitability}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">Weather Impact:</span>
                    <strong className="text-slate-200">{accessibilityData.weatherImpact}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">Operational Risk:</span>
                    <strong className="text-slate-200">{accessibilityData.operationalRisk}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">ETA Impact:</span>
                    <strong className="text-slate-200">{accessibilityData.etaImpact}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Assessment Factors / Reasons Section */}
            {Array.isArray(accessibilityData.reasons) && accessibilityData.reasons.length > 0 && (
              <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-2 font-mono text-[11px]">
                <span className="text-slate-400 font-bold block uppercase tracking-wide text-[10px] border-b border-slate-800/60 pb-2">
                  Assessment Factors & Operational Reasons:
                </span>
                <div className="space-y-1.5 pt-1">
                  {accessibilityData.reasons.map((reason, idx) => {
                    const isPositive = reason.startsWith('✓');
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 p-2 rounded-xl border ${
                          isPositive
                            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                        }`}
                      >
                        <span className="shrink-0 mt-0.5">{isPositive ? '✓' : '⚠'}</span>
                        <span>{reason.replace(/^[✓⚠]\s*/, '')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rule-Based Metadata & Synthetic Data Disclaimer Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-slate-500 bg-slate-950 border border-slate-800/80 rounded-xl p-3 font-mono">
              <span>
                Engine: <strong className="text-purple-400">Phase 3E Rule-Based Decision-Support Layer</strong>
              </span>
              <span>
                Data Source: <strong className="text-slate-400">{accessibilityData.dataSource}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{accessibilityData?.reason || 'Selected route is required for accessibility assessment.'}</span>
          </div>
        )}
      </div>

      {/* PHASE 3F: AI ROUTE RECOMMENDATION SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              AI Route Recommendation (Phase 3F)
            </h2>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px]">
            {recommendationData && recommendationData.recommendedRoute && (
              <span
                className={`px-2.5 py-1 rounded-lg border font-bold ${
                  recommendationData.recommendedRoute.recommendationLevel === 'HIGHLY_RECOMMENDED'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : recommendationData.recommendedRoute.recommendationLevel === 'RECOMMENDED'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : recommendationData.recommendedRoute.recommendationLevel === 'CAUTION_RECOMMENDED'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                LEVEL: {recommendationData.recommendedRoute.recommendationLevel}
              </span>
            )}
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg font-bold">
              DECISION SUPPORT
            </span>
            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-1 rounded-lg font-bold">
              DATASET: SYNTHETIC
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          AI Route Recommendation compares candidate transit routes by combining Route Quality (25%), AI Predicted ETA (20%), Delay Risk (20%), Accessibility (20%), Distance (10%), and Weather (5%) into a transparent decision-support recommendation score.
        </p>

        {loadingRecommendation ? (
          <div className="py-4 flex items-center justify-center text-slate-500 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400 mr-2" />
            <span>Evaluating Candidate Signals & Multi-Factor Recommendation Score...</span>
          </div>
        ) : recommendationData && recommendationData.recommendedRoute ? (
          <div className="space-y-4">
            {/* Recommended Route Spotlight */}
            <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-5 space-y-4 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">
                    Top Recommended Route
                  </span>
                  <h3 className="text-lg font-bold text-slate-100 mt-0.5">
                    {recommendationData.recommendedRoute.name}
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-mono">Recommendation Score</span>
                    <span className="text-2xl font-black text-emerald-300 font-mono">
                      {recommendationData.recommendedRoute.recommendationScore}
                      <span className="text-xs text-slate-500 font-normal"> / 100</span>
                    </span>
                  </div>

                  <button
                    onClick={() => handleSelectRoute(recommendationData.recommendedRoute)}
                    disabled={selecting}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5"
                  >
                    {selecting ? (
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

              {/* Factors Breakdown Bar */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                  Weighted Factor Breakdown (0–100 Normalized)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs font-mono">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <span className="text-[9px] text-slate-500 block">Route Quality (25%)</span>
                    <span className="font-bold text-slate-200">{recommendationData.recommendedRoute.scoreBreakdown.qualityScore.raw}</span>
                    <span className="text-[9px] text-emerald-400 block">+{recommendationData.recommendedRoute.scoreBreakdown.qualityScore.points} pts</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <span className="text-[9px] text-slate-500 block">AI ETA (20%)</span>
                    <span className="font-bold text-cyan-300">{recommendationData.recommendedRoute.scoreBreakdown.etaEfficiency.raw}</span>
                    <span className="text-[9px] text-cyan-400 block">+{recommendationData.recommendedRoute.scoreBreakdown.etaEfficiency.points} pts</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <span className="text-[9px] text-slate-500 block">Delay Risk (20%)</span>
                    <span className="font-bold text-amber-300">{recommendationData.recommendedRoute.scoreBreakdown.delayRiskScore.raw}</span>
                    <span className="text-[9px] text-amber-400 block">+{recommendationData.recommendedRoute.scoreBreakdown.delayRiskScore.points} pts</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <span className="text-[9px] text-slate-500 block">Accessibility (20%)</span>
                    <span className="font-bold text-purple-300">{recommendationData.recommendedRoute.scoreBreakdown.accessibilityScore.raw}</span>
                    <span className="text-[9px] text-purple-400 block">+{recommendationData.recommendedRoute.scoreBreakdown.accessibilityScore.points} pts</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <span className="text-[9px] text-slate-500 block">Distance (10%)</span>
                    <span className="font-bold text-slate-200">{recommendationData.recommendedRoute.scoreBreakdown.distanceEfficiency.raw}</span>
                    <span className="text-[9px] text-slate-400 block">+{recommendationData.recommendedRoute.scoreBreakdown.distanceEfficiency.points} pts</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <span className="text-[9px] text-slate-500 block">Weather (5%)</span>
                    <span className="font-bold text-blue-300">{recommendationData.recommendedRoute.scoreBreakdown.weatherScore.raw}</span>
                    <span className="text-[9px] text-blue-400 block">+{recommendationData.recommendedRoute.scoreBreakdown.weatherScore.points} pts</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Explanations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
                {Array.isArray(recommendationData.recommendedRoute.positiveFactors) && recommendationData.recommendedRoute.positiveFactors.length > 0 && (
                  <div className="bg-slate-900/80 border border-emerald-500/20 rounded-xl p-3 space-y-1.5 font-mono">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block">Key Advantages:</span>
                    {recommendationData.recommendedRoute.positiveFactors.map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-emerald-300 text-[11px]">
                        <span className="shrink-0 font-bold">✓</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                )}

                {Array.isArray(recommendationData.recommendedRoute.warningFactors) && recommendationData.recommendedRoute.warningFactors.length > 0 && (
                  <div className="bg-slate-900/80 border border-amber-500/20 rounded-xl p-3 space-y-1.5 font-mono">
                    <span className="text-[10px] text-amber-400 font-bold uppercase block">Risk & Caution Notes:</span>
                    {recommendationData.recommendedRoute.warningFactors.map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-amber-300 text-[11px]">
                        <span className="shrink-0 font-bold">⚠</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Candidate Route Options Comparison Table / List */}
            {Array.isArray(recommendationData.candidateRoutes) && recommendationData.candidateRoutes.length > 1 && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 font-mono">
                <span className="text-slate-300 font-bold text-xs uppercase tracking-wider block">
                  Candidate Route Recommendation Comparison
                </span>

                <div className="space-y-2 text-xs">
                  {recommendationData.candidateRoutes.map((cand, idx) => (
                    <div
                      key={cand.id || idx}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        cand.isRecommended
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                          : cand.disqualified
                          ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 opacity-80'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-100">{cand.name}</strong>
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
                          <span>Delay Prob: <strong className="text-amber-400">{Math.round(cand.delayProbability * 100)}%</strong></span>
                          <span>Accessibility: <strong className="text-purple-400">{cand.accessibilityScore}/100</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Score</span>
                          <span className="font-black text-sm text-slate-100">{cand.recommendationScore}/100</span>
                        </div>
                        {Boolean(
                          cand.isSelected ||
                          cand.status === 'SELECTED' ||
                          (selectedRouteId && (String(cand.id) === String(selectedRouteId) || String(cand._id) === String(selectedRouteId))) ||
                          (selectedRouteName && (
                            cand.name === selectedRouteName ||
                            (cand.name && selectedRouteName && (
                              cand.name.toLowerCase().includes(selectedRouteName.toLowerCase()) ||
                              selectedRouteName.toLowerCase().includes(cand.name.toLowerCase())
                            ))
                          ))
                        ) ? (
                          <button
                            disabled
                            className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] px-3 py-1.5 rounded-lg cursor-not-allowed flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Selected</span>
                          </button>
                        ) : hasSelectedRoute ? (
                          <button
                            onClick={() => setErrorMsg('A route has already been selected for this shipment.')}
                            className="bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 font-bold text-[11px] px-3 py-1.5 rounded-lg cursor-not-allowed transition"
                            title="A route has already been selected for this shipment."
                          >
                            Locked
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSelectRoute(cand)}
                            disabled={selecting || cand.disqualified}
                            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold text-[11px] px-3 py-1.5 rounded-lg border border-slate-700 transition"
                          >
                            Use This Route
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>Select a shipment to calculate multi-signal AI route recommendations.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteIntelligence;
