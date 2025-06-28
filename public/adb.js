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
    console.log(`[ADB] Sending text: "${text}"`);
    
    // Try using printf to avoid shell parsing issues with spaces
    // This approach uses printf to output the text and pipes it to the input method
    const escapedText = text
      .replace(/\\/g, "\\\\")      // Escape backslashes
      .replace(/"/g, '\\"')        // Escape double quotes
      .replace(/'/g, "\\'")        // Escape single quotes
      .replace(/\$/g, "\\$")       // Escape dollar signs
      .replace(/`/g, "\\`")        // Escape backticks
      .replace(/\n/g, " ")         // Replace newlines with spaces
      .replace(/\r/g, " ")         // Replace carriage returns with spaces  
      .replace(/\t/g, " ");        // Replace tabs with spaces

    console.log(`[ADB] Escaped text: "${escapedText}"`);
    
    // Use printf with %s to safely handle the text, then pipe to input text
    exec(`${adbPath} shell "printf '%s' \\"${escapedText}\\" | input text /dev/stdin"`, (error, stdout, stderr) => {
      if (error) {
        console.error('[ADB] Error with printf method, trying alternative:', error.message);
        // Fallback: try character by character for problematic text
        sendADBTextCharByChar(text);
      } else {
        console.log('[ADB] Text sent successfully via printf');
        if (stdout) console.log('[ADB] stdout:', stdout);
      }
    });
  }
}

// Fallback method: send character by character
function sendADBTextCharByChar(text) {
  console.log(`[ADB] Sending text character by character: "${text}"`);
  
  const chars = text.split('');
  let index = 0;
  
  function sendNextChar() {
    if (index >= chars.length) {
      console.log('[ADB] Finished sending text character by character');
      return;
    }
    
    const char = chars[index];
    const escapedChar = char
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "'\\''")
      .replace(/"/g, '\\"');
    
    exec(`${adbPath} shell input text '${escapedChar}'`, (error, stdout, stderr) => {
      if (error) {
        console.error(`[ADB] Error sending character '${char}':`, error.message);
      }
      index++;
      // Small delay between characters
      setTimeout(sendNextChar, 50);
    });
  }
  
  sendNextChar();
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
