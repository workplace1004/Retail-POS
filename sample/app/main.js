const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const LOG_MAX = 800;
let win;
let bridgeProc = null;
let logs = [];

const CTEP_PORT = 9000;
const HTTP_PORT = 3210;

function fileExists(p) {
  try { return require('fs').existsSync(p); } catch { return false; }
}

function findJavaExe() {
  const candidates = [];
  const env = process.env;
  // 1) Portable Java bundled in this package. Preferred for POS deployments.
  candidates.push(path.join(ROOT, 'runtime', 'java', 'bin', 'java.exe'));
  candidates.push(path.join(ROOT, 'runtime', 'java', 'bin', 'java'));

  if (env.JAVA_HOME) {
    candidates.push(path.join(env.JAVA_HOME, 'bin', 'java.exe'));
    candidates.push(path.join(env.JAVA_HOME, 'bin', 'java'));
  }
  if (env.JRE_HOME) {
    candidates.push(path.join(env.JRE_HOME, 'bin', 'java.exe'));
  }
  candidates.push(
    'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe',
    'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe',
    'C:\\Program Files\\Java\\jre-17\\bin\\java.exe',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.7.6-hotspot\\bin\\java.exe',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.15.6-hotspot\\bin\\java.exe',
    'C:\\Program Files\\Microsoft\\jdk-17.0.15.6-hotspot\\bin\\java.exe',
    'C:\\Program Files\\Zulu\\zulu-17\\bin\\java.exe',
    'C:\\Program Files (x86)\\Java\\jre-1.8\\bin\\java.exe',
    'C:\\Program Files (x86)\\Java\\jre8\\bin\\java.exe'
  );
  for (const c of candidates) if (fileExists(c)) return c;
  return 'java';
}

function describeJava(javaExe) {
  if (javaExe === 'java') return 'java (via Windows PATH)';
  return javaExe;
}


function addLog(line) {
  const stamp = new Date().toLocaleTimeString('nl-BE', { hour12: false });
  const msg = `[${stamp}] ${line}`;
  logs.unshift(msg);
  if (logs.length > LOG_MAX) logs = logs.slice(0, LOG_MAX);
  if (win && !win.isDestroyed()) win.webContents.send('bridge-log', msg);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 900,
    minHeight: 650,
    title: 'Worldline C-TEP Electron TestTool',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer.html'));
}

function startBridge() {
  if (bridgeProc && !bridgeProc.killed) {
    addLog('Bridge draait al.');
    return { ok: true, alreadyRunning: true };
  }

  const javaArgs = [
    `-Djava.library.path=${path.join(BACKEND, 'lib')}`,
    '-cp',
    `.;${path.join('lib', 'JEasyCTEP-3.4.0.jar')}`,
    'WorldlineCtepBrowserBridge',
    '--ctep-port', String(CTEP_PORT),
    '--http-port', String(HTTP_PORT)
  ];

  const javaExe = findJavaExe();
  addLog(`Start Java bridge: C-TEP ${CTEP_PORT}, HTTP ${HTTP_PORT}`);
  addLog(`Java executable: ${describeJava(javaExe)}`);
  bridgeProc = spawn(javaExe, javaArgs, {
    cwd: BACKEND,
    windowsHide: false,
    env: {
      ...process.env,
      PATH: `${path.join(BACKEND, 'lib')};${process.env.PATH || ''}`
    }
  });

  bridgeProc.stdout.on('data', d => addLog(String(d).trimEnd()));
  bridgeProc.stderr.on('data', d => addLog('ERROR: ' + String(d).trimEnd()));
  bridgeProc.on('error', err => {
    addLog('Bridge process error: ' + err.message);
    if (String(err.message || '').includes('ENOENT')) {
      addLog('Java niet gevonden. Plaats portable Java in runtime\java of draai INSTALL_PORTABLE_JAVA.bat. Daarna opnieuw starten.');
    }
  });
  bridgeProc.on('exit', (code, signal) => {
    addLog(`Bridge gestopt. code=${code} signal=${signal || ''}`);
    bridgeProc = null;
  });

  return { ok: true, started: true };
}

function stopBridge() {
  if (!bridgeProc || bridgeProc.killed) return { ok: true, message: 'Bridge was niet actief.' };
  addLog('Stop Java bridge...');
  bridgeProc.kill();
  bridgeProc = null;
  return { ok: true, stopped: true };
}

function requestJson(method, apiPath, body) {
  return new Promise(resolve => {
    const payload = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const req = http.request({
      host: '127.0.0.1',
      port: HTTP_PORT,
      path: apiPath,
      method,
      timeout: 6500,
      headers: payload ? {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      } : {}
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, data: json });
        } catch (e) {
          resolve({ ok: false, statusCode: res.statusCode, error: 'Invalid JSON response', raw: data });
        }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('Timeout naar lokale bridge')); });
    req.on('error', err => resolve({ ok: false, error: err.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

ipcMain.handle('bridge:start', () => startBridge());
ipcMain.handle('bridge:stop', () => stopBridge());
ipcMain.handle('bridge:logs', () => logs);
ipcMain.handle('api:ping', async () => requestJson('GET', '/ping'));
ipcMain.handle('api:status', async () => requestJson('GET', '/status'));
ipcMain.handle('api:transaction', async () => requestJson('GET', '/transaction'));
ipcMain.handle('api:sale', async (_evt, sale) => requestJson('POST', '/sale', sale));
ipcMain.handle('api:cancel', async () => requestJson('POST', '/cancel'));
ipcMain.handle('api:serviceStart', async () => requestJson('POST', '/service/start'));
ipcMain.handle('api:serviceStop', async () => requestJson('POST', '/service/stop'));

app.whenReady().then(() => {
  createWindow();
  startBridge();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', () => stopBridge());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
