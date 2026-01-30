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
  Navigation,
  Target,
  Zap
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
  } | null;
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
  message?: string;
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

const createFoxIcon = (teamName: string) => {
  const foxColors = {
    'Alpha': '#FF6B35',
    'Bravo': '#3B82F6', 
    'Charlie': '#10B981',
    'Delta': '#F59E0B',
    'Echo': '#8B5CF6',
    'Foxtrot': '#EF4444',
    'Golf': '#06B6D4',
    'Hotel': '#EC4899',
    'default': '#6B7280'
  };
  
  const color = foxColors[teamName as keyof typeof foxColors] || foxColors.default;
  
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="${color}" stroke="${color}" stroke-width="2"/>
        <!-- Fox head -->
        <ellipse cx="32" cy="35" rx="12" ry="10" fill="white"/>
        <!-- Fox ears -->
        <ellipse cx="24" cy="24" rx="4" ry="6" fill="white"/>
        <ellipse cx="40" cy="24" rx="4" ry="6" fill="white"/>
        <!-- Fox eyes -->
        <circle cx="28" cy="33" r="2" fill="#000"/>
        <circle cx="36" cy="33" r="2" fill="#000"/>
        <!-- Fox nose -->
        <circle cx="32" cy="37" r="1.5" fill="#000"/>
        <!-- Fox mouth -->
        <path d="M32 39 Q29 41 27 39" stroke="#000" stroke-width="1" fill="none"/>
        <path d="M32 39 Q35 41 37 39" stroke="#000" stroke-width="1" fill="none"/>
      </svg>
    `)}`,
    iconSize: [35, 35],
    iconAnchor: [17.5, 17.5],
    popupAnchor: [0, -17.5],
  });
};

