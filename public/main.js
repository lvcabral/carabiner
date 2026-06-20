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
const AutoLaunch = require("auto-launch");
const { saveSettings, loadSettings, makePair, newPairId } = require("./settings");
const { connectADB, disconnectADB, isADBConnected, sendADBKey, sendADBText } = require("./adb");
const { connectATV, disconnectATV, isATVConnected, sendATVKey, sendATVText } = require("./appletv");
const {
  connectRDK,
  disconnectRDK,
  isRDKConnected,
  sendRDKKey,
  sendRDKText,
  launchRDKApp,
  testRDKConnection,
} = require("./rdk");
const { discoverRokuDevices } = require("./ssdp");
const {
  createMacOSMenu,
  updateAlwaysOnTopMenuItem,
  updateEnableAudioMenuItem,
  updateScreenshotMenuItems,
  updateRecordingMenuItems,
  updateScriptRecordingMenuItems,
  updateScriptsSubmenu,
  createTrayMenu,
  setWindowActions,
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

// Single-instance lock — only one Carabiner process may run. Running a second
// instance would overwrite the shared settings.json, fail to bind the MCP port,
// and waste memory with extra Electron processes. When a second launch is
// attempted, bring the running instance forward instead (see issue #74).
const gotInstanceLock = app.requestSingleInstanceLock();
if (!gotInstanceLock) {
  app.quit();
} else {
  const surfaceWindow = (win) => {
    if (!win || win.isDestroyed()) return false;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    return true;
  };
  app.on("second-instance", () => {
    // Show the active Display window; if no window is enabled, show the Settings window.
    if (!surfaceWindow(getActiveWindow())) {
      surfaceWindow(mainWindow);
    }
  });
}

const isMacOS = process.platform === "darwin";
const isWindows = process.platform === "win32";
const isDev = process.env.ELECTRON_IS_DEV === "1";
const settings = loadSettings();
// Multi-window registry: each capture+control pair owns its own Display window.
let mainWindow = null; // settings (React) window; hoisted so helpers can reach it
const pairWindows = new Map(); // pairId -> BrowserWindow
const pairState = new Map(); // pairId -> { controlIp, controlType }
const senderToPair = new Map(); // webContents.id -> pairId (route renderer → main messages)
let activePairId = settings.activePairId || settings.pairs?.[0]?.id || "";
let isQuitting = false;
let captureDevices;
const recordingPairs = new Set(); // pairIds whose Display window is currently recording video
let isScriptRecording = false;
let isScriptPlaying = false;
let saveFlag = false;
let updateCheckTimeout = null;
let updateCheckInterval = null;

// Schedule the automatic update checks (initial delayed check + recurring one).
// No-op in dev or when the "Check for Updates" option is disabled. Safe to call
// repeatedly — it tears down any existing timers first.
function startUpdateChecks() {
  stopUpdateChecks();
  if (!app.isPackaged || settings.display.autoUpdate === false) {
    return;
  }
  // Check for updates 30 seconds after app start
  updateCheckTimeout = setTimeout(async () => {
    try {
      await checkForUpdates(settings);
    } catch (error) {
      console.error("Error checking for updates:", error);
    }
  }, 30000);

  // Check for updates every 24 hours
  updateCheckInterval = setInterval(
    async () => {
      try {
        await checkForUpdates(settings);
      } catch (error) {
        console.error("Error checking for updates:", error);
      }
    },
    24 * 60 * 60 * 1000
  );
}

// Cancel any scheduled automatic update checks.
function stopUpdateChecks() {
  if (updateCheckTimeout) {
    clearTimeout(updateCheckTimeout);
    updateCheckTimeout = null;
  }
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}

// Whether the active window is recording (menus' Start/Stop Recording act on it).
function isActiveRecording() {
  return recordingPairs.has(activePairId);
}

// ----- Pair / window helpers (module scope so both startup and IPC can use them) -----
function getPair(pairId) {
  return (settings.pairs || []).find((p) => p.id === pairId) || null;
}
function getActivePair() {
  return getPair(activePairId) || (settings.pairs || [])[0] || null;
}
function getWindow(pairId) {
  const win = pairWindows.get(pairId);
  return win && !win.isDestroyed() ? win : null;
}
function getActiveWindow() {
  const win = getWindow(activePairId);
  if (win) return win;
  for (const w of pairWindows.values()) {
    if (w && !w.isDestroyed()) return w;
  }
  return null;
}
function getDisplayWindows() {
  return [...pairWindows.values()].filter((w) => w && !w.isDestroyed());
}
function pairForEvent(event) {
  const id = event?.sender?.id;
  return id != null ? senderToPair.get(id) : undefined;
}
// Resolve an MCP deviceId to the pair bound to it; fall back to the active pair.
function pairIdForDeviceId(deviceId) {
  if (!deviceId) return activePairId;
  const p = (settings.pairs || []).find((x) => x.controlDeviceId === deviceId);
  return p ? p.id : activePairId;
}
function setActivePair(pairId) {
  if (!pairId || activePairId === pairId) return;
  activePairId = pairId;
  settings.activePairId = pairId;
  saveSettings(settings);
  mainWindow?.webContents?.send("active-pair-changed", pairId);
  rebuildMenus();
}

// Title for a Display window: capture card name + linked control (so the macOS Window
// menu can tell multiple Display windows apart).
function pairWindowTitle(pair) {
  const cap = (captureDevices || []).find((d) => d.deviceId === pair.captureDeviceId);
  const capName = cap?.label || "Display Window";
  const ctl = pair.controlDeviceId
    ? settings.control?.deviceList?.find((d) => d.id === pair.controlDeviceId)
    : null;
  const ctlName = ctl ? ctl.alias || ctl.type : null;
  return ctlName ? `${capName} → ${ctlName}` : capName;
}

// Keep each open Display window's title in sync with its pair (capture + control).
function updateWindowTitles() {
  for (const [pairId, win] of pairWindows) {
    if (!win || win.isDestroyed()) continue;
    const pair = getPair(pairId);
    if (pair) win.setTitle(pairWindowTitle(pair));
  }
}

// Rebuild the macOS app menu and tray so their actions (and the "Active Window" indicator)
// target the current active window. Non-context menus capture a window reference at build
// time, so they must be rebuilt when the active window, device list, or control changes.
function rebuildMenus() {
  updateWindowTitles();
  if (!mainWindow) return;
  const active = getActiveWindow();
  if (isMacOS) {
    createMacOSMenu(mainWindow, active, packageInfo, settings, captureDevices);
  }
  const tray = getTray();
  if (tray) {
    createTrayMenu(
      mainWindow,
      active,
      packageInfo,
      captureDevices,
      settings,
      isActiveRecording(),
      switchControlDevice
    );
  }
  // Re-apply dynamic states that a fresh build resets. Screenshot/recording require the
  // active window to be visible; the rest just require an enabled window to exist.
  const hasWindow = !!active;
  const activeVisible = hasWindow && active.isVisible();
  const activeRecording = isActiveRecording();
  updateScreenshotMenuItems(activeVisible);
  updateRecordingMenuItems(activeVisible, activeRecording);
  updateTrayRecordingMenuItems(activeRecording, activeVisible);
  updateAlwaysOnTopMenuItem(getActivePair()?.alwaysOnTop !== false);
  updateEnableAudioMenuItem(getActivePair()?.audioEnabled === true);
  // No window → also disable "Start Script Recording" / "Run Script".
  updateScriptRecordingMenuItems(
    !hasWindow || isScriptRecording || isScriptPlaying,
    isScriptRecording,
    isScriptPlaying
  );
}

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
    }
  });

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

