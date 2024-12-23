/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const video = document.querySelector("video");
const videoPlayer = document.getElementById("video-player");
const overlayImage = document.getElementById("overlay-image");
const settingsButton = document.getElementById("settings-button");
let currentColor = "#662D91";

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

let resizeTimeout;
window.addEventListener("resize", () => {
  const newWidth = window.innerWidth - 15;
  const newHeight = window.innerHeight - 15;
  const dimensions = { width: `${newWidth}px`, height: `${newHeight}px` };
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    console.log("Window resized to: ", newWidth, newHeight);
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
  "set-control-selected": handleControlSelected,
  "set-overlay-opacity": handleOverlayOpacity,
};

function renderDisplay(constraints) {
  if (video.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
  }
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      video.srcObject = stream;
      video.play();
    })
    .catch((err) => {
      console.log(err.name + ": " + err.message);
    });
}

window.addEventListener("DOMContentLoaded", function () {
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    const cams = devices.filter((device) => device.kind === "videoinput");
    if (cams?.length) {
      window.electronAPI.sendSync("shared-window-channel", {
        type: "set-webcams",
        payload: JSON.stringify(cams),
      });
    } else {
      console.log("No camera/capture card found");
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

  const newWidth = window.innerWidth - 15;
  const newHeight = window.innerHeight - 15;
  handleSetResolution({ width: `${newWidth}px`, height: `${newHeight}px` });

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

  // Show the button when the mouse is in the top right quarter of the screen
  this.document.body.addEventListener("mousemove", (event) => {
    const { clientX, clientY } = event;
    const { innerWidth, innerHeight } = window;
    if (clientX > innerWidth * 0.75 && clientY < innerHeight * 0.25) {
      settingsButton.style.opacity = "1";
    } else {
      settingsButton.style.opacity = "0";
    }
  });

  this.document.body.addEventListener("mouseleave", () => {
    settingsButton.style.opacity = "0";
  });

  // Handle button click
  settingsButton.addEventListener("click", () => {
    window.electronAPI.showSettings();
  });
});

// Remote Control
let controlIp = "";
let controlType = "ecp";

function handleControlSelected(data) {
  if (typeof data === "string" && data.includes("|")) {
    [controlIp, controlType] = data.split("|");
  }
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
ecpKeysMap.set("PageDown", "rev");
ecpKeysMap.set("PageUp", "fwd");
ecpKeysMap.set("Insert", "info");
ecpKeysMap.set("Control+KeyA", "a");
ecpKeysMap.set("Control+KeyZ", "b");
ecpKeysMap.set("F10", "volumemute");
if (navigator.platform.toUpperCase().indexOf("MAC") >= 0) {
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
if (navigator.platform.toUpperCase().indexOf("MAC") >= 0) {
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
adbKeysMap.set("Period", "56");
adbKeysMap.set("Space", "62");
adbKeysMap.set("Minus", "69");
adbKeysMap.set("Equal", "70");
adbKeysMap.set("BracketLeft", "71");
adbKeysMap.set("BracketRight", "72");
adbKeysMap.set("Backslash", "73");
adbKeysMap.set("Semicolon", "74");
adbKeysMap.set("Quote", "75");
adbKeysMap.set("Slash", "76");
adbKeysMap.set("Shift+Slash", "59 76");
adbKeysMap.set("Backquote", "68");
adbKeysMap.set("Shift+Digit1", "59 8");
adbKeysMap.set("Shift+Digit2", "77");
adbKeysMap.set("Shift+Digit3", "78");
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
      !["Alt", "Control", "Meta", "Shift", "Tab", "Dead"].includes(event.key)
    ) {
      sendKey(`lit_${encodeURIComponent(event.key)}`, mod);
    }
  } else if (controlType === "adb") {
    const key = adbKeysMap.get(keyCode);
    if (key) {
      sendKey(key, mod);
    }
  }
}

function sendKey(key, mod) {
  console.log("Sending Key: ", key, mod);
  if (isValidIP(controlIp) && controlType === "ecp") {
    sendEcpKey(controlIp, key, mod);
  } else if (isValidIP(controlIp) && controlType === "adb" && mod === 0) {
    window.electronAPI.sendSync("shared-window-channel", {
      type: "send-adb-key",
      payload: key,
    });
  }
}

function sendEcpKey(host, key, mod = -1) {
  let command = "keypress";
  if (mod !== -1) {
    command = mod === 0 ? "keydown" : "keyup";
  }
  const xhr = new XMLHttpRequest();
  const url = `http://${host}:8060/${command}/${key}`;
  console.log("Sending ECP Key: ", url);
  try {
    xhr.open("POST", url, false);
    xhr.send();
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
