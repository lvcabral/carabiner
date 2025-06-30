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
const recordingIndicator = document.getElementById("recording-indicator");
const isMacOS = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
let currentColor = "#662D91";
let currentConstraints = { video: true, audio: false };
let videoState = "stopped";
let resizeTimeout;
let audioEnabled = false;

// Video recording variables
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

// Load settings from main process
window.electronAPI.invoke("load-settings").then(async (settings) => {
  if (settings.control && settings.control.deviceId) {
    handleControlSelected(settings.control.deviceId);
  }
  if (settings.display && settings.display.audioEnabled !== undefined) {
    audioEnabled = settings.display.audioEnabled;
    // Note: updateAudioConstraints() will be called when video stream is set
  }
});

function updateOverlayPosition() {
  const rect = videoPlayer.getBoundingClientRect();
  const borderWidth = parseFloat(getComputedStyle(videoPlayer).borderWidth) || 0;
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

async function handleSetVideoStream(constraints) {
  currentConstraints = constraints;
  await updateAudioConstraints();
  renderDisplay(currentConstraints);
}

function handleSetTransparency(transparencyValue) {
  // Convert numeric transparency to CSS filter
  let filterValue = "none";
  if (transparencyValue === 25) {
    filterValue = "opacity(75%)";
  } else if (transparencyValue === 50) {
    filterValue = "opacity(50%)";
  } else if (transparencyValue === 75) {
    filterValue = "opacity(25%)";
  }

  videoPlayer.style.filter = filterValue;
  videoPlayer.style["-webkit-filter"] = `-webkit-${filterValue}`;
}

function handleOverlayOpacity(opacity) {
  overlayImage.style.opacity = opacity;
}

async function updateAudioConstraints() {
  if (audioEnabled && currentConstraints.video && currentConstraints.video.deviceId) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDeviceId =
        currentConstraints.video.deviceId.exact || currentConstraints.video.deviceId;

      // Find the video device to get its label for matching
      const videoDevice = devices.find(
        (device) => device.kind === "videoinput" && device.deviceId === videoDeviceId
      );

      if (videoDevice && videoDevice.label) {
        // Look for audio device with similar name/label (same capture card)
        // Many capture cards have audio and video with similar names
        const videoLabel = videoDevice.label.toLowerCase();
        const audioDevice = devices.find((device) => {
          if (device.kind !== "audioinput") return false;
          const audioLabel = device.label.toLowerCase();

          // Check if audio device name contains parts of video device name
          // This handles cases like "USB Video", "USB Audio" or "Capture Card Video", "Capture Card Audio"
          const videoWords = videoLabel.split(/[\s\-_]+/).filter((word) => word.length > 2);
          return (
            videoWords.some((word) => audioLabel.includes(word)) &&
            !audioLabel.includes("microphone") &&
            !audioLabel.includes("built-in") &&
            !audioLabel.includes("default")
          );
        });

        if (audioDevice) {
          currentConstraints.audio = {
            deviceId: { exact: audioDevice.deviceId },
          };
          console.debug(
            `[Carabiner] Found matching audio device: ${audioDevice.label} for video device: ${videoDevice.label}`
          );
        } else {
          // If no matching audio device found, disable audio to avoid using microphone
          currentConstraints.audio = false;
          console.debug(
            `[Carabiner] No matching audio device found for video device: ${videoDevice.label}, audio disabled`
          );
        }
      } else {
        currentConstraints.audio = false;
      }
    } catch (error) {
      console.error("[Carabiner] Error updating audio constraints:", error);
      currentConstraints.audio = false;
    }
  } else {
    currentConstraints.audio = false;
  }
}

async function handleSetAudioEnabled(enabled) {
  audioEnabled = enabled;
  // Update the current constraints with proper audio settings
  await updateAudioConstraints();
  if (videoState !== "stopped") {
    renderDisplay(currentConstraints);
  }
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
  "set-audio-enabled": handleSetAudioEnabled,
};

