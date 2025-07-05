/**
 * Debug auto-updater - To be used inside Electron app
 * Add this code to your main.js for debugging auto-update issues
 */

const { autoUpdater } = require("electron-updater");

// Don't use setFeedURL when using dev-app-update.yml
// The configuration will be read automatically from dev-app-update.yml

// Force development updates (allow updates in non-packaged mode)
const { app } = require("electron");
const isDev = !app.isPackaged;
const forceDevUpdates =
  process.env.ELECTRON_UPDATER_DEV === "1" || process.env.ELECTRON_IS_DEV === "1";

if (isDev && forceDevUpdates) {
  autoUpdater.forceDevUpdateConfig = true;
  console.log("🔧 Development auto-updates enabled for debugging");
}

// Enable detailed logging
try {
  autoUpdater.logger = require("electron-log");
  autoUpdater.logger.transports.file.level = "info";
  autoUpdater.logger.transports.console.level = "info";
} catch (error) {
  console.log("electron-log not available, using console logging");
  autoUpdater.logger = console;
}

// Set up detailed event listeners for debugging
autoUpdater.on("checking-for-update", () => {
  console.log("🔍 Checking for update...");
});

autoUpdater.on("update-available", (info) => {
  console.log("✅ Update available:", info);
  console.log("Version:", info.version);
  console.log("Release date:", info.releaseDate);
  console.log("Files:", info.files);
});

autoUpdater.on("update-not-available", (info) => {
  console.log("❌ Update not available. Current version:", info.version);
});

autoUpdater.on("error", (err) => {
  console.error("💥 Auto-updater error:", err);
  console.error("Error details:", err.message);
  console.error("Stack:", err.stack);
});

autoUpdater.on("download-progress", (progressObj) => {
  console.log(
    "📥 Download progress:",
    `${progressObj.percent.toFixed(2)}% (${progressObj.transferred}/${progressObj.total})`
  );
});

autoUpdater.on("update-downloaded", (info) => {
  console.log("✅ Update downloaded:", info);
  console.log("⚠️  Note: In development mode, the update installation may fail.");
  console.log("⚠️  This is expected - dev apps can't be updated like packaged apps.");
  console.log("⚠️  The download success indicates the auto-updater is working correctly.");
});

// Function to manually trigger update check with detailed logging
function debugCheckForUpdates() {
  console.log("=== Manual Update Check (Debug Mode) ===");
  console.log("App version:", require("../package.json").version);
  console.log("Platform:", process.platform);
  console.log("Architecture:", process.arch);

  return autoUpdater
    .checkForUpdates()
    .then((result) => {
      console.log("Check result:", result);
      // Return serializable data instead of the complex result object
      return {
        success: true,
        message: "Check completed successfully",
        updateInfo: result?.updateInfo
          ? {
              version: result.updateInfo.version,
              files: result.updateInfo.files?.length || 0,
              path: result.updateInfo.path,
              sha512: result.updateInfo.sha512,
              releaseDate: result.updateInfo.releaseDate,
            }
          : null,
        downloadPromise: !!result?.downloadPromise,
      };
    })
    .catch((error) => {
      console.error("Check failed:", error);
      // Return serializable error info
      return {
        success: false,
        error: error.message || "Unknown error",
        stack: error.stack,
      };
    });
}

// Simple function that just triggers update check and returns basic status
function simpleDebugCheck() {
  console.log("🔍 Triggering simple debug update check...");
  console.log("App version:", require("../package.json").version);

  // Just trigger the check, don't try to return the result
  autoUpdater.checkForUpdates();

  // Return simple status
  return {
    success: true,
    message: "Update check triggered - watch console for results",
    version: require("../package.json").version,
    platform: process.platform,
    arch: process.arch,
  };
}

module.exports = {
  debugCheckForUpdates,
  simpleDebugCheck,
  autoUpdater,
};
