import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { gameService } from '../services/gameService';
import { locationService } from '../services/locationService';
import { Area, UserLocation } from '../types';

const { width, height } = Dimensions.get('window');

// Fox team colors
const FOX_TEAM_COLORS: Record<string, string> = {
  Alpha: '#FF6B35',
  Bravo: '#3B82F6',
  Charlie: '#10B981',
  Delta: '#F59E0B',
  Echo: '#8B5CF6',
  Foxtrot: '#EF4444',
  Golf: '#06B6D4',
  Hotel: '#EC4899',
};

const MapScreen: React.FC = () => {
  const { state: authState } = useAuth();
  const { on, off, isConnected } = useWebSocket();
  const mapRef = useRef<MapView>(null);

  const [areas, setAreas] = useState<Area[]>([]);
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showFoxes, setShowFoxes] = useState(true);
  const [showHunters, setShowHunters] = useState(true);

  // Initial map region (Netherlands - Jotihunt area)
  const [region, setRegion] = useState<Region>({
    latitude: 52.1326,
    longitude: 5.2913,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  });

  // Load initial data
  useEffect(() => {
    loadData();
    checkTrackingStatus();
  }, []);

  // WebSocket listeners for real-time updates
  useEffect(() => {
    const handleLocationUpdate = (location: UserLocation) => {
      setUserLocations((prev) => {
        const existingIndex = prev.findIndex((l) => l.user_id === location.user_id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = location;
          return updated;
        }
        return [...prev, location];
      });
    };

    const handleAreaUpdate = (area: Area) => {
      setAreas((prev) => {
        const existingIndex = prev.findIndex((a) => a.id === area.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = area;
          return updated;
        }
        return [...prev, area];
      });
    };

    on('location-update', handleLocationUpdate);
    on('area-update', handleAreaUpdate);

    return () => {
      off('location-update', handleLocationUpdate);
      off('area-update', handleAreaUpdate);
    };
  }, [on, off]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [areasData, locationsData] = await Promise.all([
        gameService.getAreas(),
        gameService.getLatestLocations(),
      ]);
      setAreas(areasData);
      setUserLocations(locationsData);
    } catch (error) {
      console.error('Failed to load map data:', error);
      Alert.alert('Error', 'Failed to load map data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkTrackingStatus = async () => {
    const isRunning = await locationService.isBackgroundTrackingRunning();
    setIsTrackingEnabled(isRunning);
  };

  const toggleLocationTracking = async () => {
    if (isTrackingEnabled) {
      await locationService.stopBackgroundTracking();
      setIsTrackingEnabled(false);
      Alert.alert('Tracking Stopped', 'Location tracking has been disabled.');
    } else {
      const success = await locationService.startBackgroundTracking();
      if (success) {
        setIsTrackingEnabled(true);
        Alert.alert('Tracking Started', 'Your location is now being tracked in the background.');
      } else {
        Alert.alert(
          'Permission Required',
          'Please grant location permissions to enable tracking.'
        );
      }
    }
  };

  const centerOnCurrentLocation = async () => {
    const location = await locationService.getCurrentLocation();
    if (location) {
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setCurrentLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
      mapRef.current?.animateToRegion(newRegion, 500);
    }
  };

  const getTeamColor = (teamName: string): string => {
    return FOX_TEAM_COLORS[teamName] || '#6B7280';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        onRegionChangeComplete={setRegion}
      >
        {/* Fox Areas */}
        {showFoxes &&
          areas
            .filter((area) => area.lat && area.lng)
            .map((area) => (
              <Marker
                key={`area-${area.id}`}
                coordinate={{ latitude: area.lat!, longitude: area.lng! }}
                title={`🦊 ${area.name}`}
                description={`Status: ${area.status}${area.fox_team_name ? ` - ${area.fox_team_name}` : ''}`}
                pinColor={getTeamColor(area.name)}
              />
            ))}

        {/* Fox Routes */}
        {showFoxes &&
          areas
            .filter((area) => area.locations && area.locations.length > 1)
            .map((area) => (
              <Polyline
                key={`route-${area.id}`}
                coordinates={area.locations!.map((loc) => ({
                  latitude: loc.lat,
                  longitude: loc.lng,
                }))}
                strokeColor={getTeamColor(area.name)}
                strokeWidth={3}
              />
            ))}

        {/* Hunter Locations */}
        {showHunters &&
          userLocations
            .filter((loc) => loc.user_id !== authState.user?.id)
            .map((location) => (
              <Marker
                key={`user-${location.id}`}
                coordinate={{ latitude: location.lat, longitude: location.lng }}
                title={`🎯 ${location.first_name || location.username}`}
                description={`Team: ${location.team_name || 'None'} - ${location.session_status}`}
                pinColor={location.session_status === 'active' ? '#10B981' : '#9CA3AF'}
              />
            ))}

        {/* Current Location Marker */}
        {currentLocation && (
          <Marker
            coordinate={{ latitude: currentLocation.lat, longitude: currentLocation.lng }}
            title="You"
            pinColor="#1E40AF"
          />
        )}
      </MapView>

      {/* Controls Overlay */}
      <View style={styles.controlsContainer}>
        {/* Connection Status */}
        <View style={[styles.statusBadge, isConnected ? styles.connected : styles.disconnected]}>
          <View style={[styles.statusDot, isConnected ? styles.dotConnected : styles.dotDisconnected]} />
          <Text style={styles.statusText}>{isConnected ? 'Live' : 'Offline'}</Text>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, showFoxes && styles.filterButtonActive]}
            onPress={() => setShowFoxes(!showFoxes)}
          >
            <Text style={styles.filterEmoji}>🦊</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, showHunters && styles.filterButtonActive]}
            onPress={() => setShowHunters(!showHunters)}
          >
            <Text style={styles.filterEmoji}>🎯</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        {/* Location Tracking Toggle */}
        <TouchableOpacity
          style={[styles.trackingButton, isTrackingEnabled && styles.trackingButtonActive]}
          onPress={toggleLocationTracking}
        >
          <Ionicons
            name={isTrackingEnabled ? 'location' : 'location-outline'}
            size={24}
            color={isTrackingEnabled ? '#FFFFFF' : '#1E40AF'}
          />
          <Text style={[styles.trackingText, isTrackingEnabled && styles.trackingTextActive]}>
            {isTrackingEnabled ? 'Tracking ON' : 'Tracking OFF'}
          </Text>
        </TouchableOpacity>

        {/* Center on Location */}
        <TouchableOpacity style={styles.centerButton} onPress={centerOnCurrentLocation}>
          <Ionicons name="locate" size={24} color="#1E40AF" />
        </TouchableOpacity>

        {/* Refresh */}
        <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
          <Ionicons name="refresh" size={24} color="#1E40AF" />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Legend</Text>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendText}>Active Hunter</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#9CA3AF' }]} />
          <Text style={styles.legendText}>Inactive Hunter</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendEmoji}>🦊</Text>
          <Text style={styles.legendText}>Fox Team</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width,
    height,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  controlsContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  connected: {
    backgroundColor: '#DCFCE7',
  },
  disconnected: {
    backgroundColor: '#FEE2E2',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotConnected: {
    backgroundColor: '#10B981',
  },
  dotDisconnected: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButtonActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#1E40AF',
  },
  filterEmoji: {
    fontSize: 20,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trackingButtonActive: {
    backgroundColor: '#1E40AF',
  },
  trackingText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  trackingTextActive: {
    color: '#FFFFFF',
  },
  centerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  refreshButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legend: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#6B7280',
  },
});

export default MapScreen;
