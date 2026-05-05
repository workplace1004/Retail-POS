/**
 * HTTP adapter for Worldline Sync Service (bridge): Node ↔ Sync Service ↔ Terminal.
 * No raw TCP / low-level C-TEP in callers — only REST shapes documented by your sync vendor.
 *
 * Configure via terminal connection JSON `syncServiceUrl` or env `WORLDLINE_SYNC_SERVICE_URL`.
 * Default REST convention (adjust paths via syncPaymentStartPath / syncPaymentStatusPath):
 *   POST {base}/payment          → { sessionId | id }
 *   GET  {base}/payment/:id      → { status | state }
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Trim trailing slashes */
export function normalizeSyncBaseUrl(url) {
  return String(url || '')
    .trim()
    .replace(/\/+$/, '');
}

function joinUrl(base, path) {
  const b = normalizeSyncBaseUrl(base);
  const p = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function normalizeStatus(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!s) return 'IN_PROGRESS';
  if (['APPROVED', 'SUCCESS', 'OK', 'PAID'].includes(s)) return 'APPROVED';
  if (['DECLINED', 'FAILURE', 'FAILED', 'REFUSED'].includes(s)) return 'DECLINED';
  if (['CANCELLED', 'CANCELED', 'ABORTED'].includes(s)) return 'CANCELLED';
  if (['IN_PROGRESS', 'PENDING', 'PROCESSING'].includes(s)) return 'IN_PROGRESS';
  return s;
}

/**
 * Start payment on Sync Service.
 * @param {string} baseUrl - e.g. http://localhost:8080
 * @param {{ amount: number, currency?: string, merchantRef?: string, sessionId?: string }} payload
 */
export async function syncStartPayment(baseUrl, payload, options = {}) {
  const startPath = options.startPath || '/payment';
  const url = joinUrl(baseUrl, startPath);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), options.requestTimeoutMs ?? 30000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: controller.signal,
      body: JSON.stringify({
        amount: payload.amount,
        currency: payload.currency || 'EUR',
        ...(payload.merchantRef != null ? { merchantRef: payload.merchantRef } : {}),
        ...(payload.sessionId != null ? { externalSessionId: payload.sessionId } : {}),
      }),
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (!res.ok) {
      throw new Error(data?.message || data?.error || `Sync start failed HTTP ${res.status}`);
    }
    const vendorSessionId = data.sessionId ?? data.id ?? data.paymentId ?? data.transactionId;
    if (!vendorSessionId) {
      throw new Error('Sync service did not return sessionId/id');
    }
    return { vendorSessionId, raw: data };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Poll payment status from Sync Service.
 */
export async function syncGetPaymentStatus(baseUrl, vendorSessionId, options = {}) {
  const statusPathTemplate = options.statusPathTemplate || '/payment/{sessionId}';
  const path = statusPathTemplate.replace('{sessionId}', encodeURIComponent(String(vendorSessionId)));
  const url = joinUrl(baseUrl, path);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), options.requestTimeoutMs ?? 15000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { ...(options.headers || {}) },
      signal: controller.signal,
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (!res.ok) {
      throw new Error(data?.message || data?.error || `Sync status failed HTTP ${res.status}`);
    }
    const state = normalizeStatus(data.status ?? data.state ?? data.result);
    return { state, raw: data };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Poll until terminal outcome or timeout.
 */
export async function syncWaitForPayment(baseUrl, vendorSessionId, waitOptions = {}) {
  const timeoutMs = waitOptions.timeoutMs ?? 120000;
  const pollMs = waitOptions.pollMs ?? 1000;
  const start = Date.now();
  let lastState = 'IN_PROGRESS';
  let lastRaw = null;

  while (Date.now() - start < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const { state, raw } = await syncGetPaymentStatus(baseUrl, vendorSessionId, waitOptions);
    lastState = state;
    lastRaw = raw;
    if (state === 'APPROVED' || state === 'DECLINED' || state === 'CANCELLED') {
      return { state, raw };
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(pollMs);
  }

  throw new Error(`Sync payment timeout after ${timeoutMs}ms (last state: ${lastState})`);
}

/**
 * Optional cancel — POST {base}/payment/:id/cancel if your sync exposes it.
 */
export async function syncCancelPayment(baseUrl, vendorSessionId, options = {}) {
  const cancelPathTemplate = options.cancelPathTemplate || '/payment/{sessionId}/cancel';
  const path = cancelPathTemplate.replace('{sessionId}', encodeURIComponent(String(vendorSessionId)));
  const url = joinUrl(baseUrl, path);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: JSON.stringify({}),
    });
    if (!res.ok) return false;
    return true;
  } catch {
    return false;
  }
}
