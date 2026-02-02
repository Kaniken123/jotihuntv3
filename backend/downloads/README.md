# Mobile App Downloads

This directory is used to serve the Jotihunt mobile APK file for download.

## How to add the APK

1. Build the Android APK:
   ```bash
   cd frontend
   npm run mobile:build-apk
   ```

2. Copy the generated APK to this directory:
   ```bash
   cp frontend/android/app/build/outputs/apk/debug/app-debug.apk backend/downloads/jotihunt.apk
   ```

3. For release builds, use the signed APK:
   ```bash
   npm run mobile:build-release
   cp frontend/android/app/build/outputs/apk/release/app-release.apk backend/downloads/jotihunt.apk
   ```

## APK File Location

The APK should be named `jotihunt.apk` and placed in this directory.

Users can download it from: `https://your-server.com/downloads/jotihunt.apk`

## Building the APK

### Prerequisites
- Android Studio or Android SDK installed
- Java JDK 11+ installed

### Build Commands

From the `frontend` directory:

```bash
# Development build (debug APK)
npm run mobile:android
npm run mobile:build-apk

# Production build (signed release APK)
npm run mobile:build-release
```

## Note

The APK file is not included in git. You need to build it locally or via CI/CD.
