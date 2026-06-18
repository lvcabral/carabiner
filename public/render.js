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
const reconnectingOverlay = document.getElementById("reconnecting-overlay");
const settingsButton = document.getElementById("settings-button");
const deviceLabel = document.getElementById("device-label");
const recordingIndicator = document.getElementById("recording-indicator");
const scriptRecordingIndicator = document.getElementById("script-recording-indicator");
const scriptPlaybackIndicator = document.getElementById("script-playback-indicator");
const isMacOS = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

// Indicators share a single anchor (top-left) and reflow left-to-right in the
// order they were activated, so whichever turned on first sits at the anchor and
// later ones appear to its right. When an earlier one ends, the rest shift back.
let indicatorOrderSeq = 0;

function toggleIndicator(el, animClass, on) {
  if (on) {
    el.style.order = String(++indicatorOrderSeq);
    el.classList.add(animClass);
    el.style.display = "block";
  } else {
    el.style.display = "none";
    el.classList.remove(animClass);
  }
}

function setVideoRecordingIndicator(on) {
  toggleIndicator(recordingIndicator, "recording-active", on);
}

function setScriptRecordingIndicator(on) {
  toggleIndicator(scriptRecordingIndicator, "recording-active", on);
}

function setScriptPlaybackIndicator(on) {
  toggleIndicator(scriptPlaybackIndicator, "playback-active", on);
}

function showReconnectingOverlay() {
  reconnectingOverlay.style.display = "flex";
}

function hideReconnectingOverlay() {
  reconnectingOverlay.style.display = "none";
}

const widthOff = 16;
const heightOff = 9;
const margin = 5;
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
// When recording is driven by the MCP server, save without a dialog and report the path back.
let mcpRecording = false;
let mcpRecordingPrefix = "";
let mcpStopRecordingResolve = null;
let mcpStopRecordingReject = null;

// Device monitoring variables
let currentDeviceList = [];

// Fullscreen state
let isFullScreen = false;
let savedBorderStyle = { width: "0.1px", style: "solid" };

// Key press overlay variables
let showKeystrokes = false;
const MAX_KEY_INDICATORS = 3;
let activeKeyIndicators = [];

const ECP_DISPLAY_NAMES = {
  up: "Up", down: "Down", left: "Left", right: "Right",
  select: "OK", back: "Back", home: "Home",
  play: "Play", pause: "Pause", playpause: "Play/Pause",
  fwd: "Fwd", rev: "Rev", replay: "Replay", instantreplay: "Replay",
  info: "*", search: "Search", backspace: "⌫", enter: "Enter",
  volumeup: "Vol+", volumedown: "Vol-", volumemute: "Mute",
  channelup: "Ch+", channeldown: "Ch-", findremote: "Find Remote",
  poweroff: "Power", a: "A", b: "B", c: "C", d: "D",
};

const ADB_DISPLAY_NAMES = {
  "3": "Home", "4": "Back",
  "19": "Up", "20": "Down", "21": "Left", "22": "Right",
  "66": "OK", "67": "⌫",
  "85": "Play", "86": "Stop", "87": "Next", "88": "Prev",
  "89": "Rev", "90": "Fwd",
  "91": "Vol+", "92": "Vol-", "164": "Mute",
  "1": "Menu",
};

const ATV_DISPLAY_NAMES = {
  up: "Up", down: "Down", left: "Left", right: "Right",
  select: "OK", menu: "Back", home: "Home",
  play_pause: "Play/Pause", volume_up: "Vol+", volume_down: "Vol-",
  top_menu: "Top Menu", previous: "Prev", next: "Next",
};

