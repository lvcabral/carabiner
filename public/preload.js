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

contextBridge.exposeInMainWorld("electronAPI", {
  sendSync: (chan, message) => ipcRenderer.sendSync(chan, message),
  send: (chan, message) => ipcRenderer.send(chan, message),
  invoke: (chan, ...args) => ipcRenderer.invoke(chan, ...args),
  onMessageReceived: (chan, callback) => ipcRenderer.on(chan, callback),
  showContextMenu: () => ipcRenderer.send("show-context-menu"),
  loadImage: () => ipcRenderer.invoke("load-image"),
  getPackageInfo: () => ipcRenderer.invoke("get-package-info"),
  openExternal: (url) => shell.openExternal(url),
});
