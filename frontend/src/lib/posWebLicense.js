/**
 * Client license file + verification. Keep in sync with License/backend (licenseFileCrypto, rsaLicense, canonicalStringify).
 */

export const RETAIL_LICENSE_FILE_FORMAT = 'retail-license';
export const RETAIL_LICENSE_FILE_VERSION = 1;
export const LICENSE_OPFS_DIR = 'retail';
export const LICENSE_OPFS_FILE = 'licenseKey';
const APP_DEVICE_ID_SCOPE = 'da7cc351-b4b9-4701-b6ec-c90f70bfd5f7';
const LEGACY_LICENSE_OPFS_DIRS = ['pos-restaurant', 'retail-restaurant'];

// Backward-compatible aliases for older imports.
export const POS_LICENSE_FILE_FORMAT = RETAIL_LICENSE_FILE_FORMAT;
export const POS_LICENSE_FILE_VERSION = RETAIL_LICENSE_FILE_VERSION;

/** Plaintext license must not live in localStorage; scrub known legacy keys. */
const LEGACY_LICENSE_LOCALSTORAGE_KEYS = ['pos_web_license_v1'];

export function clearLegacyLicenseLocalStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    for (const k of LEGACY_LICENSE_LOCALSTORAGE_KEYS) {
      localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

const LICENSE_FILE_MAGIC = new Uint8Array([0x50, 0x52, 0x46, 0x4c]); // PRFL
const LICENSE_FILE_CRYPTO_VERSION = 1;

export function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalStringify(v)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(value[k])}`);
  return `{${parts.join(',')}}`;
}

function trimEnv(v) {
  return String(v ?? '').trim();
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text || ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function scopedDeviceFingerprint(rawFingerprint) {
  return sha256Hex(`${APP_DEVICE_ID_SCOPE}:${String(rawFingerprint || '').trim().toLowerCase()}`);
}

export function isLicenseEnforcementEnabled() {
  return trimEnv(import.meta.env?.VITE_LICENSE_RSA_PUBLIC_KEY_PEM).length > 0;
}

export function getLicenseRsaPublicKeyPem() {
  return trimEnv(import.meta.env?.VITE_LICENSE_RSA_PUBLIC_KEY_PEM).replace(/\\n/g, '\n');
}

export function getLicenseFileEncryptionKeyHex() {
  return trimEnv(import.meta.env?.VITE_LICENSE_FILE_ENCRYPTION_KEY);
}

export function getLicenseApiBase() {
  return trimEnv(import.meta.env?.VITE_LICENSE_API_URL).replace(/\/$/, '');
}

/**
 * Whether to POST to the license API (validate/activate). In Vite dev we skip by default so
 * missing localhost:5050 does not spam console with proxy 500s. Production/preview always calls
 * unless VITE_LICENSE_SKIP_REMOTE_VALIDATE is set. In dev, set VITE_LICENSE_FORCE_REMOTE_VALIDATE=true
 * to test against a running license server.
 */
export function shouldCallLicenseRemoteValidate() {
  const skip = trimEnv(import.meta.env?.VITE_LICENSE_SKIP_REMOTE_VALIDATE).toLowerCase();
  if (skip === '1' || skip === 'true' || skip === 'yes') return false;
  const force = trimEnv(import.meta.env?.VITE_LICENSE_FORCE_REMOTE_VALIDATE).toLowerCase();
  const forceDev = force === '1' || force === 'true' || force === 'yes';
  if (import.meta.env.DEV && !forceDev) return false;
  return true;
}

export function getDeviceAgentBase() {
  return trimEnv(import.meta.env?.VITE_DEVICE_AGENT_URL).replace(/\/$/, '');
}

/** Root-relative `/device-agent` breaks under `file://` (resolves to disk); use loopback like apiOrigin.js. */
function deviceAgentDefaultLoopbackOrigin() {
  const port = trimEnv(import.meta.env?.VITE_DEVICE_AGENT_PORT) || '39471';
  return `http://127.0.0.1:${port}`;
}

function isFileOrCustomPageProtocol() {
  if (typeof window === 'undefined') return false;
  const p = window.location?.protocol;
  return p === 'file:' || p === 'app:';
}

export function licenseApiUrl(path) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const base = getLicenseApiBase();
  if (!base) return `/license${suffix}`;
  return `${base}/license${suffix}`;
}

