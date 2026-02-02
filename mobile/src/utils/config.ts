// ============================================================================
// API CONFIGURATION FOR JOTIHUNT MOBILE APP
// ============================================================================
//
// IMPORTANT: The API URL is your website URL with '/api' added at the end.
//
// Example: If your web app runs at https://jotihunt.example.com
//          Then your API URL should be: https://jotihunt.example.com/api
//          And your WebSocket URL should be: https://jotihunt.example.com
//
// Both the web app and mobile app talk to the SAME backend, so all data
// (locations, hunts, chat messages) will sync automatically!
//
// For detailed setup instructions, see: DEPLOYMENT_GUIDE.md
// ============================================================================

const isDevelopment = __DEV__;

// Development settings - Used when running "expo start" or "npm start"
// 10.0.2.2 is Android emulator's alias for localhost on your computer
const DEV_API_URL = 'http://10.0.2.2:3001/api';
const DEV_WS_URL = 'http://10.0.2.2:3001';

// ============================================================================
// PRODUCTION SETTINGS - CHANGE THESE BEFORE BUILDING YOUR APK!
// ============================================================================
// Replace with your actual server URL where the Jotihunt web app is hosted.
//
// Example: If your website is https://jotihunt.mijngroep.nl
const PROD_API_URL = 'http://192.168.2.31:3001/api';  // Your local network
const PROD_WS_URL = 'http://192.168.2.31:3001';       // Your local network
// ============================================================================

// Warn if production URLs are not configured
if (!isDevelopment) {
  if (PROD_API_URL === 'https://your-production-server.com/api' || 
      PROD_WS_URL === 'https://your-production-server.com') {
    console.warn(
      '⚠️ PRODUCTION WARNING: API_URL is still using placeholder value. ' +
      'Please update PROD_API_URL in src/utils/config.ts before deploying.'
    );
  }
}

export const config = {
  // API base URL - the backend server
  API_URL: isDevelopment ? DEV_API_URL : PROD_API_URL,
  
  // WebSocket URL for real-time updates
  WS_URL: isDevelopment ? DEV_WS_URL : PROD_WS_URL,
  
  // Location tracking settings
  LOCATION_UPDATE_INTERVAL: 60000, // 60 seconds default
  LOCATION_MINIMUM_DISTANCE: 10, // 10 meters minimum movement
  
  // Background location task name
  BACKGROUND_LOCATION_TASK: 'background-location-task',
  
  // App info
  APP_NAME: 'Jotihunt',
  APP_VERSION: '1.0.0',
};

export default config;
