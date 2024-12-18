const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const settingsFilePath = path.join(app.getPath('userData'), 'settings.json');

function saveSettings(settings) {
  fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
}

function loadSettings() {
  const defaultSettings = { display: {}, border: {}, control: {} };
  try {
    return Object.assign( defaultSettings, JSON.parse(fs.readFileSync(settingsFilePath)));
  } catch (error) {
    return defaultSettings;
  }
}

module.exports = {
  saveSettings,
  loadSettings,
};