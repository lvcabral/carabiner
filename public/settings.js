/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const settingsFilePath = path.join(app.getPath("userData"), "settings.json");

// Default per-window appearance, used when seeding/migrating a pair.
const DEFAULT_PAIR_BORDER = { width: "0.1px", style: "solid", color: "#662D91" };
const DEFAULT_PAIR_RESOLUTION = "480px|270px";

function saveSettings(settings) {
  fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
}

function newPairId() {
  return `pair-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Build a pair object, filling any missing fields with sensible defaults so the
// rest of the app can rely on a complete shape.
function makePair(partial = {}) {
  return {
    id: partial.id || newPairId(),
    captureDeviceId: partial.captureDeviceId || "",
    controlDeviceId: partial.controlDeviceId || "",
    visible: partial.visible !== false,
    bounds: partial.bounds || { x: undefined, y: undefined, width: 500, height: 290 },
    border: partial.border || { ...DEFAULT_PAIR_BORDER },
    transparency: typeof partial.transparency === "number" ? partial.transparency : 0,
    resolution: partial.resolution || DEFAULT_PAIR_RESOLUTION,
    captureWidth: partial.captureWidth || 1280,
    captureHeight: partial.captureHeight || 720,
    alwaysOnTop: partial.alwaysOnTop !== false,
    audioEnabled: partial.audioEnabled === true,
    // Per-window overlay reference image (applied on top of this window's capture).
    overlayImagePath: partial.overlayImagePath || "",
    overlayOpacity: typeof partial.overlayOpacity === "number" ? partial.overlayOpacity : 0,
  };
}

// Convert the legacy single-window settings (display.deviceId + control.deviceId +
// displayWindow bounds + global border/transparency/resolution) into one pair.
// Each pair maps to exactly one capture device (pair.id === captureDeviceId); the
// General tab lists the available capture devices rather than free-form "pairs".
// Idempotent and legacy keys are left in place so a downgrade keeps working.
function migrateSettings(settings) {
  if (Array.isArray(settings.pairs) && settings.pairs.length > 0) {
    // Normalize existing pairs and drop any orphans without a capture device.
    settings.pairs = settings.pairs.filter((p) => p && p.captureDeviceId).map((p) => makePair(p));
    if (
      settings.pairs.length > 0 &&
      (!settings.activePairId || !settings.pairs.some((p) => p.id === settings.activePairId))
    ) {
      settings.activePairId = settings.pairs[0].id;
    }
    return settings;
  }

  const display = settings.display || {};
  const control = settings.control || {};
  const deviceList = Array.isArray(control.deviceList) ? control.deviceList : [];

  const captureDeviceId = display.deviceId || "";
  let controlDeviceId = control.deviceId || "";
  if (!controlDeviceId && captureDeviceId) {
    const linked = deviceList.find((d) => d.linked === captureDeviceId);
    if (linked) controlDeviceId = linked.id;
  }

  // Only create a pair when there is a legacy capture device to carry over. On a
  // truly fresh install pairs stays empty — the General tab is populated from the
  // enumerated capture devices instead.
  if (captureDeviceId) {
    const migratedPair = makePair({
      id: captureDeviceId, // one pair per capture device
      captureDeviceId,
      controlDeviceId,
      visible: display.visible !== false,
      bounds: settings.displayWindow || undefined,
      border: settings.border && Object.keys(settings.border).length ? settings.border : undefined,
      transparency: display.transparency,
      resolution: display.resolution,
      captureWidth: display.captureWidth,
      captureHeight: display.captureHeight,
      alwaysOnTop: display.alwaysOnTop,
      audioEnabled: display.audioEnabled,
      // Carry the legacy single global overlay onto the migrated window.
      overlayImagePath: settings.overlay?.imagePath,
      overlayOpacity:
        typeof settings.overlay?.opacity === "number" ? settings.overlay.opacity : undefined,
    });
    settings.pairs = [migratedPair];
    settings.activePairId = migratedPair.id;
  } else {
    settings.pairs = [];
    settings.activePairId = "";
  }

  return settings;
}

function loadSettings() {
  const defaultSettings = {
    display: {
      showInDock: true, // macOS: true = dock mode, false = menubar mode
      autoUpdate: true, // Check for updates enabled by default
      showKeystrokes: false,
      singleWindowMode: true, // Default to one Display window; opt in to multi-window
    },
    border: {},
    control: {
      deviceList: [],
    },
    files: {
      screenshotPath: "", // Empty string means use default (Pictures)
      recordingPath: "", // Empty string means use default (Movies on macOS, Videos elsewhere)
    },
    scripts: [],
    mcp: {
      enabled: false, // MCP server disabled by default
      port: 7734, // Localhost port the MCP server listens on
      token: "", // Optional Bearer token; empty means no authentication
    },
    pairs: [], // Per-window capture+control pairs (populated by migrateSettings)
    activePairId: "", // Pair targeted by MCP / tray actions by default
  };
  try {
    const loaded = Object.assign(defaultSettings, JSON.parse(fs.readFileSync(settingsFilePath)));
    return migrateSettings(loaded);
  } catch (error) {
    return migrateSettings(defaultSettings);
  }
}

module.exports = {
  saveSettings,
  loadSettings,
  migrateSettings,
  makePair,
  newPairId,
};
