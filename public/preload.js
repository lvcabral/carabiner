/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const { contextBridge, ipcRenderer, shell } = require("electron");

// When packaged, __dirname is inside an .asar archive. Use this to gate debug logging.
const isPackaged = __dirname.includes(".asar");

contextBridge.exposeInMainWorld("electronAPI", {
  sendSync: (chan, message) => ipcRenderer.sendSync(chan, message),
  send: (chan, ...args) => ipcRenderer.send(chan, ...args),
  invoke: (chan, ...args) => ipcRenderer.invoke(chan, ...args),
  onMessageReceived: (chan, callback) => ipcRenderer.on(chan, callback),
  removeListener: (chan) => ipcRenderer.removeAllListeners(chan),
  showContextMenu: () => ipcRenderer.send("show-context-menu"),
  loadImage: (pairId) => ipcRenderer.invoke("load-image", pairId),
  getPackageInfo: () => ipcRenderer.invoke("get-package-info"),
  openExternal: (url) => shell.openExternal(url),
  log: (level, ...args) => {
    if (!isPackaged) {
      ipcRenderer.send("renderer-log", level, ...args);
    }
  },
});
