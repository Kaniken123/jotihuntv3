import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jotihunt.app',
  appName: 'Jotihunt',
  webDir: 'dist',
  server: {
    // Allow loading from file:// protocol
    androidScheme: 'https',
    // For development, you can set the URL to your backend server
    // url: 'http://YOUR_SERVER_IP:3001',
    cleartext: true // Allow HTTP during development
  },
  plugins: {
    Geolocation: {
      // Enable background location tracking for hunters
    },
    App: {
      // App lifecycle management
    },
    Preferences: {
      // Local storage for auth tokens
    }
  },
  android: {
    allowMixedContent: true, // Allow HTTP requests
    backgroundColor: '#1f2937', // Dark mode background color
    buildOptions: {
      keystorePath: undefined, // Set this for signed release builds
      keystoreAlias: undefined
    }
  }
};

export default config;
