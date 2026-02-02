# Jotihunt Mobile App

This document explains how to build and deploy the Jotihunt Android mobile app.

## Features

The mobile app includes all the functionality of the web app with native mobile enhancements:

- **Real-time Location Tracking**: Continuous GPS tracking that updates the hunters map with your location
- **Team Chat**: Stay connected with your team on the go with push notifications
- **Fox Submission**: Quick photo capture and submission for fox hunts
- **Live Updates**: Push notifications for game updates, hints, and assignments

## Building the Android App

### Prerequisites

1. **Node.js 18+** - For building the frontend
2. **Android Studio** - For building the Android APK
3. **Java JDK 11+** - Required by Android build tools

### Setup

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Build the web assets:
   ```bash
   npm run build
   ```

3. Sync with Android project:
   ```bash
   npm run mobile:sync
   ```

### Building Debug APK

```bash
cd frontend
npm run mobile:build-apk
```

The APK will be located at:
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`

### Building Release APK

For production releases, you'll need to set up signing:

1. Create a keystore file (one-time setup):
   ```bash
   keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias jotihunt
   ```

2. Configure signing in `android/app/build.gradle`

3. Build release:
   ```bash
   npm run mobile:build-release
   ```

## Configuring the Server URL

The mobile app needs to know where the backend server is located.

### For Development

Edit `frontend/capacitor.config.ts` and set the server URL:

```typescript
server: {
  url: 'http://YOUR_LOCAL_IP:3001',
  cleartext: true
}
```

### For Production

The app uses relative API paths which work when:
1. The frontend is served from the same domain as the backend
2. Or configure the `server.url` to point to your production API

## Deploying the APK

### Via Web App Download

1. Build the APK
2. Copy to `backend/downloads/jotihunt.apk`
3. Users can download from the "Mobile App" page in the web app

### Via Direct Distribution

Share the APK file directly with users. They'll need to:
1. Enable "Install from unknown sources" in Android settings
2. Open the APK file to install

## Native Permissions

The app requests the following permissions:

| Permission | Purpose |
|------------|---------|
| Location (Fine & Coarse) | GPS tracking for hunters map |
| Background Location | Continuous tracking when app is minimized |
| Camera | Taking photos for fox submissions |
| Internet | Connecting to the backend API |
| Storage | Saving photos temporarily |
| Vibrate | Notification alerts |

## Architecture

```
frontend/
├── src/
│   ├── services/
│   │   └── mobileService.ts    # Native mobile functionality
│   ├── contexts/
│   │   └── MobileContext.tsx   # Mobile state management
│   └── components/
│       └── MobileAppSettings.tsx  # Mobile settings UI
├── android/                     # Native Android project
├── capacitor.config.ts          # Capacitor configuration
└── package.json                 # Mobile build scripts
```

## Troubleshooting

### App crashes on start

- Check that the server URL is correctly configured
- Ensure the backend is running and accessible
- Check Android logcat for error messages

### Location not updating

- Verify location permissions are granted
- Check if battery optimization is disabled for the app
- Ensure GPS is enabled on the device

### Can't connect to server

- For development, use your local IP (not localhost)
- Ensure the backend CORS allows the Capacitor origins
- Check network connectivity

## Development with Android Studio

To open the project in Android Studio:

```bash
cd frontend
npm run mobile:open-android
```

This allows you to:
- Debug the app directly
- Test on emulators
- Use Android Studio's debugging tools
