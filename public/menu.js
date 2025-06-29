/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const { Menu, BrowserWindow, app, shell } = require("electron");

let devToolsAccelerator = "Cmd+Option+I";
let alwaysOnTopMenuItem;
let copyScreenshotMenuItem;
let saveScreenshotMenuItem;
let startRecordingMenuItem;
let stopRecordingMenuItem;

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

module.exports = {
  createMenu,
  updateAlwaysOnTopMenuItem,
  updateScreenshotMenuItems,
  updateRecordingMenuItems,
};
