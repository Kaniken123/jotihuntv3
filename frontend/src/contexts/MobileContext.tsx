/**
 * Mobile Context
 * Provides mobile-specific functionality and state management
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { mobileService, isNative, LocationData } from '../services/mobileService';

interface MobileState {
  isNative: boolean;
  platform: string;
  isLocationTrackingActive: boolean;
  currentLocation: LocationData | null;
  locationPermission: 'granted' | 'denied' | 'prompt' | 'unknown';
  isInitialized: boolean;
}

interface MobileContextType {
  state: MobileState;
  startLocationTracking: (intervalMs?: number) => Promise<boolean>;
  stopLocationTracking: () => Promise<void>;
  getCurrentLocation: () => Promise<LocationData | null>;
  requestLocationPermission: () => Promise<boolean>;
  setApiServerUrl: (url: string) => Promise<void>;
}

const MobileContext = createContext<MobileContextType | undefined>(undefined);

export const MobileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<MobileState>({
    isNative: isNative,
    platform: mobileService.getPlatform(),
    isLocationTrackingActive: false,
    currentLocation: null,
    locationPermission: 'unknown',
    isInitialized: false
  });

  // Initialize mobile features on mount
  useEffect(() => {
    const initializeMobile = async () => {
      try {
        await mobileService.initializeApp();
        
        // Check initial location permission status
        if (isNative) {
          const permissions = await mobileService.checkLocationPermissions();
          setState(prev => ({
            ...prev,
            locationPermission: permissions.location as 'granted' | 'denied' | 'prompt',
            isInitialized: true
          }));
        } else {
          // For web, check navigator.geolocation permission
          if ('permissions' in navigator) {
            try {
              const result = await navigator.permissions.query({ name: 'geolocation' });
              setState(prev => ({
                ...prev,
                locationPermission: result.state as 'granted' | 'denied' | 'prompt',
                isInitialized: true
              }));
            } catch {
              setState(prev => ({ ...prev, isInitialized: true }));
            }
          } else {
            setState(prev => ({ ...prev, isInitialized: true }));
          }
        }

        console.log('Mobile context initialized. Platform:', mobileService.getPlatform());
      } catch (error) {
        console.error('Failed to initialize mobile features:', error);
        setState(prev => ({ ...prev, isInitialized: true }));
      }
    };

    initializeMobile();
  }, []);

  const startLocationTracking = useCallback(async (intervalMs: number = 60000): Promise<boolean> => {
    const success = await mobileService.startLocationTracking(intervalMs);
    if (success) {
      setState(prev => ({ ...prev, isLocationTrackingActive: true }));
    }
    return success;
  }, []);

  const stopLocationTracking = useCallback(async (): Promise<void> => {
    await mobileService.stopLocationTracking();
    setState(prev => ({ ...prev, isLocationTrackingActive: false }));
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    const location = await mobileService.getCurrentPosition();
    if (location) {
      setState(prev => ({ ...prev, currentLocation: location }));
    }
    return location;
  }, []);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (isNative) {
        const permissions = await mobileService.requestLocationPermissions();
        const granted = permissions.location === 'granted';
        setState(prev => ({
          ...prev,
          locationPermission: permissions.location as 'granted' | 'denied' | 'prompt'
        }));
        return granted;
      } else {
        // For web, request via getCurrentPosition
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              setState(prev => ({ ...prev, locationPermission: 'granted' }));
              resolve(true);
            },
            () => {
              setState(prev => ({ ...prev, locationPermission: 'denied' }));
              resolve(false);
            }
          );
        });
      }
    } catch (error) {
      console.error('Failed to request location permission:', error);
      return false;
    }
  }, []);

  const setApiServerUrl = useCallback(async (url: string): Promise<void> => {
    await mobileService.setApiBaseUrl(url);
  }, []);

  const contextValue: MobileContextType = {
    state,
    startLocationTracking,
    stopLocationTracking,
    getCurrentLocation,
    requestLocationPermission,
    setApiServerUrl
  };

  return (
    <MobileContext.Provider value={contextValue}>
      {children}
    </MobileContext.Provider>
  );
};

export const useMobile = (): MobileContextType => {
  const context = useContext(MobileContext);
  if (!context) {
    throw new Error('useMobile must be used within a MobileProvider');
  }
  return context;
};

export default MobileContext;
