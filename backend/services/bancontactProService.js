import axios from 'axios';

/** Normalize merchant API root: trim, drop trailing slash, strip accidental `/v3/payments`. */
function normalizeMerchantApiBaseUrl(raw) {
  let s = String(raw ?? '').trim().replace(/\/$/, '');
  if (!s) return '';
  const cleaned = s.replace(/\/v3\/payments\/?$/i, '').replace(/\/v3\/?$/i, '').replace(/\/$/, '');
  return cleaned || s;
}

/** Attach HTTP status for upstream Payconiq/Bancontact errors so routes can return 401/403 instead of 500. */
function httpError(status, message) {
  const err = new Error(message);
  err.httpStatus = Number(status) || 500;
  return err;
}

/**
 * Merchant Payment API base URLs (v3 `/v3/payments`).
 * Production: Bancontact Merchant API (`merchant.api.bancontact.net` — keys from Bancontact Pro portal).
 * Bancontact **pre-production**: `https://merchant.api.preprod.bancontact.net` (no `/v3/payments` in base).
 * **Backend `.env` (no UI needed):**
 *   `BANCONTACT_PRO_API_BASE=https://merchant.api.preprod.bancontact.net` — used for both sandbox on/off when the terminal has no `apiBase`.
 *   Or set `BANCONTACT_PRO_API_BASE_PROD` / `BANCONTACT_PRO_API_BASE_EXT` separately (test vs live defaults).
 * **Per terminal:** `apiBase` / `api_base` in `connection_string` JSON overrides all of the above.
 * Test / Payconiq sandbox default when sandbox is on: `api.ext.payconiq.com` (unless overridden).
 * Legacy prod on Payconiq only: `BANCONTACT_PRO_API_BASE_PROD=https://api.payconiq.com`
 */
const DEFAULT_API_PROD =
  normalizeMerchantApiBaseUrl(process.env.BANCONTACT_PRO_API_BASE_PROD?.trim() || '') ||
  'https://merchant.api.bancontact.net';
const DEFAULT_API_EXT =
  normalizeMerchantApiBaseUrl(process.env.BANCONTACT_PRO_API_BASE_EXT?.trim() || '') ||
  'https://api.ext.payconiq.com';

/** “On a receipt” QR image service (Bancontact Pro branding). */
export const BANCONTACT_QR_GENERATOR_BASE = 'https://qrcodegenerator.api.bancontact.net/qrcode';

/** Pay link template host for PPID-based static / receipt QR payloads. */
export const BANCONTACT_PAY_TEMPLATE_BASE = 'https://pay.bancontact.net/t/1';

/** Trim copy-paste noise: CR, zero-width chars, one layer of wrapping quotes. */
function normalizeBancontactProApiKey(raw) {
  let s = String(raw ?? '')
    .replace(/\r/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
  if (!s) return '';
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).replace(/\r/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  }
  return s;
}

/**
 * Parse payment terminal `connection_string` JSON for Bancontact Pro.
 * If `apiKey` is missing/blank after normalization, `BANCONTACT_PRO_API_KEY` is used (server env, dev fallback).
 */
export function parseBancontactProConfig(connectionString) {
  let config = {};
  if (typeof connectionString === 'string') {
    try {
      config = JSON.parse(connectionString);
    } catch {
      config = {};
    }
  } else if (connectionString && typeof connectionString === 'object') {
    config = connectionString;
  }
  const fromTerminal = normalizeBancontactProApiKey(config.apiKey || config.api_key);
  const fromEnv = normalizeBancontactProApiKey(process.env.BANCONTACT_PRO_API_KEY);
  const apiKeyRaw = fromTerminal || fromEnv;
  const sandboxRaw = config.sandbox;
  const sandbox =
    sandboxRaw === true ||
    sandboxRaw === 1 ||
    String(sandboxRaw).toLowerCase() === 'true' ||
    String(config.environment || '').toLowerCase() === 'sandbox' ||
    String(config.env || '').toLowerCase() === 'ext';
  const apiBase = normalizeMerchantApiBaseUrl(config.apiBase || config.api_base || '');
  const callbackUrl = String(config.callbackUrl || config.callback_url || '').trim();
  const productProfileId = String(
    config.productProfileId ?? config.product_profile_id ?? config.ppid ?? '',
  ).trim();
  const qrGeneratorBase = String(config.qrGeneratorBase || config.qr_generator_base || '').trim().replace(/\/$/, '');
  const payTemplateBase = String(config.payTemplateBase || config.pay_template_base || '').trim().replace(/\/$/, '');
  return { apiKeyRaw, sandbox, apiBase, callbackUrl, productProfileId, qrGeneratorBase, payTemplateBase };
}

