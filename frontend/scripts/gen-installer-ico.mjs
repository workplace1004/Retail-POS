#!/usr/bin/env node
/**
 * NSIS (makensis) requires .ico for installer/uninstaller — PNG fails with "invalid icon file".
 * Writes build/installer.ico from public/icon.png before electron-builder.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const pngPath = path.join(root, 'public', 'icon.png');
const outDir = path.join(root, 'build');
const icoPath = path.join(outDir, 'installer.ico');

if (!fs.existsSync(pngPath)) {
  console.error(`[gen-installer-ico] Missing ${pngPath}`);
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
/** png-to-ico requires a square PNG; pad non-square assets to 256×256. */
const squarePng = await sharp(pngPath)
  .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .png()
  .toBuffer();
const buf = await pngToIco(squarePng);
fs.writeFileSync(icoPath, buf);
console.log(`[gen-installer-ico] Wrote ${icoPath}`);
