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

let alwaysOnTopMenuItem;
let copyScreenshotMenuItem;
let saveScreenshotMenuItem;
let startRecordingMenuItem;
let stopRecordingMenuItem;
let showDisplayMenuItem;

// Tray-related variables
let tray = null;
let trayContextMenu = null;
let trayStartRecordingItem = null;
let trayStopRecordingItem = null;
let trayAlwaysOnTopItem = null;

// Context menu variables
let contextAlwaysOnTopItem = null;

const isMacOS = process.platform === "darwin";
const isWindows = process.platform === "win32";

// Common accelerators
const ACCELERATORS = {
  devTools: isMacOS ? "Cmd+Option+I" : "F12",
  fullscreen: isMacOS ? "Cmd+Ctrl+F" : "F11",
  settings: "CmdOrCtrl+,",
  saveScreenshot: "CmdOrCtrl+S",
  copyScreenshot: "CmdOrCtrl+Shift+C",
  startRecording: "CmdOrCtrl+Shift+R",
  stopRecording: "CmdOrCtrl+Shift+S",
  closeWindow: "CmdOrCtrl+W",
  paste: "CmdOrCtrl+V",
};

// Common menu item creators
const MenuItems = {
  separator: () => ({ type: "separator" }),

  settings: (mainWindow) => ({
    label: "Settings...",
    accelerator: ACCELERATORS.settings,
    click: () => {
      mainWindow.webContents.send("open-display-tab");
      mainWindow.show();
    },
  }),

  copyScreenshot: (displayWindow) => ({
    id: "copy-screen",
    label: "Copy Screenshot",
    accelerator: ACCELERATORS.copyScreenshot,
    enabled: true,
    click: () => displayWindow?.webContents.send("copy-screenshot"),
  }),

  saveScreenshot: (displayWindow) => ({
    id: "save-screenshot",
    label: "Save Screenshot As...",
    accelerator: ACCELERATORS.saveScreenshot,
    click: () => displayWindow?.isVisible() && displayWindow.webContents.send("save-screenshot"),
  }),

  startRecording: (displayWindow, enabled = false) => ({
    id: "start-recording",
    label: "Start Recording",
    accelerator: ACCELERATORS.startRecording,
    enabled,
    click: () => {
      if (displayWindow) {
        if (!displayWindow.isVisible()) displayWindow.show();
        displayWindow.webContents.send("start-recording");
      }
    },
  }),

  stopRecording: (displayWindow, enabled = false) => ({
    id: "stop-recording",
    label: "Stop Recording",
    accelerator: ACCELERATORS.stopRecording,
    enabled,
    click: () => displayWindow?.webContents.send("stop-recording"),
  }),

  toggleFullscreen: (displayWindow) => ({
    label: "Toggle Fullscreen",
    accelerator: ACCELERATORS.fullscreen,
    click: () => toggleFullScreen(displayWindow),
  }),

  devTools: (window) => ({
    label: "Developer Tools",
    accelerator: ACCELERATORS.devTools,
    click: (_, targetWindow) => openDevTools(targetWindow || window),
  }),

  alwaysOnTop: (displayWindow, mainWindow) => ({
    id: "on-top",
    label: "Always on Top",
    type: "checkbox",
    checked: false,
    enabled: true,
    click: (item) => {
      // Use the same logic as the React component
      const { ipcMain } = require("electron");
      ipcMain.emit("save-always-on-top", null, item.checked);
    },
  }),

  pasteText: (displayWindow) => ({
    label: "Paste Text",
    accelerator: ACCELERATORS.paste,
    click: () => displayWindow?.webContents.send("handle-paste"),
  }),

  hideScreen: (displayWindow, settings) => ({
    label: "Hide Screen",
    click: () => hideWindowSafely(displayWindow, settings),
  }),

  showCarabiner: (displayWindow) => ({
    label: "Show Carabiner",
    click: () => {
      if (displayWindow) {
        if (!displayWindow.isVisible()) {
          displayWindow.show();
        }
        displayWindow.focus();
      }
    },
  }),

  showDisplay: (displayWindow) => ({
    id: "show-display",
    label: "Show Display",
    enabled: false,
    click: () => {
      if (displayWindow && !displayWindow.isVisible()) {
        displayWindow.show();
        displayWindow.focus();
      }
    },
  }),
};

