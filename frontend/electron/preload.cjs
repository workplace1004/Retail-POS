const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('posElectronPrint', {
  printHtml: (html) => ipcRenderer.invoke('print-periodic-report-html', html),
});