function formatDeviceKeyLabel(key, type) {
  if (type === "ecp") {
    return ECP_DISPLAY_NAMES[key.toLowerCase()] || key.charAt(0).toUpperCase() + key.slice(1);
  }
  if (type === "atv") {
    return ATV_DISPLAY_NAMES[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  // ADB: numeric keycodes → readable name
  if (ADB_DISPLAY_NAMES[key]) return ADB_DISPLAY_NAMES[key];
  const code = parseInt(key, 10);
  if (!isNaN(code)) {
    if (code >= 29 && code <= 54) return String.fromCharCode(code + 36); // A–Z
    if (code >= 7 && code <= 16) return String(code - 7); // 0–9
  }
  // Non-numeric ADB value (e.g. special chars like "\\<")
  return key.replace(/^\\/, "");
}

function displayKeyIndicator(label) {
  const overlay = document.getElementById("key-overlay");
  if (!overlay) return;
  if (activeKeyIndicators.length >= MAX_KEY_INDICATORS) {
    const oldest = activeKeyIndicators.shift();
    oldest.remove();
  }
  const el = document.createElement("div");
  el.className = "key-indicator";
  el.textContent = label;
  overlay.appendChild(el);
  activeKeyIndicators.push(el);
  el.addEventListener("animationend", () => {
    el.remove();
    activeKeyIndicators = activeKeyIndicators.filter((x) => x !== el);
  });
}

// Script recording/playback variables
let isScriptRecording = false;
let currentScriptSteps = [];
let currentScriptControlType = "";
let currentScriptId = null;
let lastKeyTimestamp = null;
let isPlayingScript = false;
let scriptPlaybackCancelled = false;

// Load settings from main process
window.electronAPI.invoke("load-settings").then(async (settings) => {
  if (settings.control && settings.control.deviceId) {
    handleControlSelected(settings.control.deviceId);
  }
  if (settings.display && settings.display.audioEnabled !== undefined) {
    audioEnabled = settings.display.audioEnabled;
    // Note: updateAudioConstraints() will be called when video stream is set
  }
  if (settings.display && settings.display.showKeystrokes !== undefined) {
    showKeystrokes = settings.display.showKeystrokes;
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

function adjustVideoLayout() {
  const B = parseFloat(getComputedStyle(videoPlayer).borderWidth) || 0;
  const elementHeight = parseFloat(videoPlayer.style.height) || (window.innerHeight - heightOff);
  if (B > 0.5) {
    // Widen the element so the content area inside the border stays 16:9
    const contentHeight = elementHeight - 2 * B;
    const contentWidth = contentHeight * 16 / 9;
    const elementWidth = contentWidth + 2 * B;
    videoPlayer.style.width = `${elementWidth}px`;
    videoPlayer.style.left = `${(window.innerWidth - elementWidth) / 2}px`;
  } else {
    videoPlayer.style.width = `${window.innerWidth - widthOff}px`;
    videoPlayer.style.left = `${widthOff / 2}px`;
  }
}

function handleSetResolution(style) {
  videoPlayer.style.height = style.height;
  if (isFullScreen) {
    videoPlayer.style.top = "0px";
    videoPlayer.style.left = "0px";
    videoPlayer.style.width = style.width;
  } else {
    videoPlayer.style.top = `${heightOff / 2}px`;
    adjustVideoLayout();
  }
  document.body.style.width = style.width;
  document.body.style.height = style.height;
  updateOverlayPosition();
}

window.addEventListener("resize", () => {
  const newWidth = window.innerWidth - widthOff;
  const newHeight = window.innerHeight - heightOff;
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
  adjustVideoLayout();
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
        } else {
          // If no matching audio device found, disable audio to avoid using microphone
          currentConstraints.audio = false;
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
  "set-show-keystrokes": (payload) => { showKeystrokes = payload; },
};

function renderDisplay(constraints, isBlankRetry = false) {
  const deviceId = constraints.video?.deviceId?.exact || constraints.video?.deviceId;
  window.electronAPI.log("debug",
    `[Carabiner] renderDisplay called - deviceId: ${deviceId || "default"}, videoState: ${videoState}, isBlankRetry: ${isBlankRetry}`
  );
  if (videoState !== "stopped") {
    window.electronAPI.log("debug","[Carabiner] Stopping existing stream before starting new one");
    stopVideoStream();
  }
  videoState = "starting";
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(async (stream) => {
      const videoTrack = stream.getVideoTracks()[0];
      window.electronAPI.log("debug",
        `[Carabiner] getUserMedia succeeded - track: "${videoTrack?.label}", readyState: ${videoTrack?.readyState}, enabled: ${videoTrack?.enabled}, muted: ${videoTrack?.muted}`
      );
      hideReconnectingOverlay();
      deviceLabel.textContent = await getCaptureDeviceLabel(deviceId);
      videoPlayer.srcObject = null; // Release any previous stream before assigning new one
      videoPlayer.srcObject = stream;
      const playPromise = videoPlayer.play();
      if (playPromise) {
        playPromise
          .then(() =>
            window.electronAPI.log("debug",
              `[Carabiner] videoPlayer.play() resolved - videoWidth: ${videoPlayer.videoWidth}, videoHeight: ${videoPlayer.videoHeight}`
            )
          )
          .catch((err) => console.error("[Carabiner] videoPlayer.play() failed:", err.message));
      }
      currentConstraints = constraints;
      videoState = "playing";
      if (deviceId) {
        lastKnownDeviceId = deviceId;
        deviceRecoveryAttempts = 0;
        window.electronAPI.log("debug",`[Carabiner] lastKnownDeviceId set to: ${deviceId.slice(0, 8)}...`);
      }
      // Monitor track for unexpected end (e.g., device disconnected while playing)
      if (videoTrack) {
        videoTrack.addEventListener("ended", () => {
          window.electronAPI.log("debug",
            `[Carabiner] Video track ended unexpectedly (videoState was: ${videoState}, videoWidth: ${videoPlayer.videoWidth})`
          );
          if (videoState !== "stopped") {
            videoState = "stopped";
            // Show reconnecting overlay immediately so the user knows to wait.
            // It will be hidden by renderDisplay() when recovery succeeds or fails.
            if (lastKnownDeviceId) {
              showReconnectingOverlay();
            }
          }
        });
      }
      // Check if stream is actually delivering frames 3 seconds after play starts.
      // The device may appear in enumerateDevices before it is fully ready to stream,
      // causing getUserMedia to succeed but the video to remain blank.
      setTimeout(() => {
        if (videoState === "playing" && videoPlayer.videoWidth === 0 && !isBlankRetry) {
          window.electronAPI.log("debug",
            "[Carabiner] Stream appears blank (videoWidth=0 after 3s) - retrying renderDisplay once"
          );
          renderDisplay(constraints, true);
        } else if (videoState === "playing") {
          window.electronAPI.log("debug",
            `[Carabiner] Stream health check OK - ${videoPlayer.videoWidth}x${videoPlayer.videoHeight}`
          );
        } else {
          window.electronAPI.log("debug",
            `[Carabiner] Stream health check skipped - videoState is now: ${videoState}`
          );
        }
      }, 3000);
    })
    .catch((err) => {
      console.error(`[Carabiner] getUserMedia failed: ${err.name} - ${err.message}`);
      hideReconnectingOverlay();
      showToast(`Error loading capture device! ${err.message}`, 5000, true);
      videoState = "stopped";
      // Show fallback image when capture device fails to load
      overlayImage.style.opacity = "1";
      overlayImage.src = "images/no-capture-device.png";
      overlayImage.style.display = "block";
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

  // Handle both direct deviceId and deviceId.exact formats
  const actualDeviceId = typeof deviceId === "object" && deviceId.exact ? deviceId.exact : deviceId;

  const devices = await navigator.mediaDevices.enumerateDevices();
  const captureDevice = devices.find(
    (device) => device.deviceId === actualDeviceId && device.kind === "videoinput"
  );
  let deviceLabel = captureDevice ? captureDevice.label : "Unknown Device";
  const streamDevice = controlList.find((device) => device.linked === captureDevice?.deviceId);
  if (streamDevice) {
    deviceLabel += ` - ${streamDevice.type} ${streamDevice.alias ?? streamDevice.ipAddress}`;
  }
  return deviceLabel;
}

window.addEventListener("DOMContentLoaded", function () {
  // Ensure the display window gets focus when it loads
  window.focus();

  // Auto-pause capture so the Mac can sleep (issue #91). Main triggers these on
  // screen lock / user idle, and resume on unlock / activity. Kept separate from
  // window-hide/show so it doesn't disturb script recording or window state.
  window.electronAPI.onMessageReceived("auto-suspend", () => {
    if (videoState !== "stopped") {
      stopVideoStream();
    }
  });

  window.electronAPI.onMessageReceived("auto-resume", () => {
    if (videoState === "stopped" && currentConstraints && currentConstraints.video) {
      const hasSpecificDevice =
        currentConstraints.video !== true &&
        typeof currentConstraints.video === "object" &&
        currentConstraints.video.deviceId;

      if (hasSpecificDevice) {
        renderDisplay(currentConstraints);
      }
    }
  });

  // Handle window visibility changes via Electron IPC events
  window.electronAPI.onMessageReceived("window-show", () => {
    // Window is now visible - restart video stream if we have constraints and it's stopped
    if (videoState === "stopped" && currentConstraints && currentConstraints.video) {
      // Only restart if we have a proper video stream constraint (not just the default { video: true })
      const hasSpecificDevice =
        currentConstraints.video !== true &&
        typeof currentConstraints.video === "object" &&
        currentConstraints.video.deviceId;

      if (hasSpecificDevice) {
        renderDisplay(currentConstraints);
      }
    }
  });

  window.electronAPI.onMessageReceived("window-hide", () => {
    // Window is hidden - stop video stream to save resources
    if (videoState !== "stopped") {
      stopVideoStream();
    }
    if (isScriptRecording) {
      isScriptRecording = false;
      setScriptRecordingIndicator(false);
      currentScriptSteps = [];
      currentScriptId = null;
      window.electronAPI.send("script-recording-state-changed", false);
      showToast("Script recording cancelled.", 3000, true);
    }
  });

  window.electronAPI.onMessageReceived("window-minimize", () => {
    // Window is minimized - stop video stream to save resources
    if (videoState !== "stopped") {
      stopVideoStream();
    }
    if (isScriptRecording) {
      isScriptRecording = false;
      setScriptRecordingIndicator(false);
      currentScriptSteps = [];
      currentScriptId = null;
      window.electronAPI.send("script-recording-state-changed", false);
      showToast("Script recording cancelled.", 3000, true);
    }
  });

  window.electronAPI.onMessageReceived("window-restore", () => {
    // Window is restored from minimized - restart video stream if we have constraints and it's stopped
    if (videoState === "stopped" && currentConstraints && currentConstraints.video) {
      // Only restart if we have a proper video stream constraint (not just the default { video: true })
      const hasSpecificDevice =
        currentConstraints.video !== true &&
        typeof currentConstraints.video === "object" &&
        currentConstraints.video.deviceId;

      if (hasSpecificDevice) {
        renderDisplay(currentConstraints);
      }
    }
  });

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
      overlayImage.style.display = "block";
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

  // Script recording IPC listeners
  window.electronAPI.onMessageReceived("start-script-recording", () => {
    if (isScriptRecording) return;
    isScriptRecording = true;
    currentScriptSteps = [];
    currentScriptControlType = controlType;
    currentScriptId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    lastKeyTimestamp = Date.now();
    setScriptRecordingIndicator(true);
    window.electronAPI.send("script-recording-state-changed", true);
    showToast("Script recording started...");
  });

  window.electronAPI.onMessageReceived("stop-script-recording", () => {
    if (!isScriptRecording) return;
    isScriptRecording = false;
    setScriptRecordingIndicator(false);
    if (currentScriptSteps.length === 0) {
      showToast("Script has no steps. Recording discarded.", 3000, true);
      currentScriptId = null;
      window.electronAPI.send("script-recording-state-changed", false);
      return;
    }
    window.electronAPI.send("save-script", {
      id: currentScriptId,
      name: "",
      controlType: currentScriptControlType,
      steps: currentScriptSteps,
    });
    currentScriptSteps = [];
    currentScriptId = null;
    showToast("Script saved!");
  });

  window.electronAPI.onMessageReceived("play-script", (_, payload) => {
    if (isScriptRecording) {
      showToast("Cannot play script while recording.", 3000, true);
      return;
    }
    playScript(payload.steps, payload.controlType).then(() => {
      window.electronAPI.send("script-playback-done", payload.id);
    });
  });

  window.electronAPI.onMessageReceived("discard-script-recording", () => {
    isScriptRecording = false;
    setScriptRecordingIndicator(false);
    currentScriptSteps = [];
    currentScriptId = null;
    window.electronAPI.send("script-recording-state-changed", false);
  });

  window.electronAPI.onMessageReceived("stop-script", () => {
    scriptPlaybackCancelled = true;
  });

  const newWidth = window.innerWidth - widthOff;
  const newHeight = window.innerHeight - heightOff;
  handleSetResolution({ width: `${newWidth}px`, height: `${newHeight}px` });

  // Keyboard Events
  document.addEventListener("keydown", keyDownHandler);
  document.addEventListener("keyup", keyUpHandler);

  // Keyboard handlers
  function keyDownHandler(event) {
    if (event.key === "Tab") {
      event.preventDefault();
      return;
    }
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
    // Start Script Recording: Ctrl+Shift+A / Cmd+Shift+A
    const isStartScriptRecording =
      (isMacOS && event.metaKey && event.shiftKey && key === "a") ||
      (!isMacOS && event.ctrlKey && event.shiftKey && key === "a");
    if (isStartScriptRecording) {
      window.electronAPI.send("start-script-recording");
      handled = true;
    }
    // Stop Script Recording: Ctrl+Shift+Z / Cmd+Shift+Z
    const isStopScriptRecording =
      (isMacOS && event.metaKey && event.shiftKey && key === "z") ||
      (!isMacOS && event.ctrlKey && event.shiftKey && key === "z");
    if (isStopScriptRecording) {
      window.electronAPI.send("stop-script-recording");
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
        if (mod === 0 && showKeystrokes) displayKeyIndicator(formatDeviceKeyLabel(key, "ecp"));
        recordScriptStep(key, mod);
        sendKey(key, mod);
      } else if (
        !["Alt", "Control", "Meta", "Shift", "Tab", "Dead"].includes(event.key) &&
        mod === 0
      ) {
        if (showKeystrokes) displayKeyIndicator(event.key.toUpperCase());
        const litKey = `lit_${encodeURIComponent(event.key)}`;
        recordScriptStep(litKey, -1);
        sendKey(litKey, -1);
      }
    } else if (controlType === "adb") {
      const key = adbKeysMap.get(keyCode);
      if (key) {
        if (mod === 0 && showKeystrokes) displayKeyIndicator(formatDeviceKeyLabel(key, "adb"));
        recordScriptStep(key, mod);
        sendKey(key, mod);
      }
    } else if (controlType === "atv") {
      const key = atvKeysMap.get(keyCode);
      if (key && mod === 0) {
        if (showKeystrokes) displayKeyIndicator(formatDeviceKeyLabel(key, "atv"));
        recordScriptStep(key, mod);
        sendKey(key, mod);
      } else if (event.key.length === 1 && mod === 0) {
        if (showKeystrokes) displayKeyIndicator(event.key.toUpperCase());
        const litKey = `lit_${encodeURIComponent(event.key)}`;
        recordScriptStep(litKey, -1);
        sendKey(litKey, -1);
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
          window.electronAPI.log("debug",`error copying screenshot to clipboard: ${err.message}`);
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
      if (!controlIp) {
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
      window.electronAPI.log("debug","[Carabiner] Cannot start recording: already recording or no video stream");
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
        setVideoRecordingIndicator(false); // Hide recording indicator on error
        window.electronAPI.send("recording-state-changed", isRecording);
      };

      mediaRecorder.start();
      isRecording = true;
      setVideoRecordingIndicator(true); // Show recording indicator
      window.electronAPI.send("recording-state-changed", isRecording);
      showToast("Recording started...");
    } catch (error) {
      console.error("[Carabiner] Error starting recording:", error);
      showToast("Failed to start recording!", 5000, true);
      isRecording = false;
      setVideoRecordingIndicator(false); // Hide recording indicator on error
      window.electronAPI.send("recording-state-changed", isRecording);
    }
  }

  function handleStopRecording() {
    if (!isRecording || !mediaRecorder) {
      window.electronAPI.log("debug","[Carabiner] Cannot stop recording: not currently recording");
      return;
    }

    try {
      mediaRecorder.stop();
      isRecording = false;
      setVideoRecordingIndicator(false); // Hide recording indicator
      window.electronAPI.send("recording-state-changed", isRecording);
    } catch (error) {
      console.error("[Carabiner] Error stopping recording:", error);
      showToast("Error stopping recording!", 5000, true);
      isRecording = false;
      setVideoRecordingIndicator(false); // Hide recording indicator on error
      window.electronAPI.send("recording-state-changed", isRecording);
    }
  }

  function settleMcpRecording(error, filePath) {
    const resolve = mcpStopRecordingResolve;
    const reject = mcpStopRecordingReject;
    mcpStopRecordingResolve = null;
    mcpStopRecordingReject = null;
    mcpRecording = false;
    mcpRecordingPrefix = "";
    if (error) {
      reject?.(error instanceof Error ? error : new Error(String(error)));
    } else {
      resolve?.({ filePath });
    }
  }

  async function saveRecording() {
    if (recordedChunks.length === 0) {
      showToast("No recording data to save!", 5000, true);
      if (mcpRecording) settleMcpRecording(new Error("No recording data to save."));
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

      const prefix = mcpRecording && mcpRecordingPrefix ? mcpRecordingPrefix : "carabiner-recording";
      const filename = `${prefix}-${datePart}-${timePart}.${extension}`;

      // Convert blob to buffer for saving
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Convert to regular array for IPC serialization
      const bufferData = Array.from(uint8Array);

      // MCP-driven recording: save without a dialog and report the path back to the caller.
      if (mcpRecording) {
        const directResult = await window.electronAPI.invoke("save-video-direct", filename, bufferData);
        recordedChunks = [];
        if (directResult.success) {
          showToast(`Recording saved as ${filename}.`, 5000, false, () => {
            window.electronAPI.invoke("open-containing-folder", directResult.filePath);
          });
          settleMcpRecording(null, directResult.filePath);
        } else {
          showToast("Failed to save recording!", 5000, true);
          settleMcpRecording(new Error(directResult.error || "Failed to save recording."));
        }
        return;
      }

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
        window.electronAPI.log("debug","[Carabiner] Recording saved:", result.filePath);
      } else if (result.canceled) {
        // User canceled - don't show any message
        window.electronAPI.log("debug","[Carabiner] Recording save canceled by user");
      } else {
        showToast("Failed to save recording!", 5000, true);
        console.error("[Carabiner] Error saving recording:", result.error);
      }

      recordedChunks = [];
    } catch (error) {
      console.error("[Carabiner] Error saving recording:", error);
      showToast("Failed to save recording!", 5000, true);
      recordedChunks = [];
      if (mcpRecording) settleMcpRecording(error);
    }
  }

  // Handle copy and save screenshot requests
  window.electronAPI.onMessageReceived("copy-screenshot", handleCopyScreenshot);
  window.electronAPI.onMessageReceived("save-screenshot", handleSaveScreenshot);

  // Handle MCP server requests routed through the main process (request/response RPC).
  window.electronAPI.onMessageReceived("mcp-rpc-request", async (_, { requestId, action, params }) => {
    try {
      let result;
      switch (action) {
        case "capture-screenshot": {
          if (!videoPlayer || !videoPlayer.videoWidth) {
            throw new Error("No active video stream to capture.");
          }
          result = getScreenshotCanvas().toDataURL("image/png");
          break;
        }
        case "send-key":
          sendKey(params.key, params.mod ?? 0);
          result = { sent: params.key };
          break;
        case "send-text":
          await typeText(params.text);
          result = { sent: params.text };
          break;
        case "start-recording": {
          if (isRecording) throw new Error("Already recording.");
          if (!videoPlayer || !videoPlayer.srcObject) {
            throw new Error("No active video stream to record.");
          }
          mcpRecording = true;
          mcpRecordingPrefix = params?.filenamePrefix || "";
          handleStartRecording();
          if (!isRecording) {
            mcpRecording = false;
            mcpRecordingPrefix = "";
            throw new Error("Failed to start recording.");
          }
          result = { recording: true };
          break;
        }
        case "stop-recording": {
          if (!isRecording) throw new Error("Not currently recording.");
          const done = new Promise((resolve, reject) => {
            mcpStopRecordingResolve = resolve;
            mcpStopRecordingReject = reject;
          });
          handleStopRecording();
          result = await done; // { filePath }
          break;
        }
        default:
          throw new Error(`Unknown MCP action: ${action}`);
      }
      window.electronAPI.send("mcp-rpc-response", { requestId, result });
    } catch (error) {
      window.electronAPI.send("mcp-rpc-response", { requestId, error: error.message });
    }
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
  overlayImage.style.objectFit = "contain";
  overlayImage.style.pointerEvents = "auto";
  overlayImage.style.opacity = "0";
  overlayImage.style.zIndex = "700";

  // Prevent browser-native HTML5 drag of <img>/<video> elements
  document.addEventListener("dragstart", (e) => e.preventDefault());

  // Detect double-click via mousedown timing. dblclick events are not reliable on
  // -webkit-app-region:drag elements, but mousedown fires before drag detection runs.
  // The position check prevents triggering during a drag-then-click sequence.
  let lastMouseDownTime = 0;
  let lastMouseDownX = 0;
  let lastMouseDownY = 0;
  document.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    if (settingsButton.contains(event.target)) return;
    const now = Date.now();
    const dx = event.clientX - lastMouseDownX;
    const dy = event.clientY - lastMouseDownY;
    if (now - lastMouseDownTime < 400 && Math.abs(dx) <= 8 && Math.abs(dy) <= 8) {
      window.electronAPI.send("toggle-fullscreen-window");
      lastMouseDownTime = 0;
    } else {
      lastMouseDownTime = now;
      lastMouseDownX = event.clientX;
      lastMouseDownY = event.clientY;
    }
  });

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

  // Handle right-click context menu for entire window
  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    window.electronAPI.showContextMenu();
  });

  // Handle fullscreen state changes
  window.electronAPI.onMessageReceived("enter-full-screen", () => {
    isFullScreen = true;
    savedBorderStyle = {
      width: videoPlayer.style.borderWidth,
      style: videoPlayer.style.borderStyle,
    };
    videoPlayer.style.borderWidth = "0px";
    videoPlayer.style.borderStyle = "none";
    handleSetResolution({ width: `${window.innerWidth}px`, height: `${window.innerHeight}px` });
  });

  window.electronAPI.onMessageReceived("leave-full-screen", () => {
    isFullScreen = false;
    videoPlayer.style.borderWidth = savedBorderStyle.width || "0.1px";
    videoPlayer.style.borderStyle = savedBorderStyle.style || "solid";
    const w = window.innerWidth - widthOff;
    const h = window.innerHeight - heightOff;
    handleSetResolution({ width: `${w}px`, height: `${h}px` });
  });

  // Handle Recording Requests
  window.electronAPI.onMessageReceived("start-recording", handleStartRecording);
  window.electronAPI.onMessageReceived("stop-recording", handleStopRecording);

  // Start device monitoring
  setupDeviceMonitoring();
});

// Video Events
videoPlayer.addEventListener("loadstart", () => {
  // Only advance to "loading" from the explicit "starting" state.
  // A second loadstart fired by a capture card resetting mid-initialization
  // must not downgrade an already-playing or already-stopped stream.
  if (videoState === "starting") {
    videoState = "loading";
  }
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

// Apple TV Keyboard Mapping (pyatv / atvremote command names)
const atvKeysMap = new Map();
atvKeysMap.set("ArrowUp", "up");
atvKeysMap.set("ArrowDown", "down");
atvKeysMap.set("ArrowLeft", "left");
atvKeysMap.set("ArrowRight", "right");
atvKeysMap.set("Enter", "select");
atvKeysMap.set("Escape", "menu");
atvKeysMap.set("Delete", "menu");
atvKeysMap.set("Home", "home");
atvKeysMap.set("Shift+Escape", "home");
atvKeysMap.set("Control+Escape", "home");
atvKeysMap.set("End", "play_pause");
atvKeysMap.set("PageUp", "volume_up");
atvKeysMap.set("PageDown", "volume_down");
atvKeysMap.set("Insert", "top_menu");
if (isMacOS) {
  atvKeysMap.set("Command+Enter", "play_pause");
  atvKeysMap.set("Command+ArrowLeft", "previous");
  atvKeysMap.set("Command+ArrowRight", "next");
} else {
  atvKeysMap.set("Control+Enter", "play_pause");
  atvKeysMap.set("Control+ArrowLeft", "previous");
  atvKeysMap.set("Control+ArrowRight", "next");
}

// Type text character by character with proper timing
async function typeText(text) {
  // Clean the text by replacing special characters with spaces
  const cleanText = text.replace(/[\r\n\t\v\f]/g, " ");
  if (!cleanText) {
    showToast("No valid text to paste after cleaning special characters", 3000, true);
    return;
  }
  window.electronAPI.log("debug",`[Carabiner] Cleaned text for pasting: "${cleanText}"`);
  if (controlType === "adb") {
    // For ADB, send the entire text at once to avoid character ordering issues
    window.electronAPI.sendSync("shared-window-channel", {
      type: "send-adb-text",
      payload: cleanText,
    });
  } else if (controlType === "atv") {
    // For ATV, send the entire text at once via text_append (requires Companion protocol)
    window.electronAPI.sendSync("shared-window-channel", {
      type: "send-atv-text",
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

function recordScriptStep(key, mod) {
  if (!isScriptRecording) return;
  const delay = currentScriptSteps.length === 0 ? 0 : Date.now() - lastKeyTimestamp;
  currentScriptSteps.push({ key, mod, delay });
  lastKeyTimestamp = Date.now();
}

async function playScript(steps, scriptControlType) {
  if (!steps || steps.length === 0) {
    showToast("Script has no steps.", 2000, true);
    return;
  }
  if (!controlIp) {
    showToast("No device connected for script playback!", 3000, true);
    return;
  }
  if (isPlayingScript) {
    showToast("A script is already playing.", 2000, true);
    return;
  }
  if (scriptControlType && scriptControlType !== controlType) {
    showToast(
      `Warning: Script recorded for ${scriptControlType.toUpperCase()}, current device is ${controlType.toUpperCase()}.`,
      4000,
      true
    );
  }
  isPlayingScript = true;
  scriptPlaybackCancelled = false;
  setScriptPlaybackIndicator(true);
  try {
    for (let i = 0; i < steps.length; i++) {
      if (scriptPlaybackCancelled) break;
      if (i > 0 && steps[i].delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(steps[i].delay, 5000)));
      }
      if (scriptPlaybackCancelled) break;
      sendKey(steps[i].key, steps[i].mod);
    }
  } finally {
    isPlayingScript = false;
    scriptPlaybackCancelled = false;
    setScriptPlaybackIndicator(false);
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
  } else if (controlIp && controlType === "atv") {
    if (key.startsWith("lit_") && mod === -1) {
      window.electronAPI.sendSync("shared-window-channel", {
        type: "send-atv-text",
        payload: decodeURIComponent(key.slice(4)),
      });
    } else if (mod === 0) {
      window.electronAPI.sendSync("shared-window-channel", {
        type: "send-atv-key",
        payload: key,
      });
    }
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
const DEVICE_CHANGE_DEBOUNCE_DELAY = 3000; // Wait 3 seconds for monitor wake-up scenarios
let lastKnownDeviceId = null; // Track the last selected device for recovery
let deviceRecoveryAttempts = 0; // Track recovery attempts
const MAX_RECOVERY_ATTEMPTS = 3; // Maximum times to try recovering a device

function setupDeviceMonitoring() {
  navigator.mediaDevices.addEventListener("devicechange", async () => {
    window.electronAPI.log("debug","[Carabiner] devicechange event fired - resetting debounce timer");
    clearTimeout(deviceChangeTimeout);
    deviceChangeTimeout = setTimeout(async () => {
      window.electronAPI.log("debug","[Carabiner] Debounce settled, enumerating devices...");
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const captureDevices = devices.filter((device) => device.kind === "videoinput");
        window.electronAPI.log("debug",
          `[Carabiner] Found ${captureDevices.length} video device(s):`,
          captureDevices.map((d) => `"${d.label || "Unnamed"}" [${d.deviceId.slice(0, 8)}...]`)
        );
        updateCaptureDeviceList(captureDevices);
      } catch (error) {
        console.error("[Carabiner] Error handling device change:", error);
      }
    }, DEVICE_CHANGE_DEBOUNCE_DELAY);
  });
}

function updateCaptureDeviceList(captureDevices) {
  const previousCount = currentDeviceList.length;
  const newCount = captureDevices.length;
  const currentDeviceId =
    currentConstraints?.video?.deviceId?.exact || currentConstraints?.video?.deviceId;
  const currentDeviceStillExists = captureDevices.find((d) => d.deviceId === currentDeviceId);

  window.electronAPI.log("debug",
    `[Carabiner] updateCaptureDeviceList - previous: ${previousCount}, new: ${newCount}, videoState: ${videoState}` +
      `, currentDeviceId: ${currentDeviceId ? currentDeviceId.slice(0, 8) + "..." : "none"}` +
      `, lastKnownDeviceId: ${lastKnownDeviceId ? lastKnownDeviceId.slice(0, 8) + "..." : "none"}` +
      `, currentDeviceStillExists: ${!!currentDeviceStillExists}`
  );

  // Track the last known device ID for recovery
  if (currentDeviceId && currentDeviceStillExists) {
    lastKnownDeviceId = currentDeviceId;
    deviceRecoveryAttempts = 0; // Reset recovery attempts when device is working
    window.electronAPI.log("debug",`[Carabiner] lastKnownDeviceId confirmed: ${lastKnownDeviceId.slice(0, 8)}...`);
  }

  // Check if device list actually changed (same count and same device IDs)
  if (previousCount === newCount) {
    const previousIds = currentDeviceList.map((d) => d.deviceId).sort();
    const newIds = captureDevices.map((d) => d.deviceId).sort();
    const listsAreIdentical =
      previousIds.length === newIds.length &&
      previousIds.every((id, index) => id === newIds[index]);

    if (listsAreIdentical) {
      // Even with identical device list, recover stream if it stopped (e.g., monitor wake
      // where disconnect+reconnect happened within the debounce window)
      if (
        (videoState === "stopped" || videoState === "loading") &&
        lastKnownDeviceId &&
        captureDevices.some((d) => d.deviceId === lastKnownDeviceId) &&
        deviceRecoveryAttempts < MAX_RECOVERY_ATTEMPTS
      ) {
        deviceRecoveryAttempts++;
        const recoveredDevice = captureDevices.find((d) => d.deviceId === lastKnownDeviceId);
        window.electronAPI.log("debug",
          `[Carabiner] Identical list but stream stopped/loading - scheduling recovery (attempt ${deviceRecoveryAttempts}) for: "${recoveredDevice?.label}"`
        );
        setTimeout(async () => {
          window.electronAPI.log("debug","[Carabiner] Executing recovery (identical-list path) - updating audio constraints...");
          await updateAudioConstraints();
          window.electronAPI.log("debug","[Carabiner] Audio constraints updated, calling renderDisplay...");
          renderDisplay(currentConstraints);
          showToast(`Restored capture device: ${recoveredDevice.label || "Device"}`, 3000);
          deviceRecoveryAttempts = 0;
        }, 2000);
      } else {
        window.electronAPI.log("debug",
          `[Carabiner] Device list unchanged, no action needed (videoState: ${videoState}, lastKnownDeviceId: ${lastKnownDeviceId ? "set" : "null"}, attempts: ${deviceRecoveryAttempts}/${MAX_RECOVERY_ATTEMPTS})`
        );
      }
      return;
    }
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
    window.electronAPI.log("debug","[Carabiner] No video devices available - showing fallback image");
    overlayImage.style.opacity = "1";
    overlayImage.src = "images/no-capture-device.png";
    overlayImage.style.display = "block";
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
      overlayImage.style.display = "none";
    }

    // Check if current device is still available
    if (currentDeviceId && !currentDeviceStillExists && videoState !== "stopped") {
      // Current device was disconnected, stop stream
      window.electronAPI.log("debug",
        `[Carabiner] Current device ${currentDeviceId.slice(0, 8)}... disconnected, stopping stream`
      );
      stopVideoStream();
      showToast("Current capture device was disconnected!", 3000, true);
      shouldUpdateUI = true;
      if (lastKnownDeviceId) {
        showReconnectingOverlay();
      }
    } else if (newCount > previousCount) {
      // New device connected
      const isRecoveringDevice =
        lastKnownDeviceId &&
        (videoState === "stopped" || videoState === "loading") &&
        captureDevices.some((d) => d.deviceId === lastKnownDeviceId);

      window.electronAPI.log("debug",
        `[Carabiner] New device detected - isRecoveringDevice: ${isRecoveringDevice}, recoveryAttempts: ${deviceRecoveryAttempts}/${MAX_RECOVERY_ATTEMPTS}`
      );

      if (isRecoveringDevice && deviceRecoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
        const recoveredDevice = captureDevices.find((d) => d.deviceId === lastKnownDeviceId);
        deviceRecoveryAttempts++;
        window.electronAPI.log("debug",
          `[Carabiner] Scheduling recovery (attempt ${deviceRecoveryAttempts}) for device: "${recoveredDevice?.label}"`
        );
        setTimeout(async () => {
          window.electronAPI.log("debug","[Carabiner] Executing recovery (new-device path) - updating audio constraints...");
          await updateAudioConstraints();
          window.electronAPI.log("debug","[Carabiner] Audio constraints updated, calling renderDisplay...");
          renderDisplay(currentConstraints);
          showToast(`Restored capture device: ${recoveredDevice.label || "Device"}`, 3000);
          deviceRecoveryAttempts = 0;
        }, 2000);
        shouldUpdateUI = true;
      } else {
        // New device connected - show toast but don't update UI to avoid flash
        window.electronAPI.log("debug",`[Carabiner] New device connected (not a recovery), showing toast`);
        showToast(`New capture device connected: ${captureDevices.length} device(s) available`);
        // Only update UI if this is the first device (going from 0 to 1+)
        shouldUpdateUI = previousCount === 0;
      }
    } else if (newCount < previousCount && currentDeviceId && currentDeviceStillExists) {
      // Device was removed but current device is still available - show toast but don't refresh UI
      window.electronAPI.log("debug",`[Carabiner] A device was removed but current device still active, no stream action needed`);
      showToast(`Capture device disconnected: ${captureDevices.length} device(s) remaining`);
      shouldUpdateUI = false;
    } else if (newCount < previousCount) {
      // Device was removed and we need to update (either no current device or current was removed)
      window.electronAPI.log("debug",`[Carabiner] Device removed, updating UI`);
      shouldUpdateUI = true;
    }
  }

  // Note: Main process has already been notified above to keep menus updated
  // UI updates are handled separately to prevent unnecessary display refreshes
}
