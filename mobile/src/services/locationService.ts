import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { api } from './api';
import config from '../utils/config';

const BACKGROUND_LOCATION_TASK = config.BACKGROUND_LOCATION_TASK;

// Define the background location task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];

    if (location) {
      try {
        await api.post('/locations/update', {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy,
        });
        console.log('Background location updated:', location.coords);
      } catch (error) {
        console.error('Failed to update background location:', error);
      }
    }
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
          console.log('Location permissions not granted');
          return false;
        }
      }

      // Check if already running
      const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (isRunning) {
        console.log('Background location already running');
        return true;
      }

      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: options?.accuracy ?? Location.Accuracy.Balanced,
        timeInterval: options?.timeInterval ?? config.LOCATION_UPDATE_INTERVAL,
        distanceInterval: options?.distanceInterval ?? config.LOCATION_MINIMUM_DISTANCE,
        deferredUpdatesInterval: 60000, // Batch updates every minute
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Jotihunt Location Tracking',
          notificationBody: 'Your location is being tracked for the hunt',
          notificationColor: '#1E40AF',
        },
        pausesUpdatesAutomatically: false,
      });

      console.log('Background location tracking started');
      return true;
    } catch (error) {
      console.error('Error starting background tracking:', error);
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
        accuracy: options?.accuracy ?? Location.Accuracy.Balanced,
        timeInterval: options?.timeInterval ?? 10000,
        distanceInterval: options?.distanceInterval ?? 10,
      },
      callback
    );
  },
};

export default locationService;
