/**
 * `npm run dev`: starts Worldline C-TEP Java bridge + Node API (watch mode).
 * Bridge uses the same launcher as `npm run worldline-bridge`.
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const bridgeScript = path.join(__dirname, 'run-worldline-ctep-bridge.cjs');

const env = {
  ...process.env,
  WORLDLINE_CTEP_HTTP_URL: process.env.WORLDLINE_CTEP_HTTP_URL || 'http://127.0.0.1:3210',
};

const children = [];

function start(label, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env,
    windowsHide: false,
  });
  children.push({ label, child });
  return child;
}

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) {
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  setTimeout(() => process.exit(exitCode), 400);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('[dev-with-bridge] Starting Worldline C-TEP bridge + API (WORLDLINE_CTEP_HTTP_URL=%s)', env.WORLDLINE_CTEP_HTTP_URL);

const bridgeChild = start('worldline-ctep-bridge', process.execPath, [bridgeScript]);
bridgeChild.on('exit', (code, signal) => {
  if (shuttingDown) return;
  const portableHint =
    'Portable JRE must exist at backend/runtime/java (copy a Java 17 x64 JRE tree there; see worldline-ctep-bridge/README.md).';
  console.error(
    `[dev-with-bridge] Bridge process stopped (code=${code}, signal=${signal || 'none'}). `
    + `Payments to http://127.0.0.1:3210 will fail until the bridge runs. ${portableHint} `
    + 'Or run: npm run worldline-bridge',
  );
});

const serverChild = start('server', process.execPath, ['--watch', 'server.js']);
serverChild.on('exit', (code, signal) => {
  if (shuttingDown) return;
  console.error(`[dev-with-bridge] Server exited (code=${code}, signal=${signal || 'none'})`);
  shutdown(code == null ? 1 : code);
});
