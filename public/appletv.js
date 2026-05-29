/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const { exec } = require("child_process");
const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
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
    const command = `"${atvremotePath}" --id ${deviceId} --protocol mrp ${key}`;
    console.log("Executing command: ", command);
    exec(command, puts);
  } else {
    console.error("Cannot send key. Apple TV is not connected or parameters are invalid.", isATVConnected, key, atvremotePath, deviceId);
  }
}

function puts(error, stdout, stderr) {
  if (stdout) console.log(stdout);
  // pyatv exits non-zero when Companion initialization fails even though the MRP
  // key command succeeded. The traceback appears in both error.message and stderr.
  // Suppress the entire output block when the benign companion marker is detected.
  const allOutput = `${stderr || ""}${error?.message || ""}`;
  if (allOutput.includes("pyatv.protocols.companion")) return;
  if (error) console.error(error);
  if (stderr) console.error(stderr.trim());
}

module.exports = { connectATV, disconnectATV, sendATVKey };
