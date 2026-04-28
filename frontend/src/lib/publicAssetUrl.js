import { POS_BACKEND_ORIGIN } from './apiOrigin.js';

const base = String(import.meta.env.BASE_URL || '/');

function fileLikeAppProtocol() {
  if (typeof window === 'undefined') return false;
  const p = window.location?.protocol;
  return p === 'file:' || p === 'app:';
}

/**
 * Files from `public/` (copied next to `index.html` in `dist/`).
 * Root-relative `/x.svg` breaks under `file://`; this prefixes `import.meta.env.BASE_URL`.
 */
export function publicAssetUrl(path) {
  const p = String(path ?? '').trim();
  if (!p) return p;
  if (/^(https?:|data:|blob:)/i.test(p)) return p;
  const tail = p.startsWith('/') ? p.slice(1) : p;
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${tail}`;
}

/**
 * Absolute paths from the API (e.g. product photos as `/uploads/...`) — resolve to the POS backend when the UI is `file://`.
 */
export function resolveMediaSrc(src) {
  const s = String(src ?? '').trim();
  if (!s) return s;
  if (/^(https?:|data:|blob:)/i.test(s)) return s;
  if (s.startsWith('//')) return s;
  if (s.startsWith('/') && fileLikeAppProtocol()) {
    return `${POS_BACKEND_ORIGIN}${s}`;
  }
  return s;
}
