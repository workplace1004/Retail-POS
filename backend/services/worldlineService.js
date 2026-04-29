import net from 'net';

const sharedSessions = new Map();

function parseBool(v) {
  if (v === true || v === 1) return true;
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

function parseTerminalConnection(connectionString, defaults = {}) {
  let config = {};
  if (typeof connectionString === 'string') {
    try {
      config = JSON.parse(connectionString);
    } catch {
      if (connectionString.startsWith('tcp://')) {
        const match = connectionString.match(/tcp:\/\/([^:]+):?(\d+)?/i);
        if (match) config = { ip: match[1], port: match[2] || '' };
      } else if (connectionString.trim()) {
        config = { ip: connectionString.trim() };
      }
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

  const ip = get('ip', 'ipAddress', 'ip_address', 'host', 'hostname') || String(defaults.ip || '').trim();
  const portRaw = get('port', 'Port');
  const timeoutMsRaw = get('timeoutMs', 'timeout', 'timeout_ms');
  const bridgeUrl = get('bridgeUrl', 'bridge_url', 'worldlineBridgeUrl') || String(process.env.WORLDLINE_BRIDGE_URL || '').trim();
  const saleBodyTemplate = get('saleBodyTemplate', 'sale_body_template', 'ctepSaleBody');
  const approveRegexStr = get('approveRegex', 'approve_regex') || 'approved|accept|ok|autoris|transaction ok';
  const declineRegexStr = get('declineRegex', 'decline_regex') || 'declin|refus|refused|error|annul';
  let wrapStxEtx = true;
  if (parseBool(get('noStxEtx', 'rawTcp'))) wrapStxEtx = false;
  else if (get('wrapStxEtx', 'wrap_stx_etx') !== '') wrapStxEtx = parseBool(get('wrapStxEtx', 'wrap_stx_etx'));
  let appendLrc = true;
  if (get('appendLrc', 'append_lrc') !== '') appendLrc = parseBool(get('appendLrc', 'append_lrc'));
  const currencyCode = (get('currencyCode', 'currency') || String(defaults.currencyCode || 'EUR')).toUpperCase();

  const envSim = String(process.env.WORLDLINE_SIMULATE || '').trim() === '1';
  const simulate = envSim || parseBool(get('simulate', 'testMode', 'test_mode'));

  if (!ip) throw new Error('Worldline IP address not found in terminal configuration.');

  const parsedPort = Number.parseInt(portRaw || '0', 10);
  const parsedTimeoutMs = Number.parseInt(timeoutMsRaw || String(defaults.timeoutMs || ''), 10);

  let approveRegex;
  try {
    approveRegex = new RegExp(approveRegexStr, 'i');
  } catch {
    approveRegex = /approved|accept/i;
  }
  let declineRegex;
  try {
    declineRegex = new RegExp(declineRegexStr, 'i');
  } catch {
    declineRegex = /declin|refus/i;
  }

  return {
    ip,
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 9001,
    timeoutMs: Number.isFinite(parsedTimeoutMs) && parsedTimeoutMs > 0 ? parsedTimeoutMs : 180000,
    currencyCode: currencyCode || 'EUR',
    simulate,
    bridgeUrl,
    saleBodyTemplate,
    approveRegex,
    declineRegex,
    wrapStxEtx,
    appendLrc,
    cancelBodyTemplate: get('cancelBodyTemplate', 'cancel_body_template') || '',
  };
}

function substituteSaleTemplate(template, { amountEuro, amountMinor, reference, currency }) {
  const euroDot = amountEuro.toFixed(2);
  return String(template)
    .replace(/\{amountMinor\}/g, String(amountMinor))
    .replace(/\{amountCents\}/g, String(amountMinor))
    .replace(/\{amountEuro\}/g, euroDot.replace('.', ','))
    .replace(/\{amountEuroDot\}/g, euroDot)
    .replace(/\{reference\}/g, reference)
    .replace(/\{currency\}/g, currency);
}

function xorLrc(buffer) {
  let lrc = 0;
  for (let i = 0; i < buffer.length; i += 1) lrc ^= buffer[i];
  return lrc & 0xff;
}

function buildWirePayload(config, bodyUtf8) {
  const bodyBuf = Buffer.from(bodyUtf8, 'utf8');
  if (!config.wrapStxEtx) return bodyBuf;
  const stx = Buffer.from([0x02]);
  const etx = Buffer.from([0x03]);
  const core = Buffer.concat([stx, bodyBuf, etx]);
  if (!config.appendLrc) return core;
  const lrc = Buffer.from([xorLrc(core)]);
  return Buffer.concat([core, lrc]);
}

function tcpProbe(host, port, ms = 8000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const t = setTimeout(() => {
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      reject(new Error('TCP connection timeout'));
    }, ms);
    socket.once('error', (err) => {
      clearTimeout(t);
      reject(err);
    });
    socket.connect(port, host, () => {
      clearTimeout(t);
      try {
        socket.end();
      } catch {
        // ignore
      }
      resolve();
    });
  });
}

function tcpSendAndRead(config, payload) {
  const maxTotal = config.timeoutMs || 180000;
  const idleMs = 900;
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    let settled = false;
    let idleTimer = null;

    const cleanup = () => {
      if (idleTimer) clearTimeout(idleTimer);
      socket.removeAllListeners();
      try {
        socket.destroy();
      } catch {
        // ignore
      }
    };

    const totalTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Worldline CTEP read timeout'));
    }, maxTotal);

    const bumpIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        clearTimeout(totalTimer);
        cleanup();
        resolve(buffer);
      }, idleMs);
    };

    socket.on('error', (err) => {
      if (settled) return;
      settled = true;
      if (idleTimer) clearTimeout(idleTimer);
      clearTimeout(totalTimer);
      cleanup();
      reject(err);
    });

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      bumpIdle();
      if (config.wrapStxEtx) {
        const etxAt = buffer.indexOf(0x03);
        if (etxAt >= 0) {
          if (settled) return;
          settled = true;
          if (idleTimer) clearTimeout(idleTimer);
          clearTimeout(totalTimer);
          cleanup();
          resolve(buffer.slice(0, etxAt + 1));
        }
      }
    });

    socket.connect(config.port, config.ip, () => {
      socket.write(payload, () => {
        bumpIdle();
      });
    });
  });
}

