import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline, Circle } from 'react-leaflet';
import { Icon, LatLng } from 'leaflet';
import { Area, UserLocation, FoxRoute, Subscription, Article } from '../types/index';
import { gameService } from '../services/gameService';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useAuth } from '../contexts/AuthContext';
import FoxStatusOverlay from './FoxStatusOverlay';
import FoxPredictionLayer from './FoxPredictionLayer';

// Subscription Popup Content Component
interface SubscriptionPopupProps {
  subscription: Subscription;
  onUpdate: () => void;
}

const SubscriptionPopupContent: React.FC<SubscriptionPopupProps> = ({ subscription, onUpdate }) => {
  const { t } = useTranslation();
  const [selectedArea, setSelectedArea] = useState(subscription.area || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const areas = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];

  const handleAreaChange = async (area: string) => {
    setIsUpdating(true);
    try {
      await gameService.updateSubscription(subscription.id, { area: area || undefined });
      setSelectedArea(area);
      onUpdate(); // Refresh subscriptions
    } catch (error) {
      console.error('Failed to update area:', error);
      alert(t('map.updateAreaError'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-3 min-w-80">
      <h3 className="font-semibold text-lg mb-3">{subscription.team_name}</h3>

      {/* Area Display (read-only, synced from API) */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          📍 {t('map.subareaLabel')}
        </label>
        <div className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-md text-sm text-gray-700">
          {subscription.area || t('map.noSubareaValue')}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {t('map.autoSyncNote')}
        </p>
      </div>

      {/* Visit Count and Status */}
      <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('map.visitStatus')}</span>
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {t('map.visitCount', { count: subscription.visit_count || 0 })}
          </span>
        </div>

        {subscription.visited_by_foxes && subscription.visited_by_foxes.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-1">{t('map.visitedBy')}</p>
            <div className="flex flex-wrap gap-1">
              {subscription.visited_by_foxes.map((foxTeam, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 rounded-full"
                >
                  {foxTeam}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-blue-700 dark:text-blue-300">{t('map.notVisitedYet')}</p>
        )}
      </div>

      {/* Accommodation details */}
      <div className="space-y-2 mb-3 text-sm">
        {subscription.accomodation && (
          <p className="text-gray-600 dark:text-gray-400">
            <span className="font-medium">{t('map.typeLabel')}</span> {subscription.accomodation}
          </p>
        )}

        {subscription.street && subscription.housenumber && (
          <p className="text-gray-600 dark:text-gray-400">
            <span className="font-medium">{t('map.addressLabel')}</span> {subscription.street} {subscription.housenumber}
            {subscription.housenumber_addition && subscription.housenumber_addition}
          </p>
        )}

        {subscription.postcode && subscription.city && (
          <p className="text-gray-600 dark:text-gray-400">
            <span className="font-medium">{t('map.cityLabel')}</span> {subscription.postcode} {subscription.city}
          </p>
        )}
      </div>

      {/* Coordinates */}
      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
        <p>📍 {subscription.lat?.toFixed(6)}, {subscription.lng?.toFixed(6)}</p>
      </div>
    </div>
  );
};

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
const createHouseIcon = (isVisited: boolean = false, area?: string, size: 'small' | 'medium' | 'large' = 'medium') => {
  const sizes = {
    small: [16, 16],
    medium: [20, 20],
    large: [24, 24],
  };

  const [width, height] = sizes[size];

  // Get color based on area (deelgebied)
  let fillColor = '#3B82F6'; // Default blue if no area
  if (area && FOX_TEAM_COLORS[area as keyof typeof FOX_TEAM_COLORS]) {
    fillColor = FOX_TEAM_COLORS[area as keyof typeof FOX_TEAM_COLORS].primary;
  }

  // If visited, make it slightly darker
  const strokeColor = isVisited ? '#000' : '#fff';
  const strokeWidth = isVisited ? '2' : '1';

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 24">
      <path d="M12 2L2 8v14h20V8L12 2z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
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


// User icons with session status - car shape
const createUserIcon = (isActive: boolean = true, size: 'small' | 'medium' | 'large' = 'medium') => {
  const sizes = {
    small: [32, 32],
    medium: [40, 40],
    large: [48, 48],
  };

  const [width, height] = sizes[size];
  const color = isActive ? '#10B981' : '#6B7280'; // Green for active, gray for inactive
  const accentColor = isActive ? '#059669' : '#4B5563'; // Darker shade for depth

  // Create a car-shaped SVG with more contrast and details
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 64 64">
      <!-- Outer glow for visibility -->
      <circle cx="32" cy="32" r="30" fill="${color}" opacity="0.3"/>
      <circle cx="32" cy="32" r="28" fill="${color}" opacity="0.5"/>

      <!-- Car body shadow -->
      <ellipse cx="32" cy="54" rx="22" ry="5" fill="rgba(0,0,0,0.5)"/>

      <!-- Car main body -->
      <rect x="14" y="26" width="36" height="20" rx="3" fill="${color}" stroke="#fff" stroke-width="2.5"/>

      <!-- Car body accent -->
      <rect x="14" y="26" width="36" height="10" rx="3" fill="${accentColor}" stroke="#fff" stroke-width="2.5"/>

      <!-- Car roof/cabin -->
      <path d="M 20 26 L 25 14 L 39 14 L 44 26 Z" fill="${color}" stroke="#fff" stroke-width="2.5"/>

      <!-- Windshield (front window) -->
      <path d="M 38 16 L 42 24 L 36 24 L 36 16 Z" fill="rgba(135,206,250,0.8)" stroke="#fff" stroke-width="1.5"/>

      <!-- Side window -->
      <path d="M 26 16 L 30 24 L 24 24 L 22 16 Z" fill="rgba(135,206,250,0.7)" stroke="#fff" stroke-width="1.5"/>

      <!-- Car wheels with more detail -->
      <circle cx="21" cy="46" r="5" fill="#1a1a1a" stroke="#fff" stroke-width="2"/>
      <circle cx="21" cy="46" r="3" fill="#333"/>
      <circle cx="21" cy="46" r="1.5" fill="#888"/>

      <circle cx="43" cy="46" r="5" fill="#1a1a1a" stroke="#fff" stroke-width="2"/>
      <circle cx="43" cy="46" r="3" fill="#333"/>
      <circle cx="43" cy="46" r="1.5" fill="#888"/>

      <!-- Headlights with glow -->
      <circle cx="50" cy="34" r="3" fill="#FFE66D" opacity="0.5"/>
      <circle cx="50" cy="34" r="2.5" fill="#FFED4E" stroke="#FFF" stroke-width="1"/>

      <!-- Taillight -->
      <circle cx="14" cy="34" r="2" fill="#EF4444" opacity="0.8"/>
    </svg>
  `;

  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgContent)}`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height - 6],
    popupAnchor: [0, -height + 8],
  });
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
  const [showPredictions, setShowPredictions] = useState(false);
  const [showUserMarkers, setShowUserMarkers] = useState(true);
  const [showSubscriptions, setShowSubscriptions] = useState(true);
  const [showNoHuntZones, setShowNoHuntZones] = useState(true);
  const [selectedFoxRoute, setSelectedFoxRoute] = useState<FoxRoute | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeTimeSpan, setRouteTimeSpan] = useState<number>(24); // hours
  
  // Fox location reporting states (public feature)
  const [isReportFoxMode, setIsReportFoxMode] = useState(false);
  const [reportFoxPosition, setReportFoxPosition] = useState<LatLng | null>(null);
  const [showReportFoxModal, setShowReportFoxModal] = useState(false);
  const [selectedReportFoxTeam, setSelectedReportFoxTeam] = useState<string>('');
  const [isSubmittingFoxReport, setIsSubmittingFoxReport] = useState(false);
  
  // Fox prediction settings
  
  // Real-time circle growth - updates every 5 seconds to make circles grow autonomously
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // Quick Hint Solution functionality
  const [showHintSolutionModal, setShowHintSolutionModal] = useState(false);
  const [hints, setHints] = useState<Article[]>([]);
  const [selectedHint, setSelectedHint] = useState<Article | null>(null);
  const [solutionForm, setSolutionForm] = useState({
    solution: '',
    foxCoordinates: {
      alpha: { rd_x: '', rd_y: '' },
      bravo: { rd_x: '', rd_y: '' },
      charlie: { rd_x: '', rd_y: '' },
      delta: { rd_x: '', rd_y: '' },
      echo: { rd_x: '', rd_y: '' },
      foxtrot: { rd_x: '', rd_y: '' },
      golf: { rd_x: '', rd_y: '' },
      hotel: { rd_x: '', rd_y: '' }
    }
  });
  const [isSubmittingSolution, setIsSubmittingSolution] = useState(false);
  
  const { socket, isConnected } = useWebSocket();
  const { state } = useAuth();
  const { t } = useTranslation();

  // Separate function to fetch subscriptions (for refresh after update)
  const fetchSubscriptions = useCallback(async () => {
    try {
      const subscriptionsData = await gameService.getSubscriptions();
      console.log('🔄 Subscriptions refreshed:', subscriptionsData?.length || 0);
      setSubscriptions(subscriptionsData || []);
    } catch (error) {
      console.error('Error refreshing subscriptions:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('🗺️ Loading map data...');
        // Load areas first for immediate map display
        const areasData = await gameService.getAreas();
        console.log('🦊 Areas loaded:', areasData?.length || 0, 'areas');

        // Deduplicate areas by name, keeping the most recent (highest id)
        const uniqueAreas = areasData.reduce((acc, area) => {
          const existing = acc.find(a => a.name === area.name);
          if (!existing || area.id > existing.id) {
            if (existing) {
              acc.splice(acc.indexOf(existing), 1);
            }
            acc.push(area);
          }
          return acc;
        }, []);
        console.log('🦊 Unique areas after deduplication:', uniqueAreas.length);

        setAreas(uniqueAreas);
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

  // Handle hint solution success events
  const handleHintSolutionSubmitted = useCallback((update: any) => {
    console.log('Hint solution submitted:', update);

    if (update.reveals_fox && update.revealed_areas?.length > 0) {
      // Reload areas to show newly revealed fox locations
      gameService.getAreas().then(areasData => {
        setAreas(areasData);

        // Show success notification
        alert(t('map.hintSolved', { areas: update.revealed_areas.join(', ') }));
      }).catch(error => {
        console.error('Failed to reload areas after hint solution:', error);
      });
    }
  }, []);

  // Handle fox locations reset event
  const handleFoxLocationsReset = useCallback((update: any) => {
    console.log('Fox locations reset by admin:', update);

    // Reload areas to show cleared fox locations
    gameService.getAreas().then(areasData => {
      setAreas(areasData);
      console.log('🗑️ Fox locations cleared from map');
    }).catch(error => {
      console.error('Failed to reload areas after reset:', error);
    });
  }, []);

  useEffect(() => {
    if (socket && isConnected) {
      socket.on('location-update', handleLocationUpdate);
      socket.on('team-location-update', handleLocationUpdate);
      socket.on('fox-status-update', handleFoxStatusUpdate);
      socket.on('fox-location-update', handleFoxLocationUpdate);
      socket.on('hint-solution-submitted', handleHintSolutionSubmitted);
      socket.on('fox-locations-reset', handleFoxLocationsReset);

      return () => {
        socket.off('location-update', handleLocationUpdate);
        socket.off('team-location-update', handleLocationUpdate);
        socket.off('fox-status-update', handleFoxStatusUpdate);
        socket.off('fox-location-update', handleFoxLocationUpdate);
        socket.off('hint-solution-submitted', handleHintSolutionSubmitted);
        socket.off('fox-locations-reset', handleFoxLocationsReset);
      };
    }
  }, [socket, isConnected, handleLocationUpdate, handleFoxStatusUpdate, handleFoxLocationUpdate, handleHintSolutionSubmitted, handleFoxLocationsReset]);

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
    // Admin fox location placement
    if (state.user?.role === 'admin' && isAddMode) {
      setSelectedPosition(position);
      setShowFoxLocationModal(true);
      setIsAddMode(false); // Exit add mode after placing
    }
    // Public fox location reporting
    else if (isReportFoxMode) {
      setReportFoxPosition(position);
      setShowReportFoxModal(true);
      setIsReportFoxMode(false); // Exit report mode after placing
    }
  }, [state.user?.role, isAddMode, isReportFoxMode]);

  const handleFoxLocationSubmit = useCallback(async () => {
    if (!selectedPosition || !selectedFoxTeam) return;

    setIsSubmittingLocation(true);
    try {
      const area = areas.find(a => a.name === selectedFoxTeam);
      if (!area) {
        alert(t('map.foxNotFound'));
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
      
      alert(t('map.foxUpdated'));
    } catch (error) {
      console.error('Error updating fox location:', error);
      alert(t('map.foxUpdateFailed'));
    } finally {
      setIsSubmittingLocation(false);
    }
  }, [selectedPosition, selectedFoxTeam, areas]);

  // Public fox location reporting
  const handleFoxLocationReport = useCallback(async () => {
    if (!reportFoxPosition || !selectedReportFoxTeam) return;

    setIsSubmittingFoxReport(true);
    try {
      const area = areas.find(a => a.name === selectedReportFoxTeam);
      if (!area) {
        alert(t('map.foxNotFound'));
        return;
      }

      await gameService.updateFoxLocation(area.id, reportFoxPosition.lat, reportFoxPosition.lng, 'user_report');
      
      // Update local state
      setAreas(prevAreas => 
        prevAreas.map(a => 
          a.id === area.id 
            ? { ...a, lat: reportFoxPosition.lat, lng: reportFoxPosition.lng, last_seen: new Date().toISOString() }
            : a
        )
      );

      setShowReportFoxModal(false);
      setReportFoxPosition(null);
      setSelectedReportFoxTeam('');
      setIsReportFoxMode(false);
      
      alert(t('map.foxReported'));
    } catch (error) {
      console.error('Error reporting fox location:', error);
      alert(t('map.foxReportFailed'));
    } finally {
      setIsSubmittingFoxReport(false);
    }
  }, [reportFoxPosition, selectedReportFoxTeam, areas]);

  const loadFoxRoute = useCallback(async (areaId: number) => {
    setIsLoadingRoute(true);
    try {
      console.log(`🛣️ Loading route for area ID: ${areaId}, timeSpan: ${routeTimeSpan} hours`);
      const routeData = await gameService.getFoxRoute(areaId, routeTimeSpan);
      console.log('🛣️ Raw route data:', routeData);
      console.log('🛣️ Route points count:', routeData?.route?.length || 0);
      console.log('🛣️ Route points in order:', routeData?.route?.map((p, i) => `${i+1}. ${new Date(p.recorded_at).toLocaleTimeString()} - (${p.lat}, ${p.lng})`) || []);
      
      if (routeData?.route?.length > 0) {
        console.log('🛣️ Setting selected fox route - should show on map');
      } else {
        console.log('🛣️ No route points found for this fox');
        alert(t('map.noRouteData'));
      }
      
      setSelectedFoxRoute(routeData);
    } catch (error: any) {
      console.error('❌ Error loading fox route:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred';
      alert(t('map.routeLoadFailed', { error: errorMessage }));
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

  // Load available hints
  const loadHints = useCallback(async () => {
    if (!state.user) return;
    
    try {
      const articles = await gameService.getArticles();
      const hintArticles = articles.filter((article: Article) => article.type === 'hint');
      setHints(hintArticles);
    } catch (error) {
      console.error('Failed to load hints:', error);
    }
  }, [state.user]);

  useEffect(() => {
    if (state.user) {
      loadHints();
    }
  }, [state.user, loadHints]);

  // Real-time circle growth timer - updates currentTime every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      console.log('🕒 Timer: Updating prediction circles for autonomous growth');
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Handle hint solution submission
  const handleSubmitHintSolution = useCallback(async () => {
    if (!solutionForm.solution.trim()) return; // article is optional; solution text is not
    
    setIsSubmittingSolution(true);
    try {
      // Filter out empty coordinates
      const filteredCoordinates: any = {};
      Object.entries(solutionForm.foxCoordinates).forEach(([area, coords]) => {
        if (coords.rd_x.trim() && coords.rd_y.trim()) {
          filteredCoordinates[area] = {
            rd_x: coords.rd_x.trim(),
            rd_y: coords.rd_y.trim()
          };
        }
      });

      const result = await gameService.submitHintSolution(
        selectedHint?.id ?? null,
        solutionForm.solution,
        Object.keys(filteredCoordinates).length > 0 ? filteredCoordinates : undefined
      );
      
      // Reset form
      setSolutionForm({
        solution: '',
        foxCoordinates: {
          alpha: { rd_x: '', rd_y: '' },
          bravo: { rd_x: '', rd_y: '' },
          charlie: { rd_x: '', rd_y: '' },
          delta: { rd_x: '', rd_y: '' },
          echo: { rd_x: '', rd_y: '' },
          foxtrot: { rd_x: '', rd_y: '' },
          golf: { rd_x: '', rd_y: '' },
          hotel: { rd_x: '', rd_y: '' }
        }
      });
      setShowHintSolutionModal(false);
      setSelectedHint(null);
      
      // Show success message
      alert(result.message || t('map.solutionSubmitted'));
      
      // If correct and reveals fox locations, reload areas to show new fox positions
      if (result.solution?.is_correct && result.solution?.reveals_fox_location) {
        const areasData = await gameService.getAreas();
        setAreas(areasData);
      }
      
    } catch (error: any) {
      console.error('Failed to submit solution:', error);
      alert(error.response?.data?.error || t('map.solutionFailed'));
    } finally {
      setIsSubmittingSolution(false);
    }
  }, [selectedHint, solutionForm]);

  const openHintSolutionModal = useCallback((hint: Article) => {
    setSelectedHint(hint);
    setShowHintSolutionModal(true);
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
                {area.last_seen && (
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded text-xs">
                    <span className="text-yellow-700 dark:text-yellow-300 font-medium">
                      💡 Revealed by hint solution
                    </span>
                  </div>
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
            icon={createHouseIcon(isVisited, subscription.area, 'medium')}
          >
            <Popup>
              <SubscriptionPopupContent subscription={subscription} onUpdate={fetchSubscriptions} />
            </Popup>
          </Marker>
        );
      });
  }, [subscriptions, showSubscriptions, fetchSubscriptions]);

  // No-hunt zones - 500m circles around subscriptions
  const noHuntZones = useMemo(() => {
    if (!showNoHuntZones) return [];
    
    return subscriptions
      .filter(subscription => subscription.lat && subscription.lng)
      .map((subscription) => (
        <Circle
          key={`no-hunt-${subscription.id}`}
          center={[subscription.lat!, subscription.lng!]}
          radius={500} // 500 meters
          pathOptions={{
            fillColor: '#EF4444', // Red color
            fillOpacity: 0.1,
            color: '#EF4444',
            weight: 2,
            opacity: 0.6,
            dashArray: '5, 5'
          }}
        >
          <Popup>
            <div className="p-2">
              <h4 className="font-semibold text-red-600">{t('map.noHuntZoneTitle')}</h4>
              <p className="text-sm text-gray-600 mb-1">
                <strong>{t('map.clubhouse')}</strong> {subscription.team_name}
              </p>
              <p className="text-xs text-gray-500">
                {t('map.noHuntRadius')}
              </p>
              <p className="text-xs text-gray-500">
                {t('map.counterHuntZone')}
              </p>
            </div>
          </Popup>
        </Circle>
      ));
  }, [subscriptions, showNoHuntZones]);

  if (isLoading) {
    return (
      <div className="map-container flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('map.loading')}</p>
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
              {t('map.routeTitle', { name: selectedFoxRoute.area.fox_team_name || selectedFoxRoute.area.name })}
            </h3>
            <button
              onClick={clearFoxRoute}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <p>{t('map.points')}: {selectedFoxRoute.route_stats.total_points}</p>
            <p>{t('map.timeSpan')}: {selectedFoxRoute.route_stats.time_span_hours}h</p>
            {selectedFoxRoute.route_stats.first_point && (
              <p>{t('map.from')}: {new Date(selectedFoxRoute.route_stats.first_point).toLocaleString()}</p>
            )}
            {selectedFoxRoute.route_stats.last_point && (
              <p>{t('map.to')}: {new Date(selectedFoxRoute.route_stats.last_point).toLocaleString()}</p>
            )}
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('map.timeSpanHours')}
            </label>
            <select
              value={routeTimeSpan}
              onChange={(e) => setRouteTimeSpan(Number(e.target.value))}
              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200"
            >
              <option value={1}>{t('map.opt1h')}</option>
              <option value={6}>{t('map.opt6h')}</option>
              <option value={12}>{t('map.opt12h')}</option>
              <option value={24}>{t('map.opt24h')}</option>
              <option value={48}>{t('map.opt48h')}</option>
            </select>
            <button
              onClick={() => loadFoxRoute(selectedFoxRoute.area.id)}
              disabled={isLoadingRoute}
              className="w-full mt-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoadingRoute ? t('map.loadingShort') : t('map.reloadRoute')}
            </button>
          </div>
          
        </div>
      )}
      
      {/* Control Panel */}
      <div className="absolute top-4 right-4 z-10 space-y-2">
        {/* Quick Hint Solution Button */}
        <button
          onClick={() => {
            // Standalone entry: open even with no synced article (selectedHint = null),
            // so a solved hint location can be logged immediately.
            setSelectedHint(hints.length > 0 ? (hints.find(h => !h.is_read) || hints[0]) : null);
            setShowHintSolutionModal(true);
          }}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 rounded-md shadow-lg transition-all"
        >
          <span className="text-sm">💡</span>
          <span className="text-xs font-medium">{t('map.quickHint')}</span>
          {hints.filter(h => !h.is_read).length > 0 && (
            <span className="bg-yellow-400 text-blue-900 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {hints.filter(h => !h.is_read).length}
            </span>
          )}
        </button>

        {/* Fox Filter Button */}
        <button
          onClick={() => setShowFoxFilter(!showFoxFilter)}
          className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
        >
          <span className="text-sm">🦊</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('map.filter')}</span>
        </button>
        
        {showFoxFilter && (
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg p-4 min-w-[200px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('map.foxTeams')}</h3>
              <div className="flex space-x-1">
                <button
                  onClick={showAllFoxTeams}
                  className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                >
                  {t('map.all')}
                </button>
                <button
                  onClick={hideAllFoxTeams}
                  className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  {t('map.none')}
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
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('map.otherMarkers')}</h4>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showUserMarkers}
                    onChange={(e) => setShowUserMarkers(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: '#10B981' }}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t('map.users')}</span>
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
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t('map.groups')}</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showNoHuntZones}
                    onChange={(e) => setShowNoHuntZones(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <div className="w-3 h-3 rounded-full border-2 border-red-500" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t('map.noHuntZones')}</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fox Location Buttons */}
      <div className="absolute bottom-4 right-4 z-10 space-y-2">
        {/* Prediction toggle */}
        <button
          onClick={() => setShowPredictions(!showPredictions)}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md shadow-lg transition-all ${
            showPredictions
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
          }`}
        >
          <span className="text-lg">🎯</span>
          <span className="text-sm font-medium">{t('prediction.toggle')}</span>
        </button>

        {/* Public Fox Report Button */}
        <button
          onClick={() => setIsReportFoxMode(!isReportFoxMode)}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md shadow-lg transition-all ${
            isReportFoxMode 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          <span className="text-lg">
            {isReportFoxMode ? '✕' : '🦊'}
          </span>
          <span className="text-sm font-medium">
            {isReportFoxMode ? t('common.cancel') : t('map.reportFoxLocation')}
          </span>
        </button>
        
        {/* Admin Add Button */}
        {state.user?.role === 'admin' && (
          <button
            onClick={() => setIsAddMode(!isAddMode)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md shadow-lg transition-all ${
              isAddMode 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <span className="text-lg">
              {isAddMode ? '✕' : '👑'}
            </span>
            <span className="text-sm font-medium">
              {isAddMode ? t('common.cancel') : t('map.adminAddFox')}
            </span>
          </button>
        )}
        
        {(isReportFoxMode || isAddMode) && (
          <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 px-3 py-2 rounded-md shadow-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">
                {isReportFoxMode ? t('map.clickReport') : t('map.clickPlace')}
              </span>
            </div>
          </div>
        )}
      </div>
      
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
        <MapClickHandler onMapClick={handleMapClick} isAdminMode={(state.user?.role === 'admin' && isAddMode) || isReportFoxMode} />
        
        {/* No-hunt zones first (behind other markers) */}
        {noHuntZones}
        
        {foxMarkers}
        {userMarkers}
        {subscriptionMarkers}

        {/* Fox location predictions (heatmap + top zones) */}
        <FoxPredictionLayer areas={areas} visible={showPredictions} />
        
        {/* Fox Route Polyline */}
        {selectedFoxRoute && selectedFoxRoute.route.length > 1 && (
          console.log('🗺️ Rendering fox route with', selectedFoxRoute.route.length, 'points'),
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
            {/* Removed: walking-speed prediction circle. Replaced by FoxPredictionLayer (🎯 toggle). */}
          </>
        )}
        
        {/* Removed: all-foxes walking-speed prediction circles. Replaced by FoxPredictionLayer (🎯 toggle). */}
        
        {/* Current user position */}
        {userPosition && (
          <Marker position={userPosition} icon={createUserIcon(true)}>
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold">{t('map.yourLocation')}</h3>
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
              {t('map.placeFoxTitle')}
            </h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <strong>{t('map.locationLabel')}</strong> {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <strong>{t('map.timestampLabel')}</strong> {new Date().toLocaleString()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('map.selectFoxTeam')}
                </label>
                <select
                  value={selectedFoxTeam}
                  onChange={(e) => setSelectedFoxTeam(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="">{t('map.chooseFoxTeam')}</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.name}>
                      {area.name}
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
                {isSubmittingLocation ? t('map.placing') : t('map.placeMarker')}
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
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fox Location Report Modal (Public Feature) */}
      {showReportFoxModal && reportFoxPosition && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('map.reportFoxTitle')}
            </h3>

            <div className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  📍 <strong>{t('map.spottedLocation')}</strong> {reportFoxPosition.lat.toFixed(6)}, {reportFoxPosition.lng.toFixed(6)}
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  🕒 <strong>{t('map.reportTime')}</strong> {new Date().toLocaleString()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('map.whichFoxTeam')}
                </label>
                <select
                  value={selectedReportFoxTeam}
                  onChange={(e) => setSelectedReportFoxTeam(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="">{t('map.chooseSpotted')}</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.name}>
                      🦊 {area.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {t('map.helpReport')}
                </p>
              </div>
              
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  {t('map.reportHelpsAll')}
                </p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleFoxLocationReport}
                disabled={!selectedReportFoxTeam || isSubmittingFoxReport}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isSubmittingFoxReport ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>{t('map.reporting')}</span>
                  </>
                ) : (
                  <>
                    <span>🦊</span>
                    <span>{t('map.reportFox')}</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setShowReportFoxModal(false);
                  setReportFoxPosition(null);
                  setSelectedReportFoxTeam('');
                  setIsReportFoxMode(false);
                }}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Hint Solution Modal */}
      {showHintSolutionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {t('map.quickHintTitle')}
              </h2>
              <button
                onClick={() => {
                  setShowHintSolutionModal(false);
                  setSelectedHint(null);
                  setSolutionForm({
                    solution: '',
                    foxCoordinates: {
                      alpha: { rd_x: '', rd_y: '' },
                      bravo: { rd_x: '', rd_y: '' },
                      charlie: { rd_x: '', rd_y: '' },
                      delta: { rd_x: '', rd_y: '' },
                      echo: { rd_x: '', rd_y: '' },
                      foxtrot: { rd_x: '', rd_y: '' },
                      golf: { rd_x: '', rd_y: '' },
                      hotel: { rd_x: '', rd_y: '' }
                    }
                  });
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            {/* Hint Display (only when solving a specific synced article) */}
            {selectedHint && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {selectedHint.title}
              </h3>
              {selectedHint.area && (
                <span className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded-full mb-2">
                  {t('map.areaLabel')} {selectedHint.area}
                </span>
              )}
              <div 
                className="text-sm text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: selectedHint.content }}
              />
              <div className="mt-2 text-xs text-gray-500">
                {t('map.publishedLabel')} {new Date(selectedHint.published_at).toLocaleString()}
              </div>
            </div>
            )}

            {/* Solution Form */}
            <div className="space-y-6">
              {/* Text Solution */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('map.solutionTextReq')}
                </label>
                <textarea
                  value={solutionForm.solution}
                  onChange={(e) => setSolutionForm(prev => ({ ...prev, solution: e.target.value }))}
                  placeholder={t('map.solutionPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                  rows={2}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('map.solutionHint')}
                </p>
              </div>
              
              {/* Fox Coordinates */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('map.foxLocationsOptional')}
                  </label>
                  <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                    {t('map.deadlineNote')}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  {t('map.fillRevealed')}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'] as const).map((area) => {
                    const areaKey = area.toLowerCase() as keyof typeof solutionForm.foxCoordinates;
                    const teamColors = {
                      'Alpha': 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-700',
                      'Bravo': 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-700',
                      'Charlie': 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-700',
                      'Delta': 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-700',
                      'Echo': 'bg-purple-50 border-purple-200 dark:bg-purple-900/10 dark:border-purple-700',
                      'Foxtrot': 'bg-pink-50 border-pink-200 dark:bg-pink-900/10 dark:border-pink-700',
                      'Golf': 'bg-cyan-50 border-cyan-200 dark:bg-cyan-900/10 dark:border-cyan-700',
                      'Hotel': 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-700',
                    };
                    
                    return (
                      <div 
                        key={area} 
                        className={`p-3 rounded-lg border ${teamColors[area]}`}
                      >
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                          🦊 {area} {t('updateDetail.teamSuffix')}
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                              {t('map.rdX')}
                            </label>
                            <input
                              type="number"
                              value={solutionForm.foxCoordinates[areaKey].rd_x}
                              onChange={(e) => setSolutionForm(prev => ({
                                ...prev,
                                foxCoordinates: {
                                  ...prev.foxCoordinates,
                                  [areaKey]: {
                                    ...prev.foxCoordinates[areaKey],
                                    rd_x: e.target.value
                                  }
                                }
                              }))}
                              placeholder="123456"
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                              min="10000"
                              max="280000"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                              {t('map.rdY')}
                            </label>
                            <input
                              type="number"
                              value={solutionForm.foxCoordinates[areaKey].rd_y}
                              onChange={(e) => setSolutionForm(prev => ({
                                ...prev,
                                foxCoordinates: {
                                  ...prev.foxCoordinates,
                                  [areaKey]: {
                                    ...prev.foxCoordinates[areaKey],
                                    rd_y: e.target.value
                                  }
                                }
                              }))}
                              placeholder="456789"
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                              min="300000"
                              max="620000"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <p>{t('map.note1')}</p>
                <p>{t('map.note2')}</p>
                <p>{t('map.note3')}</p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowHintSolutionModal(false);
                    setSelectedHint(null);
                    setSolutionForm({
                      solution: '',
                      foxCoordinates: {
                        alpha: { rd_x: '', rd_y: '' },
                        bravo: { rd_x: '', rd_y: '' },
                        charlie: { rd_x: '', rd_y: '' },
                        delta: { rd_x: '', rd_y: '' },
                        echo: { rd_x: '', rd_y: '' },
                        foxtrot: { rd_x: '', rd_y: '' },
                        golf: { rd_x: '', rd_y: '' },
                        hotel: { rd_x: '', rd_y: '' }
                      }
                    });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  {t('common.cancel')}
                </button>

                <button
                  onClick={handleSubmitHintSolution}
                  disabled={!solutionForm.solution.trim() || isSubmittingSolution}
                  className="flex items-center space-x-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  {isSubmittingSolution ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      <span>{t('updateDetail.submitting')}</span>
                    </>
                  ) : (
                    <>
                      <span>🎯</span>
                      <span>{t('updateDetail.submitSolution')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Map;