// Common help menu items
const HelpMenuItems = {
  documentation: (packageInfo) => ({
    label: "Usage Guide",
    click: () => shell.openExternal(`${packageInfo.repository.url}/blob/main/docs/usage-guide.md`),
  }),

  keyboardControl: (packageInfo) => ({
    label: "Keyboard Control",
    click: () => shell.openExternal(`${packageInfo.repository.url}/blob/main/docs/key-mappings.md`),
  }),

  releaseNotes: (packageInfo) => ({
    label: "Release Notes",
    click: () => shell.openExternal(`${packageInfo.repository.url}/releases`),
  }),

  viewLicense: (packageInfo) => ({
    label: "View License",
    click: () => shell.openExternal(`${packageInfo.repository.url}/blob/main/LICENSE`),
  }),

  reportBug: (packageInfo) => ({
    label: "Report a Bug",
    click: () => shell.openExternal(`${packageInfo.repository.url}/issues`),
  }),

  about: (mainWindow) => ({
    label: "About Carabiner",
    click: () => {
      mainWindow.webContents.send("open-about-tab");
      mainWindow.show();
    },
  }),
};

// Platform-specific application menu items
const AppMenuItems = {
  macOS: (mainWindow) => ({
    label: app.getName(),
    submenu: [
      HelpMenuItems.about(mainWindow),
      MenuItems.separator(),
      MenuItems.settings(mainWindow),
      MenuItems.separator(),
      { label: "Services", role: "services", submenu: [] },
      MenuItems.separator(),
      { label: `Hide ${app.getName()}`, role: "hide" },
      { label: "Hide Others", role: "hideothers" },
      { label: "Show All", role: "unhide" },
      MenuItems.separator(),
      { label: `Quit ${app.getName()}`, role: "quit" },
    ],
  }),

  closeWindow: (settings) => ({
    label: "Close Window",
    accelerator: ACCELERATORS.closeWindow,
    click: (_, window) => hideWindowSafely(window, settings),
  }),
};

