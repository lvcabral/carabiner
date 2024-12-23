const { Menu, BrowserWindow, app, shell } = require("electron");

let devToolsAccelerator = "Cmd+Option+I";
let alwaysOnTopMenuItem;

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
          label: "Save Screenshot As...",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            displayWindow.webContents.send("save-screenshot");
          },
        },
        { type: "separator" },
        {
          label: "Close Window",
          accelerator: "CmdOrCtrl+W",
          click: (_, window) => {
            window.hide();
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
            shell.openExternal(
              `${packageInfo.repository.url}/blob/main/docs/key-mappings.md`
            );
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
            shell.openExternal(
              `${packageInfo.repository.url}/blob/main/LICENSE`
            );
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  alwaysOnTopMenuItem = menu.getMenuItemById("on-top");
}

function updateAlwaysOnTopMenuItem(value) {
  if (alwaysOnTopMenuItem) {
    alwaysOnTopMenuItem.checked = value;
  }
}

module.exports = { createMenu, updateAlwaysOnTopMenuItem };
