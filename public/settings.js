/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const settingsFilePath = path.join(app.getPath("userData"), "settings.json");

function saveSettings(settings) {
  fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
}

function loadSettings() {
  const defaultSettings = {
    display: {
      showInDock: true, // macOS: true = dock mode, false = menubar mode
      autoUpdate: true, // Check for updates enabled by default
    },
    border: {},
    control: {
      deviceList: [],
    },
    files: {
      screenshotPath: "", // Empty string means use default (Pictures)
      recordingPath: "", // Empty string means use default (Movies on macOS, Videos elsewhere)
    },
  };
  try {
    return Object.assign(defaultSettings, JSON.parse(fs.readFileSync(settingsFilePath)));
  } catch (error) {
    return defaultSettings;
  }
}

module.exports = {
  saveSettings,
  loadSettings,
};
