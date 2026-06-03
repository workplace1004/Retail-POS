/**
 * `npm run dev`: starts Worldline C-TEP Java bridge + Node API (watch mode).
 * Bridge uses the same launcher as `npm run worldline-bridge`.
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const bridgeScript = path.join(__dirname, 'run-worldline-ctep-bridge.cjs');
const bridgeRestartTrigger = path.join(root, 'runtime', 'worldline-bridge.restart');

const env = {
  ...process.env,
  WORLDLINE_CTEP_HTTP_URL: process.env.WORLDLINE_CTEP_HTTP_URL || 'http://127.0.0.1:3210',
};

function start(label, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env,
    windowsHide: false,
  });
  return child;
}

let shuttingDown = false;
let bridgeChild = null;
let serverChild = null;
let restartingBridge = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try { fs.unwatchFile(bridgeRestartTrigger); } catch {}
  try { if (bridgeChild) bridgeChild.kill('SIGTERM'); } catch {}
  try { if (serverChild) serverChild.kill('SIGTERM'); } catch {}
  setTimeout(() => process.exit(exitCode), 400);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('[dev-with-bridge] Starting Worldline C-TEP bridge + API (WORLDLINE_CTEP_HTTP_URL=%s)', env.WORLDLINE_CTEP_HTTP_URL);

function startBridge() {
  const child = start('worldline-ctep-bridge', process.execPath, [bridgeScript]);
  child.on('exit', (code, signal) => {
    if (shuttingDown || restartingBridge) return;
    const portableHint =
      'Portable JRE must exist at backend/runtime/java (copy a Java 17 x64 JRE tree there; see worldline-ctep-bridge/README.md).';
    console.error(
      `[dev-with-bridge] Bridge process stopped (code=${code}, signal=${signal || 'none'}). `
      + `Payments to http://127.0.0.1:3210 will fail until the bridge runs. ${portableHint} `
      + 'Or run: npm run worldline-bridge',
    );
  });
  return child;
}

function restartBridge() {
  if (shuttingDown || restartingBridge) return;
  restartingBridge = true;
  console.log('[dev-with-bridge] Restarting Worldline bridge after configuration change...');
  const prev = bridgeChild;
  bridgeChild = null;
  const finish = () => {
    bridgeChild = startBridge();
    restartingBridge = false;
  };
  if (!prev) {
    finish();
    return;
  }
  prev.once('exit', () => setTimeout(finish, 120));
  try {
    prev.kill('SIGTERM');
  } catch {
    setTimeout(finish, 120);
  }
}

bridgeChild = startBridge();

fs.watchFile(bridgeRestartTrigger, { interval: 500 }, (curr, prev) => {
  if (shuttingDown) return;
  if (curr.mtimeMs && curr.mtimeMs !== prev.mtimeMs) {
    restartBridge();
  }
});

serverChild = start('server', process.execPath, ['--watch', 'server.js']);
serverChild.on('exit', (code, signal) => {
  if (shuttingDown) return;
  console.error(`[dev-with-bridge] Server exited (code=${code}, signal=${signal || 'none'})`);
  shutdown(code == null ? 1 : code);
});
