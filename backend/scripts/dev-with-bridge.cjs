/**
 * Dev entry: starts the Node Worldline HTTP bridge, then the API server.
 * No Java/Maven required.
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const children = [];

const defaultBridgeUrl = 'http://127.0.0.1:8099/worldline';
const env = {
  ...process.env,
  WORLDLINE_BRIDGE_URL: process.env.WORLDLINE_BRIDGE_URL || defaultBridgeUrl,
};

function start(label, args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env,
    windowsHide: false,
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(`[dev-with-bridge] ${label} exited (code=${code}, signal=${signal || 'none'})`);
      shutdown(code ?? 1);
    }
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

console.log('[dev-with-bridge] Starting Node Worldline HTTP bridge + API (WORLDLINE_BRIDGE_URL=%s)', env.WORLDLINE_BRIDGE_URL);

start('worldline-http-bridge', ['worldline-http-bridge.js']);
start('server', ['--watch', 'server.js']);
