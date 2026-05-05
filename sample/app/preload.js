const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ctep', {
  startBridge: () => ipcRenderer.invoke('bridge:start'),
  stopBridge: () => ipcRenderer.invoke('bridge:stop'),
  getLogs: () => ipcRenderer.invoke('bridge:logs'),
  onLog: (cb) => ipcRenderer.on('bridge-log', (_evt, line) => cb(line)),
  ping: () => ipcRenderer.invoke('api:ping'),
  status: () => ipcRenderer.invoke('api:status'),
  transaction: () => ipcRenderer.invoke('api:transaction'),
  sale: (payload) => ipcRenderer.invoke('api:sale', payload),
  cancel: () => ipcRenderer.invoke('api:cancel'),
  serviceStart: () => ipcRenderer.invoke('api:serviceStart'),
  serviceStop: () => ipcRenderer.invoke('api:serviceStop')
});
