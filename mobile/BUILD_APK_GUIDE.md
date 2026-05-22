# Jotihunt Mobile APK Build Guide

This guide documents the complete process for building an Android APK for the Jotihunt mobile app.

## Prerequisites

Before building, ensure you have the following installed:

1. **Node.js** - Required for npm commands
2. **Android SDK** - Located at `C:\Users\xctia\AppData\Local\Android\Sdk`
3. **Java JDK** - Required for Gradle builds

## Quick Build (If Everything Is Set Up)

If you've built before and everything is configured, run these commands:

```powershell
# 1. Navigate to the mobile folder
cd C:\Users\xctia\jotihuntv3\mobile

# 2. Install dependencies (if needed)
npm install --legacy-peer-deps

# 3. Navigate to android folder and build
cd android
$env:ANDROID_HOME = "C:\Users\xctia\AppData\Local\Android\Sdk"
.\gradlew.bat assembleRelease
```

The APK will be generated at:
```
C:\Users\xctia\jotihuntv3\mobile\android\app\build\outputs\apk\release\app-release.apk
```

## APK Versioning System

**Important:** Every time you build a new APK, name it with an incrementing version number:
- `jotihunt-release-v1.apk`
- `jotihunt-release-v2.apk`
- `jotihunt-release-v3.apk`
- etc.

This helps track which version of the app was installed on devices.

**To copy the APK with the next version:**
```powershell
# Replace X with the next version number
Copy-Item "C:\Users\xctia\jotihuntv3\mobile\android\app\build\outputs\apk\release\app-release.apk" -Destination "C:\Users\xctia\jotihuntv3\jotihunt-release-vX.apk" -Force
```

**Last version built:** v9

**Important — app icon changes:** the launcher icon ships from the native
resources in `android/app/src/main/res/mipmap-*`, NOT directly from
`assets/icon.png`. After changing `assets/icon.png` or `assets/adaptive-icon.png`
you MUST run `npx expo prebuild -p android --no-install` to regenerate those
mipmaps before building, otherwise the APK keeps the old icon. Set the version
in `app.json` (`version` + `android.versionCode`) before prebuild so it carries
into the generated `build.gradle`.

## Full Build Process (From Scratch)

### Step 1: Install Dependencies

```powershell
cd C:\Users\xctia\jotihuntv3\mobile
npm install --legacy-peer-deps
```

**Note:** The `--legacy-peer-deps` flag is required due to dependency conflicts between packages.

### Step 2: Generate Native Android Code (Expo Prebuild)

If the `android` folder doesn't exist or needs to be regenerated:

```powershell
npx expo prebuild --platform android
```

This generates the native Android project from the Expo configuration.

### Step 3: Build the APK

```powershell
cd C:\Users\xctia\jotihuntv3\mobile\android

# Set Android SDK path
$env:ANDROID_HOME = "C:\Users\xctia\AppData\Local\Android\Sdk"

# Build release APK
.\gradlew.bat assembleRelease
```

**Build time:** Approximately 3-5 minutes (longer on first build, faster with cached tasks)

### Step 4: Locate the APK

The APK is generated at:
```
C:\Users\xctia\jotihuntv3\mobile\android\app\build\outputs\apk\release\app-release.apk
```

To copy it to the project root for easy access, but change the last part of release.apk to release(release number).apk:
```powershell
Copy-Item "C:\Users\xctia\jotihuntv3\mobile\android\app\build\outputs\apk\release\app-release.apk" -Destination "C:\Users\xctia\jotihuntv3\jotihunt-release.apk" -Force
```

## Troubleshooting

### Error: "Cannot find module 'crypt'" or "Cannot find module 'charenc'"

Install the missing crypto dependencies:
```powershell
npm install crypt charenc --legacy-peer-deps
```

### Error: "Unable to resolve module react-native-webview"

Install the missing webview package:
```powershell
npm install react-native-webview --legacy-peer-deps
```

### Error: expo-modules-core missing android folder

Reinstall the expo-modules-core package:
```powershell
npm install expo-modules-core@1.11.14 --legacy-peer-deps
```

### Gradle build fails with ANDROID_HOME not set

Make sure to set the environment variable before running gradle:
```powershell
$env:ANDROID_HOME = "C:\Users\xctia\AppData\Local\Android\Sdk"
```

### Clean Build (If Build Is Corrupted)

To perform a clean build:
```powershell
cd C:\Users\xctia\jotihuntv3\mobile\android
.\gradlew.bat clean
.\gradlew.bat assembleRelease
```

### Regenerate Android Folder Completely

If the android folder is corrupted:
```powershell
cd C:\Users\xctia\jotihuntv3\mobile

# Remove existing android folder
Remove-Item -Recurse -Force android

# Regenerate
npx expo prebuild --platform android
```

## Important Files

| File | Purpose |
|------|---------|
| `mobile/package.json` | Dependencies and scripts |
| `mobile/app.json` | Expo configuration (app name, version, etc.) |
| `mobile/android/` | Generated native Android project |
| `mobile/android/app/build.gradle` | Android build configuration |

## Key Dependencies

The app uses these key packages:
- **expo** ~50.0.0 - Expo framework
- **react-native** 0.73.6 - React Native core
- **react-native-maps** - Map functionality
- **react-native-webview** - WebView component
- **expo-location** - Location services
- **expo-camera** - Camera access
- **expo-notifications** - Push notifications

## App Configuration

The app is configured in `app.json`:
- **Package name:** `com.jotihunt.app`
- **Version:** Check `app.json` for current version
- **Permissions:** Location, Camera, Notifications

## Build Output

- **APK Size:** ~83 MB
- **Output Path:** `android/app/build/outputs/apk/release/app-release.apk`

## Version History

| Version | Date | Notes |
|---------|------|-------|
| v9 | May 22, 2026 | New GOG launcher icon: ran expo prebuild to regenerate native mipmaps (assets had changed but APK kept old icon); v1.0.9 / versionCode 9 |
| v8 | May 22, 2026 | Fix login refresh loop: stop dispatching AUTH_START (it unmounted LoginScreen mid-login, breaking tenant selection and error display) |
| v7 | May 22, 2026 | Fix login network error: point app at https://jotihunt-gog.nl (was hardcoded LAN IP); add Socket.IO /api/socket.io/ path |
| v6 | March 28, 2026 | Jotihunt logo branding (icon, adaptive-icon, splash screen) |
| v5 | March 27, 2026 | Removed privacy mode completely |
| v4 | March 27, 2026 | Fixed continuous location tracking (30-second polling) |
| v3 | March 26, 2026 | Auto location tracking on login, removed location sharing toggle |
| v1-v2 | March 26, 2026 | Initial builds, fixed missing dependencies |

---

## Quick Build Command (with Versioning)

For quick reference, here's how to build with versioning (replace `X` with next version number):

```powershell
# Build and copy with version number
cd C:\Users\xctia\jotihuntv3\mobile
npm install --legacy-peer-deps
cd android
$env:ANDROID_HOME = "C:\Users\xctia\AppData\Local\Android\Sdk"
.\gradlew.bat assembleRelease
Copy-Item "app\build\outputs\apk\release\app-release.apk" -Destination "C:\Users\xctia\jotihuntv3\jotihunt-release-vX.apk" -Force
Write-Host "APK v-X built and copied to C:\Users\xctia\jotihuntv3\jotihunt-release-vX.apk"
```
