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
let atvremotePath = "";
let deviceIp = "";
let isATVConnected = false;

function connectATV(ip, path) {
  if (typeof path === "string") {
    atvremotePath = path;
  }
  if (atvremotePath === "") {
    console.error("atvremote path not set.");
    return false;
  }
  deviceIp = ip;
  isATVConnected = true;
  console.log("Apple TV configured for " + ip);
  return isATVConnected;
}

function disconnectATV() {
  deviceIp = "";
  isATVConnected = false;
  console.log("Disconnected from Apple TV");
  return isATVConnected;
}

function sendATVKey(key) {
  if (isATVConnected && typeof key === "string" && atvremotePath !== "" && deviceIp !== "") {
    exec(`"${atvremotePath}" --address ${deviceIp} --protocol mrp ${key}`, puts);
  }
}

function puts(error, stdout, stderr) {
  if (error) console.error(error);
  if (stdout) console.log(stdout);
}

module.exports = { connectATV, disconnectATV, sendATVKey };
