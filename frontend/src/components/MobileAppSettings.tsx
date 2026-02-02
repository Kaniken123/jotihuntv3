import React from 'react';
import { useMobile } from '../contexts/MobileContext';
import { Smartphone, Download, MapPin, MessageCircle, Camera, Bell, Settings, CheckCircle, XCircle } from 'lucide-react';

/**
 * Mobile App Settings Component
 * Shows mobile app download link and location tracking controls
 */
const MobileAppSettings: React.FC = () => {
  const { state, startLocationTracking, stopLocationTracking, requestLocationPermission, getCurrentLocation } = useMobile();

  const handleStartTracking = async () => {
    // First request permission if not granted
    if (state.locationPermission !== 'granted') {
      const granted = await requestLocationPermission();
      if (!granted) {
        alert('Location permission is required for tracking. Please enable it in your device settings.');
        return;
      }
    }
    
    // Start tracking with 1 minute interval
    const success = await startLocationTracking(60000);
    if (success) {
      // Get initial location
      await getCurrentLocation();
    }
  };

  const handleStopTracking = async () => {
    await stopLocationTracking();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* App Info Card */}
      <div className="card p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <Smartphone className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Jotihunt Mobile App
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {state.isNative ? `Running on ${state.platform}` : 'Download for Android'}
            </p>
          </div>
        </div>

        {/* Mobile App Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <MapPin className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Real-time Location</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Continuous GPS tracking for hunters map
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <MessageCircle className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Team Chat</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Stay connected with your team on the go
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Camera className="w-5 h-5 text-orange-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Fox Submission</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Quick photo capture and submission
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Bell className="w-5 h-5 text-purple-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Live Updates</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Push notifications for game updates
              </p>
            </div>
          </div>
        </div>

        {/* Download Section - Only show on web */}
        {!state.isNative && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Download Android App
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Get the Jotihunt mobile app for a better experience on your Android device. 
              The app provides background location tracking, push notifications, and faster performance.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="/downloads/jotihunt.apk"
                download="jotihunt.apk"
                className="btn btn-primary flex items-center justify-center space-x-2"
              >
                <Download className="w-5 h-5" />
                <span>Download APK</span>
              </a>
              
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                <span>📱 Android 8.0+ required</span>
              </div>
            </div>

            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Installation Instructions
              </h4>
              <ol className="text-sm text-yellow-700 dark:text-yellow-300 list-decimal list-inside space-y-1">
                <li>Download the APK file to your Android device</li>
                <li>Open the downloaded file (you may need to allow unknown sources)</li>
                <li>Tap "Install" and wait for completion</li>
                <li>Open the Jotihunt app and log in with your account</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Location Tracking Settings */}
      <div className="card p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Location Tracking
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Control your location sharing settings
            </p>
          </div>
        </div>

        {/* Status Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Location Permission
              </span>
              <div className="flex items-center space-x-2">
                {state.locationPermission === 'granted' ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400">Granted</span>
                  </>
                ) : state.locationPermission === 'denied' ? (
                  <>
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="text-sm text-red-600 dark:text-red-400">Denied</span>
                  </>
                ) : (
                  <>
                    <span className="w-5 h-5 text-yellow-500">⚠️</span>
                    <span className="text-sm text-yellow-600 dark:text-yellow-400">Not requested</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Tracking Status
              </span>
              <div className="flex items-center space-x-2">
                {state.isLocationTrackingActive ? (
                  <>
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm text-green-600 dark:text-green-400">Active</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 bg-gray-400 rounded-full" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Inactive</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Current Location */}
        {state.currentLocation && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              Current Location
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-blue-700 dark:text-blue-300">
              <div>Latitude: {state.currentLocation.lat.toFixed(6)}</div>
              <div>Longitude: {state.currentLocation.lng.toFixed(6)}</div>
              <div>Accuracy: {Math.round(state.currentLocation.accuracy)}m</div>
              <div>Updated: {new Date(state.currentLocation.timestamp).toLocaleTimeString()}</div>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          {!state.isLocationTrackingActive ? (
            <button
              onClick={handleStartTracking}
              className="btn btn-primary flex items-center justify-center space-x-2"
            >
              <MapPin className="w-5 h-5" />
              <span>Start Tracking</span>
            </button>
          ) : (
            <button
              onClick={handleStopTracking}
              className="btn btn-outline flex items-center justify-center space-x-2 text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
            >
              <XCircle className="w-5 h-5" />
              <span>Stop Tracking</span>
            </button>
          )}

          {state.locationPermission !== 'granted' && (
            <button
              onClick={requestLocationPermission}
              className="btn btn-outline flex items-center justify-center space-x-2"
            >
              <span>Request Permission</span>
            </button>
          )}
        </div>

        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          📍 When tracking is active, your location will be sent to the server every minute for the hunters map.
        </p>
      </div>

      {/* Platform Info */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Platform Information
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <span className="text-gray-600 dark:text-gray-400">Platform:</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{state.platform}</span>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <span className="text-gray-600 dark:text-gray-400">Native App:</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{state.isNative ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileAppSettings;
