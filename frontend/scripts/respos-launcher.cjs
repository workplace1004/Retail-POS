#!/usr/bin/env node
/**
 * Double-click launcher: runs Electron against `dist/` (after `npm run build:electron`).
 * Build: npm run build:respos-exe → release/RESPOS.exe
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const APP_ROOT = process.env.RESPOS_ROOT || 'C:\\RESPOS';

const distIndex = path.join(APP_ROOT, 'dist', 'index.html');
const electronCli = path.join(APP_ROOT, 'node_modules', 'electron', 'cli.js');

if (!fs.existsSync(distIndex)) {
  console.error(
    `[RESPOS] Missing ${distIndex}\n` +
      '  Run: npm install && npm run build:electron'
  );
  process.exitCode = 1;
  process.exit(1);
}

if (!fs.existsSync(electronCli)) {
  console.error(
    `[RESPOS] Electron not installed (missing ${electronCli})\n` +
      '  Run: npm install'
  );
  process.exitCode = 1;
  process.exit(1);
}

const child = spawn(process.execPath, [electronCli, '.'], {
  cwd: APP_ROOT,
  env: { ...process.env, ELECTRON_LOAD_DIST: '1' },
  detached: true,
  stdio: 'ignore',
  windowsHide: false
});
child.unref();
