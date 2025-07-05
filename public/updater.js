/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const { autoUpdater } = require("electron-updater");
const { dialog, BrowserWindow } = require("electron");

// Configure auto-updater
autoUpdater.setFeedURL({
  provider: "github",
  owner: "lvcabral",
  repo: "carabiner",
});

// Auto-updater will only work in packaged apps by default
// For development testing, use the debug-updater.js or npm run debug-updater

let updateAvailable = false;
let updateDownloaded = false;

// Auto-updater events
autoUpdater.on("checking-for-update", () => {
  console.log("Checking for update...");
});

autoUpdater.on("update-available", (info) => {
  console.log("Update available:", info.version);
  updateAvailable = true;

  // Notify user about available update
  const mainWindow = BrowserWindow.getAllWindows().find((win) =>
    win.webContents.getURL().includes("index.html")
  );

  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Update Available",
      message: `A new version (${info.version}) is available!`,
      detail:
        "The update will be downloaded in the background. You'll be notified when it's ready to install.",
      buttons: ["OK"],
    });
  }
});

autoUpdater.on("update-not-available", (info) => {
  console.log("Update not available:", info.version);
  updateAvailable = false;
});

autoUpdater.on("error", (err) => {
  console.error("Auto-updater error:", err);
  updateAvailable = false;
  updateDownloaded = false;
});

autoUpdater.on("download-progress", (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + " - Downloaded " + progressObj.percent + "%";
  log_message = log_message + " (" + progressObj.transferred + "/" + progressObj.total + ")";
  console.log(log_message);
});

autoUpdater.on("update-downloaded", (info) => {
  console.log("Update downloaded:", info.version);
  updateDownloaded = true;

  // Notify user that update is ready to install
  const mainWindow = BrowserWindow.getAllWindows().find((win) =>
    win.webContents.getURL().includes("index.html")
  );

  if (mainWindow) {
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Update Ready",
        message: `Update to version ${info.version} is ready to install.`,
        detail: "The application will restart to apply the update.",
        buttons: ["Restart Now", "Later"],
        defaultId: 0,
      })
      .then((result) => {
        if (result.response === 0) {
          // User chose to restart now
          autoUpdater.quitAndInstall();
        }
      });
  }
});

// Functions to be called from main process
function checkForUpdates() {
  if (!updateDownloaded) {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

function installUpdate() {
  if (updateDownloaded) {
    autoUpdater.quitAndInstall();
  }
}

function getUpdateStatus() {
  return {
    updateAvailable,
    updateDownloaded,
  };
}

module.exports = {
  checkForUpdates,
  installUpdate,
  getUpdateStatus,
  autoUpdater,
};
