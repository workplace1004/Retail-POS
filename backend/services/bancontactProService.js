import axios from 'axios';

const DEFAULT_API_EXT = 'https://api.ext.payconiq.com';
const DEFAULT_API_PROD = 'https://api.payconiq.com';

/** Parse payment terminal `connection_string` JSON for Bancontact Pro (Payconiq v3) QR. */
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
  const apiKeyRaw = String(config.apiKey || config.api_key || '').trim();
  const sandbox =
    config.sandbox === true ||
    config.sandbox === 1 ||
    String(config.environment || '').toLowerCase() === 'sandbox' ||
    String(config.env || '').toLowerCase() === 'ext';
  const apiBase = String(config.apiBase || config.api_base || '').trim().replace(/\/$/, '');
  const callbackUrl = String(config.callbackUrl || config.callback_url || '').trim();
  return { apiKeyRaw, sandbox, apiBase, callbackUrl };
}

export function bancontactProApiRoot(parsed) {
  if (parsed.apiBase) return parsed.apiBase;
  return parsed.sandbox ? DEFAULT_API_EXT : DEFAULT_API_PROD;
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
    return { success: false, message: 'Bancontact Pro API key was rejected (401).' };
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
 * Create Payconiq/Bancontact Pro v3 payment (in-store QR).
 * @see https://developer.payconiq.com/ — Create Payment
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

  const res = await client.post('/v3/payments', body);
  if (res.status !== 201) {
    const msg = res.data?.message || res.data?.code || `HTTP ${res.status}`;
    throw new Error(msg || 'Failed to create Bancontact Pro payment.');
  }
  const paymentId = res.data?.paymentId;
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
    throw new Error('Bancontact Pro payment not found.');
  }
  if (res.status !== 200) {
    const msg = res.data?.message || res.data?.code || `HTTP ${res.status}`;
    throw new Error(msg || 'Failed to read Bancontact Pro payment.');
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

/** Map Payconiq payment status to POS terminal polling shape (same as Payworld). */
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
      details: { payconiqStatus: status, qrcodeUrl },
    };
  }
  if (status === 'CANCELLED') {
    return {
      ok: true,
      state: 'CANCELLED',
      message: 'Payment cancelled.',
      details: { payconiqStatus: status, qrcodeUrl },
    };
  }
  if (status === 'EXPIRED') {
    return {
      ok: false,
      state: 'DECLINED',
      message: 'Payment QR expired. Please try again.',
      details: { payconiqStatus: status, qrcodeUrl },
    };
  }
  if (status === 'AUTHORIZATION_FAILED' || status === 'FAILED') {
    return {
      ok: false,
      state: 'DECLINED',
      message: description || `Payment ${status.toLowerCase().replace(/_/g, ' ')}.`,
      details: { payconiqStatus: status, qrcodeUrl },
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
      details: { payconiqStatus: status, qrcodeUrl },
    };
  }
  if (status === 'PENDING_MERCHANT_ACKNOWLEDGEMENT') {
    return {
      ok: true,
      state: 'IN_PROGRESS',
      message: 'Awaiting confirmation…',
      details: { payconiqStatus: status, qrcodeUrl },
    };
  }
  return {
    ok: true,
    state: 'IN_PROGRESS',
    message: description || 'Waiting for payment…',
    details: { payconiqStatus: status || 'UNKNOWN', qrcodeUrl },
  };
}