const RouteTracker: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [error, setError] = useState('');
  const [timePeriod, setTimePeriod] = useState(24); // hours
  const [showFoxOnly, setShowFoxOnly] = useState(false);
  const { state } = useAuth();

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

  const getRouteColor = (user: User) => {
    // Use team_area to determine if this is a fox team member
    if (user.team_area && ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'].includes(user.team_area)) {
      const foxColors = {
        'Alpha': '#FF6B35',
        'Bravo': '#3B82F6', 
        'Charlie': '#10B981',
        'Delta': '#F59E0B',
        'Echo': '#8B5CF6',
        'Foxtrot': '#EF4444',
        'Golf': '#06B6D4',
        'Hotel': '#EC4899',
      };
      return foxColors[user.team_area as keyof typeof foxColors] || '#FF6B35';
    }
    return '#3B82F6'; // Default blue for regular users
  };

  const isFoxTeamMember = (user: User) => {
    return user.team_area && ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'].includes(user.team_area);
  };

  const filteredUsers = showFoxOnly ? users.filter(user => isFoxTeamMember(user)) : users;

  const center: [number, number] = [52.1597, 6.4131];
  const routePositions: [number, number][] = routeData?.locations.map(loc => [loc.lat, loc.lng]) || [];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center space-x-2">
          <Route className="w-5 h-5 sm:w-6 sm:h-6" />
          <span>Route Tracker</span>
          <Target className="w-5 h-5 text-orange-500" />
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          🦊 Track fox teams and other players' routes (respects privacy settings)
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
                <span>Players</span>
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

            {/* Fox Filter Toggle */}
            <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFoxOnly}
                  onChange={(e) => setShowFoxOnly(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <Target className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  🦊 Show Fox Teams Only
                </span>
              </label>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                Focus on tracking fox teams for strategic hunting
              </p>
            </div>

            {/* Time Period Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center space-x-2">
                <Clock className="w-4 h-4" />
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
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer transition-all ${
                      selectedUser?.id === user.id 
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                        : isFoxTeamMember(user)
                        ? 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-800/30'
                        : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                    onClick={() => loadUserRoute(user)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {getUserDisplayName(user)}
                          </p>
                          {isFoxTeamMember(user) && (
                            <Target className="w-4 h-4 text-orange-600" />
                          )}
                        </div>
                        {user.team_name && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {user.team_name} {user.team_area ? `(${user.team_area})` : ''}
                            {isFoxTeamMember(user) && ' - Fox Team'}
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
          {routeData && routeData.user && (
            <div className="card p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>Route Statistics for {getUserDisplayName({ 
                  first_name: routeData.user.first_name, 
                  last_name: routeData.user.last_name, 
                  username: routeData.user.username 
                } as User)}</span>
                {selectedUser && isFoxTeamMember(selectedUser) && (
                  <div className="flex items-center space-x-1">
                    <Target className="w-4 h-4 text-orange-600" />
                    <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">Fox Team</span>
                  </div>
                )}
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

          {/* Privacy Message */}
          {routeData?.message && (
            <div className="card p-4 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
              <div className="flex items-center space-x-2">
                <EyeOff className="w-5 h-5 text-yellow-600" />
                <p className="text-yellow-700 dark:text-yellow-300">{routeData.message}</p>
              </div>
            </div>
          )}

          {/* Map */}
          <div className="card p-4 relative">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <MapPin className="w-5 h-5" />
              <span>Route Visualization</span>
              {isLoadingRoute && <LoadingSpinner size="sm" />}
              {selectedUser && isFoxTeamMember(selectedUser) && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                  <Target className="w-3 h-3 text-orange-600" />
                  <span className="text-xs font-medium text-orange-700 dark:text-orange-300">Fox Route</span>
                </div>
              )}
            </h2>

            <div className="h-64 sm:h-80 lg:h-96 rounded-lg overflow-hidden relative">
              {!selectedUser ? (
                <div className="h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-lg">
                  <div className="text-center">
                    <Navigation className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      Select a player to view their route
                    </p>
                    <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                      <Target className="w-4 h-4 text-orange-500" />
                      <span>Fox teams are highlighted</span>
                    </div>
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
                      color={getRouteColor(selectedUser)} 
                      weight={isFoxTeamMember(selectedUser) ? 4 : 3}
                      opacity={0.8}
                      dashArray={isFoxTeamMember(selectedUser) ? '10, 5' : undefined}
                    />
                  )}

                  {/* Start Marker */}
                  {routeData?.locations.length > 0 && (
                    <Marker 
                      position={[routeData.locations[0].lat, routeData.locations[0].lng]}
                      icon={isFoxTeamMember(selectedUser) ? createFoxIcon(selectedUser.team_area || 'default') : createStartIcon()}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-semibold text-green-600 flex items-center space-x-1">
                            <span>Start</span>
                            {isFoxTeamMember(selectedUser) && <Target className="w-4 h-4 text-orange-600" />}
                          </h3>
                          <p className="text-sm">
                            {formatTime(routeData.locations[0].recorded_at)}
                          </p>
                          {routeData.locations[0].accuracy && (
                            <p className="text-xs text-gray-500">
                              Accuracy: {Math.round(routeData.locations[0].accuracy)}m
                            </p>
                          )}
                          {isFoxTeamMember(selectedUser) && (
                            <p className="text-xs text-orange-600 mt-1 font-medium">
                              🦊 Fox Team: {selectedUser.team_area}
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
                          <h3 className="font-semibold text-red-600 flex items-center space-x-1">
                            <span>Latest Position</span>
                            {isFoxTeamMember(selectedUser) && <Target className="w-4 h-4 text-orange-600" />}
                          </h3>
                          <p className="text-sm">
                            {formatTime(routeData.locations[routeData.locations.length - 1].recorded_at)}
                          </p>
                          {routeData.locations[routeData.locations.length - 1].accuracy && (
                            <p className="text-xs text-gray-500">
                              Accuracy: {Math.round(routeData.locations[routeData.locations.length - 1].accuracy)}m
                            </p>
                          )}
                          {isFoxTeamMember(selectedUser) && (
                            <p className="text-xs text-orange-600 mt-1 font-medium">
                              🦊 Current fox position
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

export default RouteTracker;