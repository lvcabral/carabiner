/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const path = require("path");
const os = require("os");
const log = require("electron-log");
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Notification,
  systemPreferences,
  globalShortcut,
  powerMonitor,
  screen,
  shell,
} = require("electron");
const fs = require("fs");
const { execSync } = require("child_process");
const AutoLaunch = require("auto-launch");
const { saveSettings, loadSettings } = require("./settings");
const { connectADB, disconnectADB, sendADBKey, sendADBText } = require("./adb");
const { connectATV, disconnectATV, sendATVKey, sendATVText } = require("./appletv");
const {
  createMacOSMenu,
  updateAlwaysOnTopMenuItem,
  updateEnableAudioMenuItem,
  updateScreenshotMenuItems,
  updateRecordingMenuItems,
  updateShowDisplayMenuItem,
  updateScriptRecordingMenuItems,
  updateScriptsSubmenu,
  createTrayMenu,
  updateTrayRecordingMenuItems,
  toggleDockIcon,
  createContextMenu,
  getTray,
  toggleFullScreen,
  isTogglingFullscreen,
  openDevTools,
  resetFullscreenVars,
  hideWindowSafely,
} = require("./menu");
const { checkForUpdates } = require("./updater");
const { startMcpServer, stopMcpServer, isRunning: isMcpRunning, getPort: getMcpPort } = require("./mcp-server");
const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));

if (require("electron-squirrel-startup") === true) app.quit();

const isMacOS = process.platform === "darwin";
const isWindows = process.platform === "win32";
const settings = loadSettings();
let lastSize = [500, 290];
let controlIp = "";
let controlType = "";
let isADBConnected = false;
let isATVConnected = false;
let isQuitting = false;
let captureDevices;
let isCurrentlyRecording = false;
let isScriptRecording = false;
let isScriptPlaying = false;
let saveFlag = false;

const appLauncher = new AutoLaunch({
  name: "Carabiner",
  path: app.getPath("exe"),
});

function createWindow(name, options, showOnStart = true) {
  const windowState = settings[name] || {
    width: options.width || 800,
    height: options.height || 600,
    x: undefined,
    y: undefined,
  };
  if (windowState.width < options.minWidth) {
    windowState.width = options.minWidth;
  }
  if (windowState.height < options.minHeight) {
    windowState.height = options.minHeight;
  }
  const win = new BrowserWindow({
    ...options,
    ...windowState,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
    },
    show: showOnStart,
  });

  win.on("close", (event) => {
    if (!win.isFullScreen()) {
      const bounds = win.getBounds();
      settings[name] = bounds;
      saveSettings(settings);
    }
    if (name === "mainWindow" && !isQuitting) {
      event.preventDefault();
      win?.hide();
    } else if (name === "displayWindow") {
      resetFullscreenVars();
      app.quit();
    }
  });

  if (name === "displayWindow") {
    win.on("hide", () => {
      win.webContents.send("stop-video-stream");
      updateScreenshotMenuItems(false);
      updateRecordingMenuItems(false, false);
      updateTrayRecordingMenuItems(isCurrentlyRecording);
    });

    win.on("show", () => {
      win.webContents.send("start-video-stream");
      updateScreenshotMenuItems(true);
      updateRecordingMenuItems(true, false);
      updateTrayRecordingMenuItems(isCurrentlyRecording);
    });
  }

  return win;
}

function createMainWindow() {
  const win = createWindow(
    "mainWindow",
    {
      height: isMacOS ? 620 : 645,
      width: 700,
      minHeight: isMacOS ? 620 : 645,
      minWidth: 700,
      maximizable: false,
      resizable: false,
      autoHideMenuBar: true,
      icon: __dirname + "/images/icon.ico",
    },
    settings.display.showSettingsOnStart
  );

  win.loadURL(`file://${path.join(__dirname, "../build/index.html")}`);

  win.removeMenu();
  win.setMenuBarVisibility(false);
  return win;
}

function createDisplayWindow() {
  if (settings.display?.resolution?.includes("px")) {
    lastSize = settings.display.resolution
      .split("|")
      .map((dim) => parseInt(dim.replace("px", ""), 10) + 15);
  }

  // Windows 11 specific configuration to remove the 1-pixel border
  const windowOptions = {
    width: lastSize[0] ?? 500,
    height: lastSize[1] ?? 290,
    minWidth: 500,
    minHeight: 290,
    titleBarStyle: "hidden",
    transparent: true,
    darkTheme: false,
    hasShadow: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      backgroundThrottling: false,
    },
  };

  // Additional Windows-specific options to remove the border completely
  if (isWindows) {
    windowOptions.thickFrame = false;
    windowOptions.titleBarOverlay = false;
    // Windows 11 specific options
    windowOptions.roundedCorners = false;
    windowOptions.shadow = false;
  }

  // Create window directly instead of using createWindow wrapper to avoid webPreferences conflicts
  const windowState = settings["displayWindow"] || {
    width: windowOptions.width,
    height: windowOptions.height,
    x: undefined,
    y: undefined,
  };
  if (windowState.width < windowOptions.minWidth) {
    windowState.width = windowOptions.minWidth;
  }
  if (windowState.height < windowOptions.minHeight) {
    windowState.height = windowOptions.minHeight;
  }

  const win = new BrowserWindow({
    ...windowOptions,
    ...windowState,
    show: false, // Always start hidden for Windows 11 fix
  });

  if (isMacOS) win.setWindowButtonVisibility(false);
  win.loadFile("public/display.html");
  win.setResizable(true);
  win.setAspectRatio(16 / 9);

  if (isWindows) {
    // Apply Windows 11 specific fixes after the window is ready
    win.once("ready-to-show", () => {
      // Force transparent background and remove any system borders
      win.setBackgroundColor("#00000000");

      // Show the window after applying the background
      if (settings.display?.visible !== false) {
        win.show();
      }
    });
    // This is a workaround for the issue where frameless windows on Windows 11
    // show a title bar when the window loses focus and removes the 1-pixel border.
    win.on("blur", () => {
      win.setBackgroundColor("#00000000");
    });
    win.on("focus", () => {
      win.setBackgroundColor("#00000000");
    });
    win.on("show", () => {
      win.setBackgroundColor("#00000000");
    });
    win.on("restore", () => {
      win.setBackgroundColor("#00000000");
    });
  } else {
    // For non-Windows platforms, show normally after ready
    win.once("ready-to-show", () => {
      if (settings.display?.visible !== false) {
        win.show();
      }
    });
  }

  win.on("move", () => {
    win.webContents.send("window-moved");
    // Save position when window is moved
    if (!win.isFullScreen()) {
      const bounds = win.getBounds();
      settings["displayWindow"] = bounds;
      saveSettings(settings);
    }
  });

  // Save size when window is resized
  win.on("resize", () => {
    // Check for fullscreen state and toggling state on Windows/Linux
    if (!win.isFullScreen() && !isTogglingFullscreen()) {
      const bounds = win.getBounds();
      settings["displayWindow"] = bounds;
      saveSettings(settings);
    }
  });

  win.on("enter-full-screen", () => {
    win.webContents.send("enter-full-screen");
  });

  win.on("leave-full-screen", () => {
    win.webContents.send("leave-full-screen");
  });

  // Add close event handler to save window position and size
  win.on("close", (event) => {
    if (!win.isFullScreen()) {
      const bounds = win.getBounds();
      settings["displayWindow"] = bounds;
      saveSettings(settings);
    }
    resetFullscreenVars();
    app.quit();
  });

  return win;
}