// Resolve the RDK connection config ({host,port,token}) for a "<host:port>|rdk" device id.
function findRDKDeviceConfig(deviceId) {
  if (typeof deviceId !== "string" || !deviceId.endsWith("|rdk")) return null;
  const device = (settings.control.deviceList || []).find((d) => d.id === deviceId);
  if (!device) {
    const [hostPort] = deviceId.split("|");
    const [host, portStr] = hostPort.split(":");
    const port = parseInt(portStr, 10);
    if (!host || Number.isNaN(port)) return null;
    return { host, port, token: "" };
  }
  return { host: device.ipAddress, port: device.port, token: device.token || "" };
}

// True when another pair is still bound to the same control device id.
function isControlTargetSharedByOthers(pairId, deviceId) {
  if (!deviceId) return false;
  return (settings.pairs || []).some((p) => p.id !== pairId && p.controlDeviceId === deviceId);
}

// Connect (or re-register) the control device a pair is bound to, recording its
// routing target in pairState. Connecting the same target twice is a no-op in the
// control modules, so two pairs sharing a device safely share one connection.
function connectPairControl(pairId) {
  const pair = getPair(pairId);
  if (!pair) return;
  const deviceId = pair.controlDeviceId || "";
  const [ip = "", type = ""] = deviceId ? deviceId.split("|") : [];
  pairState.set(pairId, { controlDeviceId: deviceId, controlIp: ip, controlType: type });
  if (!deviceId) return;
  if (type === "adb") connectADB(ip, settings.control?.adbPath);
  else if (type === "atv") connectATV(ip, settings.control?.atvremotePath);
  else if (type === "rdk") {
    const cfg = findRDKDeviceConfig(deviceId);
    if (cfg) connectRDK(cfg.host, cfg.port, cfg.token);
  }
}

// Disconnect the control device for a pair, unless another pair still uses it.
function disconnectPairControl(pairId, deviceId) {
  const id = deviceId ?? pairState.get(pairId)?.controlDeviceId;
  if (!id || isControlTargetSharedByOthers(pairId, id)) return;
  const [ip = "", type = ""] = id.split("|");
  if (type === "adb") disconnectADB(ip);
  else if (type === "atv") disconnectATV(ip);
  else if (type === "rdk") {
    const cfg = findRDKDeviceConfig(id);
    if (cfg) disconnectRDK(cfg.host, cfg.port);
  }
}

// True once both the settings window and every Display window are hidden — used on
// macOS dock mode to hide the whole app.
function allWindowsHidden() {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) return false;
  return getDisplayWindows().every((w) => !w.isVisible());
}

