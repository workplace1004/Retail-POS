import 'dotenv/config';
import express from 'express';
import { createWorldlineService } from './services/worldlineService.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

const BRIDGE_PORT = Number.parseInt(process.env.WORLDLINE_BRIDGE_PORT || '8099', 10) || 8099;
const BRIDGE_HOST = String(process.env.WORLDLINE_BRIDGE_HOST || '127.0.0.1').trim() || '127.0.0.1';
const CTEP_PORT = Number.parseInt(process.env.WORLDLINE_CTEP_PORT || '9000', 10) || 9000;
const CTEP_HOST = String(process.env.WORLDLINE_CTEP_HOST || '0.0.0.0').trim() || '0.0.0.0';

const baseConnectionConfig = {
  listenHost: CTEP_HOST,
  port: String(CTEP_PORT),
  protocol: 'ctep',
  simulate: String(process.env.WORLDLINE_SIMULATE || '').trim() === '1',
};

// Build a local Node bridge over the existing Node CTEP service.
// Important: we force bridgeUrl empty to avoid recursive bridge calls.
const service = createWorldlineService({
  connection_string: JSON.stringify({
    ...baseConnectionConfig,
    bridgeUrl: '',
  }),
});

async function waitSessionFinal(sessionId, timeoutMs = 190000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = service.getSessionStatus(sessionId);
    if (!status?.success) throw new Error(status?.message || 'Session not found');
    const state = String(status.state || '').toUpperCase();
    if (state === 'APPROVED' || state === 'DECLINED' || state === 'CANCELLED' || state === 'ERROR') {
      return status;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error('Bridge timeout waiting for final session state');
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    mode: 'node-worldline-bridge',
    ctep: { listenHost: CTEP_HOST, listenPort: CTEP_PORT },
  });
});

app.post('/worldline', async (req, res) => {
  try {
    const action = String(req.body?.action || '').trim().toLowerCase();
    if (action === 'cancel') {
      const sessionId = String(req.body?.sessionId || '').trim();
      if (!sessionId) return res.status(400).json({ ok: false, state: 'ERROR', message: 'sessionId is required for cancel' });
      const result = await service.cancelSession(sessionId);
      if (!result?.success) {
        return res.status(400).json({ ok: false, state: 'ERROR', message: result?.message || 'Cancel failed' });
      }
      return res.json({ ok: true, state: 'CANCELLED', message: result.message || 'Payment cancelled.' });
    }

    const amountMinor = Number.parseInt(String(req.body?.amountMinor ?? ''), 10);
    const amountFromMinor = Number.isFinite(amountMinor) && amountMinor > 0 ? amountMinor / 100 : 0;
    const amount = Number(req.body?.amount);
    const amountEuro = Number.isFinite(amount) && amount > 0 ? amount : amountFromMinor;
    if (!Number.isFinite(amountEuro) || amountEuro <= 0) {
      return res.status(400).json({ ok: false, state: 'ERROR', message: 'amount/amountMinor must be > 0' });
    }

    const created = service.createSession(amountEuro);
    if (!created?.success || !created?.sessionId) {
      return res.status(500).json({ ok: false, state: 'ERROR', message: created?.message || 'Failed to start payment session' });
    }
    const finalStatus = await waitSessionFinal(created.sessionId);
    return res.json({
      ok: true,
      state: finalStatus.state,
      message: finalStatus.message || '',
      details: finalStatus.details || null,
      sessionId: created.sessionId,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      state: 'ERROR',
      message: err?.message || 'Bridge failure',
    });
  }
});

app.listen(BRIDGE_PORT, BRIDGE_HOST, () => {
  console.log(`Worldline Node bridge running on http://${BRIDGE_HOST}:${BRIDGE_PORT}`);
  console.log(`Bridge endpoint: http://${BRIDGE_HOST}:${BRIDGE_PORT}/worldline`);
});