export function deviceAgentUrl(path) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const base = getDeviceAgentBase();
  if (!base) {
    if (isFileOrCustomPageProtocol()) return `${deviceAgentDefaultLoopbackOrigin()}${suffix}`;
    return `/device-agent${suffix}`;
  }
  return `${base}${suffix}`;
}

export function normalizeLicenseKeyInput(raw) {
  const alnum = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (alnum.length !== 12) return '';
  return `${alnum.slice(0, 4)}-${alnum.slice(4, 8)}-${alnum.slice(8, 12)}`;
}

function pemToSpkiBytes(pem) {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importRsaPublicKey(pem) {
  const spki = pemToSpkiBytes(pem);
  return crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

async function importAesGcmKeyFromHex(hex) {
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) return null;
  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    keyBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function magicEqual(a, slice) {
  if (slice.length !== a.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (slice[i] !== a[i]) return false;
  }
  return true;
}

export async function decryptLicenseFileBytes(encBytes, hexKey) {
  const key = await importAesGcmKeyFromHex(hexKey);
  if (!key) throw new Error('no_decryption_key');
  const minLen = LICENSE_FILE_MAGIC.length + 1 + 12 + 16 + 1;
  if (encBytes.length < minLen) throw new Error('invalid_bundle');
  if (!magicEqual(LICENSE_FILE_MAGIC, encBytes.subarray(0, LICENSE_FILE_MAGIC.length))) {
    throw new Error('invalid_bundle');
  }
  const version = encBytes[LICENSE_FILE_MAGIC.length];
  if (version !== LICENSE_FILE_CRYPTO_VERSION) throw new Error('invalid_bundle');
  const iv = encBytes.subarray(LICENSE_FILE_MAGIC.length + 1, LICENSE_FILE_MAGIC.length + 1 + 12);
  const ctAndTag = encBytes.subarray(LICENSE_FILE_MAGIC.length + 1 + 12);
  if (ctAndTag.length < 17) throw new Error('invalid_bundle');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, ctAndTag);
  const text = new TextDecoder('utf-8').decode(plain);
  return JSON.parse(text);
}

export async function encryptLicenseFileObject(obj, hexKey) {
  const key = await importAesGcmKeyFromHex(hexKey);
  if (!key) throw new Error('no_decryption_key');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, plaintext);
  const ctU8 = new Uint8Array(ct);
  const out = new Uint8Array(LICENSE_FILE_MAGIC.length + 1 + iv.length + ctU8.length);
  out.set(LICENSE_FILE_MAGIC, 0);
  out[LICENSE_FILE_MAGIC.length] = LICENSE_FILE_CRYPTO_VERSION;
  out.set(iv, LICENSE_FILE_MAGIC.length + 1);
  out.set(ctU8, LICENSE_FILE_MAGIC.length + 1 + iv.length);
  return out;
}

export async function verifyLicenseSignature(licensePayload, signatureBase64, pem) {
  const key = await importRsaPublicKey(pem);
  const payload = canonicalStringify(licensePayload);
  const sig = Uint8Array.from(atob(String(signatureBase64 || '').replace(/\s/g, '')), (c) => c.charCodeAt(0));
  const data = new TextEncoder().encode(payload);
  return crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, sig, data);
}

function isLicensePayload(o) {
  return (
    o &&
    typeof o === 'object' &&
    typeof o.licenseKey === 'string' &&
    typeof o.deviceFingerprint === 'string' &&
    typeof o.email === 'string' &&
    typeof o.expiresAt === 'string'
  );
}

/**
 * @returns {{ inner: object, license: object }}
 */
export function extractLicenseRecord(innerRaw) {
  if (!innerRaw || typeof innerRaw !== 'object') throw new Error('invalid_bundle');
  if (innerRaw.license && innerRaw.signature) {
    if (!isLicensePayload(innerRaw.license)) throw new Error('invalid_bundle');
    return { inner: innerRaw, license: innerRaw.license };
  }
  if (isLicensePayload(innerRaw) && typeof innerRaw.signature === 'string') {
    return { inner: innerRaw, license: innerRaw };
  }
  throw new Error('invalid_bundle');
}

export async function validateLicenseBundleAgainstDevice(innerRaw, deviceFingerprintLower, pem) {
  const fp = String(deviceFingerprintLower || '').trim().toLowerCase();
  const { inner, license } = extractLicenseRecord(innerRaw);
  if (!/^[a-f0-9]{64}$/.test(fp)) throw new Error('fingerprint_error');
  const licFp = String(license.deviceFingerprint || '').trim().toLowerCase();
  if (licFp !== fp) throw new Error('device_mismatch');
  const exp = new Date(license.expiresAt).getTime();
  if (Number.isNaN(exp) || exp < Date.now()) throw new Error('expired');
  const ok = await verifyLicenseSignature(license, inner.signature, pem);
  if (!ok) throw new Error('bad_signature');
  return license;
}