export function bancontactProApiRoot(parsed) {
  if (parsed.apiBase) return parsed.apiBase;
  const fromEnvUnified = normalizeMerchantApiBaseUrl(process.env.BANCONTACT_PRO_API_BASE?.trim() || '');
  if (fromEnvUnified) return fromEnvUnified;
  return parsed.sandbox ? DEFAULT_API_EXT : DEFAULT_API_PROD;
}

/** Short hint for 401: prod vs sandbox keys differ by host. */
function bancontactPro401ContextHint(parsed, baseURL) {
  if (parsed.sandbox) {
    return ` Sandbox=on → ${baseURL}. Use a test API key (Test API enabled in the portal), not a live-only key.`;
  }
  return ` Sandbox=off → ${baseURL}. Use a live/production API key from the portal, or turn on "Use test / pre-prod API" if you only have a test key.`;
}

export function bancontactProAuthorizationHeader(apiKeyRaw) {
  if (!apiKeyRaw) return null;
  if (/^bearer\s+/i.test(apiKeyRaw)) return apiKeyRaw;
  return `Bearer ${apiKeyRaw}`;
}

function withQrDisplayOptions(qrHref) {
  if (!qrHref || typeof qrHref !== 'string') return qrHref;
  try {
    const u = new URL(qrHref);
    if (!u.searchParams.get('f')) u.searchParams.set('f', 'PNG');
    if (!u.searchParams.get('s')) u.searchParams.set('s', 'XL');
    return u.toString();
  } catch {
    const sep = qrHref.includes('?') ? '&' : '?';
    return `${qrHref}${sep}f=PNG&s=XL`;
  }
}

/**
 * Build full “On a receipt” QR image URL per Bancontact Pro guide (UTF-8 encode D/A/R, then encode full pay URL as `c`).
 * @param {object} opts
 * @param {string} opts.productProfileId – PPID (required)
 * @param {string} [opts.description] – max 35 UTF-8 chars recommended
 * @param {number} opts.amountCents – 1…999999 (Euro cents)
 * @param {string} [opts.reference] – max 35 UTF-8 chars recommended
 * @param {'PNG'|'SVG'} [opts.imageFormat]
 * @param {'S'|'M'|'L'|'XL'} [opts.imageSize] – PNG only; ignored for SVG
 * @param {string} [opts.qrGeneratorBase] – override generator base URL
 * @param {string} [opts.payTemplateBase] – override `https://pay.bancontact.net/t/1` prefix
 */
export function buildBancontactOnAReceiptQrCodeUrl({
  productProfileId,
  description = '',
  amountCents,
  reference = '',
  imageFormat = 'PNG',
  imageSize = 'XL',
  qrGeneratorBase,
  payTemplateBase,
}) {
  const ppid = String(productProfileId || '').trim();
  if (!ppid) throw new Error('Product profile ID (PPID) is required for On a Receipt QR.');
  const cents = Math.round(Number(amountCents) || 0);
  if (cents < 1 || cents > 999999) {
    throw new Error('Amount must be between 1 and 999999 Euro cents for On a Receipt QR.');
  }
  const D = encodeURIComponent(String(description || '').slice(0, 35));
  const A = encodeURIComponent(String(cents));
  const R = encodeURIComponent(String(reference || '').slice(0, 35));
  const payBase = (payTemplateBase || BANCONTACT_PAY_TEMPLATE_BASE).replace(/\/$/, '');
  const innerUrl = `${payBase}/${encodeURIComponent(ppid)}?D=${D}&A=${A}&R=${R}`;
  const c = encodeURIComponent(innerUrl);
  const genBase = (qrGeneratorBase || BANCONTACT_QR_GENERATOR_BASE).replace(/\?$/, '');
  const f = String(imageFormat || 'PNG').toUpperCase() === 'SVG' ? 'SVG' : 'PNG';
  const s = String(imageSize || 'XL').toUpperCase();
  const sizeParam = f === 'PNG' ? `&s=${encodeURIComponent(['S', 'M', 'L', 'XL'].includes(s) ? s : 'XL')}` : '';
  return `${genBase}?f=${encodeURIComponent(f)}${sizeParam}&c=${c}`;
}

