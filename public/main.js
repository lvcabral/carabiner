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
} = require("electron");
const fs = require("fs");
const AutoLaunch = require("auto-launch");
const { saveSettings, loadSettings } = require("./settings");
const { connectADB, disconnectADB, sendADBKey } = require("./adb");
const {
  createMenu,
  updateAlwaysOnTopMenuItem,
  updateScreenshotMenuItems,
} = require("./menu");
const packageInfo = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"), "utf8")
);

if (require('electron-squirrel-startup') === true) app.quit();

const settings = loadSettings();
let lastSize = [500, 290];
let controlIp = "";
let controlType = "";
let isADBConnected = false;
let isQuitting = false;
let captureDevices;

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
    });

    win.on("show", () => {
      win.webContents.send("start-video-stream");
      updateScreenshotMenuItems(true);
    });
  }

  return win;
}

function createMainWindow() {
  const win = createWindow(
    "mainWindow",
    {
      height: 605,
      width: 600,
      minHeight: 605,
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
  if (process.platform === "darwin") {
    createMenu(mainWindow, displayWindow, packageInfo);
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
      const found = arg.payload.find(
        (device) => device.id === settings.control.deviceId
      );
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

  ipcMain.on("show-context-menu", (event) => {
    const menu = new Menu();
    let fullscreenAcc = "F11";
    if (process.platform === "darwin") {
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
        let deviceLabel =
          device.label || `Device ${videoDevices.indexOf(device) + 1}`;
        const found = settings.control.deviceList.find(
          (d) => d.linked === device.deviceId
        );
        deviceLabel += found
          ? ` - ${found.type} ${found.alias ?? found.ipAddress}`
          : "";
        menu.append(
          new MenuItem({
            label: deviceLabel,
            type: "radio",
            checked: settings.display.deviceId === device.deviceId,
            click: () => {
              mainWindow.webContents.send(
                "update-capture-device",
                device.deviceId
              );
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
          shell.openExternal(
            `${packageInfo.repository.url}/blob/main/docs/key-mappings.md`
          );
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
      displayWindow.webContents.send(
        "image-loaded",
        `data:image/png;base64,${imageData}`
      );
      return imagePath;
    }
  });

  ipcMain.handle("load-settings", async () => {
    return settings;
  });

  ipcMain.handle("get-package-info", async () => {
    return packageInfo;
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
  if (process.platform !== "darwin") {
    app.quit();
  }
});
