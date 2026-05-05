/**
 * Worldline C-TEP Java bridge — **backend only** (no `../sample/` at runtime).
 * - Portable JRE: `backend/runtime/java/bin/java.exe` (or `.../bin/java`).
 * - Bridge libs + class: `backend/worldline-ctep-bridge/` (copy from vendor / reference package into this tree).
 * - Same JVM args as the reference START_BRIDGE_ONLY flow: library path, classpath, main class, ports.
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const retailRoot = path.join(__dirname, '..');
const bundledBridge = path.join(retailRoot, 'worldline-ctep-bridge');
const jarBundled = path.join(bundledBridge, 'lib', 'JEasyCTEP-3.4.0.jar');

function pickBridgeDir() {
  if (fs.existsSync(jarBundled)) return bundledBridge;
  console.error(
    '[worldline-bridge] Missing %s — copy `lib/` (JEasyCTEP JAR + native DLLs) and bridge class files into backend/worldline-ctep-bridge/.',
    jarBundled,
  );
  process.exit(1);
}

/** Portable JRE under backend only — no system JDK / JAVA_HOME required for this launcher. */
function resolvePortableJavaExe() {
  const binDir = path.join(retailRoot, 'runtime', 'java', 'bin');
  const win = path.join(binDir, 'java.exe');
  const nix = path.join(binDir, 'java');
  if (process.platform === 'win32' && fs.existsSync(win)) return win;
  if (process.platform !== 'win32' && fs.existsSync(nix)) return nix;
  if (fs.existsSync(win)) return win;
  if (fs.existsSync(nix)) return nix;
  return null;
}

const bridgeDir = pickBridgeDir();
const ctepPort = String(process.env.WORLDLINE_CTEP_PORT || '9000');
const httpPort = String(process.env.WORLDLINE_CTEP_HTTP_PORT || '3210');
const javaExe = resolvePortableJavaExe();

if (!javaExe) {
  const expected = path.join(retailRoot, 'runtime', 'java', 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  console.error('[worldline-bridge] Portable Java missing: %s', expected);
  console.error(
    '[worldline-bridge] Copy a Java 17 x64 JRE into backend/runtime/java so that bin/java.exe exists (same folder layout as a full JRE).',
  );
  process.exit(1);
}

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

child.on('exit', (code, signal) => {
  process.exit(code == null ? (signal ? 1 : 0) : code);
});
