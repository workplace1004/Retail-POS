/**
 * Same workflow as `sample/START_BRIDGE_ONLY.bat`:
 * - Java: only `sample/runtime/java/bin/java.exe` (Windows) or `.../bin/java` (other OS).
 * - cwd: `sample/backend` when that tree has the JAR, else `backend/worldline-ctep-bridge` (retail copy).
 * - Classpath, library path, main class, ports: same as the batch file (ports overridable via env).
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const retailRoot = path.join(__dirname, '..');
const sampleRoot = path.join(retailRoot, '..', 'sample');
const bundledBridge = path.join(retailRoot, 'worldline-ctep-bridge');
const sampleBridge = path.join(sampleRoot, 'backend');

function pickBridgeDir() {
  const jarSample = path.join(sampleBridge, 'lib', 'JEasyCTEP-3.4.0.jar');
  if (fs.existsSync(jarSample)) return sampleBridge;
  const jarBundled = path.join(bundledBridge, 'lib', 'JEasyCTEP-3.4.0.jar');
  if (fs.existsSync(jarBundled)) return bundledBridge;
  return sampleBridge;
}

/** Portable JRE only — no JAVA_HOME, no `java` on PATH (matches sample). */
function resolvePortableJavaExe() {
  const binDir = path.join(sampleRoot, 'runtime', 'java', 'bin');
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
  const expected = path.join(sampleRoot, 'runtime', 'java', 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  console.error('[worldline-bridge] Portable Java ontbreekt: %s', expected);
  console.error('[worldline-bridge] Draai eerst INSTALL_PORTABLE_JAVA.bat in de sample-hoofdmap (zie sample/README_PORTABLE_JAVA_NL.txt).');
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
