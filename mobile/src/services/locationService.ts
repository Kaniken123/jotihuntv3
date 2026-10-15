import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { api } from './api';
import config from '../utils/config';

const BACKGROUND_LOCATION_TASK = config.BACKGROUND_LOCATION_TASK;

// Define the background location task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  console.log('[BackgroundLocationTask] Task triggered');
  
  if (error) {
    console.error('[BackgroundLocationTask] Error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    console.log('[BackgroundLocationTask] Received locations:', locations.length);

    // The OS batches fixes and can deliver several at once (common at speed /
    // after a background gap). Send the NEWEST one so the server never shows a
    // stale position; locations[0] alone looked "frozen" when a batch arrived.
    const location = locations
      .filter((l) => l && l.coords)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (location) {
      try {
        console.log('[BackgroundLocationTask] Sending location to server:', {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy,
          batch: locations.length,
        });

        const resp = await api.post('/locations/update', {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy,
        });
        // The server switches tracking per person on the planning board. When
        // it says we are not tracked, stop transmitting instead of pinging on.
        if (resp?.data?.tracked === false) {
          console.log('[BackgroundLocationTask] Tracking is off for this user — stopping');
          try {
            if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
              await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
            }
          } catch (e) {
            console.warn('[BackgroundLocationTask] Could not stop updates', e);
          }
          return;
        }
        console.log('[BackgroundLocationTask] Location sent successfully');
      } catch (error) {
        console.error('[BackgroundLocationTask] Failed to update location:', error);
      }
    }
  } else {
    console.log('[BackgroundLocationTask] No location data received');
  }
});

export interface LocationTrackingOptions {
  accuracy?: Location.Accuracy;
  timeInterval?: number;
  distanceInterval?: number;
}

export const locationService = {
  // Request location permissions
  async requestPermissions(): Promise<boolean> {
    try {
      // Request foreground permission first
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        console.log('Foreground location permission denied');
        return false;
      }

      // Request background permission
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (backgroundStatus !== 'granted') {
        console.log('Background location permission denied');
        // Still return true for foreground-only tracking
        return true;
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  },

  // Check if permissions are granted
  async checkPermissions(): Promise<{ foreground: boolean; background: boolean }> {
    const foreground = await Location.getForegroundPermissionsAsync();
    const background = await Location.getBackgroundPermissionsAsync();

    return {
      foreground: foreground.status === 'granted',
      background: background.status === 'granted',
    };
  },

  // Get current location
  async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return location;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  },

  // Start background location tracking
  async startBackgroundTracking(options?: LocationTrackingOptions): Promise<boolean> {
    try {
      const permissions = await this.checkPermissions();
      
      if (!permissions.foreground) {
        const granted = await this.requestPermissions();
        if (!granted) {
          console.log('[LocationService] Location permissions not granted');
          return false;
        }
      }

      // Check if already running
      const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (isRunning) {
        console.log('[LocationService] Background location already running');
        return true;
      }

      console.log('[LocationService] Starting background location tracking...');
      
      // Start location updates that will fire every 30 seconds regardless of movement.
      // High accuracy = GPS provider (Balanced used the fused/network provider, which
      // degraded or stalled while driving with no wifi — the "stopped at speed" bug).
      // activityType keeps iOS from pausing updates for a moving vehicle.
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        activityType: Location.ActivityType.AutomotiveNavigation,
        timeInterval: 60000, // Update every 60 seconds
        distanceInterval: 0, // Send update regardless of distance (every minute)
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Jotihunt Location Tracking',
          notificationBody: 'Your location is being tracked for the hunt',
          notificationColor: '#1E40AF',
        },
        pausesUpdatesAutomatically: false, // Keep tracking even when stationary
      });

      console.log('[LocationService] Background location tracking started successfully');
      return true;
    } catch (error) {
      console.error('[LocationService] Error starting background tracking:', error);
      return false;
    }
  },

  // Ask the server whether this person should be tracked right now (the admin
  // switches it per person on the planning board) and start or stop to match.
  async syncTrackingWithServer(): Promise<boolean> {
    try {
      const res = await api.get('/locations/should-track');
      const shouldTrack = !!res?.data?.track;
      const running = await this.isBackgroundTrackingRunning();
      if (shouldTrack && !running) {
        await this.startBackgroundTracking();
      } else if (!shouldTrack && running) {
        await this.stopBackgroundTracking();
      }
      return shouldTrack;
    } catch (e: any) {
      console.log('[LocationService] should-track check failed:', e?.message || e);
      return false;
    }
  },

  // Stop background location tracking
  async stopBackgroundTracking(): Promise<void> {
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log('Background location tracking stopped');
      }
    } catch (error) {
      console.error('Error stopping background tracking:', error);
    }
  },

  // Check if background tracking is running
  async isBackgroundTrackingRunning(): Promise<boolean> {
    try {
      return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch (error) {
      return false;
    }
  },

  // Update location to server (manual call)
  async updateLocationToServer(
    latitude: number,
    longitude: number,
    accuracy?: number
  ): Promise<boolean> {
    try {
      await api.post('/locations/update', {
        lat: latitude,
        lng: longitude,
        accuracy,
      });
      return true;
    } catch (error) {
      console.error('Failed to update location to server:', error);
      return false;
    }
  },

  // Watch location changes (foreground)
  watchLocation(
    callback: (location: Location.LocationObject) => void,
    options?: LocationTrackingOptions
  ): Promise<Location.LocationSubscription> {
    return Location.watchPositionAsync(
      {
        accuracy: options?.accuracy ?? Location.Accuracy.High,
        timeInterval: options?.timeInterval ?? 10000,
        distanceInterval: options?.distanceInterval ?? 10,
      },
      callback
    );
  },
};

export default locationService;
