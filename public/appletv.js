/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const { spawn } = require("child_process");
let atvremotePath = "";

// Track connected Apple TV device ids so multiple Display windows can each drive a
// different device. atvremote already addresses a device via `--id <deviceId>`.
const connectedIds = new Set();

function connectATV(id, path) {
  if (typeof path === "string") {
    atvremotePath = path;
  }
  if (atvremotePath === "") {
    console.error("atvremote path not set.");
    return false;
  }
  if (!id) return false;
  connectedIds.add(id);
  console.log("Apple TV configured for " + id);
  return true;
}

// Disconnect a specific device id; with no argument, forget every device.
function disconnectATV(id) {
  if (id) {
    connectedIds.delete(id);
    console.log("Disconnected from Apple TV " + id);
  } else {
    connectedIds.clear();
    console.log("Disconnected from Apple TV");
  }
  return false;
}

function isATVConnected(id) {
  if (id) return connectedIds.has(id);
  return connectedIds.size > 0;
}

function sendATVKey(key, deviceId) {
  if (deviceId && connectedIds.has(deviceId) && typeof key === "string" && atvremotePath !== "") {
    spawn(atvremotePath, ["--id", deviceId, "--protocol", "mrp", key], { stdio: "ignore" });
  } else {
    console.error("Cannot send ATV key — not connected or missing parameters.", {
      key,
      atvremotePath,
      deviceId,
    });
  }
}

function sendATVText(text, deviceId) {
  if (
    deviceId &&
    connectedIds.has(deviceId) &&
    typeof text === "string" &&
    text.length > 0 &&
    atvremotePath !== ""
  ) {
    spawn(atvremotePath, ["--id", deviceId, `text_append=${text}`], { stdio: "ignore" });
  }
}

module.exports = { connectATV, disconnectATV, isATVConnected, sendATVKey, sendATVText };
