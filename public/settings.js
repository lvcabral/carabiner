/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024 Marcelo Lv Cabral. All Rights Reserved.
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
  const defaultSettings = { display: {}, border: {}, control: {} };
  try {
    return Object.assign(
      defaultSettings,
      JSON.parse(fs.readFileSync(settingsFilePath))
    );
  } catch (error) {
    return defaultSettings;
  }
}

module.exports = {
  saveSettings,
  loadSettings,
};
