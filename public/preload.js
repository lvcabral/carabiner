/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  sendSync: (chan, message) => ipcRenderer.sendSync(chan, message),
  send: (chan, message) => ipcRenderer.send(chan, message),
  invoke: (chan, message) => ipcRenderer.invoke(chan, message),
  onMessageReceived: (chan, callback) => ipcRenderer.on(chan, callback),
  showSettings: () => ipcRenderer.send("show-settings"),
  loadImage: () => ipcRenderer.invoke("load-image"),
  getVersion: () => ipcRenderer.invoke("get-version"),
});
