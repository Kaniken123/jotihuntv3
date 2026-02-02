/**
 * Mobile Service for Capacitor Native Features
 * Provides native mobile capabilities for the Jotihunt app
 */

import { Capacitor } from '@capacitor/core';
import { Geolocation, Position, PermissionStatus } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { api } from './authService';

// Check if running on native platform
export const isNative = Capacitor.isNativePlatform();
export const isAndroid = Capacitor.getPlatform() === 'android';
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isWeb = Capacitor.getPlatform() === 'web';

// Location tracking state
let locationWatchId: string | null = null;
let isTrackingLocation = false;
let locationUpdateInterval: ReturnType<typeof setInterval> | null = null;

export interface LocationData {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
}

/**
 * Mobile Service for native capabilities
 */
export const mobileService = {
  /**
   * Check if running on native platform
   */
  isNative(): boolean {
    return isNative;
  },

  /**
   * Get current platform
   */
  getPlatform(): string {
    return Capacitor.getPlatform();
  },

  /**
   * Initialize app lifecycle listeners
   */
  async initializeApp(): Promise<void> {
    if (!isNative) return;

    // Handle app state changes
    App.addListener('appStateChange', async ({ isActive }) => {
      console.log('App state changed. Is active:', isActive);
      
      if (isActive) {
        // App came to foreground - resume location tracking if it was active
        const wasTracking = await this.getPreference('location_tracking_active');
        if (wasTracking === 'true' && !isTrackingLocation) {
          console.log('Resuming location tracking...');
          await this.startLocationTracking();
        }
      }
    });

    // Handle back button on Android
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        // Optionally minimize app instead of closing
        App.minimizeApp();
      }
    });

    console.log('Mobile app initialized on platform:', Capacitor.getPlatform());
  },

  /**
   * Check location permissions
   */
  async checkLocationPermissions(): Promise<PermissionStatus> {
    return await Geolocation.checkPermissions();
  },

  /**
   * Request location permissions
   */
  async requestLocationPermissions(): Promise<PermissionStatus> {
    return await Geolocation.requestPermissions();
  },

  /**
   * Get current position
   */
  async getCurrentPosition(): Promise<LocationData | null> {
    try {
      const position: Position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000
      });

      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        speed: position.coords.speed,
        heading: position.coords.heading
      };
    } catch (error) {
      console.error('Failed to get current position:', error);
      return null;
    }
  },

  /**
   * Start continuous location tracking
   */
  async startLocationTracking(intervalMs: number = 60000): Promise<boolean> {
    if (isTrackingLocation) {
      console.log('Location tracking already active');
      return true;
    }

    try {
      // Check permissions first
      let permissions = await this.checkLocationPermissions();
      
      if (permissions.location !== 'granted') {
        permissions = await this.requestLocationPermissions();
        if (permissions.location !== 'granted') {
          console.error('Location permission denied');
          return false;
        }
      }

      isTrackingLocation = true;
      await this.setPreference('location_tracking_active', 'true');

      // Start watching position for real-time updates
      if (isNative) {
        locationWatchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true },
          (position, err) => {
            if (err) {
              console.error('Location watch error:', err);
              return;
            }
            if (position) {
              this.sendLocationToServer({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
              });
            }
          }
        );
      }

      // Also set up interval for regular updates
      locationUpdateInterval = setInterval(async () => {
        const location = await this.getCurrentPosition();
        if (location) {
          await this.sendLocationToServer(location);
        }
      }, intervalMs);

      console.log('Location tracking started');
      return true;
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      isTrackingLocation = false;
      return false;
    }
  },

  /**
   * Stop location tracking
   */
  async stopLocationTracking(): Promise<void> {
    isTrackingLocation = false;
    await this.setPreference('location_tracking_active', 'false');

    if (locationWatchId) {
      await Geolocation.clearWatch({ id: locationWatchId });
      locationWatchId = null;
    }

    if (locationUpdateInterval) {
      clearInterval(locationUpdateInterval);
      locationUpdateInterval = null;
    }

    console.log('Location tracking stopped');
  },

  /**
   * Check if location tracking is active
   */
  isLocationTrackingActive(): boolean {
    return isTrackingLocation;
  },

  /**
   * Send location update to server
   */
  async sendLocationToServer(location: LocationData): Promise<boolean> {
    try {
      await api.post('/locations/update', {
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy
      });
      console.log('Location sent to server:', location.lat, location.lng);
      return true;
    } catch (error) {
      console.error('Failed to send location to server:', error);
      return false;
    }
  },

  /**
   * Store a preference value
   */
  async setPreference(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  },

  /**
   * Get a preference value
   */
  async getPreference(key: string): Promise<string | null> {
    const result = await Preferences.get({ key });
    return result.value;
  },

  /**
   * Remove a preference value
   */
  async removePreference(key: string): Promise<void> {
    await Preferences.remove({ key });
  },

  /**
   * Store authentication token securely
   */
  async storeAuthToken(token: string): Promise<void> {
    await this.setPreference('auth_token', token);
    // Also store in localStorage for web compatibility
    localStorage.setItem('token', token);
  },

  /**
   * Get stored authentication token
   */
  async getAuthToken(): Promise<string | null> {
    // Try native storage first, fall back to localStorage
    const token = await this.getPreference('auth_token');
    if (token) return token;
    return localStorage.getItem('token');
  },

  /**
   * Clear authentication token
   */
  async clearAuthToken(): Promise<void> {
    await this.removePreference('auth_token');
    localStorage.removeItem('token');
  },

  /**
   * Get API base URL based on environment
   */
  getApiBaseUrl(): string {
    // On native, you'll need to set the actual server URL
    // This can be configured in capacitor.config.ts or environment variables
    if (isNative) {
      // Try to get from stored preferences first
      return localStorage.getItem('api_base_url') || '/api';
    }
    return '/api';
  },

  /**
   * Set API base URL for native connections
   */
  async setApiBaseUrl(url: string): Promise<void> {
    await this.setPreference('api_base_url', url);
    localStorage.setItem('api_base_url', url);
  }
};

export default mobileService;
