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

let updateAvailable = false;
let latestVersion = null;

// Function to compare version strings
function compareVersions(current, latest) {
  const currentParts = current.replace('v', '').split('.').map(Number);
  const latestParts = latest.replace('v', '').split('.').map(Number);
  
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

// Function to check for updates via GitHub API
function checkForUpdates() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/lvcabral/carabiner/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': 'Carabiner-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          
          if (res.statusCode === 200 && release.tag_name) {
            latestVersion = release.tag_name;
            
            // Get current version from package.json
            const packageInfo = require('../package.json');
            const currentVersion = 'v' + packageInfo.version;
            
            console.log(`Current version: ${currentVersion}, Latest version: ${latestVersion}`);
            
            if (compareVersions(currentVersion, latestVersion) === 1) {
              updateAvailable = true;
              
              // Notify user about available update
              const mainWindow = BrowserWindow.getAllWindows().find((win) =>
                win.webContents.getURL().includes("index.html")
              );

              if (mainWindow) {
                dialog.showMessageBox(mainWindow, {
                  type: "info",
                  title: "Update Available",
                  message: `A new version (${latestVersion}) is available!`,
                  detail: "Click 'Download' to visit the releases page and download the latest version.",
                  buttons: ["Download", "Later"],
                  defaultId: 0,
                }).then((result) => {
                  if (result.response === 0) {
                    // User chose to download - open releases page
                    shell.openExternal('https://github.com/lvcabral/carabiner/releases/latest');
                  }
                });
              }
              
              resolve({ updateAvailable: true, version: latestVersion });
            } else {
              updateAvailable = false;
              console.log("No updates available");
              resolve({ updateAvailable: false, version: currentVersion });
            }
          } else {
            console.error("Failed to fetch release info:", res.statusCode, data);
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (error) {
          console.error("Error parsing release data:", error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error("Error checking for updates:", error);
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
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
