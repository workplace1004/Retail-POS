import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';

export function hashWebpanelPassword(plain) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(String(plain), salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return `${salt.toString('base64')}.${hash.toString('base64')}`;
}

export function verifyWebpanelPassword(plain, stored) {
  const parts = String(stored || '').split('.');
  if (parts.length !== 2) return false;
  const [saltB64, hashB64] = parts;
  let salt;
  let expected;
  try {
    salt = Buffer.from(saltB64, 'base64');
    expected = Buffer.from(hashB64, 'base64');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length !== PBKDF2_KEYLEN) return false;
  const hash = pbkdf2Sync(String(plain), salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return timingSafeEqual(expected, hash);
}

function getJwtSecret() {
  return String(process.env.WEBPANEL_JWT_SECRET || 'retail-webpanel-dev-secret-change-in-production');
}

const JWT_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export function signWebpanelJwt(payload) {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + JWT_MAX_AGE_SEC };
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadPart = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', secret).update(`${header}.${payloadPart}`).digest('base64url');
  return `${header}.${payloadPart}.${sig}`;
}

export function verifyWebpanelJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const secret = getJwtSecret();
  const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload?.exp || typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
