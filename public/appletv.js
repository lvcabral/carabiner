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
let deviceId = "";
let isATVConnected = false;

function connectATV(id, path) {
  if (typeof path === "string") {
    atvremotePath = path;
  }
  if (atvremotePath === "") {
    console.error("atvremote path not set.");
    return false;
  }
  deviceId = id;
  isATVConnected = true;
  console.log("Apple TV configured for " + id);
  return isATVConnected;
}

function disconnectATV() {
  deviceId = "";
  isATVConnected = false;
  console.log("Disconnected from Apple TV");
  return isATVConnected;
}

function sendATVKey(key) {
  if (isATVConnected && typeof key === "string" && atvremotePath !== "" && deviceId !== "") {
    // Use spawn with stdio ignored so pyatv's benign Companion protocol errors
    // never reach the parent process — no callback filtering needed
    spawn(atvremotePath, ["--id", deviceId, "--protocol", "mrp", key], { stdio: "ignore" });
  } else {
    console.error("Cannot send ATV key — not connected or missing parameters.", { isATVConnected, key, atvremotePath, deviceId });
  }
}

module.exports = { connectATV, disconnectATV, sendATVKey };
