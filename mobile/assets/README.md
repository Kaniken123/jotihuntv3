# App Assets

This folder contains placeholder assets for the Jotihunt mobile app. Before building for production, you should replace these with actual images.

## Required Assets

### icon.png
- **Size**: 1024x1024 pixels
- **Format**: PNG (no transparency recommended for iOS)
- **Purpose**: App icon displayed on home screen

### adaptive-icon.png
- **Size**: 1024x1024 pixels
- **Format**: PNG
- **Purpose**: Android adaptive icon foreground layer
- **Note**: Keep important content within the center 66% (safe zone)

### splash.png
- **Size**: 1284x2778 pixels (or similar aspect ratio)
- **Format**: PNG
- **Purpose**: Splash screen shown while app loads
- **Background Color**: Set in app.json (currently #1E40AF - Jotihunt blue)

### favicon.png
- **Size**: 48x48 pixels
- **Format**: PNG
- **Purpose**: Web favicon (for Expo web builds)

## Design Recommendations

1. **Icon**: Use the Jotihunt logo or a fox/location pin icon
2. **Colors**: Match the app theme (#1E40AF primary blue)
3. **Simplicity**: Icons should be recognizable at small sizes
4. **Testing**: Test icons on various devices and backgrounds

## Tools for Creating Assets

- [Figma](https://figma.com) - Free design tool
- [Canva](https://canva.com) - Easy icon creation
- [App Icon Generator](https://appicon.co) - Generate all sizes from one image
- [Expo Icon Builder](https://buildicon.netlify.app) - Specifically for Expo apps
