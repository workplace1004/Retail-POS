/**
 * Starts the same Java bridge as `sample/START_BRIDGE_ONLY.bat`:
 * WorldlineCtepBrowserBridge on C-TEP + HTTP (default 9000 / 3210).
 *
 * Uses `backend/worldline-ctep-bridge` when lib JAR is present, otherwise `sample/backend`.
 */
'use strict';

const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const retailRoot = path.join(__dirname, '..');
const bundledBridge = path.join(retailRoot, 'worldline-ctep-bridge');
const sampleBridge = path.join(retailRoot, '..', 'sample', 'backend');

function pickBridgeDir() {
  const jarBundled = path.join(bundledBridge, 'lib', 'JEasyCTEP-3.4.0.jar');
  if (fs.existsSync(jarBundled)) return bundledBridge;
  const jarSample = path.join(sampleBridge, 'lib', 'JEasyCTEP-3.4.0.jar');
  if (fs.existsSync(jarSample)) return sampleBridge;
  return bundledBridge;
}

function resolveJavaFromPathProbe() {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('where.exe', ['java'], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const lines = out.trim().split(/\r?\n/).filter(Boolean);
      const first = lines[0] ? lines[0].trim() : '';
      if (first && fs.existsSync(first)) return first;
    } else {
      const out = execFileSync('which', ['java'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const p = out.trim().split('\n')[0];
      if (p && fs.existsSync(p)) return p;
    }
  } catch {
    // not on PATH
  }
  return null;
}

/** Best-effort: Adoptium, Microsoft, Corretto, Zulu under Program Files */
function findJavaUnderWindowsProgramFiles() {
  if (process.platform !== 'win32') return null;
  const bases = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']].filter(Boolean);
  const vendors = ['Eclipse Adoptium', 'Microsoft', 'Amazon Corretto', 'Zulu', 'Java'];
  for (const base of bases) {
    for (const vendor of vendors) {
      const dir = path.join(base, vendor);
      if (!fs.existsSync(dir)) continue;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const javaExe = path.join(dir, ent.name, 'bin', 'java.exe');
        if (fs.existsSync(javaExe)) return javaExe;
      }
    }
  }
  return null;
}

function findJavaExe() {
  const candidates = [];
  const portable = path.join(retailRoot, '..', 'sample', 'runtime', 'java', 'bin', 'java.exe');
  candidates.push(portable);
  candidates.push(path.join(retailRoot, '..', 'sample', 'runtime', 'java', 'bin', 'java'));
  if (process.env.JAVA_HOME) {
    candidates.push(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'));
    candidates.push(path.join(process.env.JAVA_HOME, 'bin', 'java'));
  }
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      // ignore
    }
  }
  const winJava = findJavaUnderWindowsProgramFiles();
  if (winJava) return winJava;
  const fromPath = resolveJavaFromPathProbe();
  if (fromPath) return fromPath;
  return 'java';
}

const bridgeDir = pickBridgeDir();
const ctepPort = String(process.env.WORLDLINE_CTEP_PORT || '9000');
const httpPort = String(process.env.WORLDLINE_CTEP_HTTP_PORT || '3210');
const javaExe = findJavaExe();

const libPath = path.join(bridgeDir, 'lib');
const classPath = `.${path.delimiter}${path.join('lib', 'JEasyCTEP-3.4.0.jar')}`;
const args = [
  `-Djava.library.path=${libPath}`,
  '-cp',
  classPath,
  'WorldlineCtepBrowserBridge',
  '--ctep-port',
  ctepPort,
  '--http-port',
  httpPort,
];

console.log('[worldline-bridge] cwd=%s', bridgeDir);
console.log('[worldline-bridge] java=%s', javaExe);
console.log('[worldline-bridge] C-TEP port=%s HTTP port=%s', ctepPort, httpPort);

const child = spawn(javaExe, args, {
  cwd: bridgeDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PATH: `${libPath}${path.delimiter}${process.env.PATH || ''}`,
  },
  windowsHide: false,
});

child.on('error', (err) => {
  if (err && err.code === 'ENOENT') {
    console.error(
      '[worldline-bridge] Java executable not found (ENOENT). Install a JDK (17+), add it to PATH, or set JAVA_HOME to the JDK folder.',
    );
    console.error('[worldline-bridge] Tried:', javaExe);
  } else {
    console.error('[worldline-bridge] Failed to start Java:', err && err.message ? err.message : err);
  }
  process.exit(1);
});

child.on('exit', (code, signal) => {
  process.exit(code == null ? (signal ? 1 : 0) : code);
});
