# Auto-Update Setup Guide

This document explains how to set up and use the auto-update feature in Carabiner.

## 🚨 IMPORTANT: Missing Update Metadata Files

**If auto-updates aren't working, it's likely because the required `.yml` metadata files are missing from your GitHub releases.**

### The Problem
The auto-update feature wasn't working because the required metadata files (`latest.yml`, `latest-mac.yml`, etc.) were missing from GitHub releases.

### The Solution ✅
Updated forge.config.js and added custom scripts to properly generate auto-update metadata files:

1. **Added `remoteReleases: true`** to squirrel maker (Windows)
2. **Added `@electron-forge/maker-zip`** for macOS auto-updates  
3. **Changed publisher config**: `draft: false` (was previously `true`)
4. **Added `generateReleaseNotes: true`**
5. **Created custom scripts** for macOS YML generation (see [Manual YML Generation Guide](./manual-yml-generation.md))

## 🚀 Proper Release Process

### Step 1: Install Missing Dependency
```bash
npm install --save-dev @electron-forge/maker-zip
```

### Step 2: Build and Publish
```bash
# Complete release workflow (includes YML generation and upload)
npm run release
```

### Step 3: Manual YML Upload (macOS)
Since electron-forge doesn't automatically generate macOS YML files, you need to upload them manually:

```bash
# Generate YML files after publishing
npm run generate-yml

# Upload them to GitHub (requires GitHub CLI or manual upload)
npm run upload-yml
```

**Alternative:** Manually upload `out/make/latest-mac.yml` to your GitHub release.

### Step 4: Verify Release Assets
After publishing, your GitHub release should include:

**Windows:**
- `Carabiner-1.1.0 Setup.exe`
- `latest.yml` ← **Auto-generated by electron-forge**

**macOS:**
- `Carabiner-1.1.0-darwin-universal.dmg`
- `Carabiner-1.1.0-darwin-universal-mac.zip`
- `latest-mac.yml` ← **Generated by custom script**

**Linux:**
- `carabiner_1.1.0_amd64.deb`
- `latest-linux.yml` ← **Auto-generated by electron-forge**

## How Auto-Update Works

The auto-update system uses `electron-updater` with GitHub releases to automatically deliver updates to users.

### For Users

1. **Auto-Update Checkbox**: Users can enable/disable auto-updates in the General settings tab
2. **Automatic Checks**: When enabled, the app checks for updates:
   - 30 seconds after app startup
   - Every 4 hours while running
3. **User Experience**:
   - Users are notified when an update is available
   - Updates download in the background
   - Users can choose to install immediately or later
   - App automatically restarts to apply updates

### For Developers

## Setting Up Auto-Update

### 1. GitHub Repository Setup

1. Ensure your repository is public or you have proper access tokens
2. The repository should match the one specified in `package.json`:
   ```json
   "repository": {
     "type": "git",
     "url": "https://github.com/lvcabral/carabiner"
   }
   ```

### 2. Environment Variables

Create a `.env` file in your project root with your GitHub token:

```bash
# GitHub Personal Access Token with repo permissions
GITHUB_TOKEN=your_github_token_here

# Apple Developer credentials (for macOS)
APPLE_ID=your_apple_id@example.com
APPLE_PASSWORD=your_app_specific_password
APPLE_TEAM_ID=your_team_id
```

### 3. Building and Publishing

```bash
# Build the React app
npm run build

# Package for the current platform
npm run make

# Publish to GitHub releases (this triggers auto-update)
npm run publish
```

### 4. Release Process

1. **Version Bump**: Update version in `package.json`
2. **Build**: Run `npm run build` to build React app
3. **Make**: Run `npm run make` to create platform-specific builds
4. **Publish**: Run `npm run publish` to upload to GitHub releases
5. **Auto-Update**: Existing users will be notified of the new version

## Configuration Files

### forge.config.js
- Configures build makers (DMG, Squirrel, etc.)
- Sets up GitHub publisher
- Handles code signing and notarization

### public/updater.js
- Manages auto-update logic
- Handles user notifications
- Controls download and installation process

### package.json
- Contains repository and publish configuration
- Defines build scripts

## Platform Support

- **macOS**: DMG installer with auto-update
- **Windows**: Squirrel installer with auto-update
- **Linux**: DEB/RPM packages (manual update)

## Security Considerations

1. **Code Signing**: Always sign your releases for security
2. **HTTPS**: Updates are delivered over HTTPS via GitHub
3. **Verification**: electron-updater verifies signatures before installing
4. **User Control**: Users can disable auto-updates in settings

## Testing Auto-Update

1. **Development**: Auto-update is disabled in development mode
2. **Production**: Build and install a lower version, then publish a higher version
3. **Verification**: Check that the app detects and offers the update

## Troubleshooting

### Common Issues

1. **No Updates Detected**:
   - Check GitHub repository URL in package.json
   - Verify GITHUB_TOKEN permissions
   - Ensure release is published (not draft)

2. **Download Fails**:
   - Check internet connection
   - Verify GitHub release assets are accessible
   - Check for firewall/antivirus blocking

3. **Installation Fails**:
   - Verify app is not running as administrator
   - Check disk space
   - Ensure proper permissions

### Debug Logs

Check the developer console for auto-update logs:
- "Checking for update..."
- "Update available: X.X.X"
- "Update downloaded: X.X.X"
- Error messages with details

## Manual Update Fallback

If auto-update fails, users can always:
1. Download the latest release from GitHub
2. Install manually over the existing installation
3. Settings and data are preserved
