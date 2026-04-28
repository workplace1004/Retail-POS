#!/usr/bin/env node
/**
 * Windows: release/ with:
 * - retail-backend/ — unpacked app (retail-backend.exe, runtime/, app/)
 * - retail-backend.exe — NSIS installer (CRC self-check disabled for flaky copies)
 * - retail-backend-portable.exe — no wizard; unpacks to temp (also CRCCheck off)
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const defaultReleaseOut = path.join(root, 'release', 'retail-backend');
const elauncher = path.join(root, 'electron-tray-launcher');

/** Tiny PNG fallback if frontend app icon is missing */
const FALLBACK_TRAY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAKElEQVQoz2NgoBAwUqifgYEQgZFK9YjFMIhBYgIxGBgYsNiHOQAA+T8FxwtQV14AAAAASUVORK5CYII=',
  'base64',
);

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function rmrfTry(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* wait */
  }
}

/** Windows: EXE running or Explorer preview often holds locks; retry before giving up. */
function rmrfTryRetries(p, attempts = 6, delayMs = 500) {
  for (let i = 0; i < attempts; i++) {
    if (rmrfTry(p)) return true;
    if (i < attempts - 1) sleepSync(delayMs);
  }
  return false;
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, name.name);
    const d = path.join(destDir, name.name);
    if (name.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** Copy unpacked app to final folder. Do not delete src (Windows often holds locks on win-unpacked). */
function copyUnpackedToOut(unpackedDir, destDir) {
  if (!rmrfTryRetries(destDir)) {
    throw new Error(
      `Cannot clear output folder (in use): ${destDir}\n` +
        '  Quit retail-backend.exe (tray → Quit), close Explorer windows on that folder, then run build again.',
    );
  }
  fs.cpSync(unpackedDir, destDir, { recursive: true });
}

function copyNodeRuntime(destRuntimeDir) {
  if (process.platform !== 'win32') {
    console.error('[build-win-exe] Only Windows is supported (need node.exe + DLLs).');
    process.exit(1);
  }
  const nodeDir = path.dirname(process.execPath);
  const nodeExe = process.execPath;
  fs.mkdirSync(destRuntimeDir, { recursive: true });
  if (!fs.existsSync(nodeExe)) {
    console.error('[build-win-exe] Could not find node at', nodeExe);
    process.exit(1);
  }
  copyFile(nodeExe, path.join(destRuntimeDir, 'node.exe'));
  for (const name of fs.readdirSync(nodeDir)) {
    if (!name.toLowerCase().endsWith('.dll')) continue;
    copyFile(path.join(nodeDir, name), path.join(destRuntimeDir, name));
  }
  console.log('[build-win-exe] Copied Node runtime from', nodeDir);
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: false, windowsHide: true });
  if (r.status !== 0) {
    console.error(`[build-win-exe] Failed: ${cmd} ${args.join(' ')}`);
    process.exit(r.status || 1);
  }
}

