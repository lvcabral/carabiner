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
    console.log(`[ADB] Sending text character by character: "${text}"`);

    const chars = text.split("");
    let index = 0;

    function sendNextChar() {
      if (index >= chars.length) {
        console.log("[ADB] Finished sending text character by character");
        return;
      }

      const char = chars[index];

      // Skip spaces by sending a space keyevent instead of text
      if (char === " ") {
        exec(`${adbPath} shell input keyevent 62`, (error, stdout, stderr) => {
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

        exec(`${adbPath} shell input text '${escapedChar}'`, (error, stdout, stderr) => {
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
  sendADBKey,
  sendADBText,
};