function createDisplayWindow(pair) {
  let sizeFromRes = null;
  if (typeof pair.resolution === "string" && pair.resolution.includes("px")) {
    sizeFromRes = pair.resolution.split("|").map((dim) => parseInt(dim.replace("px", ""), 10) + 15);
  }

  // Windows 11 specific configuration to remove the 1-pixel border
  const windowOptions = {
    width: sizeFromRes?.[0] ?? 500,
    height: sizeFromRes?.[1] ?? 290,
    minWidth: 500,
    minHeight: 290,
    titleBarStyle: "hidden",
    transparent: true,
    darkTheme: false,
    hasShadow: false,
    frame: false,
    alwaysOnTop: pair.alwaysOnTop !== false,
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

  // Per-pair saved bounds override the size derived from resolution.
  const windowState = pair.bounds || {
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
  // Pass the pair id to the renderer so it knows which capture/control it owns.
  win.loadFile("public/display.html", { query: { pairId: pair.id } });
  win.setResizable(true);
  win.setAspectRatio(16 / 9);

  // Keep our pair-based title (capture + control) instead of the page's <title>, so the
  // macOS Window menu can distinguish multiple Display windows.
  win.on("page-title-updated", (e) => e.preventDefault());
  win.setTitle(pairWindowTitle(pair));

  pairWindows.set(pair.id, win);
  senderToPair.set(win.webContents.id, pair.id);

  const saveBounds = () => {
    if (!win.isFullScreen()) {
      const target = getPair(pair.id);
      if (target) {
        target.bounds = win.getBounds();
        saveSettings(settings);
      }
    }
  };

  if (isWindows) {
    // Apply Windows 11 specific fixes after the window is ready
    win.once("ready-to-show", () => {
      win.setBackgroundColor("#00000000");
      if (pair.visible !== false) win.show();
    });
    // Workaround: frameless windows on Windows 11 flash a title bar on focus changes.
    win.on("blur", () => win.setBackgroundColor("#00000000"));
    win.on("show", () => win.setBackgroundColor("#00000000"));
    win.on("restore", () => win.setBackgroundColor("#00000000"));
  } else {
    win.once("ready-to-show", () => {
      if (pair.visible !== false) win.show();
    });
  }

  win.on("focus", () => {
    if (isWindows) win.setBackgroundColor("#00000000");
    setActivePair(pair.id);
  });

  if (!isMacOS) {
    win.on("system-context-menu", (event) => event.preventDefault());
  }

  win.on("move", () => {
    win.webContents.send("window-moved");
    saveBounds();
  });

  win.on("resize", () => {
    if (!win.isFullScreen() && !isTogglingFullscreen()) {
      saveBounds();
    }
    if (!isTogglingFullscreen()) {
      if (!isMacOS) resetFullscreenVars();
      const [width, height] = win.getSize();
      mainWindow?.webContents?.send("shared-window-channel", {
        type: "window-resized",
        payload: { width, height, pairId: pair.id },
      });
    }
  });

  win.on("enter-full-screen", () => win.webContents.send("enter-full-screen"));
  win.on("leave-full-screen", () => win.webContents.send("leave-full-screen"));

  win.on("show", () => {
    win.webContents.send("window-show");
    // Rebuild menus so window-specific actions reflect the new visibility/active window.
    rebuildMenus();
  });

  win.on("hide", () => {
    win.webContents.send("window-hide");
    if (isMacOS && settings.display?.showInDock && !isTogglingFullscreen() && allWindowsHidden()) {
      app.hide();
    }
    if (isScriptRecording) {
      isScriptRecording = false;
    }
    rebuildMenus();
  });

  win.on("minimize", () => {
    win.webContents.send("window-minimize");
    if (isScriptRecording) isScriptRecording = false;
    rebuildMenus();
  });

  win.on("restore", () => {
    win.webContents.send("window-restore");
    rebuildMenus();
  });

  // Closing one Display window no longer quits the app — it just hides that pair.
  // The app quits via the tray/menu Quit, before-quit, or window-all-closed policy.
  win.on("close", () => {
    saveBounds();
    const target = getPair(pair.id);
    // Only a user-initiated close marks the pair hidden; on app quit we preserve the
    // last visibility so windows reopen as they were on the next launch.
    if (target && !isQuitting) {
      target.visible = false;
      saveSettings(settings);
    }
    senderToPair.delete(win.webContents.id);
    pairWindows.delete(pair.id);
    recordingPairs.delete(pair.id);
    if (!isQuitting) disconnectPairControl(pair.id);
    pairState.delete(pair.id);
    resetFullscreenVars();
  });

  return win;
}

// Open (create + connect + show) the Display window for a pair if not already open.
function openPair(pair) {
  if (!pair || getWindow(pair.id)) return getWindow(pair.id);
  const win = createDisplayWindow(pair);
  setAlwaysOnTop(pair.alwaysOnTop !== false, win);
  connectPairControl(pair.id);
  return win;
}

// Close and tear down the Display window for a pair.
function closePair(pairId) {
  const win = getWindow(pairId);
  if (win) win.close();
}

// Enable/disable a pair (pair.visible is the "enabled" flag = whether a Display window
// exists for the capture device). Enabling opens+shows the window; disabling closes it.
// Temporary show/hide of an enabled window is a separate concern (the global shortcut).
function togglePairVisibility(pairId, enabled) {
  const pair = getPair(pairId);
  if (!pair) return;
  pair.visible = enabled;
  saveSettings(settings);
  if (enabled) {
    let win = getWindow(pairId);
    if (!win) win = openPair(pair);
    win?.show();
  } else {
    closePair(pairId);
  }
  mainWindow?.webContents?.send("pairs-updated", settings.pairs);
}

// Switch the control device bound to a pair (defaults to the active pair). Reconciles
// the pair's control connection and notifies only that pair's Display window.
function switchControlDevice(deviceId, pairId = activePairId) {
  if (!deviceId) return;
  const pair = getPair(pairId);
  if (!pair) return;
  const prevDeviceId = pair.controlDeviceId;
  pair.controlDeviceId = deviceId;
  saveSettings(settings);
  if (prevDeviceId && prevDeviceId !== deviceId) {
    disconnectPairControl(pairId, prevDeviceId);
  }
  connectPairControl(pairId);
  const win = getWindow(pairId);
  win?.webContents?.send("shared-window-channel", {
    type: "set-control-selected",
    payload: deviceId,
  });
  win?.webContents?.send("shared-window-channel", {
    type: "set-control-list",
    payload: settings.control.deviceList,
  });
  mainWindow?.webContents?.send("update-control-device", {
    deviceId,
    deviceList: settings.control.deviceList,
    pairId,
  });
  mainWindow?.webContents?.send("pairs-updated", settings.pairs);
  rebuildMenus();
}

// Enable/disable a capture device's Display window from the tray, creating the pair on
// demand. Mirrors the General tab's Enabled checkbox.
function setCaptureWindowEnabled(captureDeviceId, enabled) {
  if (!captureDeviceId) return;
  if (!settings.pairs) settings.pairs = [];
  let pair = settings.pairs.find((p) => p.captureDeviceId === captureDeviceId);
  if (enabled) {
    if (!pair) {
      pair = makePair({ id: captureDeviceId, captureDeviceId, controlDeviceId: "", visible: true });
      settings.pairs.push(pair);
    } else {
      pair.visible = true;
    }
    saveSettings(settings);
    let win = getWindow(pair.id);
    if (!win) win = openPair(pair);
    win?.show();
  } else if (pair) {
    pair.visible = false;
    // Forget the pair entirely if nothing else (a linked control) needs remembering.
    if (!pair.controlDeviceId) {
      settings.pairs = settings.pairs.filter((p) => p.id !== pair.id);
    }
    saveSettings(settings);
    closePair(pair.id);
  }
  mainWindow?.webContents?.send("pairs-updated", settings.pairs);
  rebuildMenus();
}

// Show/hide an already-enabled window (transient — does NOT change the enabled flag, so
// the window stays in the registry and reopens on next launch). Gives the menu a way to
// re-show a window that was hidden via the shortcut or the Close Window command.
function setCaptureWindowVisible(captureDeviceId, visible) {
  const pair = (settings.pairs || []).find((p) => p.captureDeviceId === captureDeviceId);
  if (!pair) return;
  const win = getWindow(pair.id);
  if (!win) return; // not enabled
  if (visible) win.show();
  else hideWindowSafely(win, settings);
  rebuildMenus();
}

// Whether an enabled window is currently shown (used for the "Visible" menu checkbox).
function isCaptureWindowVisible(captureDeviceId) {
  const pair = (settings.pairs || []).find((p) => p.captureDeviceId === captureDeviceId);
  if (!pair) return false;
  const win = getWindow(pair.id);
  return !!win && win.isVisible();
}

// Reconcile the live windows with settings.pairs: open enabled, close disabled/removed,
// and apply control-device changes. Existing enabled windows are left as-is so a
// shortcut-driven hide isn't undone by an unrelated settings edit.
function reconcilePairs(newPairs) {
  const next = (newPairs || []).map((p) => makePair(p));
  const nextIds = new Set(next.map((p) => p.id));

  // Close windows whose pair was removed entirely.
  for (const id of [...pairWindows.keys()]) {
    if (!nextIds.has(id)) closePair(id);
  }

  // Detect control-device changes before we overwrite settings.pairs.
  const prevById = new Map((settings.pairs || []).map((p) => [p.id, p]));
  settings.pairs = next;
  if (!nextIds.has(activePairId)) {
    activePairId = next[0]?.id || "";
    settings.activePairId = activePairId;
  }
  saveSettings(settings);

  for (const pair of next) {
    const prev = prevById.get(pair.id);
    const win = getWindow(pair.id);
    // Disabled pair: ensure its window is closed (so it can't be re-shown by the shortcut).
    if (pair.visible === false) {
      if (win) closePair(pair.id);
      continue;
    }
    // Enabled but no window yet: open it.
    if (!win) {
      openPair(pair);
      continue;
    }
    // Enabled with an existing window: apply only control-device changes.
    if (!prev || prev.controlDeviceId !== pair.controlDeviceId) {
      if (prev?.controlDeviceId) disconnectPairControl(pair.id, prev.controlDeviceId);
      connectPairControl(pair.id);
      win.webContents.send("shared-window-channel", {
        type: "set-control-selected",
        payload: pair.controlDeviceId,
      });
    }
  }
}

function setAlwaysOnTop(alwaysOnTop, window) {
  if (alwaysOnTop === false) {
    window.setAlwaysOnTop(false);
  } else {
    window.setAlwaysOnTop(true, "floating", 1);
  }
  updateAlwaysOnTopMenuItem(alwaysOnTop);
}

// Global shortcut toggles all Display windows together: if any is visible, hide them
// all; otherwise show them all. Deterministic regardless of which window has focus.
function registerShortcut(shortcut) {
  globalShortcut.unregisterAll();
  if (!shortcut) return;
  globalShortcut.register(shortcut, () => {
    const wins = getDisplayWindows();
    if (wins.length === 0) return;
    if (wins.some((w) => w.isVisible())) {
      wins.forEach((w) => {
        if (w.isVisible()) hideWindowSafely(w, settings);
      });
    } else {
      wins.forEach((w) => w.show());
    }
  });
}

app.whenReady().then(async () => {
  // Second instance: the lock holder handles focusing; bail before creating windows.
  if (!gotInstanceLock) return;
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

  mainWindow = createMainWindow();
  // Open a Display window for each ENABLED pair (visible !== false). Disabled pairs are
  // remembered in settings but have no window until enabled.
  (settings.pairs || []).filter((p) => p.visible !== false).forEach((pair) => openPair(pair));
  // Drive the "Display Windows" submenu: Enabled (create/destroy) + Visible (show/hide).
  setWindowActions({
    enableCapture: setCaptureWindowEnabled,
    setVisible: setCaptureWindowVisible,
    isVisible: isCaptureWindowVisible,
  });

  // With no Display window (no capture device connected, or all disabled) there's nothing
  // to look at, so always show the settings window at start so the user can configure one.
  const anyEnabledPair = (settings.pairs || []).some((p) => p.visible !== false);
  if (!anyEnabledPair && mainWindow && !mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.focus();
  }

  // --- Allow Mac to sleep (issue #91) ---------------------------------------
  // Live audio I/O (and the playing <video>) cause macOS to hold
  // PreventUserIdleSystemSleep / "Video Wake Lock" assertions, which keep the
  // machine awake. The app can't suppress those assertions directly, so when
  // the user locks the screen we pause the capture stream (releasing them) and
  // resume it on unlock. Controlled by settings.display.allowSleep (default on).
  //
  // We deliberately only act on screen lock/unlock — a deterministic
  // "user walked away / came back" signal — rather than an idle timeout, so
  // passively watching the stream never pauses it. The trade-off is that the
  // Mac only sleeps once the screen is locked, not on plain inactivity.
  let sleepWatcherStarted = false;
  let autoSuspended = false;

  function suspendCapture() {
    const windows = getDisplayWindows();
    if (autoSuspended || windows.length === 0) return;
    autoSuspended = true;
    if (isDev) log.info("[allow-sleep] screen locked — pausing capture");
    windows.forEach((win) => win.webContents.send("auto-suspend"));
  }

  function resumeCapture() {
    if (!autoSuspended) return;
    autoSuspended = false;
    if (isDev) log.info("[allow-sleep] screen unlocked — resuming capture");
    getDisplayWindows().forEach((win) => {
      if (win.isVisible()) win.webContents.send("auto-resume");
    });
  }

  function startSleepWatcher() {
    if (sleepWatcherStarted) return;
    sleepWatcherStarted = true;
    if (isDev) log.info("[allow-sleep] watcher started — pausing capture on screen lock");
    powerMonitor.on("lock-screen", suspendCapture);
    powerMonitor.on("unlock-screen", resumeCapture);
  }

  function stopSleepWatcher() {
    sleepWatcherStarted = false;
    powerMonitor.removeListener("lock-screen", suspendCapture);
    powerMonitor.removeListener("unlock-screen", resumeCapture);
    if (autoSuspended) resumeCapture();
  }

  if (isMacOS) {
    // macOS only: this works around the macOS audio/video sleep assertions and the
    // toggle is hidden on other platforms (see DisplaySection.js).
    if (settings.display?.allowSleep !== false) {
      startSleepWatcher();
    } else if (isDev) {
      log.info("[allow-sleep] watcher not started — display.allowSleep is disabled");
    }
    createMacOSMenu(mainWindow, getActiveWindow(), packageInfo, settings, captureDevices);
    // Ensure menu reflects the active pair's always on top / audio state from settings
    updateAlwaysOnTopMenuItem(getActivePair()?.alwaysOnTop !== false);
    updateEnableAudioMenuItem(getActivePair()?.audioEnabled === true);
  }

  // This is a workaround for the issue where frameless windows on Windows 11
  // show a title bar when the window loses focus.
  function resetFramelessWindow() {
    if (isWindows) {
      setTimeout(() => {
        getDisplayWindows().forEach((win) => win.setBackgroundColor("#00000000"));
      }, 1000);
    }
  }

  // Initialize dock/tray mode based on user setting (both macOS and Windows)
  if (isMacOS || isWindows) {
    const showInDock = settings.display.showInDock !== false; // Default to true
    toggleDockIcon(showInDock, mainWindow, getActiveWindow(), packageInfo);
  }

  // Normalize all menu enable-states once windows + tray exist (disables window-specific
  // actions when there is no enabled/active window).
  rebuildMenus();

  if (settings.display?.shortcut) {
    registerShortcut(settings.display.shortcut);
  }

  // Initialize version checking (only in production and if enabled)
  startUpdateChecks();

  // Hide the whole app on macOS dock mode once every window is hidden. Per-window
  // show/hide/minimize/restore handlers live in createDisplayWindow().
  if (isMacOS) {
    mainWindow.on("hide", () => {
      if (settings.display?.showInDock && !isTogglingFullscreen() && allWindowsHidden()) {
        app.hide();
      }
    });
  }

  ipcMain.on("shared-window-channel", (event, arg) => {
    // Resolve which pair this message targets: explicit pairId (from the settings UI),
    // the sending Display window (renderer → main), else the active pair.
    const pairId = arg.pairId || pairForEvent(event) || activePairId;
    const targetWin = getWindow(pairId);
    const pair = getPair(pairId);

    // Forward renderer-bound appearance/control messages to the target pair's window.
    // Control-key sends originate from the renderer (no echo), and the messages below
    // are handled with bespoke forwarding/visibility logic.
    const NO_FORWARD = new Set([
      "set-video-stream",
      "set-capture-devices",
      "send-adb-key",
      "send-adb-text",
      "send-atv-key",
      "send-atv-text",
      "send-rdk-key",
      "send-rdk-text",
      "clear-overlay-image",
      "set-display-size",
    ]);
    if (!NO_FORWARD.has(arg.type)) {
      targetWin?.webContents?.send("shared-window-channel", arg);
    }
    saveFlag = true;
    if (arg.type && arg.type === "set-capture-devices") {
      const newDevices = JSON.parse(arg.payload);

      // De-dupe: every Display window reports the same hardware list on load, so only
      // rebuild the tray when the global list actually changes.
      const devicesChanged =
        !captureDevices ||
        captureDevices.length !== newDevices.length ||
        !captureDevices.every((oldDev) =>
          newDevices.some((newDev) => newDev.deviceId === oldDev.deviceId)
        ) ||
        !newDevices.every((newDev) =>
          captureDevices.some((oldDev) => oldDev.deviceId === newDev.deviceId)
        );

      // If the sending pair's capture device was removed and its window is hidden, show it.
      if (
        pair?.captureDeviceId &&
        !newDevices.find((device) => device.deviceId === pair.captureDeviceId) &&
        targetWin &&
        !targetWin.isVisible()
      ) {
        targetWin.show();
      }

      captureDevices = newDevices;
      mainWindow?.webContents?.send("shared-window-channel", arg);

      // Rebuild menus so device-name labels (incl. the active-window indicator) refresh.
      if (devicesChanged) rebuildMenus();
    } else if (arg.type && arg.type === "set-video-stream") {
      saveFlag = false;
      let deviceIdChanged = false;
      if (pair && arg.payload?.video?.deviceId?.exact) {
        const newDeviceId = arg.payload.video.deviceId.exact;
        if (pair.captureDeviceId !== newDeviceId) {
          pair.captureDeviceId = newDeviceId;
          deviceIdChanged = true;
        }
        saveFlag = true;
      }
      if (pair && arg.payload?.video?.width && arg.payload?.video?.height) {
        pair.captureWidth = arg.payload.video.width;
        pair.captureHeight = arg.payload.video.height;
        saveFlag = true;
      }

      if (deviceIdChanged && captureDevices?.length > 0) rebuildMenus();

      // Forward to the target window when visible; show it if explicitly requested.
      if (targetWin?.isVisible()) {
        targetWin.webContents.send("shared-window-channel", arg);
      }
      if (arg.payload?.showDisplayWindow && targetWin && !targetWin.isVisible()) {
        targetWin.show();
        targetWin.webContents.send("shared-window-channel", arg);
      }
    } else if (arg.type && arg.type === "set-transparency") {
      saveFlag = false;
      if (pair && typeof arg.payload === "number") {
        pair.transparency = arg.payload;
        saveFlag = true;
      }
      if (targetWin && !targetWin.isVisible()) targetWin.show();
    } else if (arg.type && arg.type === "set-resolution") {
      const { width, height } = arg.payload;
      if (pair) pair.resolution = `${width}|${height}`;
      saveFlag = true;
    } else if (arg.type && arg.type === "set-border-width") {
      if (pair) pair.border = { ...pair.border, width: arg.payload };
      if (targetWin && !targetWin.isVisible()) targetWin.show();
    } else if (arg.type && arg.type === "set-border-style") {
      if (pair) pair.border = { ...pair.border, style: arg.payload };
      if (targetWin && !targetWin.isVisible()) targetWin.show();
    } else if (arg.type && arg.type === "set-border-color") {
      if (pair) pair.border = { ...pair.border, color: arg.payload };
      if (targetWin && !targetWin.isVisible()) targetWin.show();
    } else if (arg.type && arg.type === "set-control-list") {
      // The device catalog is global. Remove any pair binding to a deleted device.
      const remainingIds = new Set(arg.payload.map((d) => d.id));
      let clearedAny = false;
      (settings.pairs || []).forEach((p) => {
        if (p.controlDeviceId && !remainingIds.has(p.controlDeviceId)) {
          disconnectPairControl(p.id, p.controlDeviceId);
          p.controlDeviceId = "";
          clearedAny = true;
          getWindow(p.id)?.webContents?.send("shared-window-channel", {
            type: "set-control-selected",
            payload: "",
          });
        }
      });
      settings.control.deviceList = arg.payload;
      if (clearedAny) mainWindow?.webContents?.send("pairs-updated", settings.pairs);
    } else if (arg.type && arg.type === "set-control-selected") {
      if (pair) {
        const prev = pair.controlDeviceId;
        pair.controlDeviceId = arg.payload;
        if (prev && prev !== arg.payload) disconnectPairControl(pairId, prev);
        connectPairControl(pairId);
      }
    } else if (arg.type && arg.type === "send-adb-key") {
      sendADBKey(arg.payload, pairState.get(pairId)?.controlIp);
    } else if (arg.type && arg.type === "send-adb-text") {
      sendADBText(arg.payload, pairState.get(pairId)?.controlIp);
    } else if (arg.type && arg.type === "send-atv-key") {
      sendATVKey(arg.payload, pairState.get(pairId)?.controlIp);
    } else if (arg.type && arg.type === "send-atv-text") {
      sendATVText(arg.payload, pairState.get(pairId)?.controlIp);
    } else if (arg.type && arg.type === "send-rdk-key") {
      sendRDKKey(arg.payload, [], findRDKDeviceConfig(pairState.get(pairId)?.controlDeviceId));
    } else if (arg.type && arg.type === "send-rdk-text") {
      sendRDKText(arg.payload, findRDKDeviceConfig(pairState.get(pairId)?.controlDeviceId));
    } else if (arg.type && arg.type === "set-adb-path") {
      settings.control.adbPath = arg.payload;
      saveFlag = true;
    } else if (arg.type && arg.type === "set-atv-path") {
      settings.control.atvremotePath = arg.payload;
      saveFlag = true;
    } else if (arg.type && arg.type === "set-audio-enabled") {
      if (pair) pair.audioEnabled = arg.payload;
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
      targetWin?.webContents?.send("clear-overlay-image");
    } else if (arg.type && arg.type === "set-display-size") {
      saveFlag = false;
      const { width, height } = arg.payload;
      if (targetWin && width && height) {
        if (!targetWin.isVisible()) targetWin.show();
        targetWin.setSize(width, height);
        mainWindow?.webContents?.send("shared-window-channel", {
          type: "window-resized",
          payload: { width, height, pairId },
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
    registerShortcut(shortcut);
  });

  // ----- Multi-window pair management (capture+control pairs → Display windows) -----
  ipcMain.on("set-pairs", (event, pairs) => {
    reconcilePairs(pairs);
    rebuildMenus();
    mainWindow?.webContents?.send("pairs-updated", settings.pairs);
  });

  ipcMain.on("toggle-pair-visibility", (event, { pairId, visible } = {}) => {
    togglePairVisibility(pairId, visible);
  });

  ipcMain.on("set-active-pair", (event, pairId) => {
    setActivePair(pairId);
  });

  ipcMain.handle("get-pairs", async () => ({ pairs: settings.pairs, activePairId }));

  // The capture-device list is reported by the Display window(s) on load. Cache it so a
  // late-mounting renderer (e.g. a pair's capture dropdown) can fetch it without waiting
  // for the next broadcast.
  ipcMain.handle("get-capture-devices", async () => captureDevices || []);

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

  ipcMain.on("save-always-on-top", (event, alwaysOnTop, pairId = activePairId) => {
    const pair = getPair(pairId);
    if (pair) {
      pair.alwaysOnTop = alwaysOnTop;
      saveSettings(settings);
    }

    const win = getWindow(pairId);
    if (win) {
      // Show the window so the user can see the always-on-top behavior change.
      if (!win.isVisible()) win.show();
      setAlwaysOnTop(alwaysOnTop, win);
    } else {
      updateAlwaysOnTopMenuItem(alwaysOnTop);
    }

    // Broadcast the change to the React UI
    mainWindow.webContents.send("update-always-on-top", { value: alwaysOnTop, pairId });
    mainWindow?.webContents?.send("pairs-updated", settings.pairs);
  });

  ipcMain.on("save-audio-enabled", (event, audioEnabled, pairId = activePairId) => {
    const pair = getPair(pairId);
    if (pair) {
      pair.audioEnabled = audioEnabled;
      saveSettings(settings);
    }

    // Update all menu items to reflect the new state
    updateEnableAudioMenuItem(audioEnabled);

    // Forward to the pair's Display window so it toggles its stream audio.
    getWindow(pairId)?.webContents?.send("shared-window-channel", {
      type: "set-audio-enabled",
      payload: audioEnabled,
    });

    // Broadcast the change to the React UI
    mainWindow.webContents.send("update-audio-enabled", { value: audioEnabled, pairId });
    mainWindow?.webContents?.send("pairs-updated", settings.pairs);
  });

  ipcMain.on("save-dark-mode", (event, darkMode) => {
    settings.display.darkMode = darkMode;
    saveSettings(settings);
  });

  ipcMain.on("save-check-for-updates", (event, checkForUpdates) => {
    settings.display.autoUpdate = checkForUpdates;
    saveSettings(settings);
    // Start/stop the scheduled checks live so toggling the option takes effect
    // immediately instead of only on the next launch.
    startUpdateChecks();
  });

  // Manual "Check for Updates" triggered from a menu — always runs (even in dev)
  // and gives the user feedback when there is nothing to download.
  ipcMain.on("check-for-updates", () => {
    checkForUpdates(settings, true).catch((error) => {
      console.error("Error checking for updates:", error);
    });
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
    toggleDockIcon(showInDock, mainWindow, getActiveWindow(), packageInfo);

    // A freshly created tray is built without device data; populate it (and refresh the
    // app menu) so the Display Windows submenu reflects the current capture devices.
    rebuildMenus();

    // If switching to menubar mode (unchecking), ensure window stays visible
    if (!showInDock) {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  ipcMain.on("toggle-fullscreen-window", (event) => {
    const win = getWindow(pairForEvent(event)) || getActiveWindow();
    if (win) toggleFullScreen(win);
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
    const win = getWindow(pairForEvent(event)) || getActiveWindow();
    if (!win) {
      return;
    }
    openDevTools(win);
  });

  ipcMain.on("show-context-menu", (event) => {
    const ctxPairId = pairForEvent(event) || activePairId;
    const win = getWindow(ctxPairId) || getActiveWindow();
    const menu = createContextMenu(
      mainWindow,
      win,
      packageInfo,
      recordingPairs.has(ctxPairId),
      captureDevices,
      settings,
      isScriptRecording,
      isScriptPlaying,
      switchControlDevice
    );
    menu.popup({ window: win || undefined });
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
      getActiveWindow()?.webContents?.send("image-loaded", `data:${mimeType};base64,${imageData}`);
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

  ipcMain.handle("test-rdk-connection", async (event, { host, port, token } = {}) => {
    return testRDKConnection({ host, port, token });
  });

  ipcMain.handle("launch-rdk-app", async (event, { client, uri } = {}) => {
    try {
      const target = findRDKDeviceConfig(pairState.get(activePairId)?.controlDeviceId);
      const result = await launchRDKApp(client, uri, target);
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("discover-roku-devices", async (event, timeoutMs) => {
    try {
      const devices = await discoverRokuDevices(timeoutMs);
      return { success: true, devices };
    } catch (err) {
      return { success: false, error: err.message };
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
      const result = await dialog.showSaveDialog(getActiveWindow() || mainWindow, {
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

  // Recording state management — tracked per pair (each Display window records its own
  // stream to its own file), keyed by the sending window.
  ipcMain.on("recording-state-changed", (event, isRecording) => {
    const pairId = pairForEvent(event) || activePairId;
    if (isRecording) recordingPairs.add(pairId);
    else recordingPairs.delete(pairId);
    rebuildMenus();
  });

  // Save screenshot dialog
  ipcMain.handle("save-screenshot-dialog", async (event, filename, imageData) => {
    try {
      const defaultPath = settings.files?.screenshotPath
        ? path.join(settings.files.screenshotPath, filename)
        : path.join(os.homedir(), "Pictures", filename);
      resetFramelessWindow();
      const result = await dialog.showSaveDialog(getActiveWindow() || mainWindow, {
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

  // Script recording controls — single-active, routed to the active Display window.
  ipcMain.on("start-script-recording", () => {
    if (!isScriptRecording) {
      const win = getActiveWindow();
      if (win && !win.isVisible()) win.show();
      isScriptRecording = true;
      updateScriptRecordingMenuItems(isScriptRecording || isScriptPlaying, isScriptRecording, isScriptPlaying);
      mainWindow?.webContents.send("script-recording-state-changed", true);
      win?.webContents.send("start-script-recording");
    }
  });

  ipcMain.on("stop-script-recording", () => {
    if (isScriptRecording) {
      // Broadcast — only the window currently recording acts on it.
      getDisplayWindows().forEach((win) => win.webContents.send("stop-script-recording"));
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
  function callDisplay(action, params = {}, pairId = activePairId) {
    return new Promise((resolve, reject) => {
      const win = getWindow(pairId) || getActiveWindow();
      if (!win) {
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
      win.webContents.send("mcp-rpc-request", { requestId, action, params });
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
  function startScriptPlayback(scriptId, pairId = activePairId) {
    if (isScriptRecording || isScriptPlaying) return false;
    const script = settings.scripts?.find((s) => s.id === scriptId);
    if (!script) return false;
    const win = getWindow(pairId) || getActiveWindow();
    if (win && !win.isVisible()) win.show();
    isScriptPlaying = true;
    updateScriptRecordingMenuItems(isScriptRecording || isScriptPlaying, isScriptRecording, isScriptPlaying);
    mainWindow?.webContents.send("script-playback-started", script.id);
    win?.webContents.send("play-script", {
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
    // List the live Display windows (pairs) so an MCP agent can target one explicitly.
    listWindows: () =>
      (settings.pairs || []).map((p) => {
        const cap = (captureDevices || []).find((d) => d.deviceId === p.captureDeviceId);
        const win = getWindow(p.id);
        return {
          pairId: p.id,
          captureDeviceId: p.captureDeviceId || "",
          captureLabel: cap?.label || "",
          controlDeviceId: p.controlDeviceId || "",
          visible: !!win && win.isVisible(),
          active: p.id === activePairId,
        };
      }),
    // Device control — `deviceId` optionally targets a specific window's device.
    getCurrentDevice: (deviceId) => {
      const pairId = pairIdForDeviceId(deviceId);
      const id = deviceId || getPair(pairId)?.controlDeviceId || "";
      const [ip = "", type = ""] = id ? id.split("|") : [];
      let connected = false;
      if (type === "adb") connected = isADBConnected(ip);
      else if (type === "atv") connected = isATVConnected(ip);
      else if (type === "rdk") {
        const cfg = findRDKDeviceConfig(id);
        connected = cfg ? isRDKConnected(cfg.host, cfg.port) : false;
      } else if (type === "ecp") connected = !!ip;
      return { id, ip, type, connected, pairId };
    },
    listDevices: () => {
      const activeControl = getActivePair()?.controlDeviceId;
      return (settings.control.deviceList || []).map((d) => ({
        id: d.id,
        name: d.alias || "",
        deviceType: d.type || "",
        ipAddress: d.ipAddress || (d.id ? d.id.split("|")[0] : ""),
        protocol: d.id ? d.id.split("|")[1] : "",
        selected: d.id === activeControl,
      }));
    },
    selectDevice: (deviceId) => {
      const device = (settings.control.deviceList || []).find((d) => d.id === deviceId);
      if (!device) throw new Error(`Unknown device id: ${deviceId}`);
      // If a window is already bound to this device, make it active; otherwise switch
      // the active window's control device to it.
      const bound = (settings.pairs || []).find((p) => p.controlDeviceId === deviceId);
      if (bound) {
        setActivePair(bound.id);
      } else {
        switchControlDevice(deviceId, activePairId);
      }
      return mcpCtx.getCurrentDevice(deviceId);
    },
    launchApp: async ({ client, uri, deviceId } = {}) => {
      const pairId = pairIdForDeviceId(deviceId);
      const st = pairState.get(pairId);
      if (st?.controlType !== "rdk") {
        throw new Error("launch_app is only supported on RDK (Xumo) devices.");
      }
      if (!client) {
        throw new Error("client is required.");
      }
      const result = await launchRDKApp(client, uri, findRDKDeviceConfig(st.controlDeviceId));
      return { launched: client, uri: uri || null, result };
    },
    sendKey: async (nativeKey, mod, deviceId) => {
      const pairId = pairIdForDeviceId(deviceId);
      if (!getPair(pairId)?.controlDeviceId) {
        throw new Error("No control device selected. Use select_device first.");
      }
      await callDisplay("send-key", { key: nativeKey, mod }, pairId);
      return { sent: nativeKey };
    },
    sendText: async (text, deviceId) => {
      const pairId = pairIdForDeviceId(deviceId);
      if (!getPair(pairId)?.controlDeviceId) {
        throw new Error("No control device selected. Use select_device first.");
      }
      await callDisplay("send-text", { text }, pairId);
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
    takeScreenshot: async ({ save = true, deviceId } = {}) => {
      const pairId = pairIdForDeviceId(deviceId);
      const dataUrl = await callDisplay("capture-screenshot", {}, pairId);
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
    startRecording: async ({ filenamePrefix, deviceId } = {}) => {
      await callDisplay("start-recording", { filenamePrefix }, pairIdForDeviceId(deviceId));
      return { recording: true };
    },
    stopRecording: async ({ deviceId } = {}) =>
      callDisplay("stop-recording", {}, pairIdForDeviceId(deviceId)),
    // Scripts
    listScripts: () =>
      (settings.scripts || []).map((s) => ({
        id: s.id,
        name: s.name,
        controlType: s.controlType,
        stepCount: s.steps?.length || 0,
      })),
    getScripts: () => settings.scripts || [],
    runScript: (scriptId, deviceId) =>
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
        if (!startScriptPlayback(scriptId, pairIdForDeviceId(deviceId))) {
          mcpPendingScripts.delete(scriptId);
          reject(new Error("Failed to start script playback."));
        }
      }),
    stopScript: () => {
      getDisplayWindows().forEach((win) => win.webContents.send("stop-script"));
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
      updateScriptsSubmenu(settings.scripts, mainWindow, getActiveWindow(), packageInfo, settings);
      return { id: script.id, name: script.name, controlType: script.controlType, stepCount: script.steps.length };
    },
    deleteScript: (scriptId) => {
      const before = settings.scripts?.length || 0;
      settings.scripts = (settings.scripts || []).filter((s) => s.id !== scriptId);
      saveSettings(settings);
      mainWindow?.webContents.send("shared-window-channel", { type: "scripts-updated", payload: settings.scripts });
      updateScriptsSubmenu(settings.scripts, mainWindow, getActiveWindow(), packageInfo, settings);
      return { deleted: before !== settings.scripts.length };
    },
    // Display window — `deviceId` optionally targets a specific window/pair.
    showDisplay: ({ deviceId } = {}) => {
      const pairId = pairIdForDeviceId(deviceId);
      togglePairVisibility(pairId, true);
      return { visible: true };
    },
    hideDisplay: ({ deviceId } = {}) => {
      const pairId = pairIdForDeviceId(deviceId);
      togglePairVisibility(pairId, false);
      return { visible: false };
    },
    toggleFullscreen: ({ deviceId } = {}) => {
      const win = getWindow(pairIdForDeviceId(deviceId));
      if (win) toggleFullScreen(win);
      return { fullscreen: !!win && win.isFullScreen() };
    },
    toggleOnTop: ({ deviceId } = {}) => {
      const pairId = pairIdForDeviceId(deviceId);
      const pair = getPair(pairId);
      const newVal = !(pair?.alwaysOnTop !== false);
      if (pair) {
        pair.alwaysOnTop = newVal;
        saveSettings(settings);
      }
      const win = getWindow(pairId);
      if (win) {
        if (!win.isVisible()) win.show();
        setAlwaysOnTop(newVal, win);
      }
      mainWindow?.webContents?.send("update-always-on-top", { value: newVal, pairId });
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
    updateScriptsSubmenu(settings.scripts, mainWindow, getActiveWindow(), packageInfo, settings);
    const tray = getTray();
    if (tray) {
      createTrayMenu(mainWindow, getActiveWindow(), packageInfo, captureDevices, settings, isActiveRecording(), switchControlDevice);
    }
  });

  ipcMain.on("run-script", (event, scriptId, pairId) => {
    startScriptPlayback(scriptId, pairId || activePairId);
  });

  ipcMain.on("stop-script", () => {
    getDisplayWindows().forEach((win) => win.webContents.send("stop-script"));
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
    stopUpdateChecks();
    if (isMcpRunning()) {
      stopMcpServer();
    }
    // Tear down every control connection (no-arg disconnect clears all targets).
    disconnectADB();
    disconnectATV();
    disconnectRDK();
    if (isScriptRecording) {
      getDisplayWindows().forEach((win) => win.webContents.send("discard-script-recording"));
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
