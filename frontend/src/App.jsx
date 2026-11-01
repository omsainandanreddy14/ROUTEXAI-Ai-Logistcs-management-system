import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import MainLayout from './layouts/MainLayout';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// OWNER Pages
import OwnerDashboard from './pages/owner/OwnerDashboard';
import AIDashboard from './pages/owner/AIDashboard';
import ShipmentsManagement from './pages/owner/ShipmentsManagement';
import ShipmentLifecycle from './pages/owner/ShipmentLifecycle';
import ETAMonitoring from './pages/owner/ETAMonitoring';
import RouteIntelligence from './pages/owner/RouteIntelligence';
import LiveTracking from './pages/owner/LiveTracking';
import VehiclesManagement from './pages/owner/VehiclesManagement';
import DriversManagement from './pages/owner/DriversManagement';
import HubsManagement from './pages/owner/HubsManagement';
import WeatherAlerts from './pages/owner/WeatherAlerts';
import SystemAlerts from './pages/owner/SystemAlerts';
import AnalyticsView from './pages/owner/AnalyticsView';
import AIInsightsView from './pages/owner/AIInsightsView';
import SettingsView from './pages/owner/SettingsView';

// DRIVER Pages
import DriverDashboard from './pages/driver/DriverDashboard';
import DriverTrips from './pages/driver/DriverTrips';
import DriverCurrentShipment from './pages/driver/DriverCurrentShipment';
import DriverRouteView from './pages/driver/DriverRouteView';
import DriverReportIssue from './pages/driver/DriverReportIssue';
import DriverProfile from './pages/driver/DriverProfile';

// CUSTOMER Pages
import CustomerDashboard from './pages/customer/CustomerDashboard';
import CreateShipment from './pages/customer/CreateShipment';
import CustomerShipments from './pages/customer/CustomerShipments';
import CustomerTrack from './pages/customer/CustomerTrack';
import CustomerHistory from './pages/customer/CustomerHistory';
import CustomerProfile from './pages/customer/CustomerProfile';

import NotFound from './pages/NotFound';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Main Layout Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/login" replace />} />

            {/* OWNER Routes */}
            <Route path="owner/dashboard" element={<ProtectedRoute allowedRoles={['OWNER']}><OwnerDashboard /></ProtectedRoute>} />
            <Route path="owner/ai-dashboard" element={<ProtectedRoute allowedRoles={['OWNER']}><AIDashboard /></ProtectedRoute>} />
            <Route path="owner/shipments" element={<ProtectedRoute allowedRoles={['OWNER']}><ShipmentsManagement /></ProtectedRoute>} />
            <Route path="owner/shipment-lifecycle" element={<ProtectedRoute allowedRoles={['OWNER']}><ShipmentLifecycle /></ProtectedRoute>} />
            <Route path="owner/eta-monitoring" element={<ProtectedRoute allowedRoles={['OWNER']}><ETAMonitoring /></ProtectedRoute>} />
            <Route path="owner/route-intelligence" element={<ProtectedRoute allowedRoles={['OWNER']}><RouteIntelligence /></ProtectedRoute>} />
            <Route path="owner/live-tracking" element={<ProtectedRoute allowedRoles={['OWNER']}><LiveTracking /></ProtectedRoute>} />
            <Route path="owner/vehicles" element={<ProtectedRoute allowedRoles={['OWNER']}><VehiclesManagement /></ProtectedRoute>} />
            <Route path="owner/drivers" element={<ProtectedRoute allowedRoles={['OWNER']}><DriversManagement /></ProtectedRoute>} />
            <Route path="owner/hubs" element={<ProtectedRoute allowedRoles={['OWNER']}><HubsManagement /></ProtectedRoute>} />
            <Route path="owner/weather" element={<ProtectedRoute allowedRoles={['OWNER']}><WeatherAlerts /></ProtectedRoute>} />
            <Route path="owner/alerts" element={<ProtectedRoute allowedRoles={['OWNER']}><SystemAlerts /></ProtectedRoute>} />
            <Route path="owner/analytics" element={<ProtectedRoute allowedRoles={['OWNER']}><AnalyticsView /></ProtectedRoute>} />
            <Route path="owner/ai-insights" element={<ProtectedRoute allowedRoles={['OWNER']}><AIInsightsView /></ProtectedRoute>} />
            <Route path="owner/settings" element={<ProtectedRoute allowedRoles={['OWNER']}><SettingsView /></ProtectedRoute>} />

            {/* DRIVER Routes */}
            <Route path="driver/dashboard" element={<ProtectedRoute allowedRoles={['DRIVER']}><DriverDashboard /></ProtectedRoute>} />
            <Route path="driver/trips" element={<ProtectedRoute allowedRoles={['DRIVER']}><DriverTrips /></ProtectedRoute>} />
            <Route path="driver/current-shipment" element={<ProtectedRoute allowedRoles={['DRIVER']}><DriverCurrentShipment /></ProtectedRoute>} />
            <Route path="driver/route" element={<ProtectedRoute allowedRoles={['DRIVER']}><DriverRouteView /></ProtectedRoute>} />
            <Route path="driver/report-issue" element={<ProtectedRoute allowedRoles={['DRIVER']}><DriverReportIssue /></ProtectedRoute>} />
            <Route path="driver/profile" element={<ProtectedRoute allowedRoles={['DRIVER']}><DriverProfile /></ProtectedRoute>} />

            {/* CUSTOMER Routes */}
            <Route path="customer/dashboard" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><CustomerDashboard /></ProtectedRoute>} />
            <Route path="customer/create-shipment" element={<ProtectedRoute allowedRoles={['CUSTOMER', 'OWNER']}><CreateShipment /></ProtectedRoute>} />
            <Route path="customer/shipments" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><CustomerShipments /></ProtectedRoute>} />
            <Route path="customer/track" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><CustomerTrack /></ProtectedRoute>} />
            <Route path="customer/history" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><CustomerHistory /></ProtectedRoute>} />
            <Route path="customer/profile" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><CustomerProfile /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
