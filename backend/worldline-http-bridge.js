/**
 * Lightweight Node HTTP bridge for Worldline legacy POS contract (no Java).
 * Matches POST body expected by worldlineService.js: { action: 'sale'|'cancel', ... }.
 *
 * Env:
 *   WORLDLINE_BRIDGE_HOST (default 0.0.0.0)
 *   WORLDLINE_BRIDGE_PORT (default 8099)
 *   WORLDLINE_SYNC_SERVICE_URL — if set, sale is proxied (start + poll) to the Sync Service
 *   WORLDLINE_BRIDGE_SIMULATE_DECLINE=1 — dev: respond DECLINED instead of APPROVED when not using sync
 */

import http from 'http';
import { URL } from 'url';
import {
  normalizeSyncBaseUrl,
  syncStartPayment,
  syncWaitForPayment,
} from './services/worldlineBridgeService.js';

const HOST = String(process.env.WORLDLINE_BRIDGE_HOST || '0.0.0.0').trim();
const PORT = Number.parseInt(String(process.env.WORLDLINE_BRIDGE_PORT || '8099'), 10);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

async function handlePost(req, res) {
  let raw = '';
  try {
    raw = await readBody(req);
  } catch (e) {
    sendJson(res, 400, { state: 'ERROR', message: String(e?.message || e) });
    return;
  }
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    sendJson(res, 400, { state: 'ERROR', message: 'Invalid JSON body' });
    return;
  }

  const action = String(payload.action || '').toLowerCase();

  if (action === 'cancel') {
    sendJson(res, 200, { state: 'CANCELLED', message: 'Cancel acknowledged (Node bridge).' });
    return;
  }

  if (action !== 'sale') {
    sendJson(res, 400, { state: 'ERROR', message: 'Expected action sale or cancel' });
    return;
  }

  const syncUrl = String(process.env.WORLDLINE_SYNC_SERVICE_URL || '').trim();
  if (syncUrl) {
    try {
      const base = normalizeSyncBaseUrl(syncUrl);
      const { vendorSessionId } = await syncStartPayment(
        base,
        {
          amount: Number(payload.amount),
          currency: payload.currency || 'EUR',
          merchantRef: payload.merchantRef,
          sessionId: payload.sessionId,
        },
        {},
      );
      const { state, raw: statusRaw } = await syncWaitForPayment(base, vendorSessionId, {
        timeoutMs: Number.parseInt(process.env.WORLDLINE_SYNC_WAIT_MS || '120000', 10) || 120000,
      });
      sendJson(res, 200, {
        state,
        status: state,
        message: String(statusRaw?.message || ''),
        data: statusRaw,
      });
    } catch (e) {
      sendJson(res, 502, {
        state: 'ERROR',
        message: String(e?.message || e),
      });
    }
    return;
  }

  await new Promise((r) => setTimeout(r, Number.parseInt(process.env.WORLDLINE_BRIDGE_SIMULATE_MS || '400', 10) || 400));
  const decline = String(process.env.WORLDLINE_BRIDGE_SIMULATE_DECLINE || '').trim() === '1';
  sendJson(res, 200, {
    state: decline ? 'DECLINED' : 'APPROVED',
    message: decline
      ? 'Simulated decline (WORLDLINE_BRIDGE_SIMULATE_DECLINE=1).'
      : 'Simulated approval (Node bridge; set WORLDLINE_SYNC_SERVICE_URL for real terminal).',
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = u.pathname.replace(/\/+$/, '') || '/';
  const isBridgePath =
    path === '/worldline'
    || path === '/'
    || path.endsWith('/worldline');

  if (req.method === 'GET' && (path === '/health' || path === '/worldline/health')) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }

  if (req.method === 'POST' && isBridgePath) {
    handlePost(req, res).catch((e) => {
      sendJson(res, 500, { state: 'ERROR', message: String(e?.message || e) });
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

server.listen(PORT, HOST, () => {
  const hint = process.env.WORLDLINE_SYNC_SERVICE_URL
    ? 'proxying sales to WORLDLINE_SYNC_SERVICE_URL'
    : 'simulating APPROVED (set WORLDLINE_SYNC_SERVICE_URL for real Sync Service)';
  console.log(
    `[worldline-http-bridge] http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}/worldline (${hint})`,
  );
});

server.on('error', (err) => {
  console.error('[worldline-http-bridge] failed to listen', err?.message || err);
  process.exit(1);
});
