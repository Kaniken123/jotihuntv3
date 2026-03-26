import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { gameService } from '../services/gameService';
import { locationService } from '../services/locationService';
import { Area, UserLocation, Subscription } from '../types';

const { width, height } = Dimensions.get('window');

// Fox team colors matching the web frontend
const FOX_TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  Alpha: { primary: '#FF6B35', secondary: '#FF8C42' },
  Bravo: { primary: '#3B82F6', secondary: '#60A5FA' },
  Charlie: { primary: '#10B981', secondary: '#34D399' },
  Delta: { primary: '#F59E0B', secondary: '#FBBF24' },
  Echo: { primary: '#8B5CF6', secondary: '#A78BFA' },
  Foxtrot: { primary: '#EF4444', secondary: '#F87171' },
  Golf: { primary: '#06B6D4', secondary: '#22D3EE' },
  Hotel: { primary: '#EC4899', secondary: '#F472B6' },
};

const MapScreen: React.FC = () => {
  const { state: authState } = useAuth();
  const { on, off, isConnected } = useWebSocket();
  const webViewRef = useRef<WebView>(null);

  const [areas, setAreas] = useState<Area[]>([]);
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showFoxes, setShowFoxes] = useState(true);
  const [showHunters, setShowHunters] = useState(true);
  const [showSubscriptions, setShowSubscriptions] = useState(true);
  const [mapReady, setMapReady] = useState(false);

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

  // Update map when data changes
  useEffect(() => {
    if (mapReady) {
      updateMapMarkers();
    }
  }, [areas, userLocations, subscriptions, showFoxes, showHunters, showSubscriptions, mapReady]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [areasData, locationsData, subscriptionsData] = await Promise.all([
        gameService.getAreas(),
        gameService.getLatestLocations(),
        gameService.getSubscriptions(),
      ]);
      setAreas(areasData);
      setUserLocations(locationsData);
      setSubscriptions(subscriptionsData);
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

  const enableLocationTracking = async () => {
    const success = await locationService.startBackgroundTracking();
    if (success) {
      setIsTrackingEnabled(true);
      console.log('Location tracking started automatically');
    } else {
      console.log('Failed to start location tracking');
    }
  };

  // Auto-start tracking on component mount
  useEffect(() => {
    if (!isTrackingEnabled) {
      enableLocationTracking();
    }
  }, []);

  const centerOnCurrentLocation = async () => {
    const location = await locationService.getCurrentLocation();
    if (location) {
      const lat = location.coords.latitude;
      const lng = location.coords.longitude;
      setCurrentLocation({ lat, lng });
      webViewRef.current?.injectJavaScript(`
        map.setView([${lat}, ${lng}], 15);
        if (currentLocationMarker) {
          currentLocationMarker.setLatLng([${lat}, ${lng}]);
        } else {
          currentLocationMarker = L.circleMarker([${lat}, ${lng}], {
            radius: 10,
            fillColor: '#1E40AF',
            color: '#fff',
            weight: 3,
            opacity: 1,
            fillOpacity: 1
          }).addTo(map).bindPopup('You are here');
        }
        true;
      `);
    }
  };

  const updateMapMarkers = () => {
    const foxMarkers = showFoxes ? areas.filter(a => a.lat && a.lng).map(area => ({
      type: 'fox',
      id: area.id,
      lat: area.lat,
      lng: area.lng,
      name: area.name,
      status: area.status,
      color: FOX_TEAM_COLORS[area.name]?.primary || '#6B7280',
    })) : [];

    const hunterMarkers = showHunters ? userLocations
      .filter(loc => loc.user_id !== authState.user?.id)
      .map(loc => ({
        type: 'hunter',
        id: loc.id,
        lat: loc.lat,
        lng: loc.lng,
        name: loc.first_name || loc.username || 'Hunter',
        team: loc.team_name,
        active: loc.session_status === 'active',
      })) : [];

    const subMarkers = showSubscriptions ? subscriptions
      .filter(sub => sub.lat && sub.lng)
      .map(sub => ({
        type: 'subscription',
        id: sub.id,
        lat: sub.lat,
        lng: sub.lng,
        name: sub.team_name,
        area: sub.area,
        color: FOX_TEAM_COLORS[sub.area || '']?.primary || '#6B7280',
        visits: sub.visit_count || 0,
      })) : [];

    const foxRoutes = showFoxes ? areas
      .filter(area => area.locations && area.locations.length > 1)
      .map(area => ({
        id: area.id,
        name: area.name,
        color: FOX_TEAM_COLORS[area.name]?.primary || '#6B7280',
        points: area.locations!.map(loc => [loc.lat, loc.lng]),
      })) : [];

    const script = `
      updateMarkers(
        ${JSON.stringify(foxMarkers)},
        ${JSON.stringify(hunterMarkers)},
        ${JSON.stringify(subMarkers)},
        ${JSON.stringify(foxRoutes)}
      );
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  };

  const handleMapMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'mapReady') {
        setMapReady(true);
      }
    } catch (e) {
      console.error('Error parsing map message:', e);
    }
  };

  const mapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([52.1326, 5.2913], 9);
    
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);
    
    var foxLayer = L.layerGroup().addTo(map);
    var hunterLayer = L.layerGroup().addTo(map);
    var subLayer = L.layerGroup().addTo(map);
    var routeLayer = L.layerGroup().addTo(map);
    var noHuntLayer = L.layerGroup().addTo(map);
    var currentLocationMarker = null;
    
    function createFoxIcon(color) {
      return L.divIcon({
        className: 'custom-fox-icon',
        html: '<div style="background:' + color + ';width:30px;height:30px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🦊</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
    }
    
    function createHunterIcon(active) {
      var color = active ? '#10B981' : '#9CA3AF';
      return L.divIcon({
        className: 'custom-hunter-icon',
        html: '<div style="background:' + color + ';width:26px;height:26px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 4px rgba(0,0,0,0.3);">🎯</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
    }
    
    function createSubIcon(color) {
      return L.divIcon({
        className: 'custom-sub-icon',
        html: '<div style="background:' + color + ';width:28px;height:28px;border-radius:6px;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 4px rgba(0,0,0,0.3);">🏠</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
    }
    
    function updateMarkers(foxes, hunters, subs, routes) {
      foxLayer.clearLayers();
      hunterLayer.clearLayers();
      subLayer.clearLayers();
      routeLayer.clearLayers();
      noHuntLayer.clearLayers();
      
      // Add fox markers
      foxes.forEach(function(fox) {
        L.marker([fox.lat, fox.lng], { icon: createFoxIcon(fox.color) })
          .bindPopup('<b>🦊 ' + fox.name + '</b><br>Status: ' + fox.status)
          .addTo(foxLayer);
      });
      
      // Add hunter markers
      hunters.forEach(function(hunter) {
        L.marker([hunter.lat, hunter.lng], { icon: createHunterIcon(hunter.active) })
          .bindPopup('<b>🎯 ' + hunter.name + '</b><br>Team: ' + (hunter.team || 'None'))
          .addTo(hunterLayer);
      });
      
      // Add subscription markers and no-hunt zones
      subs.forEach(function(sub) {
        L.marker([sub.lat, sub.lng], { icon: createSubIcon(sub.color) })
          .bindPopup('<b>🏠 ' + sub.name + '</b><br>Area: ' + (sub.area || 'None') + '<br>Visits: ' + sub.visits)
          .addTo(subLayer);
        
        // 500m no-hunt zone
        L.circle([sub.lat, sub.lng], {
          radius: 500,
          color: '#EF4444',
          fillColor: '#EF4444',
          fillOpacity: 0.1,
          weight: 2,
          dashArray: '5, 5'
        }).addTo(noHuntLayer);
      });
      
      // Add fox routes
      routes.forEach(function(route) {
        L.polyline(route.points, {
          color: route.color,
          weight: 3,
          opacity: 0.8
        }).addTo(routeLayer);
      });
    }
    
    // Signal that map is ready
    setTimeout(function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
    }, 500);
  </script>
</body>
</html>
  `;

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
      <WebView
        ref={webViewRef}
        source={{ html: mapHtml }}
        style={styles.map}
        onMessage={handleMapMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1E40AF" />
          </View>
        )}
      />

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
          <TouchableOpacity
            style={[styles.filterButton, showSubscriptions && styles.filterButtonActive]}
            onPress={() => setShowSubscriptions(!showSubscriptions)}
          >
            <Text style={styles.filterEmoji}>🏠</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        {/* Center on Location */}
        <TouchableOpacity style={styles.centerButton} onPress={centerOnCurrentLocation}>
          <Ionicons name="locate" size={24} color="#1E40AF" />
        </TouchableOpacity>

        {/* Refresh */}
        <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
          <Ionicons name="refresh" size={24} color="#1E40AF" />
        </TouchableOpacity>
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
});

export default MapScreen;
