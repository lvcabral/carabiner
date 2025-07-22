/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const path = require("path");
const os = require("os");
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Notification,
  systemPreferences,
  globalShortcut,
  screen,
  shell,
} = require("electron");
const fs = require("fs");
const AutoLaunch = require("auto-launch");
const { saveSettings, loadSettings } = require("./settings");
const { connectADB, disconnectADB, sendADBKey, sendADBText } = require("./adb");
const {
  createMacOSMenu,
  updateAlwaysOnTopMenuItem,
  updateScreenshotMenuItems,
  updateRecordingMenuItems,
  updateShowDisplayMenuItem,
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
const { checkForUpdates, getUpdateStatus } = require("./updater");
const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));

if (require("electron-squirrel-startup") === true) app.quit();

const isMacOS = process.platform === "darwin";
const isWindows = process.platform === "win32";
const settings = loadSettings();
let lastSize = [500, 290];
let controlIp = "";
let controlType = "";
let isADBConnected = false;
let isQuitting = false;
let captureDevices;
let isCurrentlyRecording = false;
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
      width: 630,
      minHeight: isMacOS ? 620 : 645,
      minWidth: 630,
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

  // This is a workaround for the issue where frameless windows on Windows 11
  // show a title bar when the window loses focus and removes the 1-pixel border.
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

    win.on("blur", () => {
      win.setBackgroundColor("#00000000");
    });

    win.on("focus", () => {
      win.setBackgroundColor("#00000000");
    });

    // Additional event to ensure border stays removed
    win.on("show", () => {
      win.setBackgroundColor("#00000000");
    });

    // Force background update when window is restored from minimized state
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
  if (isMacOS) {
    createMacOSMenu(mainWindow, displayWindow, packageInfo, settings);
    // Ensure menu reflects the correct always on top state from settings
    updateAlwaysOnTopMenuItem(settings.display.alwaysOnTop ?? true);
    // Set initial state of show display menu item based on display window visibility
    updateShowDisplayMenuItem(settings.display?.visible !== false);
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
    setInterval(async () => {
      try {
        await checkForUpdates();
      } catch (error) {
        console.error("Error checking for updates:", error);
      }
    }, 4 * 60 * 60 * 1000);
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
  });

  displayWindow.on("minimize", () => {
    displayWindow.webContents.send("window-minimize");
    updateShowDisplayMenuItem(false);
  });

  displayWindow.on("restore", () => {
    displayWindow.webContents.send("window-restore");
    updateShowDisplayMenuItem(true);
  });

  ipcMain.on("shared-window-channel", (event, arg) => {
    displayWindow?.webContents?.send("shared-window-channel", arg);
    saveFlag = true;
    if (arg.type && arg.type === "set-capture-devices") {
      captureDevices = JSON.parse(arg.payload);
      mainWindow?.webContents?.send("shared-window-channel", arg);
      const tray = getTray();
      if (tray) {
        createTrayMenu(
          mainWindow,
          displayWindow,
          packageInfo,
          captureDevices,
          settings,
          isCurrentlyRecording
        );
      }
    } else if (arg.type && arg.type === "set-video-stream") {
      saveFlag = false;
      if (arg.payload?.video?.deviceId?.exact) {
        settings.display.deviceId = arg.payload.video.deviceId.exact;
        saveFlag = true;
      }
      if (arg.payload?.video?.width && arg.payload?.video?.height) {
        settings.display.captureWidth = arg.payload.video.width;
        settings.display.captureHeight = arg.payload.video.height;
        saveFlag = true;
      }
      if (!displayWindow.isVisible()) {
        displayWindow.show();
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
      const found = arg.payload.find((device) => device.id === settings.control.deviceId);
      if (!found) {
        settings.control.deviceId = "";
        if (isADBConnected) {
          isADBConnected = disconnectADB();
        }
      }
      settings.control.deviceList = arg.payload;
    } else if (arg.type && arg.type === "set-control-selected") {
      settings.control.deviceId = arg.payload;
      const oldControlIp = controlIp;
      [controlIp, controlType] = arg.payload.split("|");
      if (isADBConnected && oldControlIp !== controlIp) {
        isADBConnected = disconnectADB();
      }
      if (!isADBConnected && controlType === "adb") {
        isADBConnected = connectADB(controlIp, settings.control?.adbPath);
      }
    } else if (arg.type && arg.type === "send-adb-key") {
      sendADBKey(arg.payload);
    } else if (arg.type && arg.type === "send-adb-text") {
      sendADBText(arg.payload);
    } else if (arg.type && arg.type === "set-audio-enabled") {
      settings.display.audioEnabled = arg.payload;
      saveFlag = true;
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
      settings
    );
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
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

  ipcMain.handle("select-adb-path", async () => {
    resetFramelessWindow();
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Executables", extensions: ["exe", "bat", "sh", ""] }],
    });
    if (result.canceled) {
      return null;
    } else {
      const adbPath = result.filePaths[0];
      settings.control.adbPath = adbPath;
      return adbPath;
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

  // Version checking IPC handlers
  ipcMain.handle("check-for-updates", async () => {
    try {
      const result = await checkForUpdates();
      return { success: true, ...result };
    } catch (error) {
      console.error("Error checking for updates:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("get-update-status", async () => {
    return getUpdateStatus();
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

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
  app.on("before-quit", () => {
    isQuitting = true;
    if (isADBConnected) {
      disconnectADB();
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
