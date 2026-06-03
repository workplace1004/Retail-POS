/**
 * Electron shell: tray icon only (no window). Spawns runtime/node.exe with app/server.js beside this .exe.
 * Logs Node stdout/stderr to a file so startup errors (e.g. missing modules) are visible on Windows.
 */
const { app, Tray, Menu, nativeImage, Notification, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

/** 16×16 fallback when tray-icon.png is missing */
const FALLBACK_ICON_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAKElEQVQoz2NgoBAwUqifgYEQgZFK9YjFMIhBYgIxGBgYsNiHOQAA+T8FxwtQV14AAAAASUVORK5CYII=',
  'base64',
);

let tray = null;
let serverProcess = null;
let serverLogPath = '';

function candidateBundleRoots() {
  const roots = [];
  const push = (p) => {
    if (!p) return;
    const norm = path.normalize(p);
    if (!roots.includes(norm)) roots.push(norm);
  };
  push(path.dirname(process.execPath));
  if (process.resourcesPath) {
    push(process.resourcesPath);
    push(path.join(process.resourcesPath, '..'));
  }
  return roots;
}

/** Find runtime/node.exe + app/server.js (portable / unpacked layouts). */
function resolveServerBundle() {
  for (const base of candidateBundleRoots()) {
    const node = path.join(base, 'runtime', 'node.exe');
    const appDir = path.join(base, 'app');
    if (fs.existsSync(node) && fs.existsSync(path.join(appDir, 'server.js'))) {
      return { node, appDir, base };
    }
  }
  return null;
}

function appendServerLog(line) {
  try {
    fs.appendFileSync(serverLogPath, line, 'utf8');
  } catch {
    /* ignore */
  }
}

function loadTrayIcon() {
  const p = path.join(__dirname, 'tray-icon.png');
  if (fs.existsSync(p)) {
    try {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
    } catch {
      /* fall through */
    }
  }
  return nativeImage.createFromBuffer(FALLBACK_ICON_PNG);
}

function startServer() {
  const bundle = resolveServerBundle();
  if (!bundle) {
    const tried = candidateBundleRoots().join('\n');
    console.error('Retail Backend: could not find runtime\\node.exe and app\\server.js. Tried:\n', tried);
    appendServerLog(`\n[${new Date().toISOString()}] ERROR: bundle not found. Tried:\n${tried}\n`);
    return false;
  }

  const { node, appDir } = bundle;
  appendServerLog(`\n[${new Date().toISOString()}] Starting server cwd=${appDir} node=${node}\n`);

  serverProcess = spawn(node, ['server.js'], {
    cwd: appDir,
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  serverProcess.stdout.on('data', (buf) => appendServerLog(String(buf)));
  serverProcess.stderr.on('data', (buf) => appendServerLog(String(buf)));

  serverProcess.on('exit', (code, signal) => {
    appendServerLog(`[${new Date().toISOString()}] Server exit code=${code} signal=${signal || ''}\n`);
    serverProcess = null;
    if (signal) return;
    if (code !== 0 && code !== null && Notification.isSupported()) {
      new Notification({
        title: 'Retail Backend',
        body: `Server exited (code ${code}). Log: ${serverLogPath}`,
      }).show();
    }
  });

  return true;
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    serverProcess = null;
  }
}

function createTray() {
  const icon = loadTrayIcon();
  const sized = icon.isEmpty() ? nativeImage.createFromBuffer(FALLBACK_ICON_PNG) : icon;
  tray = new Tray(sized.resize({ width: 16, height: 16 }));
  tray.setToolTip('Retail Backend — http://localhost:4000');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Retail Backend (API running)', enabled: false },
      {
        label: 'Open server log…',
        click: () => {
          if (serverLogPath && fs.existsSync(serverLogPath)) {
            shell.showItemInFolder(serverLogPath);
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          stopServer();
          app.quit();
        },
      },
    ]),
  );
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    /* optional: focus nothing */
  });

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.retail.backend.tray');
    }
    try {
      fs.mkdirSync(app.getPath('userData'), { recursive: true });
      serverLogPath = path.join(app.getPath('userData'), 'backend-server.log');
    } catch {
      serverLogPath = path.join(app.getPath('temp'), 'pos-backend-server.log');
    }

    if (!startServer()) {
      if (Notification.isSupported()) {
        new Notification({
          title: 'Retail Backend',
          body: `Could not start API. See log: ${serverLogPath}`,
        }).show();
      }
      app.quit();
      return;
    }
    createTray();
  });

  app.on('window-all-closed', (e) => e.preventDefault());
  app.on('before-quit', () => stopServer());
}