export async function unpackLicenseInnerFromBytes(bytes, hexKey) {
  const isMagic = bytes.length >= 4 && magicEqual(LICENSE_FILE_MAGIC, bytes.subarray(0, 4));
  try {
    if (isMagic) {
      return await decryptLicenseFileBytes(bytes, hexKey);
    }
    const text = new TextDecoder('utf-8').decode(bytes);
    const trimmed = text.trim();
    if (!trimmed.startsWith('{')) throw new Error('invalid_bundle');
    return JSON.parse(trimmed);
  } catch (e) {
    const msg = e?.message;
    if (msg === 'no_decryption_key' || msg === 'invalid_bundle') throw e;
    throw new Error('decryption_failed');
  }
}

export async function parseLicenseFromBytes(bytes, hexKey, deviceFingerprintLower, pem) {
  const inner = await unpackLicenseInnerFromBytes(bytes, hexKey);
  return validateLicenseBundleAgainstDevice(inner, deviceFingerprintLower, pem);
}

export function opfsSupported() {
  return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;
}

async function getLicenseDirHandle(create) {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(LICENSE_OPFS_DIR, { create: !!create });
}

export async function readLicenseFromOpfs() {
  if (!opfsSupported()) return null;
  const dirNames = [LICENSE_OPFS_DIR, ...LEGACY_LICENSE_OPFS_DIRS];
  try {
    const root = await navigator.storage.getDirectory();
    for (const dirName of dirNames) {
      try {
        const dir = await root.getDirectoryHandle(dirName);
        const fh = await dir.getFileHandle(LICENSE_OPFS_FILE);
        const file = await fh.getFile();
        const buf = await file.arrayBuffer();
        return new Uint8Array(buf);
      } catch {
        // Try next directory candidate.
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeLicenseToOpfs(bytes) {
  if (!opfsSupported()) throw new Error('opfs_unavailable');
  const dir = await getLicenseDirHandle(true);
  const fh = await dir.getFileHandle(LICENSE_OPFS_FILE, { create: true });
  const w = await fh.createWritable();
  await w.write(bytes);
  await w.close();
  // Best effort cleanup of legacy storage location after successful write.
  const root = await navigator.storage.getDirectory();
  for (const legacyDirName of LEGACY_LICENSE_OPFS_DIRS) {
    if (legacyDirName === LICENSE_OPFS_DIR) continue;
    try {
      const legacyDir = await root.getDirectoryHandle(legacyDirName);
      await legacyDir.removeEntry(LICENSE_OPFS_FILE);
    } catch {
      /* ignore */
    }
  }
  clearLegacyLicenseLocalStorage();
}

export async function removeLicenseFromOpfs() {
  if (!opfsSupported()) return;
  try {
    const root = await navigator.storage.getDirectory();
    const dirNames = Array.from(new Set([LICENSE_OPFS_DIR, ...LEGACY_LICENSE_OPFS_DIRS]));
    for (const dirName of dirNames) {
      try {
        const dir = await root.getDirectoryHandle(dirName);
        await dir.removeEntry(LICENSE_OPFS_FILE);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  clearLegacyLicenseLocalStorage();
}

export async function fetchDeviceFingerprint() {
  const url = deviceAgentUrl('/device-id');
  const res = await fetch(url);
  if (!res.ok) throw new Error('fingerprint_error');
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await res.json().catch(() => ({}));
    const raw = data.deviceId ?? data.deviceFingerprint ?? data.fingerprint ?? data.id ?? '';
    const s = String(raw).trim().toLowerCase();
    if (/^[a-f0-9]{64}$/.test(s)) return scopedDeviceFingerprint(s);
    throw new Error('fingerprint_error');
  }
  const text = (await res.text()).trim().toLowerCase();
  if (/^[a-f0-9]{64}$/.test(text)) return scopedDeviceFingerprint(text);
  throw new Error('fingerprint_error');
}

/** Map HTTP status + JSON body to a stable error code (Vite proxy returns 500 when license server is down). */
function errorFromLicenseHttpResponse(status, data) {
  const bodyErr =
    data && typeof data.error === 'string' && data.error.trim() ? data.error.trim() : '';
  if (status === 502 || status === 503 || status === 504) return 'network';
  if (status >= 500 && !bodyErr) return 'network';
  return bodyErr || 'bad_response';
}

export async function activateOnServer(licenseKeyFormatted, deviceFingerprintLower) {
  let res;
  try {
    res = await fetch(licenseApiUrl('/activate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: licenseKeyFormatted,
        deviceFingerprint: deviceFingerprintLower
      })
    });
  } catch {
    throw new Error('network');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const mapped = errorFromLicenseHttpResponse(res.status, data);
    if (mapped === 'network') throw new Error('network');
    if (mapped === 'bad_response') throw new Error(data.error || 'activation_failed');
    throw new Error(mapped);
  }
  if (!data.license || !data.signature) throw new Error('bad_response');
  return data;
}

export async function validateOnServer(licenseKeyFormatted, deviceFingerprintLower) {
  let res;
  try {
    res = await fetch(licenseApiUrl('/validate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: licenseKeyFormatted,
        deviceFingerprint: deviceFingerprintLower
      })
    });
  } catch {
    throw new Error('network');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(errorFromLicenseHttpResponse(res.status, data));
  }
  if (!data.license || !data.signature) throw new Error('bad_response');
  return data;
}

export async function persistActivationResponse(data, hexKey) {
  const lic = data.license;
  const inner = {
    format: RETAIL_LICENSE_FILE_FORMAT,
    version: RETAIL_LICENSE_FILE_VERSION,
    licenseKey: lic.licenseKey,
    email: lic.email,
    expiresAt: lic.expiresAt,
    deviceFingerprint: lic.deviceFingerprint,
    issuedAt: new Date().toISOString(),
    license: lic,
    signature: data.signature
  };
  const enc = await encryptLicenseFileObject(inner, hexKey);
  await writeLicenseToOpfs(enc);
}

export function mapLicenseErrorToI18nKey(err) {
  const code = err && typeof err.message === 'string' ? err.message : 'generic';
  const known = new Set([
    'no_public_key',
    'no_local_license',
    'no_decryption_key',
    'tampered_file',
    'revoked_by_server',
    'bad_signature',
    'device_mismatch',
    'expired',
    'fingerprint_error',
    'network',
    'not_found',
    'bad_response',
    'activation_failed',
    'invalid_key',
    'signing_misconfigured',
    'invalid_bundle',
    'decryption_failed',
    'generic',
    'opfs_unavailable'
  ]);
  const key = known.has(code) ? code : 'generic';
  return `license.err.${key}`;
}

/**
 * Full startup validation when `VITE_LICENSE_RSA_PUBLIC_KEY_PEM` is set.
 * @returns {Promise<{ ok: boolean, skipped?: boolean, errorKey?: string }>}
 */
export async function runStartupLicenseCheck() {
  if (!isLicenseEnforcementEnabled()) {
    return { ok: true, skipped: true };
  }
  clearLegacyLicenseLocalStorage();
  const pem = getLicenseRsaPublicKeyPem();
  const hex = getLicenseFileEncryptionKeyHex();
  if (!pem) {
    return { ok: false, errorKey: 'license.err.no_public_key' };
  }
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) {
    return { ok: false, errorKey: 'license.err.no_decryption_key' };
  }
  let deviceFp;
  try {
    deviceFp = await fetchDeviceFingerprint();
  } catch {
    return { ok: false, errorKey: 'license.err.fingerprint_error' };
  }
  const bytes = await readLicenseFromOpfs();
  if (!bytes?.length) {
    return { ok: false, errorKey: 'license.err.no_local_license' };
  }
  let lic;
  try {
    lic = await parseLicenseFromBytes(bytes, hex, deviceFp, pem);
  } catch (e) {
    return { ok: false, errorKey: mapLicenseErrorToI18nKey(e) };
  }
  if (shouldCallLicenseRemoteValidate()) {
    try {
      await validateOnServer(lic.licenseKey, deviceFp);
    } catch (e) {
      const c = e?.message;
      if (c === 'not_found') return { ok: false, errorKey: 'license.err.revoked_by_server' };
      if (c === 'device_mismatch') return { ok: false, errorKey: 'license.err.device_mismatch' };
      if (c === 'expired') return { ok: false, errorKey: 'license.err.expired' };
      // Offline / unreachable license API — trust local signature + device check.
      if (c === 'network' || c === 'bad_response') return { ok: true };
      return { ok: false, errorKey: mapLicenseErrorToI18nKey(e) };
    }
  }
  return { ok: true };
}
