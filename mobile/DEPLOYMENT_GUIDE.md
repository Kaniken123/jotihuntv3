# Jotihunt Mobile App - Complete Deployment Guide

This guide explains step-by-step how to configure and build the mobile app for production use.

---

## Table of Contents

1. [Understanding the API URL](#1-understanding-the-api-url)
2. [Step 1: Configure the API URL](#step-1-configure-the-api-url)
3. [Step 2: Get a Google Maps API Key](#step-2-get-a-google-maps-api-key)
4. [Step 3: Create App Icons](#step-3-create-app-icons)
5. [Step 4: Set Up Expo Account & EAS](#step-4-set-up-expo-account--eas)
6. [Step 5: Build the APK](#step-5-build-the-apk)
7. [Distributing the APK](#distributing-the-apk)

---

## 1. Understanding the API URL

### What is the API URL?

**Yes, the API URL is your website URL** - specifically, it's the URL where your Jotihunt backend server runs, with `/api` added to the end.

### Examples:

| Your Website URL | API URL for Mobile App |
|------------------|------------------------|
| `https://jotihunt.example.com` | `https://jotihunt.example.com/api` |
| `https://myteam-jotihunt.herokuapp.com` | `https://myteam-jotihunt.herokuapp.com/api` |
| `https://192.168.1.100:3001` | `https://192.168.1.100:3001/api` |

### How it works:

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR SERVER                               │
│  (e.g., https://jotihunt.example.com)                           │
│                                                                  │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   Web Frontend      │    │   Backend API                   │ │
│  │   (React App)       │    │   /api/auth/login               │ │
│  │                     │    │   /api/locations/update         │ │
│  │   Serves web pages  │    │   /api/hunts/submit             │ │
│  │   at /              │    │   etc...                        │ │
│  └─────────────────────┘    └─────────────────────────────────┘ │
│           ▲                              ▲                       │
│           │                              │                       │
└───────────│──────────────────────────────│───────────────────────┘
            │                              │
            │                              │
    ┌───────┴───────┐              ┌───────┴───────┐
    │  Web Browser  │              │  Mobile App   │
    │  (your team)  │              │  (hunters)    │
    └───────────────┘              └───────────────┘
```

Both the web app and mobile app talk to the **same backend**, so all data syncs automatically!

---

## Step 1: Configure the API URL

### 1.1 Open the config file

Open the file: `mobile/src/utils/config.ts`

### 1.2 Find these lines (around line 10-13):

```typescript
// Production settings - TODO: Update these before deploying to production!
const PROD_API_URL = 'https://your-production-server.com/api';
const PROD_WS_URL = 'https://your-production-server.com';
```

### 1.3 Replace with your actual server URL:

**Example 1: If your website is `https://jotihunt.scouting-example.nl`**
```typescript
const PROD_API_URL = 'https://jotihunt.scouting-example.nl/api';
const PROD_WS_URL = 'https://jotihunt.scouting-example.nl';
```

**Example 2: If you use a subdomain like `https://api.jotihunt.scouting-example.nl`**
```typescript
const PROD_API_URL = 'https://api.jotihunt.scouting-example.nl/api';
const PROD_WS_URL = 'https://api.jotihunt.scouting-example.nl';
```

**Example 3: If you're hosting on a platform like Heroku**
```typescript
const PROD_API_URL = 'https://myteam-jotihunt.herokuapp.com/api';
const PROD_WS_URL = 'https://myteam-jotihunt.herokuapp.com';
```

### 1.4 Important Notes:

- **Use HTTPS** (not HTTP) for production - this is required for security
- **Don't add a trailing slash** at the end
- The **API URL** has `/api` at the end, the **WebSocket URL** does not

---

## Step 2: Get a Google Maps API Key

The mobile app uses Google Maps to display the map. You need a free API key from Google.

### 2.1 Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/
2. Sign in with a Google account
3. Click "Select a project" → "New Project"
4. Name it something like "Jotihunt Mobile" → Click "Create"

### 2.2 Enable the Maps SDK

1. In the search bar, type "Maps SDK for Android"
2. Click on "Maps SDK for Android"
3. Click the blue "Enable" button

### 2.3 Create an API Key

1. Go to "APIs & Services" → "Credentials" (in the left menu)
2. Click "+ CREATE CREDENTIALS" → "API key"
3. A popup will show your new API key (something like: `AIzaSyB-abc123xyz...`)
4. Click "Close"

### 2.4 (Optional but Recommended) Restrict the API Key

1. Click on your newly created API key
2. Under "Application restrictions", select "Android apps"
3. Under "Android restrictions", click "Add an item"
4. Enter:
   - Package name: `com.jotihunt.mobile`
   - SHA-1 certificate fingerprint: (you'll get this from EAS later)
5. Click "Save"

### 2.5 Add the API Key to your app

Open `mobile/app.json` and find this section (around line 46-50):

```json
"config": {
  "googleMaps": {
    "apiKey": "YOUR_GOOGLE_MAPS_API_KEY_HERE"
  }
}
```

Replace with your actual key:

```json
"config": {
  "googleMaps": {
    "apiKey": "AIzaSyB-abc123xyz..."
  }
}
```

---

## Step 3: Create App Icons

The app needs icons to display on Android devices. Replace the placeholder files in `mobile/assets/`.

### 3.1 Required Images

| File | Size | Description |
|------|------|-------------|
| `icon.png` | 1024 x 1024 px | Main app icon |
| `adaptive-icon.png` | 1024 x 1024 px | Android adaptive icon (foreground) |
| `splash.png` | 1284 x 2778 px | Splash screen (loading screen) |
| `favicon.png` | 48 x 48 px | Web favicon (optional) |

### 3.2 Easy Way: Use an Online Generator

1. Go to https://icon.kitchen/ or https://appicon.co/
2. Upload your logo/image
3. Download the generated icons
4. Copy them to `mobile/assets/` replacing the existing files

### 3.3 Design Tips

- Use a simple, recognizable image (fox icon, location pin, your team logo)
- Use the Jotihunt blue color: `#1E40AF`
- For adaptive-icon.png: Keep important content in the center 66% (Google crops the edges on different devices)

---

## Step 4: Set Up Expo Account & EAS

EAS (Expo Application Services) is used to build the APK file.

### 4.1 Create an Expo Account

1. Go to https://expo.dev/
2. Click "Sign Up" and create a free account
3. Verify your email

### 4.2 Install EAS CLI

Open your terminal/command prompt and run:

```bash
npm install -g eas-cli
```

### 4.3 Login to EAS

```bash
eas login
```

Enter your Expo account email and password.

### 4.4 Navigate to the mobile folder

```bash
cd mobile
```

(or the full path: `cd /path/to/jotihuntv3/mobile`)

### 4.5 Initialize EAS in your project

```bash
eas init
```

This will:
- Ask you to confirm your Expo account
- Create a project on Expo's servers
- Give you a project ID

### 4.6 Update app.json with your Project ID

After running `eas init`, find your project ID (it looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

Open `mobile/app.json` and update this section (around line 79-81):

```json
"extra": {
  "eas": {
    "projectId": "your-eas-project-id-here"
  }
}
```

Replace with your actual project ID:

```json
"extra": {
  "eas": {
    "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

---

## Step 5: Build the APK

Now you're ready to build the APK file!

### 5.1 Make sure you're in the mobile folder

```bash
cd mobile
```

### 5.2 Install dependencies

```bash
npm install
```

### 5.3 Build the APK

```bash
eas build -p android --profile apk
```

### 5.4 Wait for the build

- EAS will upload your code and build it on their servers
- This takes about 10-20 minutes
- You'll see a URL where you can check the progress
- When done, you'll get a download link for the APK

### 5.5 Download the APK

- Click the link provided, or
- Go to https://expo.dev/ → Your Project → Builds → Download the APK

---

## Distributing the APK

### Option 1: Direct Download Link

1. Upload the APK to your website or a file hosting service
2. Share the download link with hunters
3. They can download and install it on their Android phones

### Option 2: QR Code

1. Upload the APK to your server
2. Generate a QR code pointing to the download URL
3. Hunters can scan the QR code to download

### Installing the APK

Hunters will need to:
1. Enable "Install from unknown sources" in their Android settings
2. Download the APK
3. Tap to install
4. Grant location permissions when prompted

---

## Quick Reference

### Files to Edit

| File | What to Change |
|------|----------------|
| `mobile/src/utils/config.ts` | Your server URL (line 12-13) |
| `mobile/app.json` | Google Maps API key (line 48), EAS project ID (line 80) |
| `mobile/assets/` | Replace placeholder icons with real images |

### Commands Summary

```bash
# Install EAS CLI (one time)
npm install -g eas-cli

# Login to Expo
eas login

# Navigate to mobile folder
cd mobile

# Install dependencies
npm install

# Initialize EAS project (one time)
eas init

# Build APK
eas build -p android --profile apk
```

---

## Troubleshooting

### "API_URL is still using placeholder value" warning
→ You forgot to update `PROD_API_URL` in `config.ts`

### Map shows as gray/blank
→ Google Maps API key is missing or invalid. Check `app.json`

### Build fails with "eas project not found"
→ Run `eas init` to set up your project

### App can't connect to server
→ Make sure your server URL uses HTTPS and is publicly accessible

### Location tracking not working
→ User needs to grant "Allow all the time" location permission

---

## Need Help?

- **Expo Documentation**: https://docs.expo.dev/
- **EAS Build Documentation**: https://docs.expo.dev/build/introduction/
- **Google Maps API**: https://developers.google.com/maps/documentation/android-sdk/get-api-key
