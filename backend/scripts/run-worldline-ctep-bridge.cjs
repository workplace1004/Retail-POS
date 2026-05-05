/**
 * Starts the same Java bridge as `sample/START_BRIDGE_ONLY.bat`:
 * WorldlineCtepBrowserBridge on C-TEP + HTTP (default 9000 / 3210).
 *
 * Uses `backend/worldline-ctep-bridge` when lib JAR is present, otherwise `sample/backend`.
 */
'use strict';

const { spawn } = require('child_process');
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

function findJavaExe() {
  const candidates = [];
  const portable = path.join(retailRoot, '..', 'sample', 'runtime', 'java', 'bin', 'java.exe');
  candidates.push(portable);
  candidates.push(path.join(retailRoot, '..', 'sample', 'runtime', 'java', 'bin', 'java'));
  if (process.env.JAVA_HOME) {
    candidates.push(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'));
    candidates.push(path.join(process.env.JAVA_HOME, 'bin', 'java'));
  }
  candidates.push('java');
  for (const c of candidates) {
    if (c === 'java') return c;
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      // ignore
    }
  }
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

child.on('exit', (code, signal) => {
  process.exit(code == null ? (signal ? 1 : 0) : code);
});
