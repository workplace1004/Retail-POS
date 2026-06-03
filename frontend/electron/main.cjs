const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');

const VITE_DEV_URL = 'http://127.0.0.1:5173';
/** Run unpacked Electron against `dist/` (no Vite) — set by npm script or launcher. */
const loadDist = app.isPackaged || process.env.ELECTRON_LOAD_DIST === '1';

/**
 * Print HTML to the OS default printer (no dialog).
 * Uses a hidden window because data: URLs + print in the main fullscreen window are unreliable.
 */
function registerAppQuitHandler() {
  ipcMain.on('pos-app-quit', () => {
    app.quit();
  });
}

function registerPrintHandler() {
  ipcMain.handle('print-periodic-report-html', async (_event, html) => {
    const payload = typeof html === 'string' ? html : '';
    if (!payload.trim()) return { success: false, failureReason: 'empty_html' };

    return new Promise((resolve) => {
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      let settled = false;
      const finish = (success, failureReason) => {
        if (settled) return;
        settled = true;
        if (!printWin.isDestroyed()) printWin.close();
        resolve({ success, failureReason: failureReason || null });
      };

      printWin.webContents.once('did-fail-load', (_e, _code, desc) => {
        finish(false, desc || 'did-fail-load');
      });

      printWin.webContents.once('did-finish-load', () => {
        setTimeout(() => {
          try {
            printWin.webContents.print(
              { silent: true, printBackground: true },
              (success, failureReason) => {
                finish(!!success, failureReason);
              }
            );
          } catch (err) {
            finish(false, String(err?.message || err));
          }
        }, 150);
      });

      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(payload)}`;
      printWin.loadURL(dataUrl).catch((err) => finish(false, String(err?.message || err)));
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    show: false,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    }
  });

  win.setMenuBarVisibility(false);

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    }
  });

  win.once('ready-to-show', () => {
    win.setFullScreen(true);
    win.show();
  });

  if (loadDist) {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    win.loadURL(VITE_DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerAppQuitHandler();
  registerPrintHandler();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
