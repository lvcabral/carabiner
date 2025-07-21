# Version Check Guide

This document explains how the version checking and update notification feature works in Carabiner.

## Overview

Carabiner uses a simplified version checking system that notifies users when new versions are available on GitHub releases, rather than automatically downloading and installing updates.

## How It Works

The version checking system:

1. **Checks GitHub API** for the latest release periodically
2. **Compares versions** using semantic versioning
3. **Shows notification** when a newer version is available
4. **Opens releases page** when user clicks "Download"

## Features

- ✅ **Automatic checking** - Checks every 4 hours and 30 seconds after startup
- ✅ **User-friendly notifications** - Clear dialog with version information
- ✅ **Direct access** - One-click link to GitHub releases page
- ✅ **Privacy-friendly** - No automatic downloads or installations
- ✅ **Cross-platform** - Works on macOS, Windows, and Linux

## Configuration

Users can enable/disable version checking in the application settings:

- Go to **Settings** → **General** → **Check for Updates**
- Toggle the checkbox to enable/disable update notifications

## Technical Implementation

The version checker:

- Uses GitHub API (`/repos/lvcabral/carabiner/releases/latest`)
- Compares semantic versions (e.g., v1.2.0 vs v1.2.1)
- Shows notifications only when newer versions are found
- Opens `https://github.com/lvcabral/carabiner/releases/latest` for downloads

## User Experience

When an update is available:

1. User sees a notification dialog with the new version number
2. User can choose "Download" to visit the releases page
3. User can choose "Later" to dismiss the notification
4. Version checking continues automatically in the background

## Manual Update Process

If users want to update manually:

1. Visit the [Carabiner releases page](https://github.com/lvcabral/carabiner/releases/latest)
2. Download the appropriate installer for your platform
3. Install the new version following the standard installation process

## Files That Implement Version Checking

The following files implement the version checking system:

### public/updater.js

- Contains the GitHub API checking logic
- Handles version comparison
- Shows notification dialogs

### public/main.js

- Initializes version checking timers
- Handles IPC communication for update checks

### src/components/GeneralSection.js

- Contains the UI checkbox for enabling/disabling version checks
- Handles user preferences for version checking

## Migration from Auto-Update

The previous auto-update system using `electron-updater` has been replaced with this simpler notification system for the following reasons:

- **Simplified maintenance** - No need for complex update metadata files
- **Better user control** - Users choose when to update
- **Cross-platform compatibility** - Works consistently across all platforms
- **Reduced complexity** - Fewer dependencies and potential points of failure

## Troubleshooting

### No Update Notifications

If you're not seeing update notifications:

1. Check that the "Check for Updates" setting is enabled in General settings
2. Ensure you have an internet connection
3. Check the console for any error messages

### Testing Version Checks

To test the version checking functionality:

```bash
# Test the version checker directly
node -e "
const { checkForUpdates } = require('./public/updater.js');
checkForUpdates()
  .then(result => console.log('Result:', result))
  .catch(error => console.error('Error:', error));
"
```

This will show the current and latest versions, and whether an update is available.

## Developer Information

### Implementation Details

The system replaces the old `electron-updater` package with a lightweight GitHub API-based approach:

- **Removed dependencies**: `electron-updater` package removed
- **Simplified code**: Direct HTTPS requests to GitHub API
- **Better error handling**: Clear error messages and timeout handling
- **No metadata files**: No need for complex YML generation scripts

### IPC Communication

The version checking uses the following IPC events:

- `check-for-updates`: Manually trigger a version check
- `get-update-status`: Get current version check status
- `save-check-for-updates`: Save user preference for version checking

### Settings Storage

Version checking preferences are stored in the settings file under:

```json
{
  "display": {
    "autoUpdate": true
  }
}
```

Note: The setting key remains `autoUpdate` for backward compatibility with existing user settings.
