import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon, LatLng } from 'leaflet';
import { Area, UserLocation } from '../types';
import { gameService } from '../services/gameService';
import { useWebSocket } from '../contexts/WebSocketContext';

// Fix for default markers in React Leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

const foxIcon = createIcon('#ef4444', 'large'); // Red for fox teams
const userIcon = createIcon('#3b82f6', 'medium'); // Blue for users
const teamBaseIcon = createIcon('#10b981', 'large'); // Green for team bases

interface LocationUpdaterProps {
  onLocationUpdate: (position: LatLng) => void;
}

const LocationUpdater: React.FC<LocationUpdaterProps> = ({ onLocationUpdate }) => {
  const map = useMap();

  useEffect(() => {
    const updateLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const newPos = new LatLng(latitude, longitude);
            onLocationUpdate(newPos);
          },
          (error) => {
            console.error('Error getting location:', error);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
      }
    };

    updateLocation();
    const interval = setInterval(updateLocation, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [onLocationUpdate]);

  return null;
};

const Map: React.FC = () => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [userPosition, setUserPosition] = useState<LatLng | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { socket, isConnected } = useWebSocket();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [areasData, locationsData] = await Promise.all([
          gameService.getAreas(),
          gameService.getUserLocations(),
        ]);
        
        setAreas(areasData);
        setUserLocations(locationsData);
      } catch (error) {
        console.error('Error loading map data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Listen for real-time location updates
  useEffect(() => {
    if (socket && isConnected) {
      const handleLocationUpdate = (locationUpdate: UserLocation) => {
        setUserLocations(prevLocations => {
          const existingIndex = prevLocations.findIndex(
            loc => loc.user_id === locationUpdate.user_id
          );
          
          if (existingIndex >= 0) {
            // Update existing location
            const newLocations = [...prevLocations];
            newLocations[existingIndex] = {
              ...newLocations[existingIndex],
              ...locationUpdate,
              id: newLocations[existingIndex].id // Preserve existing ID
            };
            return newLocations;
          } else {
            // Add new location
            return [...prevLocations, {
              id: Date.now(), // Temporary ID for new locations
              ...locationUpdate
            }];
          }
        });
      };

      const handleFoxStatusUpdate = (update: any) => {
        setAreas(prevAreas => {
          return prevAreas.map(area => 
            area.id === update.area_id 
              ? { ...area, status: update.status, updated_at: update.updated_at }
              : area
          );
        });
      };

      const handleFoxLocationUpdate = (update: any) => {
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
      };

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
  }, [socket, isConnected]);

  const handleLocationUpdate = async (position: LatLng) => {
    setUserPosition(position);
    
    try {
      await gameService.updateUserLocation(position.lat, position.lng);
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const center: [number, number] = [52.0907374, 5.1214201]; // Netherlands center
  const zoom = 13;

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
    <div className="map-container">
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
        
        <LocationUpdater onLocationUpdate={handleLocationUpdate} />
        
        {/* Fox team markers */}
        {areas.map((area) => (
          area.lat && area.lng && (
            <Marker
              key={`fox-${area.id}`}
              position={[area.lat, area.lng]}
              icon={foxIcon}
            >
              <Popup>
                <div className="p-2">
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
                </div>
              </Popup>
            </Marker>
          )
        ))}
        
        {/* User location markers */}
        {userLocations.map((location) => (
          <Marker
            key={`user-${location.id}`}
            position={[location.lat, location.lng]}
            icon={userIcon}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold">
                  {location.first_name && location.last_name
                    ? `${location.first_name} ${location.last_name}`
                    : location.username}
                </h3>
                <p className="text-sm text-gray-600">
                  Updated: {new Date(location.recorded_at).toLocaleString()}
                </p>
                {location.accuracy && (
                  <p className="text-xs text-gray-500">
                    Accuracy: {Math.round(location.accuracy)}m
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* Current user position */}
        {userPosition && (
          <Marker position={userPosition} icon={userIcon}>
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
    </div>
  );
};

export default Map;