function createMacOSMenu(mainWindow, displayWindow, packageInfo, settings) {
  const template = [
    // Add macOS-specific app menu
    ...[AppMenuItems.macOS(mainWindow)],

    {
      label: "&File",
      submenu: [
        MenuItems.saveScreenshot(displayWindow),
        MenuItems.separator(),
        MenuItems.startRecording(displayWindow, false),
        MenuItems.stopRecording(displayWindow, false),
        MenuItems.separator(),
        AppMenuItems.closeWindow(settings),
      ],
    },
    {
      label: "&Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        MenuItems.separator(),
        { role: "cut" },
        MenuItems.copyScreenshot(displayWindow),
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      id: "view-menu",
      label: "&View",
      submenu: [
        MenuItems.showDisplay(displayWindow),
        MenuItems.separator(),
        MenuItems.toggleFullscreen(displayWindow),
        MenuItems.devTools(),
        MenuItems.separator(),
        MenuItems.alwaysOnTop(displayWindow, mainWindow),
      ],
    },
    {
      label: "&Help",
      submenu: [
        HelpMenuItems.documentation(packageInfo),
        HelpMenuItems.keyboardControl(packageInfo),
        MenuItems.separator(),
        HelpMenuItems.reportBug(packageInfo),
        MenuItems.separator(),
        HelpMenuItems.releaseNotes(packageInfo),
        HelpMenuItems.viewLicense(packageInfo),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Store menu item references
  alwaysOnTopMenuItem = menu.getMenuItemById("on-top");
  copyScreenshotMenuItem = menu.getMenuItemById("copy-screen");
  saveScreenshotMenuItem = menu.getMenuItemById("save-screenshot");
  startRecordingMenuItem = menu.getMenuItemById("start-recording");
  stopRecordingMenuItem = menu.getMenuItemById("stop-recording");
  showDisplayMenuItem = menu.getMenuItemById("show-display");
}

function updateAlwaysOnTopMenuItem(value) {
  if (alwaysOnTopMenuItem) {
    alwaysOnTopMenuItem.checked = value;
  }
  if (trayAlwaysOnTopItem) {
    trayAlwaysOnTopItem.checked = value;
  }
  if (contextAlwaysOnTopItem) {
    contextAlwaysOnTopItem.checked = value;
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

function updateShowDisplayMenuItem(isVisible) {
  if (showDisplayMenuItem) {
    showDisplayMenuItem.enabled = !isVisible;
  }
}

// Tray functionality
function createTray(mainWindow, displayWindow, packageInfo) {
  if (!isMacOS && !isWindows) return null;

  // Create tray icon with appropriate platform icon
  const trayIconPath = isMacOS
    ? path.join(__dirname, "../images/menuicon.png")
    : path.join(__dirname, "../images/icon.ico");

  tray = new Tray(trayIconPath);

  // Platform-specific tray configuration
  if (isMacOS) {
    if (typeof tray.setTemplate === "function") {
      tray.setTemplate(true);
    }
    // macOS: click to show context menu
    tray.on("click", () => tray.popUpContextMenu());
  } else if (isWindows) {
    // Windows: left click shows and focuses window (same as Show Carabiner), right click shows context menu
    tray.on("click", () => {
      if (displayWindow) {
        if (!displayWindow.isVisible()) {
          displayWindow.show();
        }
        displayWindow.focus();
      }
    });
    tray.on("right-click", () => tray.popUpContextMenu());
  }

  createTrayMenu(mainWindow, displayWindow, packageInfo);
  tray.setToolTip("Carabiner - Screen Capture and Remote Control");

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
  const menuItems = [
    MenuItems.showCarabiner(displayWindow),
    MenuItems.separator(),
    MenuItems.copyScreenshot(displayWindow),
    MenuItems.saveScreenshot(displayWindow),
    MenuItems.separator(),
    {
      ...MenuItems.startRecording(displayWindow, !isCurrentlyRecording),
      id: "tray-start-recording",
    },
    { ...MenuItems.stopRecording(displayWindow, isCurrentlyRecording), id: "tray-stop-recording" },
    MenuItems.separator(),
    {
      ...MenuItems.alwaysOnTop(displayWindow, mainWindow),
      id: "tray-always-on-top",
      checked: settings?.display?.alwaysOnTop ?? displayWindow.isAlwaysOnTop(),
    },
  ];

  const trayMenu = Menu.buildFromTemplate(menuItems);

  // Add capture devices menu
  appendCaptureDevicesMenu(trayMenu, mainWindow, captureDevices, settings);

  // Add common menu items
  const commonItems = [
    new MenuItem(MenuItems.separator()),
    new MenuItem(MenuItems.settings(mainWindow)),
    new MenuItem(MenuItems.separator()),
    new MenuItem(HelpMenuItems.reportBug(packageInfo)),
    new MenuItem(MenuItems.separator()),
    new MenuItem(HelpMenuItems.documentation(packageInfo)),
    new MenuItem(HelpMenuItems.keyboardControl(packageInfo)),
    new MenuItem(HelpMenuItems.releaseNotes(packageInfo)),
    new MenuItem(MenuItems.separator()),
    new MenuItem({ role: "quit" }),
  ];

  commonItems.forEach((item) => trayMenu.append(item));

  // Set the tray context menu
  trayContextMenu = trayMenu;
  // Store references to the recording menu items for later updates
  trayStartRecordingItem = trayContextMenu.getMenuItemById("tray-start-recording");
  trayStopRecordingItem = trayContextMenu.getMenuItemById("tray-stop-recording");
  trayAlwaysOnTopItem = trayContextMenu.getMenuItemById("tray-always-on-top");
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

  trayStartRecordingItem.enabled = !isRecording;
  trayStopRecordingItem.enabled = isRecording;
}

function toggleDockIcon(showInDock, mainWindow, displayWindow = null, packageInfo = null) {
  if (!isMacOS && !isWindows) return null;

  // Ensure we have window references
  const display =
    displayWindow ||
    BrowserWindow.getAllWindows().find((win) => win.webContents.getURL().includes("display.html"));

  if (showInDock) {
    // Show in dock/taskbar
    if (isMacOS) {
      app.dock.show();
    } else if (isWindows) {
      // On Windows, ensure both windows show in taskbar
      mainWindow.setSkipTaskbar(false);
      if (display) {
        display.setSkipTaskbar(false);
      }
    }

    // Destroy tray if it exists
    if (tray) {
      tray.destroy();
      tray = null;
      trayContextMenu = null;
      trayStartRecordingItem = null;
      trayStopRecordingItem = null;
    }
  } else {
    // Hide from dock/taskbar and create tray

    // Create tray first
    if (!tray && mainWindow && display && packageInfo) {
      createTray(mainWindow, display, packageInfo);
    }

    if (isMacOS) {
      // Hide dock icon
      app.dock.hide();
    }
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
  const menuItems = [
    MenuItems.copyScreenshot(displayWindow),
    MenuItems.saveScreenshot(displayWindow),
    MenuItems.separator(),
    {
      ...MenuItems.startRecording(displayWindow, !isCurrentlyRecording),
      id: "start-recording-ctx",
    },
    { ...MenuItems.stopRecording(displayWindow, isCurrentlyRecording), id: "stop-recording-ctx" },
    MenuItems.separator(),
    MenuItems.pasteText(displayWindow),
    MenuItems.separator(),
    MenuItems.toggleFullscreen(displayWindow),
    {
      ...MenuItems.alwaysOnTop(displayWindow, mainWindow),
      id: "context-always-on-top",
      checked: settings?.display?.alwaysOnTop ?? displayWindow.isAlwaysOnTop(),
    },
    MenuItems.hideScreen(displayWindow, settings),
  ];

  const menu = Menu.buildFromTemplate(menuItems);

  // Add capture devices menu
  appendCaptureDevicesMenu(menu, mainWindow, captureDevices, settings);

  // Add remaining menu items
  const additionalItems = [
    new MenuItem(MenuItems.separator()),
    new MenuItem(MenuItems.settings(mainWindow)),
    new MenuItem(MenuItems.separator()),
    new MenuItem(HelpMenuItems.reportBug(packageInfo)),
    new MenuItem(MenuItems.separator()),
    new MenuItem(HelpMenuItems.documentation(packageInfo)),
    new MenuItem(HelpMenuItems.keyboardControl(packageInfo)),
    new MenuItem(MenuItems.devTools(displayWindow)),
    new MenuItem(MenuItems.separator()),
    new MenuItem({ role: "quit" }),
  ];

  additionalItems.forEach((item) => menu.append(item));

  // Store reference to the context always on top menu item
  contextAlwaysOnTopItem = menu.getMenuItemById("context-always-on-top");

  return menu;
}

let windowBoundsBeforeFullscreen = null; // Store window bounds for Windows fullscreen restoration
let isTogglingFullscreen = false; // Flag to prevent app hiding during fullscreen transitions

/**
 * Safely hides a window, exiting fullscreen first if it's a display window in fullscreen
 * On Windows, minimizes display window instead of hiding when not in tray mode
 * @param {BrowserWindow} window - The window to hide
 * @param {Object} settings - App settings (required)
 */
function hideWindowSafely(window, settings = null) {
  if (!window || !settings) {
    console.warn("hideWindowSafely: invalid parameters!");
    return;
  }

  if (window.webContents.getURL().includes("display.html") && window.isFullScreen()) {
    // If display window in fullscreen, exit fullscreen first, then hide/minimize
    const onceLeaveFullScreen = () => {
      window.removeListener("leave-full-screen", onceLeaveFullScreen);

      // On Windows, when not in tray mode (showInDock = true), minimize instead of hide
      if (isWindows && settings.display?.showInDock !== false) {
        window.minimize();
      } else {
        window.hide();
      }
      resetFullscreenVars();
    };

    window.once("leave-full-screen", onceLeaveFullScreen);
    window.setFullScreen(false);
  } else {
    // Normal hide for other windows or non-fullscreen display window
    // On Windows, when not in tray mode (showInDock = true), minimize display window instead of hide
    if (
      isWindows &&
      settings.display?.showInDock !== false &&
      window.webContents.getURL().includes("display.html")
    ) {
      window.minimize();
    } else {
      window.hide();
    }
  }
}

function toggleFullScreen(displayWindow) {
  if (!displayWindow) {
    return;
  }
  if (displayWindow.isFullScreen() || windowBoundsBeforeFullscreen) {
    // Exiting fullscreen
    isTogglingFullscreen = true;
    displayWindow.setFullScreen(false);

    // On Windows, manually restore the window bounds after a short delay
    if (isWindows) {
      setTimeout(() => {
        if (windowBoundsBeforeFullscreen) {
          displayWindow.setBounds(windowBoundsBeforeFullscreen);
        }
        displayWindow.focus();
        resetFullscreenVars();
      }, 100);
    } else {
      setTimeout(() => {
        displayWindow.focus();
        isTogglingFullscreen = false;
      }, 300);
    }
  } else {
    // Entering fullscreen
    isTogglingFullscreen = true;
    if (isWindows) {
      windowBoundsBeforeFullscreen = displayWindow.getBounds();
    }
    displayWindow.setFullScreen(true);
    setTimeout(() => {
      displayWindow.focus();
      isTogglingFullscreen = false;
    }, 100);
  }
}

function resetFullscreenVars() {
  windowBoundsBeforeFullscreen = null; // Reset stored bounds
  isTogglingFullscreen = false; // Reset toggling flag
}

function openDevTools(window) {
  if (!window) {
    window = BrowserWindow.fromId(1);
  }
  if (window.webContents.isDevToolsOpened()) {
    window.webContents.closeDevTools();
  } else {
    window.openDevTools({ mode: "detach" });
  }
}

// Getter functions for tray state
function getTray() {
  return tray;
}

module.exports = {
  createMacOSMenu,
  updateAlwaysOnTopMenuItem,
  updateScreenshotMenuItems,
  updateRecordingMenuItems,
  updateShowDisplayMenuItem,
  createTrayMenu,
  appendCaptureDevicesMenu,
  updateTrayRecordingMenuItems,
  toggleDockIcon,
  createContextMenu,
  getTray,
  toggleFullScreen,
  isTogglingFullscreen: () => isTogglingFullscreen,
  resetFullscreenVars,
  openDevTools,
  hideWindowSafely,
};
