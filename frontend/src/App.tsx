import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Map from './components/Map';
import ModernChat from './components/ModernChat';
import HuntRegistration from './components/HuntRegistration';
import HintsList from './components/HintsList';
import UpdateDetail from './components/UpdateDetail';
import Rules from './components/Rules';
import AdminDashboard from './components/AdminDashboard';
import AdminRouteTracking from './components/AdminRouteTracking';
import RouteTracker from './components/RouteTracker';
import LocationSettings from './components/LocationSettings';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useAuth();
  
  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!state.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { state } = useAuth();

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Routes>
          <Route
            path="/login"
            element={
              state.isAuthenticated ? <Navigate to="/" replace /> : <Login />
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div className="flex flex-col h-screen">
                  <Navbar />
                  <div className="flex-1 overflow-hidden">
                    <Map />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <div className="flex flex-col h-screen">
                  <Navbar />
                  <div className="flex-1 overflow-hidden">
                    <ModernChat />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/hunt"
            element={
              <ProtectedRoute>
                <div className="flex flex-col h-screen">
                  <Navbar />
                  <div className="flex-1 overflow-y-auto">
                    <HuntRegistration />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/updates"
            element={
              <ProtectedRoute>
                <div className="flex flex-col h-screen">
                  <Navbar />
                  <div className="flex-1 overflow-y-auto">
                    <HintsList />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/updates/:id"
            element={
              <ProtectedRoute>
                <div className="flex flex-col h-screen">
                  <Navbar />
                  <div className="flex-1 overflow-y-auto">
                    <UpdateDetail />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rules"
            element={
              <ProtectedRoute>
                <div className="flex flex-col h-screen">
                  <Navbar />
                  <div className="flex-1 overflow-y-auto">
                    <Rules />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <div className="flex flex-col h-screen">
                  <Navbar />
                  <div className="flex-1 overflow-y-auto">
                    <AdminDashboard />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/routes"
            element={
              <ProtectedRoute>
                <div className="flex flex-col h-screen">
                  <Navbar />
                  <div className="flex-1 overflow-y-auto">
                    <AdminRouteTracking />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/routes"
            element={
              <ProtectedRoute>
                <div className="flex flex-col h-screen">
                  <Navbar />
                  <div className="flex-1 overflow-y-auto">
                    <RouteTracker />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <div className="flex flex-col h-screen">
                  <Navbar />
                  <div className="flex-1 overflow-y-auto">
                    <LocationSettings />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <WebSocketProvider>
          <NotificationProvider>
            <AppContent />
          </NotificationProvider>
        </WebSocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;