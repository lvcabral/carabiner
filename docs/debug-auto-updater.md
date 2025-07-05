# Debug Auto-Updater Usage Guide

The debug auto-updater functionality has been integrated into the Carabiner app for testing and troubleshooting auto-update issues.

## 🚀 How to Use

### Option 1: Using Developer Console (Recommended)

1. **Start the app in debug mode:**
   ```bash
   # Standard debug mode
   npm run debug

   # Force auto-updater in development (recommended for testing)
   npm run debug-updater
   ```

2. **Open Developer Console:**
   - Press `Cmd+Option+I` (macOS) or `Ctrl+Shift+I` (Windows/Linux)
   - Or go to View → Toggle Developer Tools

3. **Run debug commands in the console:**
   ```javascript
   // Debug check for updates with detailed logging
   await window.electronAPI.invoke('debug-check-for-updates')

   // Regular update check
   await window.electronAPI.invoke('check-for-updates')

   // Get current update status
   await window.electronAPI.invoke('get-update-status')
   ```

### Option 2: Using NPM Scripts

1. **Debug mode with auto-updater forced:**
   ```bash
   npm run debug-updater
   ```

2. **Standard debug mode:**
   ```bash
   npm run debug
   ```

3. **Development mode:**
   ```bash
   npm run forge
   ```

## 🔍 Debug Output

The debug functionality provides detailed logging including:

- ✅ **App version and platform info**
- ✅ **Update check process step-by-step**
- ✅ **Network requests and responses** 
- ✅ **Error details with stack traces**
- ✅ **File download progress**
- ✅ **YML file parsing information**

## 📋 Example Debug Session

```javascript
// In the browser console:
await window.electronAPI.invoke('debug-check-for-updates')

// Expected output:
// === Manual Update Check (Debug Mode) ===
// App version: 1.1.0
// Platform: darwin
// Architecture: arm64
// 🔍 Checking for update...
// ❌ Update not available. Current version: 1.1.0
// Check result: ...
```

## 🛠️ Troubleshooting

### ❌ **"Skip checkForUpdates because application is not packed"**

If you see this message, it means the auto-updater is disabled in development mode. To fix this:

1. **Use the debug-updater script:**
   ```bash
   npm run debug-updater
   ```

2. **Or set environment variable manually:**
   ```bash
   ELECTRON_UPDATER_DEV=1 npm run electron
   ```

3. **The app will show:** `"🔧 Development auto-updates enabled for debugging"`

### ❌ **URL Concatenation Error (404 on malformed URL)**

Error like: `Cannot download "https://github.com/.../v1.1.0/https://github.com/.../Carabiner-darwin-arm64-1.1.0.zip"`

**Root Cause**: Conflict between `setFeedURL()` and `dev-app-update.yml` configuration.

**Fix:** 
1. Remove `setFeedURL()` from debug-updater.js when using dev-app-update.yml
2. Use only filenames (not full URLs) in YML files when using GitHub provider
3. Let electron-updater read configuration from dev-app-update.yml automatically

**Files to fix:**
- `debug-updater.js`: Remove `autoUpdater.setFeedURL()` call
- `latest-mac.yml`: Use `url: filename.zip` instead of full URLs

### ❌ **"ENOENT: no such file or directory, open 'dev-app-update.yml'"**

This error occurs when running debug auto-updater without the required development configuration file.

**Fix:** Create `dev-app-update.yml` in project root:
```yaml
owner: lvcabral
repo: carabiner
provider: github
updaterCacheDirName: carabiner-updater
```

This file tells electron-updater where to look for updates in development mode.

This error occurs when trying to return complex objects from IPC handlers. Fixed by:

1. **Using simpleDebugCheck()** instead of debugCheckForUpdates() in IPC
2. **Returning only serializable data** (strings, numbers, plain objects)
3. **Avoiding autoUpdater object references** in IPC returns

**To test the fix:**

1. Run `npm run debug-updater`
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Run in console:

   ```javascript
   window.electronAPI.invoke('debug-check-for-updates').then(console.log)
   ```

4. Should return success object without cloning errors

### ❌ **"Could not locate update bundle" Installation Error**

Error: `Could not locate update bundle for com.github.Electron within file:///...`

**Expected Behavior**: This error is normal in development mode.

**Why it happens:**
- Update downloads successfully ✅
- Installation fails because dev apps can't be "updated" like packaged apps ⚠️
- The bundle structure in development doesn't match packaged app expectations

**This is NOT a real problem:**
- The download success proves auto-updater is working correctly
- In production (packaged apps), this won't happen
- The error only occurs during installation, not during download/detection

**For testing**: Focus on whether updates are detected and downloaded, not installation.

### If you see "Update not available"

1. Ensure you're running an older version (e.g., v1.0.0)
2. Check that YML files are uploaded to GitHub release
3. Verify network connectivity

### If you see errors

1. Check the detailed error messages in console
2. Verify GitHub repository configuration
3. Ensure release assets are publicly accessible

### If auto-updater doesn't start

1. Make sure you're running a packaged app (not development)
2. Check that `app.isPackaged` is true
3. Verify auto-update is enabled in settings

## 📁 Files

- **`public/debug-updater.js`** - Debug functionality
- **`public/main.js`** - Integration with IPC handlers
- **`public/updater.js`** - Production auto-updater
- **`scripts/generate-yml.js`** - YML file generation

## 🔧 Configuration

The debug auto-updater is pre-configured with:
- **Provider:** GitHub
- **Owner:** lvcabral  
- **Repository:** carabiner
- **Detailed logging enabled**
- **All update events monitored**

This setup allows you to test and debug auto-update functionality directly within your Electron app!
