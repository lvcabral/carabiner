/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const { dialog, BrowserWindow, shell } = require("electron");
const https = require("https");
const packageInfo = require("../package.json");
const { saveSettings } = require("./settings");

let updateAvailable = false;
let latestVersion = null;
let dialogShown = false;

// Resolve the best window to parent a dialog to: the display window if visible,
// otherwise the settings window (may be hidden, which is fine for a dialog parent).
function getTargetWindow() {
  const mainWindow = BrowserWindow.getAllWindows().find((win) =>
    win.webContents.getURL().includes("index.html")
  );
  const displayWindow = BrowserWindow.getAllWindows().find((win) =>
    win.webContents.getURL().includes("display.html")
  );
  if (displayWindow && displayWindow.isVisible()) return displayWindow;
  return mainWindow || null;
}

// Show a message box, parented to a window when one is available.
function showDialog(options) {
  const targetWindow = getTargetWindow();
  return targetWindow
    ? dialog.showMessageBox(targetWindow, options)
    : dialog.showMessageBox(options);
}

// Feedback shown when a manual update check could not reach GitHub.
function showUpdateError() {
  showDialog({
    type: "error",
    title: "Update Check Failed",
    message: "Could not check for updates.",
    detail: "Please check your internet connection and try again.",
    buttons: ["OK"],
  });
}

// Function to compare version strings
function compareVersions(current, latest) {
  const currentParts = current.replace("v", "").split(".").map(Number);
  const latestParts = latest.replace("v", "").split(".").map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;

    if (latestPart > currentPart) {
      return 1; // Latest is newer
    } else if (latestPart < currentPart) {
      return -1; // Current is newer
    }
  }
  return 0; // Same version
}

// Function to check for updates via GitHub API.
// When `interactive` is true (a manual "Check for Updates" from a menu), the dialog
// is always shown (ignoring a previously skipped version) and the user is given
// "up to date" / error feedback when there is nothing to download.
function checkForUpdates(settings, interactive = false) {
  console.log("Checking for updates...");
  return new Promise((resolve, reject) => {
    // Get repository info from package.json
    const repoUrl = packageInfo.repository.url
      .replace(/^https?:\/\/github\.com\//, "")
      .replace(/\.git$/, "");

    const options = {
      hostname: "api.github.com",
      path: `/repos/${repoUrl}/releases/latest`,
      method: "GET",
      headers: {
        "User-Agent": "Carabiner-App",
        Accept: "application/vnd.github.v3+json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const release = JSON.parse(data);

          if (res.statusCode === 200 && release.tag_name) {
            latestVersion = release.tag_name;

            // Get current version from package.json
            const currentVersion = "v" + packageInfo.version;

            console.log(`Current version: ${currentVersion}, Latest version: ${latestVersion}`);

            if (compareVersions(currentVersion, latestVersion) === 1) {
              updateAvailable = true;

              const targetWindow = getTargetWindow();

              // Honor a previously skipped version - don't nag about it again.
              // A manual (interactive) check always prompts, ignoring the skip.
              const skippedVersion = settings && settings.display && settings.display.skipVersion;
              const shouldPrompt = interactive || (!dialogShown && skippedVersion !== latestVersion);

              if (targetWindow && shouldPrompt) {
                dialogShown = true;
                dialog
                  .showMessageBox(targetWindow, {
                    type: "info",
                    title: "Update Available",
                    message: `A new version (${latestVersion}) is available!`,
                    detail:
                      "Click 'Download' to visit the releases page and download the latest version.",
                    buttons: ["Download", "Skip This Version", "Later"],
                    defaultId: 0,
                    cancelId: 2,
                  })
                  .then((result) => {
                    if (result.response === 0) {
                      // User chose to download - open releases page
                      const repoUrl = packageInfo.repository.url.replace(/\.git$/, "");
                      shell.openExternal(`${repoUrl}/releases/latest`);
                    } else if (result.response === 1 && settings && settings.display) {
                      // User chose to skip this version - persist it so we stop prompting
                      settings.display.skipVersion = latestVersion;
                      saveSettings(settings);
                    }
                    // Reset flag when dialog is dismissed
                    dialogShown = false;
                  });
              }

              resolve({ updateAvailable: true, version: latestVersion });
            } else {
              updateAvailable = false;
              console.log("No updates available");

              // Reassure the user when they triggered the check manually
              if (interactive) {
                showDialog({
                  type: "info",
                  title: "No Updates Available",
                  message: "You're up to date!",
                  detail: `Carabiner ${currentVersion} is the latest version.`,
                  buttons: ["OK"],
                });
              }

              resolve({ updateAvailable: false, version: currentVersion });
            }
          } else {
            console.error("Failed to fetch release info:", res.statusCode, data);
            if (interactive) showUpdateError();
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (error) {
          console.error("Error parsing release data:", error);
          if (interactive) showUpdateError();
          reject(error);
        }
      });
    });

    req.on("error", (error) => {
      console.error("Error checking for updates:", error);
      if (interactive) showUpdateError();
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      if (interactive) showUpdateError();
      reject(new Error("Request timeout"));
    });

    req.end();
  });
}

function getUpdateStatus() {
  return {
    updateAvailable,
    latestVersion,
  };
}

module.exports = {
  checkForUpdates,
  getUpdateStatus,
};
