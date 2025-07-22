import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Icon, LatLng } from 'leaflet';
import { gameService } from '../services/gameService';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { 
  MapPin, 
  Clock, 
  Users, 
  Route, 
  Activity, 
  Eye, 
  EyeOff,
  RefreshCw,
  TrendingUp,
  Navigation
} from 'lucide-react';

// Fix for default markers in React Leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  team_name: string;
  team_area: string;
  team_role: string;
  has_locations: boolean;
  last_seen: string | null;
  can_view_route: boolean;
}

interface RouteData {
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    team_name: string;
    team_area: string;
    team_role: string;
  };
  locations: Array<{
    id: number;
    lat: number;
    lng: number;
    accuracy?: number;
    recorded_at: string;
  }>;
  statistics: {
    total_points: number;
    total_distance_km: number;
    max_speed_kmh: number;
    time_period_hours: number;
    first_location: string | null;
    last_location: string | null;
  };
}

const createStartIcon = () => {
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="#10B981">
        <circle cx="12" cy="12" r="10" fill="#10B981" stroke="#065F46" stroke-width="2"/>
        <path d="M12 6v6l4 2" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `)}`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

const createEndIcon = () => {
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="#EF4444">
        <circle cx="12" cy="12" r="10" fill="#EF4444" stroke="#991B1B" stroke-width="2"/>
        <path d="M8 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `)}`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

const AdminRouteTracking: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [error, setError] = useState('');
  const [timePeriod, setTimePeriod] = useState(24); // hours
  const { state } = useAuth();

  // Check if user is admin
  if (state.user?.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="card p-6 text-center">
          <div className="w-12 h-12 text-red-500 mx-auto mb-4">
            <EyeOff className="w-full h-full" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Admin privileges required to access route tracking.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadUsers();
  }, []);

  // Auto-reload route when time period changes
  useEffect(() => {
    if (selectedUser) {
      console.log(`Time period changed to ${timePeriod} hours, reloading route for ${getUserDisplayName(selectedUser)}`);
      loadUserRoute(selectedUser);
    }
  }, [timePeriod]);

  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      setError('');
      console.log('Loading users for route tracking...');
      const usersData = await gameService.getUsersForRouteTracking();
      console.log('Users data received:', usersData);
      setUsers(usersData);
    } catch (error: any) {
      console.error('Error loading users:', error);
      console.error('Full error object:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load users';
      setError(`Error loading users: ${errorMessage}`);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadUserRoute = async (user: User) => {
    try {
      setIsLoadingRoute(true);
      setError('');
      console.log(`Loading route for user ${user.id} (${getUserDisplayName(user)})`);
      const route = await gameService.getUserRoute(user.id, timePeriod);
      console.log('Route data received:', route);
      setRouteData(route);
      setSelectedUser(user);
    } catch (error: any) {
      console.error('Error loading route:', error);
      console.error('Full error object:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load route';
      setError(`Error loading route: ${errorMessage}`);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getUserDisplayName = (user: User) => {
    return user.first_name && user.last_name 
      ? `${user.first_name} ${user.last_name}`
      : user.username;
  };

  const center: [number, number] = [52.1597, 6.4131];
  const routePositions: [number, number][] = routeData?.locations.map(loc => [loc.lat, loc.lng]) || [];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center space-x-2">
          <Route className="w-5 h-5 sm:w-6 sm:h-6" />
          <span>Admin Route Tracking</span>
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          View user movement routes and statistics (respects privacy settings)
        </p>
      </div>

      {error && (
        <div className="card p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* User Selection Panel */}
        <div className="lg:col-span-1">
          <div className="card p-4 lg:h-fit">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Users</span>
              </h2>
              <button
                onClick={loadUsers}
                disabled={isLoadingUsers}
                className="btn btn-sm btn-outline flex items-center space-x-1"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Time Period Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center space-x-2">
                <span>Time Period</span>
                {isLoadingRoute && selectedUser && (
                  <LoadingSpinner size="sm" />
                )}
              </label>
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(parseInt(e.target.value))}
                disabled={isLoadingRoute}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
              >
                <option value={1}>Last 1 hour</option>
                <option value={6}>Last 6 hours</option>
                <option value={24}>Last 24 hours</option>
                <option value={72}>Last 3 days</option>
                <option value={168}>Last 7 days</option>
              </select>
              {selectedUser && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Currently showing {timePeriod} hours for {getUserDisplayName(selectedUser)}
                </p>
              )}
            </div>

            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className={`p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer transition-colors ${
                      selectedUser?.id === user.id 
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                        : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                    onClick={() => loadUserRoute(user)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {getUserDisplayName(user)}
                        </p>
                        {user.team_name && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {user.team_name} {user.team_area ? `(${user.team_area})` : ''}
                          </p>
                        )}
                        {user.last_seen && (
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Last seen: {new Date(user.last_seen).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        {user.can_view_route ? (
                          <Eye className="w-4 h-4 text-green-500" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-red-500" />
                        )}
                        {user.has_locations && (
                          <Activity className="w-3 h-3 text-blue-500" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map and Statistics Panel */}
        <div className="lg:col-span-3 space-y-6">
          {/* Route Statistics */}
          {routeData && (
            <div className="card p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>Route Statistics for {getUserDisplayName(routeData.user)}</span>
              </h2>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-xl lg:text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {routeData.statistics.total_points}
                  </div>
                  <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Tracking Points</div>
                </div>
                
                <div className="text-center">
                  <div className="text-xl lg:text-2xl font-bold text-green-600 dark:text-green-400">
                    {routeData.statistics.total_distance_km} km
                  </div>
                  <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Distance Traveled</div>
                </div>
                
                <div className="text-center">
                  <div className="text-xl lg:text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {routeData.statistics.max_speed_kmh} km/h
                  </div>
                  <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Max Speed</div>
                </div>
                
                <div className="text-center">
                  <div className="text-xl lg:text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {routeData.statistics.time_period_hours}h
                  </div>
                  <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Time Period</div>
                </div>
              </div>

              {routeData.statistics.first_location && routeData.statistics.last_location && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">First Location:</span>
                    <br />
                    <span className="text-gray-600 dark:text-gray-400">
                      {formatTime(routeData.statistics.first_location)}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Last Location:</span>
                    <br />
                    <span className="text-gray-600 dark:text-gray-400">
                      {formatTime(routeData.statistics.last_location)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Map */}
          <div className="card p-4 relative">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <MapPin className="w-5 h-5" />
              <span>Route Visualization</span>
              {isLoadingRoute && <LoadingSpinner size="sm" />}
            </h2>

            <div className="h-64 sm:h-80 lg:h-96 rounded-lg overflow-hidden relative">
              {!selectedUser ? (
                <div className="h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-lg">
                  <div className="text-center">
                    <Navigation className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Select a user to view their route
                    </p>
                  </div>
                </div>
              ) : (
                <MapContainer
                  center={center}
                  zoom={11}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* Route Path */}
                  {routePositions.length > 1 && (
                    <Polyline 
                      positions={routePositions} 
                      color="#3B82F6" 
                      weight={3}
                      opacity={0.8}
                    />
                  )}

                  {/* Start Marker */}
                  {routeData?.locations.length > 0 && (
                    <Marker 
                      position={[routeData.locations[0].lat, routeData.locations[0].lng]}
                      icon={createStartIcon()}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-semibold text-green-600">Start</h3>
                          <p className="text-sm">
                            {formatTime(routeData.locations[0].recorded_at)}
                          </p>
                          {routeData.locations[0].accuracy && (
                            <p className="text-xs text-gray-500">
                              Accuracy: {Math.round(routeData.locations[0].accuracy)}m
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {/* End Marker */}
                  {routeData?.locations.length > 1 && (
                    <Marker 
                      position={[
                        routeData.locations[routeData.locations.length - 1].lat, 
                        routeData.locations[routeData.locations.length - 1].lng
                      ]}
                      icon={createEndIcon()}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-semibold text-red-600">End</h3>
                          <p className="text-sm">
                            {formatTime(routeData.locations[routeData.locations.length - 1].recorded_at)}
                          </p>
                          {routeData.locations[routeData.locations.length - 1].accuracy && (
                            <p className="text-xs text-gray-500">
                              Accuracy: {Math.round(routeData.locations[routeData.locations.length - 1].accuracy)}m
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRouteTracking;