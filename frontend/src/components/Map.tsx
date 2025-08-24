import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet';
import { Icon, LatLng } from 'leaflet';
import { Area, UserLocation, FoxRoute, Subscription } from '../types/index';
import { gameService } from '../services/gameService';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useAuth } from '../contexts/AuthContext';
import FoxStatusOverlay from './FoxStatusOverlay';

// Fix for default markers in React Leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Fox team color configuration - easily editable
const FOX_TEAM_COLORS = {
  'Alpha': { primary: '#FF6B35', secondary: '#FF8C42' },    // Orange
  'Bravo': { primary: '#3B82F6', secondary: '#60A5FA' },    // Blue
  'Charlie': { primary: '#10B981', secondary: '#34D399' },  // Green
  'Delta': { primary: '#F59E0B', secondary: '#FBBF24' },    // Yellow
  'Echo': { primary: '#8B5CF6', secondary: '#A78BFA' },     // Purple
  'Foxtrot': { primary: '#EF4444', secondary: '#F87171' },  // Red
  'Golf': { primary: '#06B6D4', secondary: '#22D3EE' },     // Cyan
  'Hotel': { primary: '#EC4899', secondary: '#F472B6' },   // Pink
  'default': { primary: '#6B7280', secondary: '#9CA3AF' }   // Gray fallback
};

// Helper function to get team colors
const getTeamColors = (teamName: string) => {
  return FOX_TEAM_COLORS[teamName as keyof typeof FOX_TEAM_COLORS] || FOX_TEAM_COLORS.default;
};

// Custom icons for different marker types
const createIcon = (color: string, size: 'small' | 'medium' | 'large' = 'medium') => {
  const sizes = {
    small: [20, 20],
    medium: [25, 25],
    large: [30, 30],
  };
  
  const [width, height] = sizes[size];
  
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 24" fill="${color}">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    `)}`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height],
  });
};

// Fox icon for fox team markers
const createFoxIcon = (teamName: string, size: 'small' | 'medium' | 'large' = 'medium') => {
  const sizes = {
    small: [18, 18],
    medium: [24, 24],
    large: [32, 32],
  };
  
  const [width, height] = sizes[size];
  const colors = getTeamColors(teamName);
  
  // Create a fox-like SVG path instead of using emoji
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="28" fill="${colors.primary}" stroke="${colors.primary}" stroke-width="2"/>
      <!-- Fox head -->
      <ellipse cx="32" cy="35" rx="10" ry="8" fill="${colors.secondary}"/>
      <!-- Fox ears -->
      <ellipse cx="26" cy="26" rx="3" ry="5" fill="${colors.secondary}"/>
      <ellipse cx="38" cy="26" rx="3" ry="5" fill="${colors.secondary}"/>
      <!-- Fox eyes -->
      <circle cx="28" cy="33" r="1.5" fill="#000"/>
      <circle cx="36" cy="33" r="1.5" fill="#000"/>
      <!-- Fox nose -->
      <circle cx="32" cy="37" r="1" fill="#000"/>
      <!-- Fox mouth -->
      <path d="M32 38 Q29 40 27 38" stroke="#000" stroke-width="0.8" fill="none"/>
      <path d="M32 38 Q35 40 37 38" stroke="#000" stroke-width="0.8" fill="none"/>
    </svg>
  `;
  
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgContent)}`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
    popupAnchor: [0, -height / 2],
  });
};

// Simple house icon for subscription/group markers
const createHouseIcon = (isVisited: boolean = false, size: 'small' | 'medium' | 'large' = 'medium') => {
  const sizes = {
    small: [16, 16],
    medium: [20, 20],
    large: [24, 24],
  };
  
  const [width, height] = sizes[size];
  const fillColor = isVisited ? '#10B981' : '#3B82F6'; // Green if visited, blue if not
  
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 24">
      <path d="M12 2L2 8v14h20V8L12 2z" fill="${fillColor}" stroke="white" stroke-width="1"/>
      ${isVisited ? `<path d="M8 12l2 2 4-4" stroke="white" stroke-width="1.5" fill="none"/>` : ''}
    </svg>
  `;
  
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgContent)}`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height],
  });
};


// User icons with session status
const createUserIcon = (isActive: boolean = true) => {
  const color = isActive ? '#10B981' : '#6B7280'; // Green for active, gray for inactive
  return createIcon(color, 'medium');
};

interface LocationUpdaterProps {
  onLocationUpdate: (position: LatLng) => void;
}

const LocationUpdater: React.FC<LocationUpdaterProps> = React.memo(({ onLocationUpdate }) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    const updateLocation = () => {
      // Prevent multiple simultaneous location requests
      if (isUpdatingRef.current) return;
      
      if (navigator.geolocation) {
        isUpdatingRef.current = true;
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const newPos = new LatLng(latitude, longitude);
            callbackRef.current(newPos);
            isUpdatingRef.current = false;
          },
          (error) => {
            console.error('Error getting location:', error);
            isUpdatingRef.current = false;
          },
          { 
            enableHighAccuracy: true, 
            timeout: 15000, // Increased timeout
            maximumAge: 60000 // Increased maximum age to reduce frequent requests
          }
        );
      }
    };

    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Get initial location
    updateLocation();
    
    // Set up new interval
    intervalRef.current = setInterval(updateLocation, 120000); // Update every 2 minutes

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      isUpdatingRef.current = false;
    };
  }, []); // Remove onLocationUpdate dependency to prevent multiple intervals

  // Use a separate effect to handle callback changes
  const callbackRef = useRef(onLocationUpdate);
  callbackRef.current = onLocationUpdate;

  return null;
});

interface MapClickHandlerProps {
  onMapClick: (position: LatLng) => void;
  isAdminMode: boolean;
}

const MapClickHandler: React.FC<MapClickHandlerProps> = ({ onMapClick, isAdminMode }) => {
  useMapEvents({
    click(e) {
      if (isAdminMode) {
        onMapClick(e.latlng);
      }
    },
  });
  
  return null;
};

const Map: React.FC = () => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [userPosition, setUserPosition] = useState<LatLng | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFoxLocationModal, setShowFoxLocationModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<LatLng | null>(null);
  const [selectedFoxTeam, setSelectedFoxTeam] = useState<string>('');
  const [isSubmittingLocation, setIsSubmittingLocation] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [visibleFoxTeams, setVisibleFoxTeams] = useState<Set<string>>(new Set(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']));
  const [showFoxFilter, setShowFoxFilter] = useState(false);
  const [showUserMarkers, setShowUserMarkers] = useState(true);
  const [showSubscriptions, setShowSubscriptions] = useState(true);
  const [selectedFoxRoute, setSelectedFoxRoute] = useState<FoxRoute | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeTimeSpan, setRouteTimeSpan] = useState<number>(24); // hours
  const { socket, isConnected } = useWebSocket();
  const { state } = useAuth();

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('🗺️ Loading map data...');
        // Load areas first for immediate map display
        const areasData = await gameService.getAreas();
        console.log('🦊 Areas loaded:', areasData?.length || 0, 'areas');
        setAreas(areasData);
        setIsLoading(false); // Show map immediately with fox markers
        
        // Then load subscriptions and user locations in background
        const [subscriptionsData, locationsData] = await Promise.all([
          gameService.getSubscriptions(),
          gameService.getUserLocations()
        ]);
        
        console.log('🏠 Subscriptions loaded:', subscriptionsData?.length || 0, 'subscriptions');
        console.log('👥 User locations loaded:', locationsData?.length || 0, 'locations');
        
        setSubscriptions(subscriptionsData || []);
        setUserLocations(locationsData);
      } catch (error) {
        console.error('Error loading map data:', error);
        setIsLoading(false);
        // Don't crash the app, just show empty map
      }
    };

    if (state.user) {
      console.log('👤 User is logged in, loading map data...');
      loadData();
    } else {
      console.log('❌ No user logged in');
      setIsLoading(false);
    }
  }, [state.user]);

  const handleLocationUpdate = useCallback((locationUpdate: UserLocation) => {
    setUserLocations(prevLocations => {
      const existingIndex = prevLocations.findIndex(
        loc => loc.user_id === locationUpdate.user_id
      );
      
      if (existingIndex >= 0) {
        const newLocations = [...prevLocations];
        newLocations[existingIndex] = {
          ...newLocations[existingIndex],
          ...locationUpdate,
          id: newLocations[existingIndex].id
        };
        return newLocations;
      } else {
        return [...prevLocations, locationUpdate];
      }
    });
  }, []);

  const handleFoxStatusUpdate = useCallback((update: any) => {
    setAreas(prevAreas => {
      return prevAreas.map(area => 
        area.id === update.area_id 
          ? { ...area, status: update.status, updated_at: update.updated_at }
          : area
      );
    });
  }, []);

  const handleFoxLocationUpdate = useCallback((update: any) => {
    setAreas(prevAreas => {
      return prevAreas.map(area => 
        area.id === update.area_id 
          ? { 
              ...area, 
              lat: update.lat, 
              lng: update.lng, 
              last_seen: update.last_seen 
            }
          : area
      );
    });
  }, []);

  useEffect(() => {
    if (socket && isConnected) {
      socket.on('location-update', handleLocationUpdate);
      socket.on('team-location-update', handleLocationUpdate);
      socket.on('fox-status-update', handleFoxStatusUpdate);
      socket.on('fox-location-update', handleFoxLocationUpdate);

      return () => {
        socket.off('location-update', handleLocationUpdate);
        socket.off('team-location-update', handleLocationUpdate);
        socket.off('fox-status-update', handleFoxStatusUpdate);
        socket.off('fox-location-update', handleFoxLocationUpdate);
      };
    }
  }, [socket, isConnected, handleLocationUpdate, handleFoxStatusUpdate, handleFoxLocationUpdate]);

  const handleUserLocationUpdate = useCallback(async (position: LatLng) => {
    setUserPosition(position);
    
    try {
      await gameService.updateUserLocation(position.lat, position.lng);
    } catch (error) {
      console.error('Error updating location:', error);
      // Don't crash the app if location update fails
    }
  }, []);

  const handleMapClick = useCallback((position: LatLng) => {
    if (state.user?.role === 'admin' && isAddMode) {
      setSelectedPosition(position);
      setShowFoxLocationModal(true);
      setIsAddMode(false); // Exit add mode after placing
    }
  }, [state.user?.role, isAddMode]);

  const handleFoxLocationSubmit = useCallback(async () => {
    if (!selectedPosition || !selectedFoxTeam) return;

    setIsSubmittingLocation(true);
    try {
      const area = areas.find(a => a.name === selectedFoxTeam);
      if (!area) {
        alert('Fox team not found');
        return;
      }

      await gameService.updateFoxLocation(area.id, selectedPosition.lat, selectedPosition.lng, 'admin_manual');
      
      // Update local state
      setAreas(prevAreas => 
        prevAreas.map(a => 
          a.id === area.id 
            ? { ...a, lat: selectedPosition.lat, lng: selectedPosition.lng, last_seen: new Date().toISOString() }
            : a
        )
      );

      setShowFoxLocationModal(false);
      setSelectedPosition(null);
      setSelectedFoxTeam('');
      setIsAddMode(false);
      
      alert('Fox location updated successfully!');
    } catch (error) {
      console.error('Error updating fox location:', error);
      alert('Failed to update fox location');
    } finally {
      setIsSubmittingLocation(false);
    }
  }, [selectedPosition, selectedFoxTeam, areas]);

  const loadFoxRoute = useCallback(async (areaId: number) => {
    setIsLoadingRoute(true);
    try {
      const routeData = await gameService.getFoxRoute(areaId, routeTimeSpan);
      console.log('Loaded fox route data:', routeData);
      console.log('Route points in order:', routeData.route.map((p, i) => `${i+1}. ${new Date(p.recorded_at).toLocaleTimeString()} - (${p.lat}, ${p.lng})`));
      setSelectedFoxRoute(routeData);
    } catch (error: any) {
      console.error('Error loading fox route:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred';
      alert(`Failed to load fox route: ${errorMessage}`);
    } finally {
      setIsLoadingRoute(false);
    }
  }, [routeTimeSpan]);

  const clearFoxRoute = useCallback(() => {
    setSelectedFoxRoute(null);
  }, []);

  const toggleFoxTeamVisibility = useCallback((teamName: string) => {
    setVisibleFoxTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamName)) {
        newSet.delete(teamName);
      } else {
        newSet.add(teamName);
      }
      return newSet;
    });
  }, []);

  const showAllFoxTeams = useCallback(() => {
    setVisibleFoxTeams(new Set(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']));
  }, []);

  const hideAllFoxTeams = useCallback(() => {
    setVisibleFoxTeams(new Set());
  }, []);

  const center: [number, number] = useMemo(() => [52.1597, 6.4131], []);
  const zoom = 11;

  const foxMarkers = useMemo(() => {
    console.log('🦊 Creating fox markers:', areas.length, 'areas total');
    const filteredAreas = areas.filter(area => visibleFoxTeams.has(area.name));
    console.log('🦊 Visible fox areas:', filteredAreas.length);
    
    return filteredAreas.map((area) => {
      console.log('🦊 Processing area:', area.name, 'lat:', area.lat, 'lng:', area.lng);
      return area.lat && area.lng ? (
          <Marker
            key={`fox-${area.id}`}
            position={[area.lat, area.lng]}
            icon={createFoxIcon(area.name, 'medium')}
          >
            <Popup>
              <div className="p-2 min-w-48">
                <h3 className="font-semibold text-lg">{area.fox_team_name || area.name}</h3>
                <p className="text-sm text-gray-600">
                  Status: <span className={`font-medium ${
                    area.status === 'active' ? 'text-green-600' : 
                    area.status === 'hunted' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {area.status}
                  </span>
                </p>
                <p className="text-sm text-gray-600">Points: {area.points}</p>
                {area.last_seen && (
                  <p className="text-xs text-gray-500 mt-1">
                    Last seen: {new Date(area.last_seen).toLocaleTimeString()}
                  </p>
                )}
                <div className="mt-3 space-y-2">
                  <button
                    onClick={() => loadFoxRoute(area.id)}
                    disabled={isLoadingRoute}
                    className="w-full px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoadingRoute ? 'Loading...' : 'Show Route'}
                  </button>
                  {selectedFoxRoute?.area.id === area.id && (
                    <button
                      onClick={clearFoxRoute}
                      className="w-full px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                    >
                      Hide Route
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ) : null;
    }).filter(Boolean);
  }, [areas, visibleFoxTeams, isLoadingRoute, selectedFoxRoute, loadFoxRoute, clearFoxRoute]);

  const userMarkers = useMemo(() => 
    showUserMarkers ? userLocations.map((location) => (
      <Marker
        key={`user-${location.id}`}
        position={[location.lat, location.lng]}
        icon={createUserIcon(location.session_status === 'active')}
      >
        <Popup>
          <div className="p-2">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold">
                {location.first_name && location.last_name
                  ? `${location.first_name} ${location.last_name}`
                  : location.username}
              </h3>
              {location.role === 'admin' && (
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Admin</span>
              )}
              {location.team_role === 'leader' && (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Leader</span>
              )}
              {location.session_status && (
                <span className={`px-2 py-1 text-xs rounded-full ${
                  location.session_status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {location.session_status === 'active' ? 'Online' : 'Offline'}
                </span>
              )}
            </div>
            {location.team_name && (
              <p className="text-sm text-purple-600 font-medium">
                Team: {location.team_name} {location.team_area ? `(${location.team_area})` : ''}
              </p>
            )}
            <p className="text-sm text-gray-600">
              Updated: {new Date(location.recorded_at).toLocaleString()}
            </p>
            {location.session_status === 'inactive' && location.minutes_since_last_activity && (
              <p className="text-xs text-red-600">
                Last activity: {location.minutes_since_last_activity} minutes ago
              </p>
            )}
            {location.accuracy && (
              <p className="text-xs text-gray-500">
                Accuracy: {Math.round(location.accuracy)}m
              </p>
            )}
          </div>
        </Popup>
      </Marker>
    )) : [], [userLocations, showUserMarkers]);

  const subscriptionMarkers = useMemo(() => {
    console.log('🏠 Creating subscription markers:', subscriptions.length, 'subscriptions total');
    const filteredSubscriptions = showSubscriptions ? subscriptions
      .filter(subscription => subscription.lat && subscription.lng) : []; // Only show subscriptions with coordinates
    console.log('🏠 Visible subscriptions with coords:', filteredSubscriptions.length);
    
    return filteredSubscriptions.map((subscription) => {
        // Check if any fox team has visited this subscription
        const isVisited = subscription.visited_by_foxes && subscription.visited_by_foxes.length > 0;
        
        return (
          <Marker
            key={`subscription-${subscription.id}`}
            position={[subscription.lat!, subscription.lng!]}
            icon={createHouseIcon(isVisited, 'medium')}
          >
            <Popup>
              <div className="p-3 min-w-52">
                <h3 className="font-semibold text-lg mb-2">{subscription.team_name}</h3>
                
                {subscription.area && (
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Gebied:</span> {subscription.area}
                  </p>
                )}
                
                {subscription.fox_team_name && (
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Gekoppeld aan vos:</span> {subscription.fox_team_name}
                  </p>
                )}
                
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Status:</span> {subscription.is_participating ? 'Actief' : 'Inactief'}
                </p>

                {subscription.visited_by_foxes && subscription.visited_by_foxes.length > 0 && (
                  <div className="mt-3 p-2 bg-green-50 rounded">
                    <p className="text-sm font-medium text-green-800 mb-1">Bezocht door:</p>
                    <div className="flex flex-wrap gap-1">
                      {subscription.visited_by_foxes.map((foxTeam, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full"
                        >
                          {foxTeam}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {(!subscription.visited_by_foxes || subscription.visited_by_foxes.length === 0) && (
                  <div className="mt-3 p-2 bg-blue-50 rounded">
                    <p className="text-sm text-blue-700">🏠 Nog niet bezocht door vossen</p>
                  </div>
                )}
                
                <div className="mt-3 pt-2 border-t text-xs text-gray-500">
                  <p>Coördinaten: {subscription.lat?.toFixed(6)}, {subscription.lng?.toFixed(6)}</p>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      });
  }, [subscriptions, showSubscriptions]);

  if (isLoading) {
    return (
      <div className="map-container flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container relative">
      <FoxStatusOverlay areas={areas} />
      
      {/* Fox Route Information Panel */}
      {selectedFoxRoute && (
        <div className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg p-4 max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {selectedFoxRoute.area.fox_team_name || selectedFoxRoute.area.name} Route
            </h3>
            <button
              onClick={clearFoxRoute}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <p>Points: {selectedFoxRoute.route_stats.total_points}</p>
            <p>Time span: {selectedFoxRoute.route_stats.time_span_hours}h</p>
            {selectedFoxRoute.route_stats.first_point && (
              <p>From: {new Date(selectedFoxRoute.route_stats.first_point).toLocaleString()}</p>
            )}
            {selectedFoxRoute.route_stats.last_point && (
              <p>To: {new Date(selectedFoxRoute.route_stats.last_point).toLocaleString()}</p>
            )}
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time span (hours):
            </label>
            <select
              value={routeTimeSpan}
              onChange={(e) => setRouteTimeSpan(Number(e.target.value))}
              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200"
            >
              <option value={1}>1 hour</option>
              <option value={6}>6 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
            </select>
            <button
              onClick={() => loadFoxRoute(selectedFoxRoute.area.id)}
              disabled={isLoadingRoute}
              className="w-full mt-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoadingRoute ? 'Loading...' : 'Reload Route'}
            </button>
          </div>
        </div>
      )}
      
      {/* Fox Team Filter */}
      <div className="absolute top-4 right-4 z-10 space-y-2">
        <button
          onClick={() => setShowFoxFilter(!showFoxFilter)}
          className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
        >
          <span className="text-sm">🦊</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Filter</span>
        </button>
        
        {showFoxFilter && (
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg p-4 min-w-[200px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Fox Teams</h3>
              <div className="flex space-x-1">
                <button
                  onClick={showAllFoxTeams}
                  className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                >
                  All
                </button>
                <button
                  onClick={hideAllFoxTeams}
                  className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  None
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              {['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'].map((teamName) => {
                const colors = getTeamColors(teamName);
                const isVisible = visibleFoxTeams.has(teamName);
                
                return (
                  <label key={teamName} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => toggleFoxTeamVisibility(teamName)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <div 
                      className="w-3 h-3 rounded-full border" 
                      style={{ backgroundColor: colors.primary }}
                    ></div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{teamName}</span>
                  </label>
                );
              })}
            </div>
            
            <div className="border-t border-gray-200 dark:border-gray-600 mt-3 pt-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Other Markers</h4>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showUserMarkers}
                    onChange={(e) => setShowUserMarkers(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: '#10B981' }}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Users</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSubscriptions}
                    onChange={(e) => setShowSubscriptions(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <div className="w-3 h-3" style={{ 
                    fontSize: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center'
                  }}>🏠</div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Groups</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Admin Add Button */}
      {state.user?.role === 'admin' && (
        <div className="absolute bottom-4 right-4 z-10 space-y-2">
          <button
            onClick={() => setIsAddMode(!isAddMode)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md shadow-lg transition-all ${
              isAddMode 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <span className="text-lg">
              {isAddMode ? '✕' : '🦊'}
            </span>
            <span className="text-sm font-medium">
              {isAddMode ? 'Cancel' : 'Add Fox Location'}
            </span>
          </button>
          
          {isAddMode && (
            <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 px-3 py-2 rounded-md shadow-lg">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Click on map to place fox marker</span>
              </div>
            </div>
          )}
        </div>
      )}
      
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <LocationUpdater onLocationUpdate={handleUserLocationUpdate} />
        <MapClickHandler onMapClick={handleMapClick} isAdminMode={state.user?.role === 'admin' && isAddMode} />
        
        {foxMarkers}
        {userMarkers}
        {subscriptionMarkers}
        
        {/* Fox Route Polyline */}
        {selectedFoxRoute && selectedFoxRoute.route.length > 1 && (
          <>
            <Polyline
              positions={selectedFoxRoute.route.map(point => [point.lat, point.lng])}
              color={getTeamColors(selectedFoxRoute.area.name).primary}
              weight={4}
              opacity={0.8}
              dashArray="5, 10"
            />
            {/* Route point markers to show progression */}
            {selectedFoxRoute.route.map((point, index) => (
              <Marker
                key={`route-point-${point.id}`}
                position={[point.lat, point.lng]}
                icon={createIcon(getTeamColors(selectedFoxRoute.area.name).secondary, 'small')}
              >
                <Popup>
                  <div className="text-xs">
                    <p><strong>Route Point {index + 1}</strong></p>
                    <p>Time: {new Date(point.recorded_at).toLocaleString()}</p>
                    <p>Coordinates: {point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p>
                    <p>Source: {point.source}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </>
        )}
        
        {/* Current user position */}
        {userPosition && (
          <Marker position={userPosition} icon={createUserIcon(true)}>
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold">Your Location</h3>
                <p className="text-sm text-gray-600">
                  {userPosition.lat.toFixed(6)}, {userPosition.lng.toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Fox Location Modal */}
      {showFoxLocationModal && selectedPosition && state.user?.role === 'admin' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Place Fox Team Location
            </h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <strong>Location:</strong> {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <strong>Timestamp:</strong> {new Date().toLocaleString()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Fox Team
                </label>
                <select
                  value={selectedFoxTeam}
                  onChange={(e) => setSelectedFoxTeam(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="">Choose a fox team...</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.name}>
                      {area.name} ({area.fox_team_name || 'Unknown Team'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleFoxLocationSubmit}
                disabled={!selectedFoxTeam || isSubmittingLocation}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSubmittingLocation ? 'Placing...' : 'Place Marker'}
              </button>
              
              <button
                onClick={() => {
                  setShowFoxLocationModal(false);
                  setSelectedPosition(null);
                  setSelectedFoxTeam('');
                  setIsAddMode(false);
                }}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Map;