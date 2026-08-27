import fs from 'fs';
import path from 'path';

/**
 * Runtime location of the SQLite database.
 *
 * `npm start` from a checkout keeps using backend/prisma/retail.db. Packaged builds must not:
 * the tray shell launches them from a folder that is either read-only (NSIS install under
 * Program Files) or re-extracted to a brand-new temp dir on every launch (portable exe), so a
 * DB written there is lost — settings revert to defaults and sales disappear on restart.
 * The tray therefore passes POS_DATA_DIR pointing at the per-user app-data folder.
 */

/** Directory that holds retail.db. `appDir` is the folder containing server.js. */
export function resolveDataDir(appDir) {
  const override = String(process.env.POS_DATA_DIR || '').trim();
  if (override) return path.resolve(override);
  return path.join(appDir, 'prisma');
}

/** Absolute path to the active retail.db. */
export function resolveDbFile(appDir) {
  return path.join(resolveDataDir(appDir), 'retail.db');
}

/** The read-only snapshot shipped inside the bundle, used to seed a fresh data dir. */
function bundledDbFile(appDir) {
  return path.join(appDir, 'prisma', 'retail.db');
}

/**
 * Make sure the data dir exists and holds a database. On first run in a per-user data dir the
 * bundled snapshot is copied in; without it Prisma would open an empty file and every query
 * would fail with "no such table".
 */
export function ensureDatabaseFile(appDir) {
  const dbFile = resolveDbFile(appDir);
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  if (fs.existsSync(dbFile)) return dbFile;

  const seed = bundledDbFile(appDir);
  if (seed !== dbFile && fs.existsSync(seed)) {
    fs.copyFileSync(seed, dbFile);
    console.log('[db] Seeded new database from bundled snapshot:', dbFile);
    return dbFile;
  }
  console.warn(
    `[db] No database at ${dbFile} and no bundled snapshot to copy. ` +
      'Create one with: npx prisma db push && node prisma/seed.js',
  );
  return dbFile;
}

/**
 * Keep a copy of the shipped schema next to the database.
 *
 * `prisma db push` resolves the schema's relative `file:./retail.db` against the schema's own
 * folder, so pointing it at this copy is what lets an upgraded build migrate a data dir that now
 * outlives the app folder:
 *   npx prisma db push --schema "<dataDir>/schema.prisma"
 */
export function syncSchemaSnapshot(appDir) {
  const bundled = path.join(appDir, 'prisma', 'schema.prisma');
  const copy = path.join(resolveDataDir(appDir), 'schema.prisma');
  if (bundled === copy || !fs.existsSync(bundled)) return;

  const shipped = fs.readFileSync(bundled, 'utf8');
  const current = fs.existsSync(copy) ? fs.readFileSync(copy, 'utf8') : null;
  if (current === shipped) return;

  fs.writeFileSync(copy, shipped);
  if (current !== null) {
    console.warn(
      '[db] Shipped schema changed since the last run. If tables or columns are missing, run:' +
        `\n      npx prisma db push --schema "${copy}"`,
    );
  }
}

/**
 * Connection string for PrismaClient. An explicit DATABASE_URL still wins so the Prisma CLI and
 * the server can be pointed at the same place. Absolute path: a relative `file:` URL would be
 * resolved against schema.prisma's directory, not the data dir.
 */
export function resolveDatabaseUrl(appDir) {
  const explicit = String(process.env.DATABASE_URL || '').trim();
  if (explicit) return explicit;
  return `file:${ensureDatabaseFile(appDir)}`;
}

/**
 * Filesystem path behind a `file:` connection string, for the backup export/import routes.
 * Relative paths follow Prisma's rule of resolving against the schema.prisma directory.
 */
export function sqliteFileFromUrl(url, appDir) {
  const raw = String(url || '').trim();
  const body = (raw.startsWith('file:') ? raw.slice(5) : raw).split('?')[0];
  if (!body) return null;
  return path.resolve(path.join(appDir, 'prisma'), body);
}
