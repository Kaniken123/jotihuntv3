// API Configuration for the mobile app
// Change this to your production backend URL when deploying

const isDevelopment = __DEV__;

// Default development settings - adjust as needed
const DEV_API_URL = 'http://10.0.2.2:3001/api'; // Android emulator localhost
const DEV_WS_URL = 'http://10.0.2.2:3001';

// Production settings - CHANGE THESE for your deployment
const PROD_API_URL = 'https://your-production-server.com/api';
const PROD_WS_URL = 'https://your-production-server.com';

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