function axiosForBancontactPro(parsed) {
  const auth = bancontactProAuthorizationHeader(parsed.apiKeyRaw);
  if (!auth) throw new Error('Bancontact Pro API key is missing in terminal configuration.');
  const baseURL = bancontactProApiRoot(parsed);
  return axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    validateStatus: () => true,
  });
}

export async function testBancontactProConnection(connectionString) {
  const parsed = parseBancontactProConfig(connectionString);
  if (!parsed.apiKeyRaw) {
    return { success: false, message: 'API key is required for Bancontact Pro.' };
  }
  const client = axiosForBancontactPro(parsed);
  const probeId = '000000000000000000000000';
  const res = await client.get(`/v3/payments/${probeId}`);
  if (res.status === 401) {
    const baseURL = bancontactProApiRoot(parsed);
    return {
      success: false,
      message: `Bancontact Pro API key was rejected (401).${bancontactPro401ContextHint(parsed, baseURL)}`,
    };
  }
  if (res.status === 403) {
    return { success: false, message: 'Bancontact Pro API access denied (403).' };
  }
  if (res.status === 404) {
    return { success: true, message: 'API key accepted (test call returned payment not found as expected).' };
  }
  if (res.status >= 200 && res.status < 500) {
    return { success: true, message: `Bancontact Pro API reachable (HTTP ${res.status}).` };
  }
  return { success: false, message: `Bancontact Pro API error (HTTP ${res.status}).` };
}

/**
 * Create Bancontact Pro v3 payment (in-store QR) via Merchant Payment API.
 */
export async function createBancontactProPayment(connectionString, { amountEuro, description, reference }) {
  const parsed = parseBancontactProConfig(connectionString);
  const client = axiosForBancontactPro(parsed);
  const amountCents = Math.round(Math.max(0, Number(amountEuro) || 0) * 100);
  if (amountCents < 1 || amountCents > 999999) {
    throw new Error('Amount must be between €0.01 and €9999.99 for Bancontact Pro.');
  }
  const ref = String(reference || `POS-${Date.now().toString(36)}`).slice(0, 35);
  const body = {
    amount: amountCents,
    currency: 'EUR',
    description: String(description || 'POS payment').slice(0, 140),
    reference: ref,
  };
  if (parsed.callbackUrl) body.callbackUrl = parsed.callbackUrl;

  const baseURL = bancontactProApiRoot(parsed);
  let res;
  try {
    res = await client.post('/v3/payments', body);
  } catch (e) {
    const net = e?.message || String(e);
    throw httpError(502, `Bancontact Pro network error: ${net} (host ${baseURL})`);
  }
  if (res.status !== 201) {
    const msg = res.data?.message || res.data?.code || `HTTP ${res.status}`;
    const bodyHint =
      res.data && typeof res.data === 'object' ? ` — ${JSON.stringify(res.data).slice(0, 500)}` : '';
    const ctx401 = res.status === 401 ? bancontactPro401ContextHint(parsed, baseURL) : '';
    throw httpError(
      res.status,
      `${msg || 'Failed to create Bancontact Pro payment.'} [${res.status} @ ${baseURL}]${bodyHint}${ctx401}`,
    );
  }
  const paymentId = res.data?.paymentId;
  if (!paymentId) {
    throw httpError(
      502,
      `Bancontact Pro returned 201 but no paymentId in response. [${baseURL}] Check API version and response shape.`,
    );
  }
  const qrRaw = res.data?._links?.qrcode?.href;
  const qrcodeUrl = withQrDisplayOptions(qrRaw);
  return {
    paymentId,
    status: res.data?.status,
    qrcodeUrl,
    raw: res.data,
  };
}

