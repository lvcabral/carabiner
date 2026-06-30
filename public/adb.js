/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const exec = require("child_process").exec;
let adbPath = "";

// Track every connected device serial so multiple Display windows can each drive
// a different Android/Fire TV/Google TV target at the same time. ADB requires the
// `-s <serial>` flag to address a specific device when more than one is connected.
const connectedSerials = new Set();

// `adb connect 192.168.1.5` registers the device under serial "192.168.1.5:5555".
// Normalize so the serial we connect with matches the one we pass to `-s`.
function normalizeSerial(deviceIp) {
  if (typeof deviceIp !== "string" || deviceIp === "") return "";
  return deviceIp.includes(":") ? deviceIp : `${deviceIp}:5555`;
}

function connectADB(deviceIp, path) {
  if (typeof path === "string") {
    adbPath = path;
  }
  if (adbPath === "") {
    console.error("ADB path not set.");
    return false;
  }
  const serial = normalizeSerial(deviceIp);
  if (!serial) return false;
  try {
    exec(`${adbPath} connect ${serial}`, puts);
    connectedSerials.add(serial);
    console.log("Connected to ADB in " + serial);
  } catch (error) {
    console.error("Error connecting to ADB in " + serial, error);
    return false;
  }
  return true;
}

// Disconnect a specific serial; with no argument, disconnect every connection.
function disconnectADB(deviceIp) {
  if (adbPath === "") {
    console.error("ADB path not set.");
    return false;
  }
  try {
    if (deviceIp) {
      const serial = normalizeSerial(deviceIp);
      exec(`${adbPath} disconnect ${serial}`, puts);
      connectedSerials.delete(serial);
      console.log("Disconnected from ADB " + serial);
    } else {
      exec(`${adbPath} disconnect`, puts);
      connectedSerials.clear();
      console.log("Disconnected from ADB");
    }
  } catch (error) {
    console.error("Error disconnecting from ADB", error);
  }
  return false;
}

function isADBConnected(deviceIp) {
  if (deviceIp) return connectedSerials.has(normalizeSerial(deviceIp));
  return connectedSerials.size > 0;
}

function sendADBKey(key, deviceIp) {
  const serial = normalizeSerial(deviceIp);
  if (serial && connectedSerials.has(serial) && typeof key === "string" && adbPath !== "") {
    if (!isNumeric(key)) {
      exec(`${adbPath} -s ${serial} shell input text '${key}'`, puts);
    } else {
      exec(`${adbPath} -s ${serial} shell input keyevent ${key}`, puts);
    }
  }
}

function sendADBText(text, deviceIp) {
  const serial = normalizeSerial(deviceIp);
  if (serial && connectedSerials.has(serial) && typeof text === "string" && adbPath !== "") {
    console.debug(`[ADB] Sending text character by character: "${text}"`);

    const chars = text.split("");
    let index = 0;

    function sendNextChar() {
      if (index >= chars.length) {
        console.debug("[ADB] Finished sending text character by character");
        return;
      }

      const char = chars[index];

      // Skip spaces by sending a space keyevent instead of text
      if (char === " ") {
        exec(`${adbPath} -s ${serial} shell input keyevent 62`, (error, stdout, stderr) => {
          if (error) {
            console.error(`[ADB] Error sending space:`, error.message);
          }
          index++;
          // Small delay between characters
          setTimeout(sendNextChar, 50);
        });
      } else {
        // Escape the character for shell safety
        const escapedChar = char
          .replace(/\\/g, "\\\\") // Escape backslashes first
          .replace(/'/g, "'\\''") // Escape single quotes
          .replace(/"/g, '\\"') // Escape double quotes
          .replace(/=/g, "\\=") // Escape equals signs
          .replace(/&/g, "\\&") // Escape ampersands
          .replace(/\|/g, "\\|") // Escape pipes
          .replace(/;/g, "\\;") // Escape semicolons
          .replace(/</g, "\\<") // Escape less than
          .replace(/>/g, "\\>") // Escape greater than
          .replace(/\(/g, "\\(") // Escape opening parenthesis
          .replace(/\)/g, "\\)") // Escape closing parenthesis
          .replace(/\[/g, "\\[") // Escape opening bracket
          .replace(/\]/g, "\\]") // Escape closing bracket
          .replace(/\{/g, "\\{") // Escape opening brace
          .replace(/\}/g, "\\}") // Escape closing brace
          .replace(/\$/g, "\\$") // Escape dollar signs
          .replace(/`/g, "\\`") // Escape backticks
          .replace(/!/g, "\\!") // Escape exclamation marks
          .replace(/#/g, "\\#") // Escape hash/pound signs
          .replace(/%/g, "\\%") // Escape percent signs
          .replace(/\^/g, "\\^") // Escape caret
          .replace(/\*/g, "\\*") // Escape asterisks
          .replace(/\?/g, "\\?") // Escape question marks
          .replace(/~/g, "\\~"); // Escape tildes

        exec(`${adbPath} -s ${serial} shell input text '${escapedChar}'`, (error, stdout, stderr) => {
          if (error) {
            console.error(`[ADB] Error sending character '${char}':`, error.message);
          }
          index++;
          // Small delay between characters
          setTimeout(sendNextChar, 50);
        });
      }
    }

    sendNextChar();
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
  isADBConnected,
  sendADBKey,
  sendADBText,
};
