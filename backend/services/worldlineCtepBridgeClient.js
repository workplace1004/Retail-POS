/**
 * Mirrors `sample/developer-docs/POS_INTEGRATION_EXAMPLE_JS.js` against the
 * Java `WorldlineCtepBrowserBridge` HTTP API (same paths and polling).
 */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function normalizeHttpBaseUrl(url) {
  return String(url || '')
    .trim()
    .replace(/\/+$/, '');
}

export async function ctepStatus(baseUrl) {
  const base = normalizeHttpBaseUrl(baseUrl);
  const res = await fetch(`${base}/status`);
  return res.json();
}

/**
 * Same flow as sample POS_INTEGRATION_EXAMPLE_JS.js startCtepSale().
 * @param {string} baseUrl e.g. http://localhost:3210
 * @param {number} amount decimal euros
 * @param {string} reference merchant reference
 * @param {number} timeoutSec passed to bridge /sale body (default 180)
 * @param {{ pollMs?: number }} opts poll interval (sample uses 1500)
 */
export async function startCtepSale(baseUrl, amount, reference, timeoutSec = 180, opts = {}) {
  const base = normalizeHttpBaseUrl(baseUrl);
  const pollMs = Number(opts.pollMs) > 0 ? Number(opts.pollMs) : 1500;

  const status = await ctepStatus(base);
  if (!status.terminalConnected) {
    throw new Error('Worldline terminal niet verbonden');
  }
  if (status.transactionBusy) {
    throw new Error('Er loopt al een transactie');
  }

  const res = await fetch(`${base}/sale`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, reference, timeoutSec }),
  });
  const accepted = await res.json();
  if (!res.ok || !accepted.accepted) {
    throw new Error(accepted.error || 'Betaling niet gestart');
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(pollMs);
    // eslint-disable-next-line no-await-in-loop
    const txRes = await fetch(`${base}/transaction`);
    // eslint-disable-next-line no-await-in-loop
    const tx = await txRes.json();
    if (tx.status && tx.status !== 'running') return tx;
  }
}

export async function ctepCancel(baseUrl) {
  const base = normalizeHttpBaseUrl(baseUrl);
  const res = await fetch(`${base}/cancel`, { method: 'POST' });
  return res.json().catch(() => ({}));
}

export async function ctepPing(baseUrl) {
  const base = normalizeHttpBaseUrl(baseUrl);
  const res = await fetch(`${base}/ping`);
  return res.json();
}
