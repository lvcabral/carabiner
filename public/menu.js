/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const { Menu, BrowserWindow, app, shell, Tray, MenuItem } = require("electron");
const path = require("path");

let devToolsAccelerator = "Cmd+Option+I";
let alwaysOnTopMenuItem;
let copyScreenshotMenuItem;
let saveScreenshotMenuItem;
let startRecordingMenuItem;
let stopRecordingMenuItem;

// Tray-related variables
let tray = null;
let trayContextMenu = null;
let trayStartRecordingItem = null;
let trayStopRecordingItem = null;

const isMacOS = process.platform === "darwin";

function createMenu(mainWindow, displayWindow, packageInfo) {
  const template = [
    {
      label: app.getName(),
      submenu: [
        {
          label: "About Carabiner",
          click: () => {
            mainWindow.webContents.send("open-about-tab");
            mainWindow.show();
          },
        },
        { type: "separator" },
        {
          id: "settings",
          label: "Settings...",
          accelerator: "CmdOrCtrl+,",
          click: () => {
            mainWindow.webContents.send("open-display-tab");
            mainWindow.show();
          },
        },
        { type: "separator" },
        {
          label: "Services",
          role: "services",
          submenu: [],
        },
        {
          type: "separator",
        },
        {
          label: `Hide ${app.getName()}`,
          role: "hide",
        },
        {
          label: "Hide Others",
          role: "hideothers",
        },
        {
          label: "Show All",
          role: "unhide",
        },
        {
          type: "separator",
        },
        {
          label: `Quit ${app.getName()}`,
          role: "quit",
        },
      ],
    },
    {
      label: "&File",
      submenu: [
        {
          id: "save-screenshot",
          label: "Save Screenshot As...",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            if (displayWindow && displayWindow.isVisible()) {
              displayWindow.webContents.send("save-screenshot");
            }
          },
        },
        { type: "separator" },
        {
          id: "start-recording",
          label: "Start Recording",
          accelerator: "CmdOrCtrl+Shift+R",
          enabled: false,
          click: () => {
            if (displayWindow && displayWindow.isVisible()) {
              displayWindow.webContents.send("start-recording");
            }
          },
        },
        {
          id: "stop-recording",
          label: "Stop Recording",
          accelerator: "CmdOrCtrl+Shift+S",
          enabled: false,
          click: () => {
            if (displayWindow && displayWindow.isVisible()) {
              displayWindow.webContents.send("stop-recording");
            }
          },
        },
        { type: "separator" },
        {
          label: "Close Window",
          accelerator: "CmdOrCtrl+W",
          click: (_, window) => {
            window?.hide();
          },
        },
      ],
    },
    {
      label: "&Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        {
          id: "copy-screen",
          label: "Copy Screenshot",
          accelerator: "CmdOrCtrl+Shift+C",
          enabled: true,
          click: () => {
            if (displayWindow) {
              displayWindow.webContents.send("copy-screenshot");
            }
          },
        },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      id: "view-menu",
      label: "&View",
      submenu: [
        { role: "togglefullscreen", accelerator: "Cmd+Ctrl+F" },
        {
          label: "Developer Tools",
          accelerator: devToolsAccelerator,
          click: (_, window) => {
            if (!window) {
              window = BrowserWindow.fromId(1);
            }
            if (window.webContents.isDevToolsOpened()) {
              window.webContents.closeDevTools();
            } else {
              window.openDevTools({ mode: "detach" });
            }
          },
        },
        { type: "separator" },
        {
          id: "on-top",
          label: "Always on Top",
          type: "checkbox",
          checked: displayWindow.isAlwaysOnTop(),
          enabled: true,
          click: (item) => {
            displayWindow.setAlwaysOnTop(item.checked);
            mainWindow.webContents.send("update-always-on-top", item.checked);
          },
        },
      ],
    },
    {
      label: "&Help",
      submenu: [
        {
          label: "Documentation",
          accelerator: "F1",
          click: () => {
            shell.openExternal(`${packageInfo.repository.url}#readme`);
          },
        },
        {
          label: "Keyboard Control",
          accelerator: "CmdOrCtrl+F1",
          click: () => {
            shell.openExternal(`${packageInfo.repository.url}/blob/main/docs/key-mappings.md`);
          },
        },
        { type: "separator" },
        {
          label: "Release Notes",
          click: () => {
            shell.openExternal(`${packageInfo.repository.url}/releases`);
          },
        },
        {
          label: "View License",
          click: () => {
            shell.openExternal(`${packageInfo.repository.url}/blob/main/LICENSE`);
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  alwaysOnTopMenuItem = menu.getMenuItemById("on-top");
  copyScreenshotMenuItem = menu.getMenuItemById("copy-screen");
  saveScreenshotMenuItem = menu.getMenuItemById("save-screenshot");
  startRecordingMenuItem = menu.getMenuItemById("start-recording");
  stopRecordingMenuItem = menu.getMenuItemById("stop-recording");
}

function updateAlwaysOnTopMenuItem(value) {
  if (alwaysOnTopMenuItem) {
    alwaysOnTopMenuItem.checked = value;
  }
}

function updateScreenshotMenuItems(enabled) {
  if (copyScreenshotMenuItem) {
    copyScreenshotMenuItem.enabled = enabled;
  }
  if (saveScreenshotMenuItem) {
    saveScreenshotMenuItem.enabled = enabled;
  }
}

function updateRecordingMenuItems(displayVisible, isRecording) {
  if (startRecordingMenuItem) {
    startRecordingMenuItem.enabled = displayVisible && !isRecording;
  }
  if (stopRecordingMenuItem) {
    stopRecordingMenuItem.enabled = displayVisible && isRecording;
  }
}

// Tray functionality
function createTray(mainWindow, displayWindow, packageInfo) {
  if (!isMacOS) return null;

  // Create tray icon - use the dedicated menuicon.png
  let trayIconPath = path.join(__dirname, "../images/menuicon.png");

  tray = new Tray(trayIconPath);
  // Try to set template mode if the method exists
  if (typeof tray.setTemplate === "function") {
    tray.setTemplate(true);
  }

  createTrayMenu(mainWindow, displayWindow, packageInfo);
  tray.setToolTip("Carabiner - Screen Capture and Remote Control");

  // Click to show context menu (no window toggling)
  tray.on("click", () => {
    tray.popUpContextMenu();
  });

  return tray;
}

function createTrayMenu(
  mainWindow,
  displayWindow,
  packageInfo,
  captureDevices = null,
  settings = null,
  isCurrentlyRecording = false
) {
  const trayMenu = Menu.buildFromTemplate([
    {
      label: "Show Carabiner",
      click: () => {
        // Only show the display window (screen capture window)
        if (displayWindow && !displayWindow.isVisible()) {
          displayWindow.show();
        }
      },
    },
    { type: "separator" },
    {
      label: "Start Recording",
      id: "tray-start-recording",
      accelerator: "CmdOrCtrl+Shift+R",
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
      accelerator: "CmdOrCtrl+Shift+S",
      enabled: false,
      click: () => {
        if (displayWindow) {
          displayWindow.webContents.send("stop-recording");
        }
      },
    },
  ]);

  appendCaptureDevicesMenu(trayMenu, mainWindow, captureDevices, settings);
  trayMenu.append(new MenuItem({ type: "separator" }));
  trayMenu.append(
    new MenuItem({
      label: "Settings...",
      accelerator: "CmdOrCtrl+,",
      click: () => {
        mainWindow.webContents.send("open-display-tab");
        mainWindow.show();
      },
    })
  );
  trayMenu.append(new MenuItem({ type: "separator" }));

  trayMenu.append(
    new MenuItem({
      label: "Documentation",
      accelerator: "F1",
      click: () => {
        shell.openExternal(`${packageInfo.repository.url}#readme`);
      },
    })
  );
  trayMenu.append(
    new MenuItem({
      label: "Keyboard Control",
      accelerator: "CmdOrCtrl+F1",
      click: () => {
        shell.openExternal(`${packageInfo.repository.url}/blob/main/docs/key-mappings.md`);
      },
    })
  );
  trayMenu.append(
    new MenuItem({
      label: "Release Notes",
      click: () => {
        shell.openExternal(`${packageInfo.repository.url}/releases`);
      },
    })
  );
  trayMenu.append(new MenuItem({ type: "separator" }));
  trayMenu.append(new MenuItem({ role: "quit" }));

  // Set the tray context menu
  trayContextMenu = trayMenu;
  // Store references to the recording menu items for later updates
  trayStartRecordingItem = trayContextMenu.getMenuItemById("tray-start-recording");
  trayStopRecordingItem = trayContextMenu.getMenuItemById("tray-stop-recording");
  updateTrayRecordingMenuItems(isCurrentlyRecording);
  // Set the context menu for the tray
  if (tray) {
    tray.setContextMenu(trayContextMenu);
  }
}

function appendCaptureDevicesMenu(menu, mainWindow, captureDevices = null, settings = null) {
  if (!captureDevices || captureDevices.length === 0) {
    // If no capture devices are available, just return
    return;
  }
  menu.append(new MenuItem({ type: "separator" }));
  captureDevices.forEach((device) => {
    let deviceLabel = device.label || `Device ${captureDevices.indexOf(device) + 1}`;
    const found = settings?.control?.deviceList?.find((d) => d.linked === device.deviceId);
    deviceLabel += found ? ` - ${found.type} ${found.alias ?? found.ipAddress}` : "";
    menu.append(
      new MenuItem({
        label: deviceLabel,
        type: "radio",
        checked: settings?.display?.deviceId === device.deviceId,
        click: () => {
          mainWindow.webContents.send("update-capture-device", device.deviceId);
        },
      })
    );
  });
}

function updateTrayRecordingMenuItems(isRecording) {
  if (!tray || !trayStartRecordingItem || !trayStopRecordingItem) return;

  // Start recording is always enabled when not recording (it can show the window if needed)
  trayStartRecordingItem.enabled = !isRecording;

  // Stop recording is only enabled when currently recording
  trayStopRecordingItem.enabled = isRecording;
}

function toggleDockIcon(showInDock, mainWindow, displayWindow = null, packageInfo = null) {
  if (!isMacOS) return null;

  // Ensure we have window references
  const display =
    displayWindow ||
    BrowserWindow.getAllWindows().find((win) => win.webContents.getURL().includes("display.html"));

  if (showInDock) {
    app.dock.show();
    if (tray) {
      tray.destroy();
      tray = null;
      trayContextMenu = null;
      trayStartRecordingItem = null;
      trayStopRecordingItem = null;
    }
  } else {
    // Create tray first
    if (!tray && mainWindow && display && packageInfo) {
      createTray(mainWindow, display, packageInfo);
    }

    // Hide dock icon
    app.dock.hide();
  }

  return tray;
}

function createContextMenu(
  mainWindow,
  displayWindow,
  packageInfo,
  isCurrentlyRecording,
  captureDevices = null,
  settings = null
) {
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
  appendCaptureDevicesMenu(menu, mainWindow, captureDevices, settings);
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

  return menu;
}

// Getter functions for tray state
function getTray() {
  return tray;
}

module.exports = {
  createMenu,
  updateAlwaysOnTopMenuItem,
  updateScreenshotMenuItems,
  updateRecordingMenuItems,
  createTrayMenu,
  appendCaptureDevicesMenu,
  updateTrayRecordingMenuItems,
  toggleDockIcon,
  createContextMenu,
  getTray,
};