function renderDisplay(constraints) {
  if (videoState !== "stopped") {
    stopVideoStream();
  }
  videoState = "starting";
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(async (stream) => {
      deviceLabel.textContent = await getCaptureDeviceLabel(constraints.video.deviceId.exact);
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
  // Stop any ongoing recording when video stream stops
  if (isRecording && mediaRecorder) {
    stopRecording();
  }

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
  const streamDevice = controlList.find((device) => device.linked === captureDevice.deviceId);
  if (streamDevice) {
    deviceLabel += ` - ${streamDevice.type} ${streamDevice.alias ?? streamDevice.ipAddress}`;
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

  window.electronAPI.onMessageReceived("shared-window-channel", (_, message) => {
    const handler = eventHandlers[message.type];
    if (handler) {
      handler(message.payload);
    }
  });

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

  // Video Recording Functions
  function startRecording() {
    if (isRecording || !videoPlayer.srcObject) {
      console.log("[Carabiner] Cannot start recording: already recording or no video stream");
      return;
    }

    try {
      const stream = videoPlayer.srcObject;
      recordedChunks = [];

      // Configure recording options - Chromium 126+ supports MP4 recording
      const options = {
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      };

      // Try MP4 formats first (supported in Chromium 126+)
      if (MediaRecorder.isTypeSupported("video/mp4;codecs=h264,aac")) {
        options.mimeType = "video/mp4;codecs=h264,aac";
      } else if (MediaRecorder.isTypeSupported("video/mp4;codecs=h264")) {
        options.mimeType = "video/mp4;codecs=h264";
      } else if (MediaRecorder.isTypeSupported("video/mp4")) {
        options.mimeType = "video/mp4";
      } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
        options.mimeType = "video/webm;codecs=vp9,opus";
      } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
        options.mimeType = "video/webm;codecs=vp8,opus";
      } else {
        options.mimeType = "video/webm";
      }

      mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        saveRecording();
      };

      mediaRecorder.onerror = (event) => {
        console.error("[Carabiner] MediaRecorder error:", event.error);
        showToast("Recording error occurred!", 5000, true);
        isRecording = false;
        recordingIndicator.style.opacity = "0"; // Hide recording indicator on error
        recordingIndicator.classList.remove("recording-active"); // Stop pulsing animation on error
        window.electronAPI.send("recording-state-changed", isRecording);
      };

      mediaRecorder.start();
      isRecording = true;
      recordingIndicator.style.opacity = "1"; // Show recording indicator
      recordingIndicator.classList.add("recording-active"); // Start pulsing animation
      window.electronAPI.send("recording-state-changed", isRecording);
      showToast("Recording started...");
    } catch (error) {
      console.error("[Carabiner] Error starting recording:", error);
      showToast("Failed to start recording!", 5000, true);
      isRecording = false;
      recordingIndicator.style.opacity = "0"; // Hide recording indicator on error
      recordingIndicator.classList.remove("recording-active"); // Stop pulsing animation on error
      window.electronAPI.send("recording-state-changed", isRecording);
    }
  }

  function stopRecording() {
    if (!isRecording || !mediaRecorder) {
      console.debug("[Carabiner] Cannot stop recording: not currently recording");
      return;
    }

    try {
      mediaRecorder.stop();
      isRecording = false;
      recordingIndicator.style.opacity = "0"; // Hide recording indicator
      recordingIndicator.classList.remove("recording-active"); // Stop pulsing animation
      window.electronAPI.send("recording-state-changed", isRecording);
    } catch (error) {
      console.error("[Carabiner] Error stopping recording:", error);
      showToast("Error stopping recording!", 5000, true);
      isRecording = false;
      recordingIndicator.style.opacity = "0"; // Hide recording indicator on error
      recordingIndicator.classList.remove("recording-active"); // Stop pulsing animation on error
      window.electronAPI.send("recording-state-changed", isRecording);
    }
  }

  async function saveRecording() {
    if (recordedChunks.length === 0) {
      showToast("No recording data to save!", 5000, true);
      return;
    }

    try {
      const blob = new Blob(recordedChunks, { type: recordedChunks[0].type });

      const now = new Date();
      const datePart = now.toLocaleDateString("en-CA");
      const timePart = now.toLocaleTimeString("en-CA", { hour12: false }).replace(/:/g, "");

      // Determine file extension based on mime type
      let extension = "mp4"; // Default to mp4
      if (recordedChunks[0].type.includes("webm")) {
        extension = "webm";
      }

      const filename = `carabiner-recording-${datePart}-${timePart}.${extension}`;

      // Convert blob to buffer for saving
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Convert to regular array for IPC serialization
      const bufferData = Array.from(uint8Array);

      // Show save dialog and save file
      const result = await window.electronAPI.invoke("save-video-dialog", filename, bufferData);

      if (result.success) {
        const savedFilename = result.filePath.split(/[\\/]/).pop(); // Extract filename from path
        showToast(`Recording saved as ${savedFilename}`);
        console.debug("[Carabiner] Recording saved:", result.filePath);
      } else if (result.canceled) {
        // User canceled - don't show any message
        console.debug("[Carabiner] Recording save canceled by user");
      } else {
        showToast("Failed to save recording!", 5000, true);
        console.error("[Carabiner] Error saving recording:", result.error);
      }

      recordedChunks = [];
    } catch (error) {
      console.error("[Carabiner] Error saving recording:", error);
      showToast("Failed to save recording!", 5000, true);
      recordedChunks = [];
    }
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
    const timePart = now.toLocaleTimeString("en-CA", { hour12: false }).replace(/:/g, "");
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
    if (imageData && imageData.trim() !== "") {
      overlayImage.src = imageData;
      overlayImage.style.display = "block";
    } else {
      overlayImage.src = "";
      overlayImage.style.display = "none";
    }
  });

  // Listen for the clear-overlay-image event
  window.electronAPI.onMessageReceived("clear-overlay-image", (event) => {
    overlayImage.src = "";
    overlayImage.style.display = "none";
  });

  // Listen for paste command from context menu
  window.electronAPI.onMessageReceived("handle-paste", (event) => {
    handlePaste();
  });

  // Additional paste detection for macOS system menu paste
  // Listen for clipboard events and paste operations
  if (isMacOS) {
    // Listen for the standard 'paste' event on the document
    document.addEventListener("paste", (event) => {
      event.preventDefault();
      handlePaste();
    });

    // Also listen for beforeinput events which can capture paste operations
    document.addEventListener("beforeinput", (event) => {
      if (event.inputType === "insertFromPaste" || event.inputType === "insertCompositionText") {
        event.preventDefault();
        handlePaste();
      }
    });

    // Set focus to document to ensure it can receive paste events
    document.addEventListener("click", () => {
      document.focus();
    });
  }

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

  // Handle Recording Requests
  window.electronAPI.onMessageReceived("start-recording", function () {
    startRecording();
  });

  window.electronAPI.onMessageReceived("stop-recording", function () {
    stopRecording();
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
  const found = data.find((device) => device.id === `${controlIp}|${controlType}`);
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

  // Handle paste shortcut
  const isPasteShortcut =
    (isMacOS && event.metaKey && event.key === "v") ||
    (!isMacOS && event.ctrlKey && event.key === "v");

  if (isPasteShortcut && mod === 0) {
    event.preventDefault();
    handlePaste();
    return;
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

// Handle paste functionality
async function handlePaste() {
  try {
    // Check if we have a valid control connection
    if (!isValidIP(controlIp)) {
      showToast("No streaming device connected for paste operation!", 3000, true);
      return;
    }

    // Read text from clipboard
    const clipboardText = await navigator.clipboard.readText();

    if (!clipboardText || clipboardText.trim() === "") {
      showToast("Clipboard is empty or contains no text!", 3000, true);
      return;
    }

    console.debug(`[Carabiner] Pasting text: "${clipboardText}"`);

    // Type each character using the sendKey function
    await typeText(clipboardText);
  } catch (error) {
    console.error("[Carabiner] Error reading clipboard:", error);
  }
}

// Type text character by character with proper timing
async function typeText(text) {
  // Clean the text by replacing special characters with spaces
  const cleanText = text.replace(/[\r\n\t\v\f]/g, " ");
  if (!cleanText) {
    showToast("No valid text to paste after cleaning special characters", 3000, true);
    return;
  }
  console.debug(`[Carabiner] Cleaned text for pasting: "${cleanText}"`);
  if (controlType === "adb") {
    // For ADB, send the entire text at once to avoid character ordering issues
    window.electronAPI.sendSync("shared-window-channel", {
      type: "send-adb-text",
      payload: cleanText,
    });
  } else if (controlType === "ecp") {
    // For ECP, send character by character
    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      // Type the character
      sendKey(`lit_${encodeURIComponent(char)}`, -1);

      // Add small delay between characters to avoid overwhelming the device
      if (i < cleanText.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
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
