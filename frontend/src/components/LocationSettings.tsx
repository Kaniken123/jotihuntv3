import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/authService';
import { LocationSettings as LocationSettingsType } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { 
  MapPin, 
  Clock, 
  Eye, 
  EyeOff, 
  Wifi, 
  WifiOff, 
  Settings, 
  Save,
  AlertTriangle,
  Info,
  Trash2
} from 'lucide-react';

const LocationSettings: React.FC = () => {
  const [settings, setSettings] = useState<LocationSettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationHistory, setLocationHistory] = useState<any[]>([]);

  const { state } = useAuth();

  useEffect(() => {
    loadSettings();
    loadLocationHistory();
    getCurrentLocation();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/locations/settings');
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to load location settings:', error);
      setError('Failed to load location settings');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLocationHistory = async () => {
    if (!state.user) return;
    
    try {
      const response = await api.get(`/locations/history/${state.user.id}?limit=10`);
      setLocationHistory(response.data);
    } catch (error) {
      console.error('Failed to load location history:', error);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/locations/settings', {
        tracking_interval: settings.tracking_interval,
        offline_threshold: settings.offline_threshold,
        location_sharing_enabled: settings.location_sharing_enabled,
        privacy_mode: settings.privacy_mode
      });

      setSettings(response.data);
      setSuccess('Location settings saved successfully!');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLocationHistory = async () => {
    if (!state.user || !confirm('Are you sure you want to delete all your location history? This cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/locations/history/${state.user.id}`);
      setLocationHistory([]);
      setSuccess('Location history deleted successfully');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to delete location history');
    }
  };

  const handleUpdateSetting = (key: keyof LocationSettingsType, value: any) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      [key]: value
    });
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    return `${Math.floor(seconds / 3600)} hours`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="card p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Unable to Load Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            There was an error loading your location settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Location Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your location tracking preferences and privacy settings
        </p>
      </div>

      {error && (
        <div className="card p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="card p-4 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20">
          <p className="text-green-700 dark:text-green-300">{success}</p>
        </div>
      )}

      {/* Current Location Status */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
          <MapPin className="w-5 h-5" />
          <span>Current Location Status</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Location Sharing</span>
              <div className="flex items-center space-x-2">
                {settings.location_sharing_enabled ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400">Enabled</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-600 dark:text-red-400">Disabled</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Privacy Mode</span>
              <div className="flex items-center space-x-2">
                {settings.privacy_mode ? (
                  <>
                    <EyeOff className="w-4 h-4 text-orange-500" />
                    <span className="text-sm text-orange-600 dark:text-orange-400">Active</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-blue-600 dark:text-blue-400">Inactive</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tracking Interval</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {formatTime(settings.tracking_interval)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Offline Threshold</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {formatTime(settings.offline_threshold)}
              </span>
            </div>
          </div>
        </div>

        {currentLocation && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Current coordinates:</strong> {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
            </p>
          </div>
        )}
      </div>

      {/* Settings Configuration */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <span>Location Preferences</span>
        </h2>

        <div className="space-y-6">
          {/* Location Sharing Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Enable Location Sharing
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Allow your team members to see your location on the map
              </p>
            </div>
            <button
              onClick={() => handleUpdateSetting('location_sharing_enabled', !settings.location_sharing_enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                settings.location_sharing_enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.location_sharing_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Privacy Mode Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Privacy Mode
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Hide your location from all users (including team members)
              </p>
            </div>
            <button
              onClick={() => handleUpdateSetting('privacy_mode', !settings.privacy_mode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                settings.privacy_mode ? 'bg-orange-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.privacy_mode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Tracking Interval */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Location Update Interval
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="10"
                max="600"
                step="10"
                value={settings.tracking_interval}
                onChange={(e) => handleUpdateSetting('tracking_interval', parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm text-gray-900 dark:text-gray-100 w-20">
                {formatTime(settings.tracking_interval)}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              How often your location is updated (lower values use more battery)
            </p>
          </div>

          {/* Offline Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Offline Threshold
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="60"
                max="1800"
                step="60"
                value={settings.offline_threshold}
                onChange={(e) => handleUpdateSetting('offline_threshold', parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm text-gray-900 dark:text-gray-100 w-20">
                {formatTime(settings.offline_threshold)}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              How long before you're considered offline
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="btn btn-primary flex items-center space-x-2"
          >
            {isSaving ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Privacy Information */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
          <Info className="w-5 h-5" />
          <span>Privacy Information</span>
        </h2>

        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
            <p>
              Your location data is automatically deleted after 7 days to protect your privacy.
            </p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
            <p>
              When privacy mode is enabled, your location is not visible to anyone, including team members.
            </p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
            <p>
              Location sharing can be disabled while still allowing hunt submissions with manual coordinates.
            </p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
            <p>
              Administrators may still see your location during hunt submissions for verification purposes.
            </p>
          </div>
        </div>
      </div>

      {/* Location History */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Recent Location History</span>
          </h2>
          
          {locationHistory.length > 0 && (
            <button
              onClick={handleDeleteLocationHistory}
              className="btn btn-danger btn-sm flex items-center space-x-2"
            >
              <Trash2 size={14} />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {locationHistory.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No location history available
          </p>
        ) : (
          <div className="space-y-2">
            {locationHistory.map((location) => (
              <div key={location.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(location.recorded_at).toLocaleString()}
                    {location.accuracy && ` • Accuracy: ${Math.round(location.accuracy)}m`}
                  </p>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 dark:text-primary-400 text-sm"
                >
                  View on Map
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationSettings;