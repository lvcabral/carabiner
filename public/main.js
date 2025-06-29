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
const {
  app,
  shell,
  BrowserWindow,
  dialog,
  ipcMain,
  Notification,
  systemPreferences,
  globalShortcut,
  Menu,
  MenuItem,
  Tray,
} = require("electron");
const fs = require("fs");
const AutoLaunch = require("auto-launch");
const { saveSettings, loadSettings } = require("./settings");
const { connectADB, disconnectADB, sendADBKey, sendADBText } = require("./adb");
const {
  createMenu,
  updateAlwaysOnTopMenuItem,
  updateScreenshotMenuItems,
  updateRecordingMenuItems,
} = require("./menu");
const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));

if (require("electron-squirrel-startup") === true) app.quit();

const isMacOS = process.platform === "darwin";
const settings = loadSettings();
let lastSize = [500, 290];
let controlIp = "";
let controlType = "";
let isADBConnected = false;
let isQuitting = false;
let captureDevices;
let isCurrentlyRecording = false;
let tray = null;
let trayContextMenu = null;
let trayStartRecordingItem = null;
let trayStopRecordingItem = null;

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
      app.quit();
    }
  });

  if (name === "displayWindow") {
    win.on("hide", () => {
      win.webContents.send("stop-video-stream");
      updateScreenshotMenuItems(false);
      updateRecordingMenuItems(false, false);
      updateTrayRecordingMenuItems(false, isCurrentlyRecording);
    });

    win.on("show", () => {
      win.webContents.send("start-video-stream");
      updateScreenshotMenuItems(true);
      updateRecordingMenuItems(true, false);
      updateTrayRecordingMenuItems(true, isCurrentlyRecording);
    });
  }

  return win;
}

function createMainWindow() {
  const win = createWindow(
    "mainWindow",
    {
      height: isMacOS ? 620 : 645,
      width: 600,
      minHeight: isMacOS ? 620 : 645,
      minWidth: 600,
      maximizable: false,
      resizable: false,
      autoHideMenuBar: true,
      icon: __dirname + "/images/icon.ico",
    },
    settings.display.showSettingsOnStart
  );
  const loadURL =
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../build/index.html")}`;
  win.loadURL(loadURL);
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
  const win = createWindow("displayWindow", {
    width: lastSize[0] ?? 500,
    height: lastSize[1] ?? 290,
    minWidth: 500,
    minHeight: 290,
    titleBarStyle: "hide",
    transparent: true,
    darkTheme: false,
    hasShadow: false,
    frame: false,
    alwaysOnTop: true,
  });
  win.loadFile("public/display.html");
  win.setResizable(true);
  win.setAspectRatio(16 / 9);
  win.on("move", () => {
    win.webContents.send("window-moved");
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
      window.hide();
    } else {
      window.show();
    }
  });
}

function createTray(mainWindow, displayWindow) {
  if (!isMacOS) return;

  // Create tray icon - use the dedicated menuicon.png
  let trayIconPath = path.join(__dirname, "../images/menuicon.png");

  // Check if the file exists, if not try alternative paths
  if (!fs.existsSync(trayIconPath)) {
    trayIconPath = path.join(process.cwd(), "images/menuicon.png");
  }
  if (!fs.existsSync(trayIconPath)) {
    trayIconPath = path.join(__dirname, "images/menuicon.png");
  }

  console.log("Tray icon path:", trayIconPath);
  console.log("Icon exists:", fs.existsSync(trayIconPath));

  tray = new Tray(trayIconPath);
  // Try to set template mode if the method exists
  if (typeof tray.setTemplate === "function") {
    tray.setTemplate(true);
  }

  // Create context menu for tray
  trayContextMenu = Menu.buildFromTemplate([
    {
      label: "Show Carabiner",
      click: () => {
        // Only show the display window (screen capture window)
        if (displayWindow && !displayWindow.isVisible()) {
          displayWindow.show();
        }
      },
    },
    {
      label: "Settings...",
      click: () => {
        mainWindow.webContents.send("open-display-tab");
        mainWindow.show();
      },
    },
    { type: "separator" },
    {
      label: "Start Recording",
      id: "tray-start-recording",
      enabled: false,
      click: () => {
        if (displayWindow) {
          if (!displayWindow.isVisible()) {
            displayWindow.show();
          }
          displayWindow.webContents.send("start-recording");
        }
      },
    },
    {
      label: "Stop Recording",
      id: "tray-stop-recording",
      enabled: false,
      click: () => {
        if (displayWindow) {
          displayWindow.webContents.send("stop-recording");
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit Carabiner",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  // Store references to the recording menu items for later updates
  trayStartRecordingItem = trayContextMenu.getMenuItemById("tray-start-recording");
  trayStopRecordingItem = trayContextMenu.getMenuItemById("tray-stop-recording");

  tray.setContextMenu(trayContextMenu);
  tray.setToolTip("Carabiner - Screen Capture and Remote Control");

  // Click to show context menu (no window toggling)
  tray.on("click", () => {
    tray.popUpContextMenu();
  });
}

function updateTrayRecordingMenuItems(displayVisible, isRecording) {
  if (!tray || !trayStartRecordingItem || !trayStopRecordingItem) return;

  // Start recording is always enabled when not recording (it can show the window if needed)
  trayStartRecordingItem.enabled = !isRecording;

  // Stop recording is only enabled when currently recording
  trayStopRecordingItem.enabled = isRecording;
}

function toggleDockIcon(showInDock, mainWindow = null, displayWindow = null) {
  if (!isMacOS) return;

  console.log("toggleDockIcon called with showInDock:", showInDock);

  if (showInDock) {
    console.log("Showing dock icon");
    app.dock.show();
    if (tray) {
      console.log("Destroying existing tray");
      tray.destroy();
      tray = null;
    }
  } else {
    console.log("Hiding dock icon");
    app.dock.hide();
    if (!tray) {
      console.log("Creating tray");
      // Use provided windows or find them
      const main =
        mainWindow ||
        BrowserWindow.getAllWindows().find(
          (win) =>
            win.webContents.getURL().includes("localhost") ||
            win.webContents.getURL().includes("index.html")
        );
      const display =
        displayWindow ||
        BrowserWindow.getAllWindows().find((win) =>
          win.webContents.getURL().includes("display.html")
        );
      if (main && display) {
        createTray(main, display);
        console.log("Tray created successfully");
      } else {
        console.log("Could not find main or display window for tray creation");
      }
    } else {
      console.log("Tray already exists");
    }
  }
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
    createMenu(mainWindow, displayWindow, packageInfo);
    // Initialize dock/tray mode based on user setting
    const showInDock = settings.display.showInDock !== false; // Default to true
    toggleDockIcon(showInDock, mainWindow, displayWindow);
  }
  if (
    typeof settings?.control?.deviceId === "string" &&
    settings.control.deviceId.includes("|adb")
  ) {
    [controlIp, controlType] = settings.control.deviceId.split("|");
    if (!isADBConnected) {
      isADBConnected = connectADB(controlIp, settings.control.adbPath);
    }
  }

  if (settings.display.shortcut) {
    registerShortcut(settings.display.shortcut, displayWindow);
  }

  // Hide app when both windows are hidden in macOS (only in dock mode)
  if (isMacOS) {
    mainWindow.on("hide", () => {
      if (!displayWindow.isVisible() && settings.display.showInDock !== false) {
        app.hide();
      }
    });

    displayWindow.on("hide", () => {
      if (!mainWindow.isVisible() && settings.display.showInDock !== false) {
        app.hide();
      }
    });
  }

  ipcMain.on("shared-window-channel", (event, arg) => {
    displayWindow.webContents.send("shared-window-channel", arg);
    saveFlag = true;
    if (arg.type && arg.type === "set-capture-devices") {
      captureDevices = JSON.parse(arg.payload);
      mainWindow.webContents.send("shared-window-channel", arg);
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
      if (arg.payload?.filter) {
        settings.display.filter = arg.payload.filter;
        saveFlag = true;
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
    } else if (arg.type && arg.type === "set-border-style") {
      settings.border.style = arg.payload;
    } else if (arg.type && arg.type === "set-border-color") {
      settings.border.color = arg.payload;
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
        isADBConnected = connectADB(controlIp, settings.control.adbPath);
      }
    } else if (arg.type && arg.type === "send-adb-key") {
      sendADBKey(arg.payload);
    } else if (arg.type && arg.type === "send-adb-text") {
      sendADBText(arg.payload);
    } else if (arg.type && arg.type === "set-audio-enabled") {
      settings.display.audioEnabled = arg.payload;
      saveFlag = true;
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

    setAlwaysOnTop(alwaysOnTop, displayWindow);
  });

  ipcMain.on("save-audio-enabled", (event, audioEnabled) => {
    settings.display.audioEnabled = audioEnabled;
    saveSettings(settings);
  });

  ipcMain.on("save-show-in-dock", (event, showInDock) => {
    settings.display.showInDock = showInDock;
    saveSettings(settings);

    // Find the main window to ensure it stays visible
    const mainWindow = BrowserWindow.getAllWindows().find(
      (win) =>
        win.webContents.getURL().includes("localhost") ||
        win.webContents.getURL().includes("index.html")
    );

    toggleDockIcon(showInDock);

    // Ensure the settings window remains visible after toggling
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  ipcMain.on("show-context-menu", (event) => {
    const menu = new Menu();
    let fullscreenAcc = "F11";
    if (isMacOS) {
      fullscreenAcc = "Cmd+Ctrl+F";
    }
    menu.append(
      new MenuItem({
        label: "Copy Screenshot",
        accelerator: "CmdOrCtrl+Shift+C",
        click: () => {
          displayWindow.webContents.send("copy-screenshot");
        },
      })
    );
    menu.append(
      new MenuItem({
        label: "Save Screenshot As...",
        accelerator: "CmdOrCtrl+S",
        click: () => {
          displayWindow.webContents.send("save-screenshot");
        },
      })
    );
    menu.append(new MenuItem({ type: "separator" }));
    menu.append(
      new MenuItem({
        id: "start-recording-ctx",
        label: "Start Recording",
        accelerator: "CmdOrCtrl+Shift+R",
        enabled: !isCurrentlyRecording,
        click: () => {
          displayWindow.webContents.send("start-recording");
        },
      })
    );
    menu.append(
      new MenuItem({
        id: "stop-recording-ctx",
        label: "Stop Recording",
        accelerator: "CmdOrCtrl+Shift+S",
        enabled: isCurrentlyRecording,
        click: () => {
          displayWindow.webContents.send("stop-recording");
        },
      })
    );
    menu.append(new MenuItem({ type: "separator" }));
    menu.append(
      new MenuItem({
        label: "Paste Text",
        accelerator: "CmdOrCtrl+V",
        click: () => {
          displayWindow.webContents.send("handle-paste");
        },
      })
    );
    menu.append(new MenuItem({ type: "separator" }));
    menu.append(
      new MenuItem({
        role: "togglefullscreen",
        accelerator: fullscreenAcc,
      })
    );
    menu.append(
      new MenuItem({
        label: "Hide Screen",
        click: () => {
          displayWindow.hide();
        },
      })
    );
    if (captureDevices) {
      menu.append(new MenuItem({ type: "separator" }));
      captureDevices.forEach((device) => {
        let deviceLabel = device.label || `Device ${videoDevices.indexOf(device) + 1}`;
        const found = settings.control?.deviceList?.find((d) => d.linked === device.deviceId);
        deviceLabel += found ? ` - ${found.type} ${found.alias ?? found.ipAddress}` : "";
        menu.append(
          new MenuItem({
            label: deviceLabel,
            type: "radio",
            checked: settings.display.deviceId === device.deviceId,
            click: () => {
              mainWindow.webContents.send("update-capture-device", device.deviceId);
            },
          })
        );
      });
    }
    menu.append(new MenuItem({ type: "separator" }));
    menu.append(
      new MenuItem({
        label: "Settings...",
        accelerator: "CmdOrCtrl+,",
        click: () => {
          mainWindow.webContents.send("open-display-tab");
          mainWindow.show();
        },
      })
    );
    menu.append(new MenuItem({ type: "separator" }));
    menu.append(
      new MenuItem({
        label: "Keyboard Control Help",
        accelerator: "CmdOrCtrl+F1",
        click: () => {
          shell.openExternal(`${packageInfo.repository.url}/blob/main/docs/key-mappings.md`);
        },
      })
    );
    menu.append(new MenuItem({ type: "separator" }));
    menu.append(new MenuItem({ role: "quit" }));
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
  });

  ipcMain.handle("select-adb-path", async () => {
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

  ipcMain.handle("load-image", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["jpg", "png", "webp"] }],
    });
    if (result.canceled) {
      return "";
    } else {
      const imagePath = result.filePaths[0];
      const imageData = fs.readFileSync(imagePath, { encoding: "base64" });
      displayWindow.webContents.send("image-loaded", `data:image/png;base64,${imageData}`);
      return imagePath;
    }
  });

  ipcMain.handle("load-settings", async () => {
    return settings;
  });

  ipcMain.handle("get-package-info", async () => {
    return packageInfo;
  });

  // Save video recording dialog
  ipcMain.handle("save-video-dialog", async (event, filename, bufferData) => {
    try {
      const result = await dialog.showSaveDialog(displayWindow, {
        title: "Save Video Recording",
        defaultPath: filename,
        filters: [
          { name: "Video Files", extensions: ["mp4", "webm"] },
          { name: "MP4 Files", extensions: ["mp4"] },
          { name: "WebM Files", extensions: ["webm"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (!result.canceled && result.filePath) {
        const fs = require("fs");
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
    updateTrayRecordingMenuItems(false, isRecording); // displayVisible parameter is now ignored
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
