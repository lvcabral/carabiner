const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  sendSync: (chan, message) => ipcRenderer.sendSync(chan, message),
  send: (chan, message) => ipcRenderer.send(chan, message),
  invoke: (chan, message) => ipcRenderer.invoke(chan, message),
  onMessageReceived: (chan, callback) => ipcRenderer.on(chan, callback),
});
