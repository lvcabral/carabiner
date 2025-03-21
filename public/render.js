/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const videoPlayer = document.getElementById("video-player");
const overlayImage = document.getElementById("overlay-image");
const settingsButton = document.getElementById("settings-button");
const deviceLabel = document.getElementById("device-label");
const isMacOS = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
let currentColor = "#662D91";
let currentConstraints = { video: true };
let videoState = "stopped";
let resizeTimeout;

// Load settings from main process
window.electronAPI.invoke("load-settings").then((settings) => {
  if (settings.control && settings.control.deviceId) {
    handleControlSelected(settings.control.deviceId);
  }
});

function updateOverlayPosition() {
  const rect = videoPlayer.getBoundingClientRect();
  const borderWidth =
    parseFloat(getComputedStyle(videoPlayer).borderWidth) || 0;
  overlayImage.style.position = "absolute";
  overlayImage.style.top = `${rect.top + borderWidth}px`;
  overlayImage.style.left = `${rect.left + borderWidth}px`;
  overlayImage.style.width = `${rect.width - 2 * borderWidth}px`;
  overlayImage.style.height = `${rect.height - 2 * borderWidth}px`;
}

function handleSetResolution(style) {
  videoPlayer.style.width = style.width;
  videoPlayer.style.height = style.height;
  document.body.style.width = style.width;
  document.body.style.height = style.height;
  updateOverlayPosition();
}

window.addEventListener("resize", () => {
  const newWidth = window.innerWidth - 15;
  const newHeight = window.innerHeight - 15;
  const dimensions = { width: `${newWidth}px`, height: `${newHeight}px` };
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    window.electronAPI.sendSync("shared-window-channel", {
      type: "set-resolution",
      payload: dimensions,
    });
  }, 200);
  handleSetResolution(dimensions);
});

function handleSetBorderWidth(borderWidth) {
  if (borderWidth === "0.1px") {
    videoPlayer.style.borderColor = "rgba(0, 0, 0, 0.1)";
  } else {
    videoPlayer.style.borderColor = currentColor;
  }
  videoPlayer.style.borderWidth = borderWidth;
  updateOverlayPosition();
}

function handleSetBorderStyle(borderStyle) {
  videoPlayer.style.borderStyle = borderStyle;
}

function handleSetBorderColor(borderColor) {
  currentColor = borderColor;
  if (videoPlayer.style.borderWidth !== "0.1px") {
    videoPlayer.style.borderColor = borderColor;
  }
}

function handleSetVideoStream(constraints) {
  currentConstraints = constraints;
  renderDisplay(constraints);
}

function handleSetTransparency(data) {
  videoPlayer.style.filter = data.filter;
  videoPlayer.style["-webkit-filter"] = `-webkit-${data.filter}`;
}

function handleOverlayOpacity(opacity) {
  overlayImage.style.opacity = opacity;
}

const eventHandlers = {
  "set-border-width": handleSetBorderWidth,
  "set-border-style": handleSetBorderStyle,
  "set-border-color": handleSetBorderColor,
  "set-video-stream": handleSetVideoStream,
  "set-transparency": handleSetTransparency,
  "set-control-list": handleControlList,
  "set-control-selected": handleControlSelected,
  "set-overlay-opacity": handleOverlayOpacity,
};

function renderDisplay(constraints) {
  if (videoState !== "stopped") {
    stopVideoStream();
  }
  videoState = "starting";
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(async (stream) => {
      deviceLabel.textContent = await getCaptureDeviceLabel(
        constraints.video.deviceId.exact
      );
      videoPlayer.srcObject = stream;
      videoPlayer.play();
      currentConstraints = constraints;
    })
    .catch((err) => {
      console.log(err.name + ": " + err.message);
      showToast("Error loading capture devices!", 5000, true);
      videoState = "stopped";
    });
}