export async function getBancontactProPayment(connectionString, paymentId) {
  const parsed = parseBancontactProConfig(connectionString);
  const client = axiosForBancontactPro(parsed);
  const res = await client.get(`/v3/payments/${encodeURIComponent(paymentId)}`);
  if (res.status === 404) {
    throw httpError(404, 'Bancontact Pro payment not found.');
  }
  if (res.status !== 200) {
    const msg = res.data?.message || res.data?.code || `HTTP ${res.status}`;
    throw httpError(res.status, msg || 'Failed to read Bancontact Pro payment.');
  }
  return res.data;
}

export async function cancelBancontactProPayment(connectionString, paymentId) {
  const parsed = parseBancontactProConfig(connectionString);
  const client = axiosForBancontactPro(parsed);
  const res = await client.delete(`/v3/payments/${encodeURIComponent(paymentId)}`);
  if (res.status === 204) return { ok: true, message: 'Payment cancelled.' };
  if (res.status === 422) {
    const msg = res.data?.message || 'Payment could not be cancelled (e.g. already completed).';
    return { ok: false, message: msg };
  }
  const msg = res.data?.message || res.data?.code || `HTTP ${res.status}`;
  return { ok: false, message: msg || 'Cancel failed.' };
}

/** Map Bancontact Pro payment status to POS terminal polling shape (same as Payworld). */
export function mapBancontactProStatusToTerminal(data) {
  const status = String(data?.status || '').toUpperCase();
  const description = String(data?.description || '').trim();
  const qrRaw = data?._links?.qrcode?.href;
  const qrcodeUrl = qrRaw ? withQrDisplayOptions(qrRaw) : null;

  if (status === 'SUCCEEDED') {
    return {
      ok: true,
      state: 'APPROVED',
      message: description || 'Payment approved.',
      details: { payconiqStatus: status, bancontactStatus: status, qrcodeUrl },
    };
  }
  if (status === 'CANCELLED') {
    return {
      ok: true,
      state: 'CANCELLED',
      message: 'Payment cancelled.',
      details: { payconiqStatus: status, bancontactStatus: status, qrcodeUrl },
    };
  }
  if (status === 'EXPIRED') {
    return {
      ok: false,
      state: 'DECLINED',
      message: 'Payment QR expired. Please try again.',
      details: { payconiqStatus: status, bancontactStatus: status, qrcodeUrl },
    };
  }
  if (status === 'AUTHORIZATION_FAILED' || status === 'FAILED') {
    return {
      ok: false,
      state: 'DECLINED',
      message: description || `Payment ${status.toLowerCase().replace(/_/g, ' ')}.`,
      details: { payconiqStatus: status, bancontactStatus: status, qrcodeUrl },
    };
  }
  if (status === 'PENDING' || status === 'IDENTIFIED' || status === 'AUTHORIZED') {
    return {
      ok: true,
      state: 'IN_PROGRESS',
      message:
        status === 'AUTHORIZED'
          ? 'Authorizing payment…'
          : 'Scan the QR code with Bancontact Pay or your banking app.',
      details: { payconiqStatus: status, bancontactStatus: status, qrcodeUrl },
    };
  }
  if (status === 'PENDING_MERCHANT_ACKNOWLEDGEMENT') {
    return {
      ok: true,
      state: 'IN_PROGRESS',
      message: 'Awaiting confirmation…',
      details: { payconiqStatus: status, bancontactStatus: status, qrcodeUrl },
    };
  }
  return {
    ok: true,
    state: 'IN_PROGRESS',
    message: description || 'Waiting for payment…',
    details: { payconiqStatus: status || 'UNKNOWN', bancontactStatus: status || 'UNKNOWN', qrcodeUrl },
  };
}
