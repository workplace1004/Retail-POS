const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('posElectronPrint', {
  printHtml: (html) => ipcRenderer.invoke('print-periodic-report-html', html),
});

contextBridge.exposeInMainWorld('posElectronApp', {
  /** Request the Electron main process to quit the application. */
  quit: () => {
    ipcRenderer.send('pos-app-quit');
  },
});