function stopVideoStream() {
  videoPlayer.pause();
  const stream = videoPlayer.srcObject;
  if (stream) {
    const tracks = stream.getTracks();
    tracks.forEach((track) => track.stop());
    videoPlayer.srcObject = null;
  }
  videoState = "stopped";
}

async function getCaptureDeviceLabel(deviceId) {
  if (!deviceId) {
    return "Unknown Device";
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const captureDevice = devices.find(
    (device) => device.deviceId === deviceId && device.kind === "videoinput"
  );
  let deviceLabel = captureDevice ? captureDevice.label : "Unknown Device";
  const streamDevice = controlList.find(
    (device) => device.linked === captureDevice.deviceId
  );
  if (streamDevice) {
    deviceLabel += ` - ${streamDevice.type} ${
      streamDevice.alias ?? streamDevice.ipAddress
    }`;
  }
  return deviceLabel;
}

window.addEventListener("DOMContentLoaded", function () {
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    const capture = devices.filter((device) => device.kind === "videoinput");
    if (capture?.length) {
      window.electronAPI.sendSync("shared-window-channel", {
        type: "set-capture-devices",
        payload: JSON.stringify(capture),
      });
      // Set the initial device label
      const initialDevice = capture[0];
      deviceLabel.textContent = initialDevice.label || "";
    } else {
      overlayImage.style.opacity = "1";
      overlayImage.src = "images/no-capture-device.png";
      showToast("No capture device found!", 5000, true);
    }
  });

  window.electronAPI.onMessageReceived(
    "shared-window-channel",
    (_, message) => {
      const handler = eventHandlers[message.type];
      if (handler) {
        handler(message.payload);
      }
    }
  );

  // Handle video streaming control
  window.electronAPI.onMessageReceived("stop-video-stream", function () {
    stopVideoStream();
  });

  window.electronAPI.onMessageReceived("start-video-stream", function () {
    if (videoState === "stopped") {
      renderDisplay(currentConstraints);
    }
  });

  const newWidth = window.innerWidth - 15;
  const newHeight = window.innerHeight - 15;
  handleSetResolution({ width: `${newWidth}px`, height: `${newHeight}px` });

  // Handle Screenshot Requests
  function getScreenshotCanvas() {
    const canvas = document.createElement("canvas");
    canvas.width = videoPlayer.videoWidth;
    canvas.height = videoPlayer.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  window.electronAPI.onMessageReceived("copy-screenshot", function () {
    const canvas = getScreenshotCanvas();
    canvas.toBlob(function (blob) {
      const item = new ClipboardItem({ "image/png": blob });
      navigator.clipboard
        .write([item])
        .then(() => {
          showToast("Screenshot copied to clipboard!");
        })
        .catch((err) => {
          showToast("Error copying screenshot to clipboard!", 5000, true);
          console.log(`error copying screenshot to clipboard: ${err.message}`);
        });
    });
  });

  window.electronAPI.onMessageReceived("save-screenshot", function () {
    const canvas = getScreenshotCanvas();
    const now = new Date();
    const datePart = now.toLocaleDateString("en-CA");
    const timePart = now
      .toLocaleTimeString("en-CA", { hour12: false })
      .replace(/:/g, "");
    const filename = `carabiner-${datePart}-${timePart}.png`;
    canvas.toBlob(function (blob) {
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  // Listen for the image-loaded event
  window.electronAPI.onMessageReceived("image-loaded", (event, imageData) => {
    overlayImage.src = imageData;
  });

  // Configure the overlay image
  overlayImage.style.position = "absolute";
  updateOverlayPosition();
  overlayImage.style.objectFit = "cover";
  overlayImage.style.pointerEvents = "none"; // Ensure it doesn't interfere with video controls
  overlayImage.style.opacity = "0"; // Start with 0 opacity
  overlayImage.style.zIndex = "700";

  // Configure the ellipsis button
  settingsButton.innerHTML = "&#x22ef;"; // Ellipsis character
  settingsButton.style.position = "fixed";
  settingsButton.style.top = "25px";
  settingsButton.style.right = "30px";
  settingsButton.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  settingsButton.style.color = "rgba(255, 255, 255, 0.5)";
  settingsButton.style.border = "none";
  settingsButton.style.borderRadius = "5px";
  settingsButton.style.padding = "10px";
  settingsButton.style.cursor = "pointer";
  settingsButton.style.opacity = "0";
  settingsButton.style.transition = "opacity 0.3s";
  settingsButton.style.fontWeight = "bold";
  settingsButton.style.fontSize = "20px";
  settingsButton.style.zIndex = "1000"; // Ensure the button is on top

  // Configure the device label
  deviceLabel.style.position = "fixed";
  deviceLabel.style.bottom = "25px";
  deviceLabel.style.right = "30px";
  deviceLabel.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  deviceLabel.style.color = "rgba(255, 255, 255, 0.5)";
  deviceLabel.style.border = "none";
  deviceLabel.style.borderRadius = "5px";
  deviceLabel.style.padding = "10px";
  deviceLabel.style.opacity = "0";
  deviceLabel.style.transition = "opacity 0.3s";
  deviceLabel.style.fontSize = "12px";
  deviceLabel.style.zIndex = "1000"; // Ensure the label is on top

  // Show the button when the mouse is in the top right quarter of the window
  window.addEventListener("mousemove", (event) => {
    const { clientX, clientY } = event;
    const { innerWidth, innerHeight } = window;
    if (clientX > innerWidth * 0.75 && clientY < innerHeight * 0.25) {
      settingsButton.style.opacity = "1";
      deviceLabel.style.opacity = "1";
    } else {
      settingsButton.style.opacity = "0";
      deviceLabel.style.opacity = "0";
    }
  });

  // Show the button when the window is moved
  window.electronAPI.onMessageReceived("window-moved", (event, imageData) => {
    settingsButton.style.opacity = "1";
    deviceLabel.style.opacity = "1";
  });

  // Handle button click
  settingsButton.addEventListener("click", () => {
    settingsButton.blur();
    window.electronAPI.showContextMenu();
  });
});

// Video Events
videoPlayer.addEventListener("loadstart", () => {
  videoState = "loading";
});

videoPlayer.addEventListener("play", () => {
  videoState = "playing";
});

// Remote Control
let controlList = [];
let controlIp = "";
let controlType = "ecp";

async function handleControlSelected(data) {
  if (typeof data === "string" && data.includes("|")) {
    [controlIp, controlType] = data.split("|");
    deviceLabel.textContent = await getCaptureDeviceLabel(
      currentConstraints?.video?.deviceId?.exact
    );
  }
}

function handleControlList(data) {
  const found = data.find(
    (device) => device.id === `${controlIp}|${controlType}`
  );
  if (!found) {
    controlIp = "";
    controlType = "ecp";
  }
  controlList = data;
}

// Keyboard Events
document.addEventListener("keydown", keyDownHandler);
document.addEventListener("keyup", keyUpHandler);

// ECP Keyboard Mapping
const ecpKeysMap = new Map();
ecpKeysMap.set("ArrowUp", "up");
ecpKeysMap.set("ArrowDown", "down");
ecpKeysMap.set("ArrowLeft", "left");
ecpKeysMap.set("ArrowRight", "right");
ecpKeysMap.set("Enter", "select");
ecpKeysMap.set("Escape", "back");
ecpKeysMap.set("Delete", "back");
ecpKeysMap.set("Home", "home");
ecpKeysMap.set("Shift+Escape", "home");
ecpKeysMap.set("Control+Escape", "home");
ecpKeysMap.set("Backspace", "instantreplay");
ecpKeysMap.set("End", "play");
ecpKeysMap.set("PageUp", "rev");
ecpKeysMap.set("PageDown", "fwd");
ecpKeysMap.set("Insert", "info");
ecpKeysMap.set("Control+KeyA", "a");
ecpKeysMap.set("Control+KeyZ", "b");
ecpKeysMap.set("F10", "volumemute");
if (isMacOS) {
  ecpKeysMap.set("Command+Backspace", "backspace");
  ecpKeysMap.set("Command+Enter", "play");
  ecpKeysMap.set("Command+ArrowLeft", "rev");
  ecpKeysMap.set("Command+ArrowRight", "fwd");
  ecpKeysMap.set("Command+Digit8", "info");
} else {
  ecpKeysMap.set("Control+Backspace", "backspace");
  ecpKeysMap.set("Control+Enter", "play");
  ecpKeysMap.set("Control+ArrowLeft", "rev");
  ecpKeysMap.set("Control+ArrowRight", "fwd");
  ecpKeysMap.set("Control+Digit8", "info");
}

// ADB Keyboard Mapping
const adbKeysMap = new Map();
adbKeysMap.set("ArrowUp", "19");
adbKeysMap.set("ArrowDown", "20");
adbKeysMap.set("ArrowLeft", "21");
adbKeysMap.set("ArrowRight", "22");
adbKeysMap.set("Enter", "66");
adbKeysMap.set("Escape", "4");
adbKeysMap.set("Delete", "4");
adbKeysMap.set("Home", "3");
adbKeysMap.set("Shift+Escape", "3");
adbKeysMap.set("Control+Escape", "3");
adbKeysMap.set("Backspace", "67");
adbKeysMap.set("End", "85");
adbKeysMap.set("PageDown", "89");
adbKeysMap.set("PageUp", "90");
adbKeysMap.set("Insert", "1");
adbKeysMap.set("Control+KeyA", "29");
adbKeysMap.set("Control+KeyZ", "54");
adbKeysMap.set("F10", "164");
if (isMacOS) {
  adbKeysMap.set("Command+Backspace", "67");
  adbKeysMap.set("Command+Enter", "85");
  adbKeysMap.set("Command+ArrowLeft", "89");
  adbKeysMap.set("Command+ArrowRight", "90");
  adbKeysMap.set("Command+Digit8", "1");
} else {
  adbKeysMap.set("Control+Backspace", "67");
  adbKeysMap.set("Control+Enter", "85");
  adbKeysMap.set("Control+ArrowLeft", "89");
  adbKeysMap.set("Control+ArrowRight", "90");
  adbKeysMap.set("Control+Digit8", "1");
}
for (let i = 0; i <= 9; i++) {
  adbKeysMap.set(`Digit${i}`, (i + 7).toString());
}
for (let i = 65; i <= 90; i++) {
  adbKeysMap.set(`Key${String.fromCharCode(i)}`, (i - 36).toString());
}
adbKeysMap.set("Comma", "55");
adbKeysMap.set("Shift+Comma", "\\<");
adbKeysMap.set("Period", "56");
adbKeysMap.set("Shift+Period", "\\>");
adbKeysMap.set("Space", "62");
adbKeysMap.set("Minus", "69");
adbKeysMap.set("Shift+Minus", "_");
adbKeysMap.set("Equal", "70");
adbKeysMap.set("Shift+Equal", "+");
adbKeysMap.set("BracketLeft", "71");
adbKeysMap.set("Shift+BracketLeft", "{");
adbKeysMap.set("BracketRight", "72");
adbKeysMap.set("Shift+BracketRight", "}");
adbKeysMap.set("Backslash", "73");
adbKeysMap.set("Shift+Backslash", "\\|");
adbKeysMap.set("Semicolon", "74");
adbKeysMap.set("Shift+Semicolon", ":");
adbKeysMap.set("Quote", "75");
adbKeysMap.set("Shift+Quote", `\\"`);
adbKeysMap.set("Slash", "76");
adbKeysMap.set("Shift+Slash", "\\?");
adbKeysMap.set("Backquote", "68");
adbKeysMap.set("Shift+Backquote", "\\~");
adbKeysMap.set("Shift+Digit1", "!");
adbKeysMap.set("Shift+Digit2", "77");
adbKeysMap.set("Shift+Digit3", "\\#");
adbKeysMap.set("Shift+Digit4", "$");
adbKeysMap.set("Shift+Digit5", "\\%");
adbKeysMap.set("Shift+Digit6", "^");
adbKeysMap.set("Shift+Digit7", "\\&");
adbKeysMap.set("Shift+Digit8", "\\*");
adbKeysMap.set("Shift+Digit9", "162");
adbKeysMap.set("Shift+Digit0", "163");

// Keyboard handlers
function keyDownHandler(event) {
  if (!event.repeat) {
    handleKeyboardEvent(event, 0);
  }
}
function keyUpHandler(event) {
  handleKeyboardEvent(event, 100);
}
function handleKeyboardEvent(event, mod) {
  let keyCode = event.code;
  if (event.shiftKey && !keyCode.startsWith("Shift")) {
    keyCode = "Shift+" + keyCode;
  } else if (event.ctrlKey && !keyCode.startsWith("Control")) {
    keyCode = "Control+" + keyCode;
  } else if (event.altKey && !keyCode.startsWith("Alt")) {
    keyCode = "Alt+" + keyCode;
  } else if (event.metaKey && !keyCode.startsWith("Meta")) {
    keyCode = "Meta+" + keyCode;
  }
  if (controlType === "ecp") {
    const key = ecpKeysMap.get(keyCode);
    if (key && key.toLowerCase() !== "ignore") {
      sendKey(key, mod);
    } else if (
      !["Alt", "Control", "Meta", "Shift", "Tab", "Dead"].includes(event.key) &&
      mod === 0
    ) {
      sendKey(`lit_${encodeURIComponent(event.key)}`, -1);
    }
  } else if (controlType === "adb") {
    const key = adbKeysMap.get(keyCode);
    if (key) {
      sendKey(key, mod);
    }
  }
}

function sendKey(key, mod) {
  if (isValidIP(controlIp) && controlType === "ecp") {
    sendEcpKey(controlIp, key, mod);
  } else if (isValidIP(controlIp) && controlType === "adb" && mod === 0) {
    window.electronAPI.sendSync("shared-window-channel", {
      type: "send-adb-key",
      payload: key,
    });
  }
}

// Queue to manage key events
const keyEventQueue = [];
let isProcessingQueue = false;

function enqueueKeyEvent(key, mod) {
  keyEventQueue.push({ key, mod });
  if (!isProcessingQueue) {
    processKeyEventQueue();
  }
}

async function processKeyEventQueue() {
  isProcessingQueue = true;
  while (keyEventQueue.length > 0) {
    const { key, mod } = keyEventQueue.shift();
    await sendEcpKey(controlIp, key, mod);
  }
  isProcessingQueue = false;
}

async function sendEcpKey(host, key, mod = -1) {
  let command = "keypress";
  if (mod !== -1) {
    command = mod === 0 ? "keydown" : "keyup";
  }
  const url = `http://${host}:8060/${command}/${key}`;
  try {
    const response = await fetch(url, { method: "POST" });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (e) {
    console.error("Error sending ECP Key: ", e.message);
  }
}

//----------------------- Helper Functions -----------------------//

// Check if the IP address is valid
function isValidIP(ip) {
  if (ip && ip.length >= 7) {
    const ipFormat = /^(\d{1,3}\.){3}\d{1,3}$/;
    return ipFormat.test(ip);
  }
  return false;
}

// Shows a Toast message on the Window
function showToast(message, duration = 3000, error = false) {
  try {
    let style = null;
    if (error) {
      style = {
        color: "#fff",
        background: "#b61717",
      };
    }
    Toastify({
      text: message,
      duration: duration,
      close: false,
      gravity: "bottom",
      position: "center",
      stopOnFocus: true,
      style: style,
    }).showToast();
  } catch (error) {
    console.error("Error showing toast: ", error.message);
  }
}
