# Jotihunt Mobile App

A React Native (Expo) mobile application for the Jotihunt game. This app allows hunters to track their location, submit fox hunts, view updates/hints, and communicate with their team.

## Features

- **Real-time Map**: View fox team locations, hunter locations, and routes on an interactive map
- **Background Location Tracking**: Your location is tracked even when the app is in the background
- **Fox Hunt Submission**: Take photos and submit fox hunts with GPS coordinates
- **Updates & Hints**: View game hints, assignments, and news with read/completion tracking
- **Team Chat**: Real-time messaging with your team via WebSocket
- **Location Settings**: Control location sharing and privacy settings
- **Game Rules**: View official Jotihunt rules

## Requirements

- Node.js 18+ 
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- For APK builds: Expo Application Services (EAS) account

## Installation

1. Navigate to the mobile directory:
```bash
cd mobile
```

2. Install dependencies:
```bash
npm install
```

3. Configure the API URL:
   
   Edit `src/utils/config.ts` and update the API URLs:
   ```typescript
   // For development with local backend
   const DEV_API_URL = 'http://10.0.2.2:3001/api'; // Android emulator
   // or
   const DEV_API_URL = 'http://localhost:3001/api'; // iOS simulator
   
   // For production
   const PROD_API_URL = 'https://your-production-server.com/api';
   ```

## Development

### Start the development server:
```bash
npm start
```

### Run on Android emulator:
```bash
npm run android
```

### Run on iOS simulator (macOS only):
```bash
npm run ios
```

## Building the APK

### Prerequisites

1. Create an Expo account at https://expo.dev
2. Install EAS CLI:
```bash
npm install -g eas-cli
```

3. Login to EAS:
```bash
eas login
```

4. Configure your project:
```bash
eas build:configure
```

### Build APK for distribution

For a standalone APK file:
```bash
npm run build:apk
```

Or using EAS directly:
```bash
eas build -p android --profile apk
```

### Build for Play Store (AAB)
```bash
eas build -p android --profile production
```

## Configuration

### API Configuration

Edit `src/utils/config.ts` to configure:
- `API_URL`: Backend API endpoint
- `WS_URL`: WebSocket server URL
- `LOCATION_UPDATE_INTERVAL`: How often to send location updates (ms)
- `LOCATION_MINIMUM_DISTANCE`: Minimum distance before sending update (meters)

### Google Maps API Key (Android)

For Android, you need a Google Maps API key:

1. Get an API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Enable "Maps SDK for Android"
3. Add the key to `app.json`:
```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_API_KEY"
        }
      }
    }
  }
}
```

### Permissions

The app requires the following permissions:
- **Location**: For tracking hunter position
- **Camera**: For taking hunt photos
- **Photo Library**: For selecting photos from gallery
- **Background Location**: For continuous location tracking

## Project Structure

```
mobile/
├── App.tsx                     # Main app component with navigation
├── app.json                    # Expo configuration
├── package.json                # Dependencies
├── eas.json                    # EAS Build configuration
├── src/
│   ├── components/             # Reusable UI components
│   ├── contexts/               # React contexts
│   │   ├── AuthContext.tsx     # Authentication state
│   │   └── WebSocketContext.tsx# WebSocket connection
│   ├── screens/                # App screens
│   │   ├── LoginScreen.tsx     # Login page
│   │   ├── MapScreen.tsx       # Map with locations
│   │   ├── HuntScreen.tsx      # Fox hunt submission
│   │   ├── HintsScreen.tsx     # Updates list
│   │   ├── HintDetailScreen.tsx# Update details
│   │   ├── ChatScreen.tsx      # Team chat
│   │   ├── SettingsScreen.tsx  # Settings & location
│   │   └── RulesScreen.tsx     # Game rules
│   ├── services/               # API services
│   │   ├── api.ts              # Axios configuration
│   │   ├── authService.ts      # Authentication
│   │   ├── gameService.ts      # Game data API
│   │   └── locationService.ts  # Location tracking
│   ├── types/                  # TypeScript types
│   │   └── index.ts            # Shared type definitions
│   └── utils/                  # Utility functions
│       └── config.ts           # App configuration
└── assets/                     # Images and icons
```

## Backend Integration

This mobile app connects to the same backend as the web application. The API endpoints used include:

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Location
- `POST /api/locations/update` - Send location update
- `GET /api/locations/latest` - Get latest locations
- `GET/POST /api/locations/settings` - Location settings

### Hunts
- `POST /api/hunts/submit` - Submit fox hunt
- `GET /api/hunts/my-hunts` - Get user's hunts

### Game Data
- `GET /api/jotihunt/areas` - Get fox areas
- `GET /api/jotihunt/articles` - Get hints/updates
- `GET /api/rules` - Get game rules

### Chat
- `GET /api/chat/team/:id/messages` - Get team messages
- `POST /api/chat/team/:id/messages` - Send message

### WebSocket Events
- `location-update` - Real-time location updates
- `team-message` - Real-time chat messages
- `area-update` - Fox area status changes
- `new-hunt` - New hunt submissions

## Troubleshooting

### Location tracking not working
1. Ensure location permissions are granted in device settings
2. For background tracking, ensure "Allow all the time" is selected
3. Some devices may require disabling battery optimization for the app

### Maps not showing
1. Verify Google Maps API key is correct
2. Check that the Maps SDK for Android is enabled in Google Cloud Console
3. For development, you may need to wait for the API key to propagate

### WebSocket not connecting
1. Verify the backend server is running
2. Check the WS_URL in config matches your server
3. Ensure the JWT token is valid

## Demo Credentials

Use these credentials to test the app:
- **Admin**: `admin` / `admin123`
- **Hunter**: `hunter1` / `password123`

## License

This project is part of the Jotihunt application suite.
