/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const path = require("path");
const exec = require("child_process").exec;
let adbPath = "";

let isADBConnected = false;

function connectADB(deviceIp, path) {
  if (typeof path === "string") {
    adbPath = path;
  }
  if (adbPath === "") {
    console.error("ADB path not set.");
    return isADBConnected;
  }
  try {
    exec(`${adbPath} connect ${deviceIp}`, puts);
    isADBConnected = true;
    console.log("Connected to ADB in " + deviceIp);
  } catch (error) {
    console.error("Error connecting to ADB in " + deviceIp, error);
  }
  return isADBConnected;
}

function disconnectADB() {
  if (adbPath === "") {
    console.error("ADB path not set.");
    return isADBConnected;
  }
  try {
    exec(`${adbPath} disconnect`, puts);
    isADBConnected = false;
    console.log("Disconnected from ADB");
  } catch (error) {
    console.error("Error disconnecting from ADB", error);
  }
  return isADBConnected;
}

function sendADBKey(key) {
  if (isADBConnected && typeof key === "string" && adbPath !== "") {
    if (!isNumeric(key)) {
      exec(`${adbPath} shell input text '${key}'`, puts);
    } else {
      exec(`${adbPath} shell input keyevent ${key}`, puts);
    }
  }
}

function sendADBText(text) {
  if (isADBConnected && typeof text === "string" && adbPath !== "") {
    // Escape special characters for shell safety
    // Handle single quotes, backslashes, and other special shell characters
    const escapedText = text
      .replace(/\\/g, "\\\\") // Escape backslashes first
      .replace(/'/g, "'\"'\"'") // Escape single quotes
      .replace(/"/g, '\\"') // Escape double quotes
      .replace(/`/g, "\\`") // Escape backticks
      .replace(/\$/g, "\\$"); // Escape dollar signs

    console.log(`[ADB] Sending text: "${text}"`);
    exec(`${adbPath} shell input text '${escapedText}'`, puts);
  }
}

function isNumeric(str) {
  return /^\d+$/.test(str);
}

function puts(error, stdout, stderr) {
  if (error) console.error(error);
  console.log(stdout);
}

module.exports = {
  connectADB,
  disconnectADB,
  sendADBKey,
  sendADBText,
};