function setAlwaysOnTop(alwaysOnTop, window) {
  if (alwaysOnTop === false) {
    window.setAlwaysOnTop(false);
  } else {
    window.setAlwaysOnTop(true, "floating", 1);
  }
  updateAlwaysOnTopMenuItem(alwaysOnTop);
}

function registerShortcut(shortcut, window) {
  globalShortcut.unregisterAll();
  globalShortcut.register(shortcut, () => {
    if (window.isDestroyed()) return;
    if (window.isVisible()) {
      hideWindowSafely(window, settings);
    } else {
      window.show();
    }
  });
}

app.whenReady().then(async () => {
  if (process.platform !== "linux") {
    try {
      const access = systemPreferences.getMediaAccessStatus("camera");
      if (access !== "granted") {
        const camAllowed = await systemPreferences
          .askForMediaAccess("camera")
          .then(async (access) => {
            if (!access) {
              new Notification({
                title: "Camera Access",
                body: "Camera access is required to use this app",
              }).show();
              return false;
            }
            return true;
          });

        if (!camAllowed) {
          app.quit();
        }
      }
    } catch (error) {
      console.log("Error requesting access to the camera:", error.message);
    }
  }

  const mainWindow = createMainWindow();
  const displayWindow = createDisplayWindow();
  setAlwaysOnTop(settings.display.alwaysOnTop ?? true, displayWindow);

  // --- Allow Mac to sleep (issue #91) ---------------------------------------
  // Live audio I/O (and the playing <video>) cause macOS to hold
  // PreventUserIdleSystemSleep / "Video Wake Lock" assertions, which keep the
  // machine awake. The app can't suppress those assertions directly, so when
  // the user locks the screen or goes idle we pause the capture stream (which
  // releases them) and resume it on unlock / activity. Controlled by
  // settings.display.allowSleep (default on).
  //
  // The idle threshold mirrors the user's own macOS "turn display off"
  // (displaysleep) and screen-saver settings rather than a fixed timeout, so
  // capture stays up while they're actively watching and only pauses when the
  // screen saver / display sleep would have kicked in. (Chromium's Video Wake
  // Lock actually blocks the real screen saver from firing, so we proxy it by
  // matching its delay.) If both are "Never", we don't auto-pause on idle at
  // all — only on screen lock.
  const IDLE_POLL_MS = 30000; // check idle time every 30 seconds
  const IDLE_THRESHOLD_TTL_MS = 5 * 60 * 1000; // re-read OS settings every 5 min
  let sleepWatcherInterval = null;
  let autoSuspended = false;
  let suspendedByIdle = false;
  let idleThresholdSeconds = 0;
  let idleThresholdReadAt = 0;

  // Runs a shell command and returns its stdout, or null on failure. stderr is
  // silenced so expected "domain/default pair does not exist" noise from a
  // missing screen-saver key never reaches the console.
  function readCommand(cmd) {
    try {
      return execSync(cmd, {
        encoding: "utf8",
        timeout: 3000,
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch (error) {
      return null;
    }
  }

  // Returns the soonest of the macOS display-sleep / screen-saver delays in
  // seconds, or 0 when both are disabled ("Never"). Read live so it tracks
  // power-source changes (e.g. laptop on AC vs battery). `pmset displaysleep`
  // is the authoritative value; the screen-saver key is absent on modern macOS
  // and only used as a (shorter) refinement when present.
  function readIdleThresholdSeconds() {
    let seconds = 0;
    const pmset = readCommand("pmset -g");
    if (pmset) {
      const match = pmset.match(/^\s*displaysleep\s+(\d+)/m);
      const minutes = match ? parseInt(match[1], 10) : 0;
      if (minutes > 0) seconds = minutes * 60;
    }
    const screensaver = readCommand("defaults -currentHost read com.apple.screensaver idleTime");
    if (screensaver) {
      const ssSeconds = parseInt(screensaver.trim(), 10);
      if (ssSeconds > 0 && (seconds === 0 || ssSeconds < seconds)) seconds = ssSeconds;
    }
    return seconds;
  }

  function refreshIdleThreshold(force) {
    const now = Date.now();
    if (!force && now - idleThresholdReadAt < IDLE_THRESHOLD_TTL_MS) return;
    idleThresholdReadAt = now;
    idleThresholdSeconds = readIdleThresholdSeconds();
  }

  function suspendCapture(byIdle) {
    if (byIdle) suspendedByIdle = true;
    if (autoSuspended || !displayWindow || displayWindow.isDestroyed()) return;
    autoSuspended = true;
    displayWindow.webContents.send("auto-suspend");
  }

  function resumeCapture() {
    if (!autoSuspended) return;
    autoSuspended = false;
    suspendedByIdle = false;
    if (displayWindow && !displayWindow.isDestroyed() && displayWindow.isVisible()) {
      displayWindow.webContents.send("auto-resume");
    }
  }

  function pollSystemIdle() {
    refreshIdleThreshold(false);
    // 0 means the user disabled display sleep / screen saver: never idle-pause.
    if (idleThresholdSeconds <= 0) return;
    if (powerMonitor.getSystemIdleTime() >= idleThresholdSeconds) {
      suspendCapture(true);
    } else if (suspendedByIdle) {
      // Only auto-resume idle-triggered pauses here; lock pauses wait for unlock.
      resumeCapture();
    }
  }

  const onLockScreen = () => suspendCapture(false);
  const onUnlockScreen = () => resumeCapture();

  function startSleepWatcher() {
    if (sleepWatcherInterval) return;
    refreshIdleThreshold(true);
    powerMonitor.on("lock-screen", onLockScreen);
    powerMonitor.on("unlock-screen", onUnlockScreen);
    sleepWatcherInterval = setInterval(pollSystemIdle, IDLE_POLL_MS);
  }

  function stopSleepWatcher() {
    if (sleepWatcherInterval) {
      clearInterval(sleepWatcherInterval);
      sleepWatcherInterval = null;
    }
    powerMonitor.removeListener("lock-screen", onLockScreen);
    powerMonitor.removeListener("unlock-screen", onUnlockScreen);
    if (autoSuspended) resumeCapture();
  }

  if (isMacOS) {
    // macOS only: this works around the macOS audio/video sleep assertions and the
    // toggle is hidden on other platforms (see DisplaySection.js).
    if (settings.display?.allowSleep !== false) {
      startSleepWatcher();
    }
    createMacOSMenu(mainWindow, displayWindow, packageInfo, settings);
    // Ensure menu reflects the correct always on top state from settings
    updateAlwaysOnTopMenuItem(settings.display.alwaysOnTop ?? true);
    // Ensure menu reflects the correct enable audio state from settings
    updateEnableAudioMenuItem(settings.display.audioEnabled ?? false);
    // Set initial state of show display menu item based on display window visibility
    updateShowDisplayMenuItem(settings.display?.visible !== false);
  } else {
    displayWindow.on("system-context-menu", (event, point) => {
      event.preventDefault();
    });
  }

  // This is a workaround for the issue where frameless windows on Windows 11
  // show a title bar when the window loses focus.
  function resetFramelessWindow() {
    if (isWindows) {
      setTimeout(() => {
        displayWindow?.setBackgroundColor("#00000000");
      }, 1000);
    }
  }

  // Initialize dock/tray mode based on user setting (both macOS and Windows)
  if (isMacOS || isWindows) {
    const showInDock = settings.display.showInDock !== false; // Default to true
    toggleDockIcon(showInDock, mainWindow, displayWindow, packageInfo);
  }

  if (
    typeof settings?.control?.deviceId === "string" &&
    settings.control.deviceId.includes("|adb")
  ) {
    [controlIp, controlType] = settings.control.deviceId.split("|");
    if (!isADBConnected) {
      isADBConnected = connectADB(controlIp, settings.control?.adbPath);
    }
  }

  if (
    typeof settings?.control?.deviceId === "string" &&
    settings.control.deviceId.includes("|atv")
  ) {
    [controlIp, controlType] = settings.control.deviceId.split("|");
    if (!isATVConnected) {
      isATVConnected = connectATV(controlIp, settings.control?.atvremotePath);
    }
  }

  if (settings.display?.shortcut) {
    registerShortcut(settings.display.shortcut, displayWindow);
  }

  // Initialize version checking (only in production and if enabled)
  if (app.isPackaged && settings.display.autoUpdate !== false) {
    // Check for updates 30 seconds after app start
    setTimeout(async () => {
      try {
        await checkForUpdates();
      } catch (error) {
        console.error("Error checking for updates:", error);
      }
    }, 30000);

    // Check for updates every 4 hours
    setInterval(
      async () => {
        try {
          await checkForUpdates();
        } catch (error) {
          console.error("Error checking for updates:", error);
        }
      },
      4 * 60 * 60 * 1000
    );
  }

  // Hide app when both windows are hidden in macOS (only in dock mode)
  if (isMacOS) {
    mainWindow.on("hide", () => {
      if (!displayWindow.isVisible() && settings.display?.showInDock && !isTogglingFullscreen()) {
        app.hide();
      }
    });

    displayWindow.on("hide", () => {
      if (!mainWindow.isVisible() && settings.display?.showInDock && !isTogglingFullscreen()) {
        app.hide();
      }
    });

    // Listen for display window resize events
    displayWindow.on("resize", () => {
      const [width, height] = displayWindow.getSize();
      // Send resize notification to main window
      mainWindow.webContents?.send("shared-window-channel", {
        type: "window-resized",
        payload: { width, height },
      });
    });
  } else {
    // Listen for display window resize events on Windows and Linux
    displayWindow.on("resize", () => {
      if (!isTogglingFullscreen()) {
        resetFullscreenVars();
        // Send resize notification to main window (same as macOS)
        const [width, height] = displayWindow.getSize();
        mainWindow.webContents?.send("shared-window-channel", {
          type: "window-resized",
          payload: { width, height },
        });
      }
    });
  }

  // Add window visibility event handlers for video stream control
  displayWindow.on("show", () => {
    displayWindow.webContents.send("window-show");
    updateShowDisplayMenuItem(true);
  });

  displayWindow.on("hide", () => {
    displayWindow.webContents.send("window-hide");
    updateShowDisplayMenuItem(false);
    if (isScriptRecording) {
      isScriptRecording = false;
      updateScriptRecordingMenuItems(isScriptRecording || isScriptPlaying, isScriptRecording, isScriptPlaying);
    }
  });

  displayWindow.on("minimize", () => {
    displayWindow.webContents.send("window-minimize");
    updateShowDisplayMenuItem(false);
    if (isScriptRecording) {
      isScriptRecording = false;
      updateScriptRecordingMenuItems(isScriptRecording || isScriptPlaying, isScriptRecording, isScriptPlaying);
    }
  });

  displayWindow.on("restore", () => {
    displayWindow.webContents.send("window-restore");
    updateShowDisplayMenuItem(true);
  });

  function switchControlDevice(deviceId) {
    if (!deviceId) return;
    settings.control.deviceId = deviceId;
    // Update linked property so the capture device label in menus reflects the new selection
    const currentCaptureId = settings.display.deviceId;
    if (currentCaptureId && settings.control.deviceList) {
      settings.control.deviceList = settings.control.deviceList.map((device) => {
        if (device.id === deviceId) {
          return { ...device, linked: currentCaptureId };
        } else if (device.linked === currentCaptureId) {
          return { ...device, linked: "" };
        }
        return device;
      });
    }
    saveSettings(settings);
    const oldControlIp = controlIp;
    [controlIp, controlType] = deviceId.split("|");
    if (isADBConnected && oldControlIp !== controlIp) {
      isADBConnected = disconnectADB();
    }
    if (!isADBConnected && controlType === "adb") {
      isADBConnected = connectADB(controlIp, settings.control?.adbPath);
    }
    displayWindow?.webContents?.send("shared-window-channel", {
      type: "set-control-selected",
      payload: deviceId,
    });
    displayWindow?.webContents?.send("shared-window-channel", {
      type: "set-control-list",
      payload: settings.control.deviceList,
    });
    mainWindow?.webContents?.send("update-control-device", {
      deviceId,
      deviceList: settings.control.deviceList,
    });
    const currentTray = getTray();
    if (currentTray) {
      createTrayMenu(
        mainWindow,
        displayWindow,
        packageInfo,
        captureDevices,
        settings,
        isCurrentlyRecording,
        switchControlDevice
      );
    }
  }

  ipcMain.on("shared-window-channel", (event, arg) => {
    // Only forward set-video-stream messages if display window is visible or being shown
    // Forward all other messages unconditionally
    if (arg.type !== "set-video-stream") {
      displayWindow?.webContents?.send("shared-window-channel", arg);
    }
    saveFlag = true;
    if (arg.type && arg.type === "set-capture-devices") {
      const newDevices = JSON.parse(arg.payload);
      const currentDeviceId = settings.display.deviceId;

      // Check if device list actually changed (not just selection)
      // Compare device IDs in both directions to ensure lists are identical
      const devicesChanged =
        !captureDevices ||
        captureDevices.length !== newDevices.length ||
        !captureDevices.every((oldDev) =>
          newDevices.some((newDev) => newDev.deviceId === oldDev.deviceId)
        ) ||
        !newDevices.every((newDev) =>
          captureDevices.some((oldDev) => oldDev.deviceId === newDev.deviceId)
        );

      // Check if current capture device was removed
      if (currentDeviceId && !newDevices.find((device) => device.deviceId === currentDeviceId)) {
        // If current device was removed and display window is hidden, show it
        if (displayWindow && !displayWindow.isVisible()) {
          displayWindow.show();
        }
      }

      captureDevices = newDevices;
      mainWindow?.webContents?.send("shared-window-channel", arg);

      // Only rebuild tray menu when device list actually changes (devices added/removed)
      if (devicesChanged) {
        const tray = getTray();
        if (tray) {
          createTrayMenu(
            mainWindow,
            displayWindow,
            packageInfo,
            captureDevices,
            settings,
            isCurrentlyRecording,
            switchControlDevice
          );
        }
      }
    } else if (arg.type && arg.type === "set-video-stream") {
      saveFlag = false;
      let deviceIdChanged = false;
      if (arg.payload?.video?.deviceId?.exact) {
        const newDeviceId = arg.payload.video.deviceId.exact;
        if (settings.display.deviceId !== newDeviceId) {
          settings.display.deviceId = newDeviceId;
          deviceIdChanged = true;
        }
        saveFlag = true;
      }
      if (arg.payload?.video?.width && arg.payload?.video?.height) {
        settings.display.captureWidth = arg.payload.video.width;
        settings.display.captureHeight = arg.payload.video.height;
        saveFlag = true;
      }

      // Rebuild tray menu with updated settings to reflect new selection
      // This is more reliable than trying to update individual menu items
      if (deviceIdChanged && captureDevices?.length > 0) {
        const tray = getTray();
        if (tray) {
          createTrayMenu(
            mainWindow,
            displayWindow,
            packageInfo,
            captureDevices,
            settings,
            isCurrentlyRecording,
            switchControlDevice
          );
        }
      }

      // Only start video stream if display window is visible
      // Always save the settings, but only forward to display window if it's visible
      if (displayWindow?.isVisible()) {
        displayWindow.webContents.send("shared-window-channel", arg);
      }

      // Show display window if explicitly requested
      if (arg.payload?.showDisplayWindow && !displayWindow.isVisible()) {
        displayWindow.show();
        // When showing the window, send the video stream settings to start playback
        displayWindow.webContents.send("shared-window-channel", arg);
      }
    } else if (arg.type && arg.type === "set-transparency") {
      saveFlag = false;
      if (typeof arg.payload === "number") {
        settings.display.transparency = arg.payload;
        saveFlag = true;
      }
      // Show display window so user can see transparency changes
      if (!displayWindow.isVisible()) {
        displayWindow.show();
      }
    } else if (arg.type && arg.type === "set-resolution") {
      let { width, height } = arg.payload;
      settings.display.resolution = `${width}|${height}`;
      saveFlag = true;
      width = Number(width.replace("px", "")) + 15;
      height = Number(height.replace("px", "")) + 15;
      lastSize = [width, height];
    } else if (arg.type && arg.type === "set-border-width") {
      settings.border.width = arg.payload;
      // Show display window so user can see border changes
      if (!displayWindow.isVisible()) {
        displayWindow.show();
      }
    } else if (arg.type && arg.type === "set-border-style") {
      settings.border.style = arg.payload;
      // Show display window so user can see border changes
      if (!displayWindow.isVisible()) {
        displayWindow.show();
      }
    } else if (arg.type && arg.type === "set-border-color") {
      settings.border.color = arg.payload;
      // Show display window so user can see border changes
      if (!displayWindow.isVisible()) {
        displayWindow.show();
      }
    } else if (arg.type && arg.type === "set-control-list") {
      let currentDeviceRemoved = false;
      const found = arg.payload.find((device) => device.id === settings.control.deviceId);
      if (!found && settings.control.deviceId) {
        currentDeviceRemoved = true;
        settings.control.deviceId = "";
        if (isADBConnected) {
          isADBConnected = disconnectADB();
        }
        if (isATVConnected) {
          isATVConnected = disconnectATV();
        }
      }
      settings.control.deviceList = arg.payload;
      // If current device was removed and display window is hidden, show it
      if (currentDeviceRemoved && displayWindow && !displayWindow.isVisible()) {
        displayWindow.show();
      }
    } else if (arg.type && arg.type === "set-control-selected") {
      settings.control.deviceId = arg.payload;
      const oldControlIp = controlIp;
      [controlIp, controlType] = arg.payload.split("|");
      if (isADBConnected && oldControlIp !== controlIp) {
        isADBConnected = disconnectADB();
      }
      if (isATVConnected && oldControlIp !== controlIp) {
        isATVConnected = disconnectATV();
      }
      if (!isADBConnected && controlType === "adb") {
        isADBConnected = connectADB(controlIp, settings.control?.adbPath);
      }
      if (!isATVConnected && controlType === "atv") {
        isATVConnected = connectATV(controlIp, settings.control?.atvremotePath);
      }
    } else if (arg.type && arg.type === "send-adb-key") {
      sendADBKey(arg.payload);
    } else if (arg.type && arg.type === "send-adb-text") {
      sendADBText(arg.payload);
    } else if (arg.type && arg.type === "send-atv-key") {
      sendATVKey(arg.payload);
    } else if (arg.type && arg.type === "send-atv-text") {
      sendATVText(arg.payload);
    } else if (arg.type && arg.type === "set-adb-path") {
      settings.control.adbPath = arg.payload;
      saveFlag = true;
    } else if (arg.type && arg.type === "set-atv-path") {
      settings.control.atvremotePath = arg.payload;
      saveFlag = true;
    } else if (arg.type && arg.type === "set-audio-enabled") {
      settings.display.audioEnabled = arg.payload;
      saveFlag = true;
    } else if (arg.type && arg.type === "set-show-keystrokes") {
      settings.display.showKeystrokes = arg.payload;
      saveFlag = true;
    } else if (arg.type && arg.type === "set-allow-sleep") {
      settings.display.allowSleep = arg.payload;
      saveFlag = true;
      if (arg.payload) {
        startSleepWatcher();
      } else {
        stopSleepWatcher();
      }
    } else if (arg.type && arg.type === "clear-overlay-image") {
      saveFlag = false;
      // Clear the overlay image by sending a specific clear message
      displayWindow?.webContents?.send("clear-overlay-image");
    } else if (arg.type && arg.type === "set-display-size") {
      saveFlag = false;
      const { width, height } = arg.payload;
      if (displayWindow && width && height) {
        // Show display window so user can see size changes
        if (!displayWindow.isVisible()) {
          displayWindow.show();
        }
        displayWindow.setSize(width, height);
        // Send resize notification back to display section
        mainWindow?.webContents?.send("shared-window-channel", {
          type: "window-resized",
          payload: { width, height },
        });
      }
    }
    if (saveFlag) {
      saveSettings(settings);
    }
    event.returnValue = true;
  });

  ipcMain.on("save-shortcut", (event, shortcut) => {
    settings.display.shortcut = shortcut;
    saveSettings(settings);
    registerShortcut(shortcut, displayWindow);
  });

  ipcMain.on("save-launch-app-at-login", (event, launchAppAtLogin) => {
    settings.display.launchAppAtLogin = launchAppAtLogin;
    saveSettings(settings);
    if (launchAppAtLogin) {
      appLauncher.enable();
    } else {
      appLauncher.disable();
    }
  });

  ipcMain.on("save-show-settings-on-start", (event, showSettingsOnStart) => {
    settings.display.showSettingsOnStart = showSettingsOnStart;
    saveSettings(settings);
  });

  ipcMain.on("save-always-on-top", (event, alwaysOnTop) => {
    settings.display.alwaysOnTop = alwaysOnTop;
    saveSettings(settings);

    // Show display window so user can see the always on top behavior change
    if (!displayWindow.isVisible()) {
      displayWindow.show();
    }

    setAlwaysOnTop(alwaysOnTop, displayWindow);

    // Update all menu items to reflect the new state
    updateAlwaysOnTopMenuItem(alwaysOnTop);

    // Broadcast the change to the React UI
    mainWindow.webContents.send("update-always-on-top", alwaysOnTop);
  });

  ipcMain.on("save-audio-enabled", (event, audioEnabled) => {
    settings.display.audioEnabled = audioEnabled;
    saveSettings(settings);

    // Update all menu items to reflect the new state
    updateEnableAudioMenuItem(audioEnabled);

    // Broadcast the change to the React UI
    mainWindow.webContents.send("update-audio-enabled", audioEnabled);
  });

  ipcMain.on("save-dark-mode", (event, darkMode) => {
    settings.display.darkMode = darkMode;
    saveSettings(settings);
  });

  ipcMain.on("save-check-for-updates", (event, checkForUpdates) => {
    settings.display.autoUpdate = checkForUpdates;
    saveSettings(settings);
  });

  ipcMain.on("save-show-in-dock", (event, showInDock) => {
    settings.display.showInDock = showInDock;
    saveSettings(settings);

    // Find the main window
    const mainWindow = BrowserWindow.getAllWindows().find((win) =>
      win.webContents.getURL().includes("index.html")
    );

    if (!mainWindow) {
      return;
    }

    // Toggle dock/tray mode
    toggleDockIcon(showInDock, mainWindow, null, packageInfo);

    // If switching to menubar mode (unchecking), ensure window stays visible
    if (!showInDock) {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  ipcMain.on("toggle-fullscreen-window", (event) => {
    toggleFullScreen(displayWindow);
  });

  ipcMain.on("open-settings-from-display", (event) => {
    if (!mainWindow) {
      return;
    }
    mainWindow.webContents?.send("open-display-tab");
    mainWindow.show();
    mainWindow.focus();
  });

  ipcMain.on("open-display-devtools", (event) => {
    if (!displayWindow) {
      return;
    }
    openDevTools(displayWindow);
  });

  ipcMain.on("show-context-menu", (event) => {
    const menu = createContextMenu(
      mainWindow,
      displayWindow,
      packageInfo,
      isCurrentlyRecording,
      captureDevices,
      settings,
      isScriptRecording,
      isScriptPlaying,
      switchControlDevice
    );
    menu.popup({ window: displayWindow });
  });

  // Reusable function for loading and sending image data to display window
  const loadAndSendImage = (imagePath) => {
    try {
      const imageData = fs.readFileSync(imagePath, { encoding: "base64" });
      // Detect image type from file extension
      const ext = imagePath.toLowerCase().split(".").pop();
      let mimeType = "image/png"; // default
      if (ext === "jpg" || ext === "jpeg") {
        mimeType = "image/jpeg";
      } else if (ext === "webp") {
        mimeType = "image/webp";
      }
      displayWindow?.webContents?.send("image-loaded", `data:${mimeType};base64,${imageData}`);
      return true;
    } catch (error) {
      console.error("Error loading image:", error);
      return false;
    }
  };

  ipcMain.handle("select-adb-path", async (event, currentPath) => {
    resetFramelessWindow();
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      defaultPath: currentPath ? path.dirname(currentPath) : undefined,
    });
    if (result.canceled) {
      return null;
    } else {
      const adbPath = result.filePaths[0];
      settings.control.adbPath = adbPath;
      return adbPath;
    }
  });

  ipcMain.handle("select-atv-path", async (event, currentPath) => {
    resetFramelessWindow();
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      defaultPath: currentPath ? path.dirname(currentPath) : undefined,
    });
    if (result.canceled) {
      return null;
    } else {
      const atvremotePath = result.filePaths[0];
      settings.control.atvremotePath = atvremotePath;
      return atvremotePath;
    }
  });

  // Generic directory selection handler
  const createDirectorySelector = (title) => async () => {
    resetFramelessWindow();
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: title,
    });
    return result.canceled ? null : result.filePaths[0];
  };

  ipcMain.handle(
    "select-screenshot-path",
    createDirectorySelector("Select Default Screenshot Save Location")
  );
  ipcMain.handle(
    "select-recording-path",
    createDirectorySelector("Select Default Recording Save Location")
  );

  ipcMain.handle("load-image", async () => {
    resetFramelessWindow();
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["jpg", "png", "webp"] }],
    });
    if (result.canceled) {
      return "";
    } else {
      const imagePath = result.filePaths[0];
      const success = loadAndSendImage(imagePath);
      return success ? imagePath : "";
    }
  });

  ipcMain.handle("load-settings", async () => {
    return settings;
  });

  ipcMain.handle("get-package-info", async () => {
    return packageInfo;
  });

  ipcMain.handle("get-largest-display-size", async () => {
    const displays = screen.getAllDisplays();
    let largestDisplay = displays[0];
    let largestArea = largestDisplay.size.width * largestDisplay.size.height;

    for (const display of displays) {
      const area = display.size.width * display.size.height;
      if (area > largestArea) {
        largestArea = area;
        largestDisplay = display;
      }
    }

    return {
      width: largestDisplay.size.width,
      height: largestDisplay.size.height,
    };
  });

  // Handler for saving overlay recent files
  ipcMain.on("save-overlay-recent-files", (event, recentFiles) => {
    if (!settings.overlay) {
      settings.overlay = {};
    }
    settings.overlay.recentFiles = recentFiles;
    saveSettings(settings);
  });

  // Handler for saving overlay image path
  ipcMain.on("save-overlay-image-path", (event, imagePath) => {
    if (!settings.overlay) {
      settings.overlay = {};
    }
    settings.overlay.imagePath = imagePath;
    saveSettings(settings);
  });

  // Handler for saving overlay opacity
  ipcMain.on("save-overlay-opacity", (event, opacity) => {
    if (!settings.overlay) {
      settings.overlay = {};
    }
    settings.overlay.opacity = parseFloat(opacity);
    saveSettings(settings);
  });

  // Handler for checking if file exists
  ipcMain.handle("check-file-exists", async (event, filePath) => {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  });

  // Handler for showing message box dialogs
  ipcMain.handle("show-message-box", async (event, options) => {
    resetFramelessWindow();
    const result = await dialog.showMessageBox(mainWindow, options);
    return result;
  });

  // Handler for loading image by path (unified for both file dialog and recent files)
  ipcMain.handle("load-image-by-path", async (event, imagePath) => {
    return loadAndSendImage(imagePath);
  });

  // Save video recording dialog
  ipcMain.handle("save-video-dialog", async (event, filename, bufferData) => {
    try {
      const defaultPath = settings.files?.recordingPath
        ? path.join(settings.files.recordingPath, filename)
        : path.join(os.homedir(), isMacOS ? "Movies" : "Videos", filename);
      resetFramelessWindow();
      const result = await dialog.showSaveDialog(displayWindow, {
        title: "Save Video Recording",
        defaultPath: defaultPath,
        filters: [
          { name: "Video Files", extensions: ["mp4", "webm"] },
          { name: "MP4 Files", extensions: ["mp4"] },
          { name: "WebM Files", extensions: ["webm"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (!result.canceled && result.filePath) {
        // Convert the received data to a proper Buffer
        const buffer = Buffer.from(bufferData);
        await fs.promises.writeFile(result.filePath, buffer);
        return { success: true, filePath: result.filePath };
      } else {
        return { success: false, canceled: true };
      }
    } catch (error) {
      console.error("Error saving video file:", error);
      return { success: false, error: error.message };
    }
  });

  // Recording state management
  ipcMain.on("recording-state-changed", (event, isRecording) => {
    isCurrentlyRecording = isRecording;
    updateRecordingMenuItems(true, isRecording);
    updateTrayRecordingMenuItems(isRecording);
  });

  // Save screenshot dialog
  ipcMain.handle("save-screenshot-dialog", async (event, filename, imageData) => {
    try {
      const defaultPath = settings.files?.screenshotPath
        ? path.join(settings.files.screenshotPath, filename)
        : path.join(os.homedir(), "Pictures", filename);
      resetFramelessWindow();
      const result = await dialog.showSaveDialog(displayWindow, {
        title: "Save Screenshot",
        defaultPath: defaultPath,
        filters: [
          { name: "PNG Files", extensions: ["png"] },
          { name: "JPEG Files", extensions: ["jpg", "jpeg"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (!result.canceled && result.filePath) {
        // Convert base64 to buffer
        const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        await fs.promises.writeFile(result.filePath, buffer);
        return { success: true, filePath: result.filePath };
      } else {
        return { success: false, canceled: true };
      }
    } catch (error) {
      console.error("Error saving screenshot file:", error);
      return { success: false, error: error.message };
    }
  });

  // Script recording controls — forwarded to display window
  ipcMain.on("start-script-recording", () => {
    if (!isScriptRecording) {
      if (displayWindow && !displayWindow.isVisible()) displayWindow.show();
      isScriptRecording = true;
      updateScriptRecordingMenuItems(isScriptRecording || isScriptPlaying, isScriptRecording, isScriptPlaying);
      mainWindow?.webContents.send("script-recording-state-changed", true);
      displayWindow?.webContents.send("start-script-recording");
    }
  });

  ipcMain.on("stop-script-recording", () => {
    if (isScriptRecording) {
      displayWindow?.webContents.send("stop-script-recording");
    }
  });

  ipcMain.on("script-recording-state-changed", (event, recording) => {
    isScriptRecording = recording;
    updateScriptRecordingMenuItems(isScriptRecording || isScriptPlaying, isScriptRecording, isScriptPlaying);
    mainWindow?.webContents.send("script-recording-state-changed", recording);
  });

  // ----------------------------- MCP server integration -----------------------------
  // Request/response RPC to the display window (renderer) for operations that must run there
  // (canvas screenshot, MediaRecorder, key/text sending). Reuses render.js internals.
  const mcpPendingRpc = new Map();
  let mcpRpcSeq = 0;
  function callDisplay(action, params = {}) {
    return new Promise((resolve, reject) => {
      if (!displayWindow || displayWindow.isDestroyed()) {
        reject(new Error("Display window is not available."));
        return;
      }
      const requestId = `rpc_${++mcpRpcSeq}`;
      const timeout = setTimeout(() => {
        if (mcpPendingRpc.has(requestId)) {
          mcpPendingRpc.delete(requestId);
          reject(new Error(`Display did not respond to "${action}" in time.`));
        }
      }, 20000);
      mcpPendingRpc.set(requestId, { resolve, reject, timeout });
      displayWindow.webContents.send("mcp-rpc-request", { requestId, action, params });
    });
  }
  ipcMain.on("mcp-rpc-response", (event, { requestId, result, error }) => {
    const pending = mcpPendingRpc.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    mcpPendingRpc.delete(requestId);
    if (error) pending.reject(new Error(error));
    else pending.resolve(result);
  });

  // Shared script playback used by both the run-script IPC and the MCP run_script tool.
  const mcpPendingScripts = new Map();
  function startScriptPlayback(scriptId) {
    if (isScriptRecording || isScriptPlaying) return false;
    const script = settings.scripts?.find((s) => s.id === scriptId);
    if (!script) return false;
    if (displayWindow && !displayWindow.isVisible()) displayWindow.show();
    isScriptPlaying = true;
    updateScriptRecordingMenuItems(isScriptRecording || isScriptPlaying, isScriptRecording, isScriptPlaying);
    mainWindow?.webContents.send("script-playback-started", script.id);
    displayWindow?.webContents.send("play-script", {
      id: script.id,
      steps: script.steps,
      controlType: script.controlType,
    });
    return true;
  }

  function mcpTimestamp() {
    const now = new Date();
    const datePart = now.toLocaleDateString("en-CA");
    const timePart = now.toLocaleTimeString("en-CA", { hour12: false }).replace(/:/g, "");
    return `${datePart}-${timePart}`;
  }

  // Non-interactive video save (no dialog) used when recording is driven via MCP.
  ipcMain.handle("save-video-direct", async (event, filename, bufferData) => {
    try {
      const dir = settings.files?.recordingPath || path.join(os.homedir(), isMacOS ? "Movies" : "Videos");
      const filePath = path.join(dir, filename);
      await fs.promises.writeFile(filePath, Buffer.from(bufferData));
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Context object handed to the MCP tool handlers — the only bridge into main state.
  const mcpCtx = {
    getSettings: () => settings,
    getAuthToken: () => settings.mcp?.token || "",
    getSettingsSnapshot: () => {
      const snap = JSON.parse(JSON.stringify(settings));
      if (snap.mcp && snap.mcp.token) snap.mcp.token = "***";
      return snap;
    },
    getAppInfo: () => ({
      name: packageInfo.name,
      version: packageInfo.version,
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      mcp: { running: isMcpRunning(), port: getMcpPort() },
    }),
    // Device control
    getCurrentDevice: () => {
      const id = settings.control.deviceId || "";
      const [ip = "", type = ""] = id ? id.split("|") : [];
      let connected = false;
      if (type === "adb") connected = isADBConnected;
      else if (type === "atv") connected = isATVConnected;
      else if (type === "ecp") connected = !!ip;
      return { id, ip, type, connected };
    },
    listDevices: () =>
      (settings.control.deviceList || []).map((d) => ({
        id: d.id,
        name: d.alias || "",
        deviceType: d.type || "",
        ipAddress: d.ipAddress || (d.id ? d.id.split("|")[0] : ""),
        protocol: d.id ? d.id.split("|")[1] : "",
        selected: d.id === settings.control.deviceId,
      })),
    selectDevice: (deviceId) => {
      const device = (settings.control.deviceList || []).find((d) => d.id === deviceId);
      if (!device) throw new Error(`Unknown device id: ${deviceId}`);
      const newIp = deviceId.split("|")[0];
      // switchControlDevice handles ADB but not ATV; reconcile ATV connection here.
      if (isATVConnected && controlIp !== newIp) isATVConnected = disconnectATV();
      switchControlDevice(deviceId);
      if (controlType === "atv" && !isATVConnected) {
        isATVConnected = connectATV(controlIp, settings.control?.atvremotePath);
      }
      return mcpCtx.getCurrentDevice();
    },
    sendKey: async (nativeKey, mod) => {
      if (!settings.control.deviceId) {
        throw new Error("No control device selected. Use select_device first.");
      }
      await callDisplay("send-key", { key: nativeKey, mod });
      return { sent: nativeKey };
    },
    sendText: async (text) => {
      if (!settings.control.deviceId) {
        throw new Error("No control device selected. Use select_device first.");
      }
      await callDisplay("send-text", { text });
      return { sent: text };
    },
    // Capture & recording
    listCaptureDevices: () =>
      (captureDevices || []).map((d) => ({ deviceId: d.deviceId, label: d.label })),
    selectCaptureDevice: (deviceId) => {
      const found = (captureDevices || []).find((d) => d.deviceId === deviceId);
      if (!found) throw new Error(`Unknown capture device id: ${deviceId}`);
      mainWindow?.webContents?.send("update-capture-device", deviceId);
      return { deviceId: found.deviceId, label: found.label };
    },
    takeScreenshot: async ({ save = true } = {}) => {
      const dataUrl = await callDisplay("capture-screenshot");
      if (!dataUrl || typeof dataUrl !== "string") {
        throw new Error("No video frame available to capture.");
      }
      const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
      let filePath = null;
      if (save) {
        const dir = settings.files?.screenshotPath || path.join(os.homedir(), "Pictures");
        filePath = path.join(dir, `carabiner-${mcpTimestamp()}.png`);
        await fs.promises.writeFile(filePath, Buffer.from(base64, "base64"));
      }
      return { base64, mimeType: "image/png", filePath };
    },
    startRecording: async ({ filenamePrefix } = {}) => {
      await callDisplay("start-recording", { filenamePrefix });
      return { recording: true };
    },
    stopRecording: async () => callDisplay("stop-recording"),
    // Scripts
    listScripts: () =>
      (settings.scripts || []).map((s) => ({
        id: s.id,
        name: s.name,
        controlType: s.controlType,
        stepCount: s.steps?.length || 0,
      })),
    getScripts: () => settings.scripts || [],
    runScript: (scriptId) =>
      new Promise((resolve, reject) => {
        if (isScriptRecording || isScriptPlaying) {
          reject(new Error("Busy: a script is already recording or playing."));
          return;
        }
        const script = settings.scripts?.find((s) => s.id === scriptId);
        if (!script) {
          reject(new Error(`Unknown script id: ${scriptId}`));
          return;
        }
        mcpPendingScripts.set(scriptId, resolve);
        if (!startScriptPlayback(scriptId)) {
          mcpPendingScripts.delete(scriptId);
          reject(new Error("Failed to start script playback."));
        }
      }),
    stopScript: () => {
      displayWindow?.webContents.send("stop-script");
      return { stopped: true };
    },
    createScript: ({ name, controlType, steps }) => {
      if (!settings.scripts) settings.scripts = [];
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const script = {
        id,
        name: (name && name.trim()) || `Script ${settings.scripts.length + 1}`,
        controlType,
        steps: (steps || []).map((s) => ({ key: s.key, mod: s.mod ?? 0, delay: s.delay ?? 0 })),
      };
      settings.scripts.push(script);
      saveSettings(settings);
      mainWindow?.webContents.send("shared-window-channel", { type: "scripts-updated", payload: settings.scripts });
      updateScriptsSubmenu(settings.scripts, mainWindow, displayWindow, packageInfo, settings);
      return { id: script.id, name: script.name, controlType: script.controlType, stepCount: script.steps.length };
    },
    deleteScript: (scriptId) => {
      const before = settings.scripts?.length || 0;
      settings.scripts = (settings.scripts || []).filter((s) => s.id !== scriptId);
      saveSettings(settings);
      mainWindow?.webContents.send("shared-window-channel", { type: "scripts-updated", payload: settings.scripts });
      updateScriptsSubmenu(settings.scripts, mainWindow, displayWindow, packageInfo, settings);
      return { deleted: before !== settings.scripts.length };
    },
    // Display window
    showDisplay: () => {
      if (!displayWindow.isVisible()) displayWindow.show();
      return { visible: true };
    },
    hideDisplay: () => {
      if (displayWindow.isVisible()) displayWindow.hide();
      return { visible: false };
    },
    toggleFullscreen: () => {
      toggleFullScreen(displayWindow);
      return { fullscreen: displayWindow.isFullScreen() };
    },
    toggleOnTop: () => {
      const newVal = !(settings.display.alwaysOnTop ?? true);
      settings.display.alwaysOnTop = newVal;
      saveSettings(settings);
      if (!displayWindow.isVisible()) displayWindow.show();
      setAlwaysOnTop(newVal, displayWindow);
      updateAlwaysOnTopMenuItem(newVal);
      mainWindow?.webContents?.send("update-always-on-top", newVal);
      return { onTop: newVal };
    },
  };

  ipcMain.handle("save-mcp-config", async (event, config) => {
    settings.mcp = {
      enabled: !!config.enabled,
      port: Number(config.port) || 7734,
      token: typeof config.token === "string" ? config.token : "",
    };
    saveSettings(settings);
    await stopMcpServer();
    if (settings.mcp.enabled) {
      return startMcpServer(mcpCtx);
    }
    return { running: false, port: settings.mcp.port };
  });

  ipcMain.handle("get-mcp-status", async () => ({ running: isMcpRunning(), port: getMcpPort() }));

  if (settings.mcp?.enabled) {
    startMcpServer(mcpCtx).then((status) => {
      if (status.error) log.error("[MCP] Failed to start MCP server:", status.error);
    });
  }

  ipcMain.on("save-script", (event, script) => {
    if (!settings.scripts) settings.scripts = [];
    script.name = `Script ${settings.scripts.length + 1}`;
    settings.scripts.push(script);
    saveSettings(settings);
    isScriptRecording = false;
    updateScriptRecordingMenuItems(isScriptRecording || isScriptPlaying, isScriptRecording, isScriptPlaying);
    mainWindow?.webContents.send("script-recording-state-changed", false);
    mainWindow?.webContents.send("shared-window-channel", {
      type: "scripts-updated",
      payload: settings.scripts,
    });
    updateScriptsSubmenu(settings.scripts, mainWindow, displayWindow, packageInfo, settings);
    const tray = getTray();
    if (tray) {
      createTrayMenu(mainWindow, displayWindow, packageInfo, captureDevices, settings, isCurrentlyRecording, switchControlDevice);
    }
  });

  ipcMain.on("run-script", (event, scriptId) => {
    startScriptPlayback(scriptId);
  });

  ipcMain.on("stop-script", () => {
    displayWindow?.webContents.send("stop-script");
  });

  ipcMain.on("script-playback-done", (event, scriptId) => {
    isScriptPlaying = false;
    updateScriptRecordingMenuItems(isScriptRecording || isScriptPlaying, isScriptRecording, isScriptPlaying);
    mainWindow?.webContents.send("script-playback-done", scriptId);
    // Resolve any pending MCP run_script promise waiting on this script.
    const pending = mcpPendingScripts.get(scriptId);
    if (pending) {
      mcpPendingScripts.delete(scriptId);
      pending({ id: scriptId, completed: true });
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
  app.on("before-quit", () => {
    isQuitting = true;
    stopSleepWatcher();
    if (isMcpRunning()) {
      stopMcpServer();
    }
    if (isADBConnected) {
      disconnectADB();
    }
    if (isScriptRecording) {
      displayWindow?.webContents.send("discard-script-recording");
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (!isMacOS) {
    app.quit();
  }
});

// Handler for saving screenshot path
ipcMain.on("save-screenshot-path", (event, screenshotPath) => {
  if (!settings.files) {
    settings.files = {};
  }
  settings.files.screenshotPath = screenshotPath;
  saveSettings(settings);
});

// Handler for saving recording path
ipcMain.on("save-recording-path", (event, recordingPath) => {
  if (!settings.files) {
    settings.files = {};
  }
  settings.files.recordingPath = recordingPath;
  saveSettings(settings);
});

// Forward renderer-process log calls to the main-process logger
ipcMain.on("renderer-log", (event, level, ...args) => {
  const fn = typeof log[level] === "function" ? log[level] : log.debug;
  fn.call(log, "[Renderer]", ...args);
});

// Script management handlers
ipcMain.handle("get-scripts", async () => {
  return settings.scripts || [];
});

ipcMain.on("update-script-name", (event, { id, name }) => {
  const script = settings.scripts?.find((s) => s.id === id);
  if (script) {
    script.name = name.trim() || script.name;
    saveSettings(settings);
    const mainWindow = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("index.html"));
    const displayWindow = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("display.html"));
    mainWindow?.webContents.send("shared-window-channel", { type: "scripts-updated", payload: settings.scripts });
    updateScriptsSubmenu(settings.scripts, mainWindow, displayWindow, packageInfo, settings);
    const tray = getTray();
    if (tray) {
      createTrayMenu(mainWindow, displayWindow, packageInfo, null, settings, false);
    }
  }
});

ipcMain.on("update-script-steps", (event, { id, steps }) => {
  const script = settings.scripts?.find((s) => s.id === id);
  if (script) {
    script.steps = steps;
    saveSettings(settings);
    const mainWindow = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("index.html"));
    mainWindow?.webContents.send("shared-window-channel", { type: "scripts-updated", payload: settings.scripts });
  }
});

ipcMain.on("delete-script", (event, scriptId) => {
  if (settings.scripts) {
    settings.scripts = settings.scripts.filter((s) => s.id !== scriptId);
    saveSettings(settings);
    const mainWindow = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("index.html"));
    const displayWindow = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("display.html"));
    mainWindow?.webContents.send("shared-window-channel", { type: "scripts-updated", payload: settings.scripts });
    updateScriptsSubmenu(settings.scripts, mainWindow, displayWindow, packageInfo, settings);
    const tray = getTray();
    if (tray) {
      createTrayMenu(mainWindow, displayWindow, packageInfo, null, settings, false);
    }
  }
});

// Handler for opening folder containing file
ipcMain.handle("open-containing-folder", async (event, filePath) => {
  try {
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    console.error("Error opening containing folder:", error);
    return { success: false, error: error.message };
  }
});
