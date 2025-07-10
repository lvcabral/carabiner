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

// Overlay image setup
overlayImage.src = "";
overlayImage.style.display = "none";

// Video recording variables
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

// Device monitoring variables
let currentDeviceList = [];

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

function handleSetTransparency(transparency) {
  // Convert numeric transparency to CSS filter
  let filterValue = "none";
  if (typeof transparency === "number" && transparency > 0 && transparency <= 100) {
    const opacity = 100 - transparency;
    filterValue = `opacity(${opacity}%)`;
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
            deviceId: {
              exact: audioDevice.deviceId,
            },
            noiseSuppression: false,
            echoCancellation: false,
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
      console.debug(err.name + ": " + err.message);
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

  // Clear device label when stream stops
  deviceLabel.textContent = "";
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
  // Ensure the display window gets focus when it loads
  window.focus();

  // Setup device monitoring
  setupDeviceMonitoring();

  navigator.mediaDevices.enumerateDevices().then((devices) => {
    const capture = devices.filter((device) => device.kind === "videoinput");
    currentDeviceList = [...capture]; // Initialize current device list

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

  // Keyboard Events
  document.addEventListener("keydown", keyDownHandler);
  document.addEventListener("keyup", keyUpHandler);

  // Keyboard handlers
  function keyDownHandler(event) {
    if (!event.repeat) {
      // Handle menu shortcuts
      if (handleMenuShortcuts(event)) {
        event.preventDefault();
        return;
      }
      handleKeyboardEvent(event, 0);
    }
  }

  function keyUpHandler(event) {
    handleKeyboardEvent(event, 100);
  }

  function handleMenuShortcuts(event) {
    // Handle context menu shortcuts
    let handled = false;
    const key = event.key.toLowerCase();
    // Copy Screenshot: Ctrl+Shift+C / Cmd+Shift+C
    const isCopyScreenshot =
      (isMacOS && event.metaKey && event.shiftKey && key === "c") ||
      (!isMacOS && event.ctrlKey && event.shiftKey && key === "c");
    if (isCopyScreenshot) {
      handleCopyScreenshot();
      handled = true;
    }
    // Save Screenshot: Ctrl+S / Cmd+S
    const isSaveScreenshot =
      (isMacOS && event.metaKey && !event.shiftKey && key === "s") ||
      (!isMacOS && event.ctrlKey && !event.shiftKey && key === "s");

    if (isSaveScreenshot) {
      handleSaveScreenshot();
      handled = true;
    }
    // Start Recording: Ctrl+Shift+R / Cmd+Shift+R
    const isStartRecording =
      (isMacOS && event.metaKey && event.shiftKey && key === "r") ||
      (!isMacOS && event.ctrlKey && event.shiftKey && key === "r");
    if (isStartRecording) {
      handleStartRecording();
      handled = true;
    }
    // Stop Recording: Ctrl+Shift+S / Cmd+Shift+S
    const isStopRecording =
      (isMacOS && event.metaKey && event.shiftKey && key === "s") ||
      (!isMacOS && event.ctrlKey && event.shiftKey && key === "s");
    if (isStopRecording) {
      handleStopRecording();
      handled = true;
    }
    // Paste: Ctrl+V / Cmd+V
    const isPasteShortcut =
      (isMacOS && event.metaKey && key === "v") || (!isMacOS && event.ctrlKey && key === "v");

    if (isPasteShortcut) {
      handlePaste();
      handled = true;
    }
    // Toggle Fullscreen: F11 / Cmd+Ctrl+F
    const isToggleFullscreen =
      (!isMacOS && event.key === "F11") ||
      (isMacOS && event.metaKey && event.ctrlKey && key === "f");
    if (isToggleFullscreen) {
      window.electronAPI.send("toggle-fullscreen-window");
      handled = true;
    }
    // Settings: Ctrl+, / Cmd+,
    const isOpenSettings =
      (isMacOS && event.metaKey && key === ",") || (!isMacOS && event.ctrlKey && key === ",");
    if (isOpenSettings) {
      window.electronAPI.send("open-settings-from-display");
      handled = true;
    }
    // Toggle Fullscreen: F11 / Cmd+Ctrl+F
    const isOpenDevTools =
      (!isMacOS && event.key === "F12") ||
      (isMacOS && event.metaKey && event.altKey && key === "i");
    if (isOpenDevTools) {
      window.electronAPI.send("open-display-devtools");
      handled = true;
    }

    return handled;
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

  // Handle copy screenshot functionality
  function handleCopyScreenshot() {
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
          console.debug(`error copying screenshot to clipboard: ${err.message}`);
        });
    });
  }

  // Handle save screenshot functionality
  function handleSaveScreenshot() {
    const canvas = getScreenshotCanvas();
    const now = new Date();
    const datePart = now.toLocaleDateString("en-CA");
    const timePart = now.toLocaleTimeString("en-CA", { hour12: false }).replace(/:/g, "");
    const filename = `carabiner-${datePart}-${timePart}.png`;

    canvas.toBlob(async function (blob) {
      try {
        // Convert blob to base64 using FileReader
        const reader = new FileReader();
        reader.onload = async function () {
          try {
            const imageData = reader.result; // This is already a data URL with base64

            // Use the new save dialog with default path
            const result = await window.electronAPI.invoke(
              "save-screenshot-dialog",
              filename,
              imageData
            );

            if (result.success) {
              showToast(
                `Screenshot saved as ${filename}. Click to open containing folder.`,
                5000,
                false,
                () => {
                  window.electronAPI.invoke("open-containing-folder", result.filePath);
                }
              );
            } else if (!result.canceled) {
              showToast("Failed to save screenshot", 3000, true);
            }
          } catch (error) {
            console.error("Error saving screenshot:", error);
            showToast("Failed to save screenshot", 3000, true);
          }
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error("Error saving screenshot:", error);
        showToast("Failed to save screenshot", 3000, true);
      }
    });
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
      // Type each character using the sendKey function
      await typeText(clipboardText);
    } catch (error) {
      console.error("[Carabiner] Error reading clipboard:", error);
    }
  }

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
  function handleStartRecording() {
    if (isRecording || !videoPlayer.srcObject) {
      console.debug("[Carabiner] Cannot start recording: already recording or no video stream");
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

  function handleStopRecording() {
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
        showToast(
          `Recording saved as ${filename}. Click to open containing folder.`,
          5000,
          false,
          () => {
            window.electronAPI.invoke("open-containing-folder", result.filePath);
          }
        );
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

  // Handle copy and save screenshot requests
  window.electronAPI.onMessageReceived("copy-screenshot", handleCopyScreenshot);
  window.electronAPI.onMessageReceived("save-screenshot", handleSaveScreenshot);

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
  window.electronAPI.onMessageReceived("handle-paste", handlePaste);

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
      window.focus();
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
  window.electronAPI.onMessageReceived("start-recording", handleStartRecording);
  window.electronAPI.onMessageReceived("stop-recording", handleStopRecording);

  // Start device monitoring
  setupDeviceMonitoring();
});

// Handle window lifecycle events
window.addEventListener("beforeunload", () => {
  // Cleanup is handled automatically by the browser
});

window.addEventListener("unload", () => {
  // Cleanup is handled automatically by the browser
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
function showToast(message, duration = 3000, error = false, onClick = null) {
  try {
    let style = null;
    if (error) {
      style = {
        color: "#fff",
        background: "#b61717",
      };
    }

    const toastConfig = {
      text: message,
      duration: duration,
      close: false,
      gravity: "bottom",
      position: "center",
      stopOnFocus: false,
      style: style,
    };

    // Add onClick handler if provided
    if (onClick && typeof onClick === "function") {
      toastConfig.onClick = onClick;
    }
    const toastInstance = Toastify(toastConfig);
    toastInstance.showToast();
  } catch (error) {
    console.error("Error showing toast:", error.message);
  }
}

// Monitor device changes using Chrome's native devicechange event
let deviceChangeTimeout;
const DEVICE_CHANGE_DEBOUNCE_DELAY = 250; // Debounce device changes to prevent cascading updates

function setupDeviceMonitoring() {
  navigator.mediaDevices.addEventListener("devicechange", async () => {
    // Clear any existing timeout to debounce rapid device changes
    clearTimeout(deviceChangeTimeout);

    // Small delay to ensure device enumeration is stable and prevent cascading updates
    deviceChangeTimeout = setTimeout(async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const captureDevices = devices.filter((device) => device.kind === "videoinput");
        updateCaptureDeviceList(captureDevices);
      } catch (error) {
        console.error("[Carabiner] Error handling device change:", error);
      }
    }, DEVICE_CHANGE_DEBOUNCE_DELAY);
  });
  console.debug("[Carabiner] Device monitoring enabled using native devicechange events");
}

function updateCaptureDeviceList(captureDevices) {
  const previousCount = currentDeviceList.length;
  const newCount = captureDevices.length;
  const currentDeviceId =
    currentConstraints?.video?.deviceId?.exact || currentConstraints?.video?.deviceId;
  const currentDeviceStillExists = captureDevices.find((d) => d.deviceId === currentDeviceId);

  // Check if device list actually changed (same count and same device IDs)
  if (previousCount === newCount) {
    const previousIds = currentDeviceList.map((d) => d.deviceId).sort();
    const newIds = captureDevices.map((d) => d.deviceId).sort();
    const listsAreIdentical =
      previousIds.length === newIds.length &&
      previousIds.every((id, index) => id === newIds[index]);

    if (listsAreIdentical) {
      return; // No changes detected, skip update
    }
  }

  // Log significant device changes
  if (newCount > previousCount) {
    console.debug(
      `[Carabiner] ${newCount - previousCount} capture device(s) connected (total: ${newCount})`
    );
  } else if (newCount < previousCount) {
    console.debug(
      `[Carabiner] ${previousCount - newCount} capture device(s) disconnected (total: ${newCount})`
    );
  }

  // Update the current device list
  currentDeviceList = [...captureDevices];

  // Always notify main process of device changes to keep menus updated
  window.electronAPI.sendSync("shared-window-channel", {
    type: "set-capture-devices",
    payload: JSON.stringify(captureDevices),
  });

  // Only update UI elements when necessary to prevent screen flash
  let shouldUpdateUI = false;

  // Handle device list updates
  if (captureDevices.length === 0) {
    // No devices available
    overlayImage.style.opacity = "1";
    overlayImage.src = "images/no-capture-device.png";
    showToast("No capture devices available!", 5000, true);

    // Stop current video stream if no devices
    if (videoState !== "stopped") {
      stopVideoStream();
    }
    shouldUpdateUI = true;
  } else {
    // Devices available
    if (overlayImage.src.includes("no-capture-device.png")) {
      overlayImage.style.opacity = "0";
      overlayImage.src = "";
    }

    // Check if current device is still available
    if (currentDeviceId && !currentDeviceStillExists && videoState !== "stopped") {
      // Current device was disconnected, stop stream and update UI
      stopVideoStream();
      showToast("Current capture device was disconnected!", 3000, true);
      shouldUpdateUI = true;
    } else if (newCount > previousCount) {
      // New device connected - show toast but don't update UI to avoid flash
      showToast(`New capture device connected: ${captureDevices.length} device(s) available`);
      // Only update UI if this is the first device (going from 0 to 1+)
      shouldUpdateUI = previousCount === 0;
    } else if (newCount < previousCount && currentDeviceId && currentDeviceStillExists) {
      // Device was removed but current device is still available - show toast but don't refresh UI
      showToast(`Capture device disconnected: ${captureDevices.length} device(s) remaining`);
      // Don't update UI to avoid flash
      shouldUpdateUI = false;
    } else if (newCount < previousCount) {
      // Device was removed and we need to update (either no current device or current was removed)
      shouldUpdateUI = true;
    }
  }

  // Note: Main process has already been notified above to keep menus updated
  // UI updates are handled separately to prevent unnecessary display refreshes
}