class WorldlineServiceInstance {
  constructor(config) {
    this.config = config;
    this.sessions = sharedSessions;
  }

  effectiveMode() {
    if (this.config.simulate) return 'simulate';
    if (this.config.bridgeUrl) return 'bridge';
    if (this.config.saleBodyTemplate) return 'tcp-template';
    return 'unconfigured';
  }

  async testConnection() {
    try {
      const mode = this.effectiveMode();
      if (mode === 'simulate') {
        return { success: true, message: 'Worldline test mode (simulate) — no TCP call.' };
      }
      if (mode === 'bridge') {
        return {
          success: true,
          message: 'Worldline HTTP bridge URL is set (run a live payment to verify end-to-end).',
        };
      }
      if (mode === 'unconfigured') {
        await tcpProbe(this.config.ip, this.config.port, 8000);
        return {
          success: true,
          message:
            'TCP port reachable. Configure saleBodyTemplate + approveRegex (CTEP), or bridgeUrl / simulate for payments.',
        };
      }
      await tcpProbe(this.config.ip, this.config.port, 8000);
      return { success: true, message: 'TCP connection to Worldline terminal OK.' };
    } catch (err) {
      return {
        success: false,
        message: `Worldline connection failed: ${err.message}`,
      };
    }
  }

  createSession(amountEuro) {
    const amount = Number(amountEuro);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: 'Invalid amount for Worldline' };
    }

    const amountMinor = Math.round(amount * 100);
    const sessionId = `WORLDLINE-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const reference = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(-16) || String(Date.now());

    const session = {
      id: sessionId,
      amountEuro: amount,
      amountMinor,
      reference,
      state: 'IN_PROGRESS',
      message: 'Starting payment...',
      details: null,
      cancelRequested: false,
      completed: false,
      config: this.config,
    };
    this.sessions.set(sessionId, session);

    this.processPaymentAsync(sessionId).catch((err) => {
      const current = this.sessions.get(sessionId);
      if (!current) return;
      current.state = 'ERROR';
      current.message = err.message || 'Transaction error';
      current.details = { error: err.message, code: err.code };
      current.completed = true;
      this.sessions.set(sessionId, current);
    });

    return {
      success: true,
      sessionId,
      data: {
        state: session.state,
        message: session.message,
        amount: session.amountEuro,
        amountInCents: amountMinor,
      },
    };
  }

  async processPaymentAsync(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const finish = (patch) => {
      const cur = this.sessions.get(sessionId);
      if (!cur) return;
      Object.assign(cur, patch);
      cur.completed = true;
      this.sessions.set(sessionId, cur);
      setTimeout(() => this.sessions.delete(sessionId), 5 * 60 * 1000);
    };

    const mode = this.effectiveMode();

    if (mode === 'unconfigured') {
      finish({
        state: 'ERROR',
        message:
          'Worldline CTEP is not fully configured: set connection_string.simulate=true (test), bridgeUrl (HTTP gateway), or saleBodyTemplate + approveRegex for raw TCP CTEP.',
        details: { mode },
      });
      return;
    }

    if (mode === 'simulate') {
      await new Promise((r) => setTimeout(r, 1200));
      const cur = this.sessions.get(sessionId);
      if (!cur) return;
      if (cur.cancelRequested) {
        finish({ state: 'CANCELLED', message: 'Payment cancelled.', details: { mode: 'simulate' } });
        return;
      }
      finish({
        state: 'APPROVED',
        message: 'Payment approved (simulate mode).',
        details: { mode: 'simulate' },
      });
      return;
    }

    if (mode === 'bridge') {
      try {
        const cur0 = this.sessions.get(sessionId);
        if (!cur0 || cur0.cancelRequested) {
          finish({ state: 'CANCELLED', message: 'Payment cancelled.' });
          return;
        }
        const res = await fetch(this.config.bridgeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            amount: session.amountEuro,
            amountCents: session.amountMinor,
            reference: session.reference,
            currency: this.config.currencyCode,
          }),
        });
        const text = await res.text();
        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = {};
        }
        const cur = this.sessions.get(sessionId);
        if (!cur) return;
        if (cur.cancelRequested) {
          finish({ state: 'CANCELLED', message: 'Payment cancelled.' });
          return;
        }
        if (!res.ok) {
          finish({
            state: 'ERROR',
            message: data.message || data.error || `Bridge HTTP ${res.status}`,
            details: { body: text.slice(0, 500) },
          });
          return;
        }
        const state = String(data.state || data.status || '').toUpperCase();
        if (state === 'APPROVED' || state === 'SUCCESS' || data.approved === true) {
          finish({
            state: 'APPROVED',
            message: String(data.message || 'Payment approved.'),
            details: data,
          });
        } else if (state === 'DECLINED' || state === 'FAILURE') {
          finish({
            state: 'DECLINED',
            message: String(data.message || 'Payment declined.'),
            details: data,
          });
        } else if (state === 'CANCELLED') {
          finish({ state: 'CANCELLED', message: String(data.message || 'Payment cancelled.'), details: data });
        } else {
          finish({
            state: 'ERROR',
            message: String(data.message || 'Unexpected bridge response'),
            details: data,
          });
        }
      } catch (err) {
        finish({
          state: 'ERROR',
          message: err.message || 'Bridge request failed',
          details: { error: err.message },
        });
      }
      return;
    }

    // tcp-template
    try {
      const body = substituteSaleTemplate(this.config.saleBodyTemplate, {
        amountEuro: session.amountEuro,
        amountMinor: session.amountMinor,
        reference: session.reference,
        currency: this.config.currencyCode,
      });
      const payload = buildWirePayload(this.config, body);
      const raw = await tcpSendAndRead(this.config, payload);
      const cur = this.sessions.get(sessionId);
      if (!cur) return;
      if (cur.cancelRequested) {
        finish({ state: 'CANCELLED', message: 'Payment cancelled.' });
        return;
      }
      const ascii = raw.toString('binary');
      const utf8 = raw.toString('utf8');
      const text = utf8.includes('\uFFFD') ? ascii : utf8;

      if (this.config.declineRegex.test(text)) {
        finish({
          state: 'DECLINED',
          message: 'Payment declined.',
          details: { rawPreview: text.slice(0, 800) },
        });
        return;
      }
      if (this.config.approveRegex.test(text)) {
        finish({
          state: 'APPROVED',
          message: 'Payment approved.',
          details: { rawPreview: text.slice(0, 800) },
        });
        return;
      }
      finish({
        state: 'ERROR',
        message:
          'Worldline response did not match approveRegex or declineRegex. Adjust approveRegex or check terminal logs.',
        details: { rawPreview: text.slice(0, 800) },
      });
    } catch (err) {
      finish({
        state: 'ERROR',
        message: err.message || 'Worldline TCP error',
        details: { error: err.message, code: err.code },
      });
    }
  }

  getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, ok: false, message: 'Session not found' };
    }
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
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, message: 'Session not found' };
    if (session.completed) return { success: false, message: 'Transaction already completed' };

    session.cancelRequested = true;
    session.state = 'CANCELLED';
    session.message = 'Cancellation requested...';
    this.sessions.set(sessionId, session);

    if (this.config.cancelBodyTemplate && !this.config.simulate && !this.config.bridgeUrl) {
      try {
        const body = substituteSaleTemplate(this.config.cancelBodyTemplate, {
          amountEuro: session.amountEuro,
          amountMinor: session.amountMinor,
          reference: session.reference,
          currency: this.config.currencyCode,
        });
        const payload = buildWirePayload(this.config, body);
        await tcpSendAndRead({ ...this.config, timeoutMs: Math.min(this.config.timeoutMs, 30000) }, payload);
      } catch {
        // ignore cancel send errors
      }
    }

    return { success: true, message: 'Payment cancelled.' };
  }
}

export function createWorldlineService(terminal) {
  if (!terminal || !terminal.connection_string) {
    throw new Error('Terminal connection_string is missing.');
  }
  const config = parseTerminalConnection(terminal.connection_string, {
    currencyCode: terminal.currencyCode || 'EUR',
    timeoutMs: terminal.timeoutMs || 180000,
  });
  return new WorldlineServiceInstance(config);
}