function runNpmCli(commandLine, cwd) {
  const comspec = process.env.ComSpec || 'cmd.exe';
  const r = spawnSync(comspec, ['/d', '/c', commandLine], {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
    shell: false,
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(`[build-win-exe] Failed: ${commandLine}`);
    process.exit(r.status || 1);
  }
}

async function main() {
  const electronPkg = path.join(root, 'node_modules', 'electron', 'package.json');
  if (!fs.existsSync(electronPkg)) {
    console.error('[build-win-exe] Missing electron. Run: npm install (in backend)');
    process.exit(1);
  }
  const electronVersion = JSON.parse(fs.readFileSync(electronPkg, 'utf8')).version;
  const backendPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const backendVersion = backendPkg.version || '1.0.0';

  const staging = path.join(root, 'release', '.pos-backend-bundle');
  let ebOut = path.join(root, 'release', '_electron-out');

  let releaseOut = defaultReleaseOut;
  if (!rmrfTryRetries(releaseOut)) {
    releaseOut = path.join(root, 'release', `retail-backend-build-${Date.now()}`);
    console.warn(
      '[build-win-exe] Could not remove release\\retail-backend (is retail-backend.exe still running?).',
    );
    console.warn('[build-win-exe] Building to alternate folder:', releaseOut);
  }

  console.log('[build-win-exe] Output:', releaseOut);
  rmrf(staging);
  if (!rmrfTry(ebOut)) {
    ebOut = path.join(root, 'release', `_electron-out-${Date.now()}`);
    console.warn('[build-win-exe] Using alternate electron output dir:', ebOut);
  }
  fs.mkdirSync(staging, { recursive: true });

  const appDir = path.join(staging, 'app');
  const runtimeDir = path.join(staging, 'runtime');

  copyNodeRuntime(runtimeDir);

  fs.mkdirSync(appDir, { recursive: true });
  copyFile(path.join(root, 'package.json'), path.join(appDir, 'package.json'));
  copyFile(path.join(root, 'package-lock.json'), path.join(appDir, 'package-lock.json'));
  copyFile(path.join(root, 'server.js'), path.join(appDir, 'server.js'));
  copyFile(path.join(root, 'periodicReportReceipt.js'), path.join(appDir, 'periodicReportReceipt.js'));
  copyFile(path.join(root, 'financialReportReceipt.js'), path.join(appDir, 'financialReportReceipt.js'));
  copyDir(path.join(root, 'services'), path.join(appDir, 'services'));
  copyDir(path.join(root, 'prisma'), path.join(appDir, 'prisma'));
  const devDb = path.join(root, 'prisma', 'retail.db');
  if (fs.existsSync(devDb)) {
    copyFile(devDb, path.join(appDir, 'prisma', 'retail.db'));
    console.log('[build-win-exe] Copied prisma/retail.db');
  }

  console.log('[build-win-exe] npm ci --omit=dev …');
  runNpmCli('npm ci --omit=dev', appDir);
  console.log('[build-win-exe] prisma generate …');
  runNpmCli('npx prisma generate', appDir);

  fs.copyFileSync(path.join(root, 'tray-main.cjs'), path.join(elauncher, 'main.cjs'));
  const frontendIcon = path.join(root, '..', 'frontend', 'public', 'icon.png');
  const trayPng = path.join(elauncher, 'tray-icon.png');
  if (fs.existsSync(frontendIcon)) fs.copyFileSync(frontendIcon, trayPng);
  else fs.writeFileSync(trayPng, FALLBACK_TRAY_PNG);

  const genIco = spawnSync(process.execPath, [path.join(__dirname, 'gen-installer-ico.cjs')], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });
  if (genIco.status !== 0 && genIco.status != null) {
    console.error('[build-win-exe] gen-installer-ico failed');
    process.exit(genIco.status || 1);
  }

  const installerIco = path.join(root, 'build', 'installer.ico');
  const nsis = {
    include: 'nsis/installer.nsh',
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: false,
    createStartMenuShortcut: true,
    shortcutName: 'Retail Backend',
    uninstallDisplayName: 'Retail Backend',
    runAfterFinish: true,
    differentialPackage: false,
  };
  if (fs.existsSync(installerIco)) {
    nsis.installerIcon = installerIco;
    nsis.uninstallerIcon = installerIco;
  }

  console.log('[build-win-exe] electron-builder (folder + NSIS setup + portable exe, may download Electron once) …');
  const { build } = require('electron-builder');
  await build({
    projectDir: elauncher,
    publish: null,
    x64: true,
    config: {
      electronVersion,
      extraMetadata: { version: backendVersion },
      compression: 'normal',
      artifactName: 'retail-backend.${ext}',
      portable: {
        artifactName: 'retail-backend-portable.${ext}',
      },
      appId: 'com.retail.backend',
      productName: 'Retail Backend',
      directories: { output: ebOut },
      files: ['**/*', '!**/node_modules/**'],
      extraFiles: [
        { from: path.join(staging, 'runtime'), to: 'runtime' },
        { from: path.join(staging, 'app'), to: 'app' },
      ],
      asar: false,
      win: {
        executableName: 'retail-backend',
        ...(fs.existsSync(frontendIcon) ? { icon: frontendIcon } : {}),
        target: [
          { target: 'dir', arch: ['x64'] },
          { target: 'nsis', arch: ['x64'] },
          { target: 'portable', arch: ['x64'] },
        ],
      },
      nsis,
      npmRebuild: false,
    },
  });

  const entries = fs.readdirSync(ebOut, { withFileTypes: true }).filter((d) => d.isDirectory());
  const unpacked = entries.find((d) => d.name.includes('unpacked'));
  if (!unpacked) {
    console.error('[build-win-exe] electron-builder did not produce an *unpacked* folder in', ebOut);
    process.exit(1);
  }
  const unpackedPath = path.join(ebOut, unpacked.name);
  copyUnpackedToOut(unpackedPath, releaseOut);

  const releaseArtifactsDir = path.join(root, 'release');
  fs.mkdirSync(releaseArtifactsDir, { recursive: true });
  for (const name of fs.readdirSync(ebOut)) {
    const src = path.join(ebOut, name);
    if (!fs.statSync(src).isFile() || !name.toLowerCase().endsWith('.exe')) continue;
    const dest = path.join(releaseArtifactsDir, name);
    copyFile(src, dest);
    if (/portable/i.test(name)) {
      console.log('[build-win-exe] Portable (no install wizard; CRC check off):', dest);
    } else if (/setup/i.test(name)) {
      console.log('[build-win-exe] Setup installer:', dest);
    } else {
      console.log('[build-win-exe] Copied:', dest);
    }
  }

  if (!rmrfTry(ebOut)) {
    console.warn('[build-win-exe] Could not remove temp folder (close apps using it):', ebOut);
  }
  rmrf(staging);

  console.log('[build-win-exe] Done. Run app:', path.join(releaseOut, 'retail-backend.exe'));
  console.log(
    '[build-win-exe] Tip: The NSIS error only applies to retail-backend.exe. Use retail-backend\\retail-backend.exe from the folder, or retail-backend-portable.exe, if setup fails after copying.',
  );
  console.log('[build-win-exe] Tray icon: open the ^ menu on the taskbar — right-click → Quit to stop the API.');
  console.log('[build-win-exe] Default API: http://localhost:4000');
  if (releaseOut !== defaultReleaseOut) {
    console.warn('[build-win-exe] To refresh the usual install path, quit the tray app and delete release\\retail-backend, then rebuild.');
  }
  if (!fs.existsSync(path.join(releaseOut, 'app', 'prisma', 'retail.db'))) {
    const appRel = path.relative(root, path.join(releaseOut, 'app'));
    console.log(
      `[build-win-exe] No prisma/retail.db — create DB: cd "${appRel}" && npx prisma db push && node prisma\\seed.js`,
    );
  }
}

main().catch((err) => {
  console.error('[build-win-exe]', err);
  process.exit(1);
});
