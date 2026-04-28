#!/usr/bin/env node
/**
 * NSIS requires .ico for installer/uninstaller (PNG is rejected).
 * Writes build/installer.ico from ../frontend/public/icon.png when present.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const frontendPng = path.join(root, '..', 'frontend', 'public', 'icon.png');
const outDir = path.join(root, 'build');
const icoPath = path.join(outDir, 'installer.ico');

async function main() {
  if (!fs.existsSync(frontendPng)) {
    console.warn('[gen-installer-ico] No frontend icon at', frontendPng, '— NSIS will use default icons.');
    process.exit(0);
  }
  const sharp = require('sharp');
  const { default: pngToIco } = await import('png-to-ico');
  fs.mkdirSync(outDir, { recursive: true });
  const squarePng = await sharp(frontendPng)
    .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  const buf = await pngToIco(squarePng);
  fs.writeFileSync(icoPath, buf);
  console.log('[gen-installer-ico] Wrote', icoPath);
}

main().catch((err) => {
  console.error('[gen-installer-ico]', err);
  process.exit(1);
});
