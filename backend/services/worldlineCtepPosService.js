/**
 * POS-facing session API that runs the sample `startCtepSale` flow in the background
 * so Express can return sessionId immediately (same UX as Payworld/CCV).
 */

import {
  ctepCancel,
  ctepStatus,
  normalizeHttpBaseUrl,
  startCtepSale,
} from './worldlineCtepBridgeClient.js';

const sharedSessions = new Map();

function parseConnection(connectionString) {
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
  const get = (...keys) => {
    for (const key of keys) {
      if (config[key] != null && config[key] !== '') return String(config[key]).trim();
      const lower = String(key).toLowerCase();
      for (const ck of Object.keys(config)) {
        if (ck.toLowerCase() === lower && config[ck] != null && config[ck] !== '') {
          return String(config[ck]).trim();
        }
      }
    }
    return '';
  };
  const httpBaseUrl =
    get('httpBaseUrl', 'http_base_url', 'bridgeHttpUrl', 'bridge_url')
    || String(process.env.WORLDLINE_CTEP_HTTP_URL || '').trim()
    || 'http://localhost:3210';
  const pollMs = Number.parseInt(get('pollMs', 'poll_ms') || '1500', 10);
  const timeoutSec = Number.parseInt(get('timeoutSec', 'timeout_sec', 'timeout') || '180', 10);
  return {
    httpBaseUrl: normalizeHttpBaseUrl(httpBaseUrl),
    pollMs: Number.isFinite(pollMs) && pollMs > 0 ? pollMs : 1500,
    timeoutSec: Number.isFinite(timeoutSec) && timeoutSec > 0 ? timeoutSec : 180,
  };
}

function mapTxToPos(tx) {
  const status = String(tx?.status || '').toLowerCase();
  const msg = String(tx?.message || '').trim();
  if (status === 'done' && tx.approved === true) {
    return {
      state: 'APPROVED',
      message: msg || 'Payment approved.',
      details: { bridge: true, tx },
    };
  }
  if (status === 'declined_or_error' || (status === 'done' && tx.approved === false)) {
    return {
      state: 'DECLINED',
      message: String(tx?.error || msg || 'Payment declined.'),
      details: { bridge: true, tx },
    };
  }
  if (status === 'cancel_requested') {
    return {
      state: 'CANCELLED',
      message: msg || 'Payment cancelled.',
      details: { bridge: true, tx },
    };
  }
  if (status === 'timeout') {
    return {
      state: 'ERROR',
      message: msg || 'Payment timeout.',
      details: { bridge: true, tx },
    };
  }
  if (status === 'error') {
    return {
      state: 'ERROR',
      message: String(tx?.error || msg || 'Payment error.'),
      details: { bridge: true, tx },
    };
  }
  return {
    state: 'ERROR',
    message: msg || `Unexpected bridge status: ${status || 'unknown'}`,
    details: { bridge: true, tx },
  };
}

class WorldlineCtepPosService {
  constructor(connectionString) {
    this.config = parseConnection(connectionString);
  }

  async testConnection() {
    try {
      const st = await ctepStatus(this.config.httpBaseUrl);
      if (!st || st.ok === false) {
        return { success: false, message: 'Worldline C-TEP bridge not reachable.' };
      }
      const connected = !!st?.terminalConnected;
      return {
        success: true,
        message: connected
          ? 'Worldline C-TEP bridge OK, terminal connected.'
          : 'Worldline C-TEP bridge OK (terminal not connected yet).',
      };
    } catch (e) {
      return {
        success: false,
        message: e?.message || 'Worldline C-TEP bridge not reachable.',
      };
    }
  }

  createSession(amountEuro) {
    const amount = Number(amountEuro);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: 'Invalid amount' };
    }
    const amountMinor = Math.round(amount * 100);
    const sessionId = `WL-CTEP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const reference = `POS-${sessionId}`;

    sharedSessions.set(sessionId, {
      state: 'IN_PROGRESS',
      message: 'Starting Worldline payment…',
      amountMinor,
      amountEuro: amount,
      reference,
      details: { bridgeBaseUrl: this.config.httpBaseUrl },
      completed: false,
      cancelRequested: false,
    });

    this.processPaymentAsync(sessionId).catch(() => {});

    return {
      success: true,
      sessionId,
      data: {
        state: 'IN_PROGRESS',
        message: 'Starting payment…',
        amountInCents: amountMinor,
      },
    };
  }

  async processPaymentAsync(sessionId) {
    const session = sharedSessions.get(sessionId);
    if (!session) return;

    const patch = (values) => {
      const cur = sharedSessions.get(sessionId);
      if (!cur) return;
      Object.assign(cur, values);
      sharedSessions.set(sessionId, cur);
    };

    const finish = (values) => {
      const cur = sharedSessions.get(sessionId);
      if (!cur) return;
      Object.assign(cur, values);
      cur.completed = true;
      sharedSessions.set(sessionId, cur);
      setTimeout(() => sharedSessions.delete(sessionId), 5 * 60 * 1000);
    };

    if (session.cancelRequested) {
      finish({ state: 'CANCELLED', message: 'Payment cancelled.', details: { bridge: true } });
      return;
    }

    try {
      patch({
        state: 'IN_PROGRESS',
        message: 'Waiting for terminal (C-TEP bridge)…',
      });
      const cur0 = sharedSessions.get(sessionId);
      if (cur0?.cancelRequested) {
        finish({ state: 'CANCELLED', message: 'Payment cancelled.', details: { bridge: true } });
        return;
      }
      const tx = await startCtepSale(
        this.config.httpBaseUrl,
        session.amountEuro,
        session.reference,
        this.config.timeoutSec,
        { pollMs: this.config.pollMs },
      );
      const mapped = mapTxToPos(tx);
      finish({
        state: mapped.state,
        message: mapped.message,
        details: mapped.details,
      });
    } catch (err) {
      finish({
        state: 'ERROR',
        message: err?.message || 'Worldline payment failed',
        details: { bridge: true, error: String(err?.message || err) },
      });
    }
  }

  getSessionStatus(sessionId) {
    const session = sharedSessions.get(sessionId);
    if (!session) return { success: false, ok: false, message: 'Session not found' };
    return {
      success: true,
      ok: true,
      provider: 'worldline',
      sessionId,
      amountInCents: session.amountMinor,
      state: session.state,
      message: session.message,
      details: session.details,
      cancelRequested: session.cancelRequested,
    };
  }

  async cancelSession(sessionId) {
    const session = sharedSessions.get(sessionId);
    if (!session) return { success: false, message: 'Session not found' };
    if (session.completed) return { success: false, message: 'Transaction already completed' };
    session.cancelRequested = true;
    session.state = 'CANCELLED';
    session.message = 'Cancellation requested…';
    sharedSessions.set(sessionId, session);
    try {
      await ctepCancel(this.config.httpBaseUrl);
    } catch {
      // best effort — bridge may still complete sale
    }
    return { success: true, message: 'Payment cancelled.' };
  }
}

export function createWorldlineCtepPosService(terminal) {
  if (!terminal || !terminal.connection_string) {
    throw new Error('Terminal connection_string is missing.');
  }
  return new WorldlineCtepPosService(terminal.connection_string);
}
