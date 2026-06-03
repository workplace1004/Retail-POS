#!/usr/bin/env node
/**
 * Removes pos/release before electron-builder so a failed or locked prior build
 * cannot leave a truncated Setup .exe / .nsis.7z (NSIS "integrity check has failed").
 */
const fs = require('fs');
const path = require('path');

const release = path.join(__dirname, '..', 'release');
if (!fs.existsSync(release)) {
  process.exit(0);
}
for (const name of fs.readdirSync(release)) {
  const p = path.join(release, name);
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (e) {
    console.error(`[clean-electron-release] Could not remove ${p}: ${e.message}`);
    process.exit(1);
  }
}
console.log('[clean-electron-release] Cleared', release);
