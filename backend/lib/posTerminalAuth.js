import { createHmac, timingSafeEqual } from 'crypto';

const JWT_TYP = 'POS_TERMINAL';
const JWT_MAX_AGE_SEC = 60 * 60 * 24 * 14;

function getSecret() {
  return String(process.env.POS_TERMINAL_JWT_SECRET || 'retail-pos-terminal-dev-secret-change-in-production');
}

/** @param {{ r: string }} payload — r = PosRegister id */
export function signPosTerminalJwt(payload) {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const body = { typ: JWT_TYP, ...payload, iat: now, exp: now + JWT_MAX_AGE_SEC };
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadPart = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', secret).update(`${header}.${payloadPart}`).digest('base64url');
  return `${header}.${payloadPart}.${sig}`;
}

/** @returns {{ r: string, typ?: string, exp?: number } | null} */
export function verifyPosTerminalJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const secret = getSecret();
  const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (payload?.typ !== JWT_TYP || !payload?.r || typeof payload.r !== 'string') return null;
  if (!payload?.exp || typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
