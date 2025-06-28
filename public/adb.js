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
    // Use a more robust escaping approach for shell safety
    // We'll use double quotes and escape characters that have special meaning in double-quoted strings
    const escapedText = text
      .replace(/\\/g, "\\\\")      // Escape backslashes first
      .replace(/"/g, '\\"')        // Escape double quotes
      .replace(/`/g, "\\`")        // Escape backticks
      .replace(/\$/g, "\\$")       // Escape dollar signs
      .replace(/!/g, "\\!")        // Escape exclamation marks (history expansion)
      .replace(/=/g, "\\=")        // Escape equals signs (for ADB safety)
      .replace(/&/g, "\\&")        // Escape ampersands
      .replace(/\|/g, "\\|")       // Escape pipes
      .replace(/;/g, "\\;")        // Escape semicolons
      .replace(/</g, "\\<")        // Escape less than
      .replace(/>/g, "\\>")        // Escape greater than
      .replace(/\(/g, "\\(")       // Escape opening parenthesis
      .replace(/\)/g, "\\)")       // Escape closing parenthesis
      .replace(/\n/g, "\\n")       // Escape newlines
      .replace(/\r/g, "\\r")       // Escape carriage returns
      .replace(/\t/g, "\\t");      // Escape tabs

    console.log(`[ADB] Sending text: "${text}"`);
    console.log(`[ADB] Escaped text: "${escapedText}"`);
    
    // Use double quotes instead of single quotes to allow for better escaping
    exec(`${adbPath} shell input text "${escapedText}"`, puts);
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
