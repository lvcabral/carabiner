const path = require("path");
const {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  systemPreferences,
} = require("electron");
const { saveSettings, loadSettings } = require("./settings");
const { connectADB, disconnectADB, sendADBKey } = require("./adb");
const settings = loadSettings();
let controlIp = "";
let controlType = "";
let isADBConnected = false;
let isQuitting = false;

function createWindow(name, options) {
  const windowState = settings[name] || {
    width: options.width || 800,
    height: options.height || 600,
    x: undefined,
    y: undefined,
  };

  const win = new BrowserWindow({
    ...options,
    ...windowState,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
    },
  });

  win.on("close", (event) => {
    const bounds = win.getBounds();
    settings[name] = bounds;
    saveSettings(settings);
    if (name === "mainWindow" && !isQuitting) {
      event.preventDefault();
      win.minimize();
    } else if (name === "displayWindow") {
      app.quit();
    }
  });

  return win;
}

function createMainWindow() {
  const win = createWindow("mainWindow", {
    height: 600,
    width: 600,
    maximizable: false,
    resizable: false,
    autoHideMenuBar: true,
  });
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
  const win = createWindow("displayWindow", {
    width: 505,
    height: 295,
    maxWidth: 1945,
    maxHeight: 1105,
    resizable: false,
    titleBarStyle: "hide",
    transparent: true,
    darkTheme: false,
    hasShadow: false,
    frame: false,
    alwaysOnTop: true,
  });
  win.loadFile("public/display.html");
  return win;
}

app.whenReady().then(async () => {
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

  const mainWindow = createMainWindow();
  const displayWindow = createDisplayWindow();
  displayWindow.setAlwaysOnTop(true, "floating", 1);

  let borderSize = 0;
  let lastSizeWith = [505, 295];
  ipcMain.on("shared-window-channel", (event, arg) => {
    displayWindow.webContents.send("shared-window-channel", arg);
    if (arg.type && arg.type === "set-webcams") {
      mainWindow.webContents.send("shared-window-channel", arg);
    } else if (arg.type && arg.type === "set-video-stream") {
      if (arg.payload?.video?.deviceId?.exact) {
        settings.display.deviceId = arg.payload.video.deviceId.exact;
        saveSettings(settings);
      }
    } else if (arg.type && arg.type === "set-transparency") {
      if (arg.payload?.filter) {
        settings.display.filter = arg.payload.filter;
        saveSettings(settings);
      }
    } else if (arg.type && arg.type === "set-resolution") {
      let { width, height } = arg.payload;
      settings.display.resolution = `${width}|${height}`;
      saveSettings(settings);
       // adding 25 just to make sure the window is not too small to fit the camera
      width = Number(width.replace("px", "")) + 25;
      height = Number(height.replace("px", "")) + 25;
      lastSizeWith = [width, height];
      displayWindow.setSize(width, height);
    } else if (arg.type && arg.type === "set-border-width") {
      settings.border.width = arg.payload;
      saveSettings(settings);

      switch (arg.payload) {
        case "0.1px": {
          borderSize = 0;
          break;
        }
        case "thin": {
          borderSize = 3;
          break;
        }
        case "medium": {
          borderSize = 5;
          break;
        }
        case "thick": {
          borderSize = 20;
          break;
        }
      }

      // Resize window with count borders
      displayWindow.setSize(
        lastSizeWith[0] + borderSize,
        lastSizeWith[1] + borderSize
      );
    } else if (arg.type && arg.type === "set-border-style") {
      settings.border.style = arg.payload;
      saveSettings(settings);
    } else if (arg.type && arg.type === "set-border-color") {
      settings.border.color = arg.payload;
      saveSettings(settings);
    } else if (arg.type && arg.type === "set-control-list") {
      settings.control.deviceList = arg.payload;
      saveSettings(settings);
    } else if (arg.type && arg.type === "set-control-selected") {
      settings.control.deviceId = arg.payload;
      const oldControlIp = controlIp;
      [controlIp, controlType] = arg.payload.split("|");
      console.log("Control selected:", controlIp, controlType, isADBConnected);
      if (isADBConnected && oldControlIp !== controlIp) {
        isADBConnected = disconnectADB();
      }
      if (!isADBConnected && controlType === "adb") {
        isADBConnected = connectADB(controlIp);
      }
      saveSettings(settings);
    } else if (arg.type && arg.type === "send-adb-key") {
      sendADBKey(arg.payload);
    }
    event.returnValue = true;
  });

  ipcMain.handle('load-settings', async () => {
    return settings;
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});