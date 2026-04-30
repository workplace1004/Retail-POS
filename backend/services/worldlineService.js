import net from 'net';

const sharedSessions = new Map();

function wlLog(message, data) {
  const ts = new Date().toISOString();
  if (data === undefined) {
    console.log(`[${ts}] [worldline] ${message}`);
    return;
  }
  console.log(`[${ts}] [worldline] ${message}`, data);
}

function previewText(value, max = 400) {
  const s = String(value ?? '');
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function previewHex(buffer, maxBytes = 96) {
  if (!buffer || !Buffer.isBuffer(buffer)) return '';
  const part = buffer.subarray(0, maxBytes);
  const hx = part.toString('hex').replace(/(.{2})/g, '$1 ').trim();
  return buffer.length > maxBytes ? `${hx} …` : hx;
}

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

  const portRaw = get('port', 'Port', 'listenPort', 'listen_port');
  const listenHostRaw = get('listenHost', 'listen_host', 'bindAddress', 'bind_address') || '0.0.0.0';
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

  const listenPort = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 9001;
  const listenHost = listenHostRaw || '0.0.0.0';

  return {
    terminalConnectsToPos: true,
    listenHost,
    listenPort,
    ip: '',
    port: listenPort,
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

/** Terminal (client) connects to this POS — one accepted socket per payment. */
function listenForTerminalSocket(host, port, timeoutMs, isCancelled, onListening) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    let settled = false;
    let pollIv = null;

    const stopPoll = () => {
      if (pollIv) {
        clearInterval(pollIv);
        pollIv = null;
      }
    };

    const fail = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stopPoll();
      try {
        srv.close();
      } catch {
        // ignore
      }
      reject(err);
    };

    let timer;
    timer = setTimeout(() => {
      fail(
        new Error(
          'Timeout waiting for the Worldline terminal to connect to this POS. On the device, set the ECR/cash register IP to this machine and the same port as configured here.',
        ),
      );
    }, timeoutMs);

    pollIv = setInterval(() => {
      try {
        if (isCancelled()) fail(new Error('Cancelled'));
      } catch {
        // ignore
      }
    }, 400);

    srv.once('connection', (socket) => {
      if (settled) {
        try {
          socket.destroy();
        } catch {
          // ignore
        }
        return;
      }
      settled = true;
      clearTimeout(timer);
      stopPoll();
      try {
        srv.close();
      } catch {
        // ignore
      }
      socket.setTimeout(0);
      wlLog('Terminal socket accepted', {
        remoteAddress: socket.remoteAddress || '',
        remotePort: socket.remotePort || '',
        localAddress: socket.localAddress || '',
        localPort: socket.localPort || '',
      });
      resolve(socket);
    });

    srv.on('error', (err) => {
      clearTimeout(timer);
      fail(err);
    });

    srv.listen(port, host, () => {
      try {
        onListening?.();
      } catch {
        // ignore
      }
    });
  });
}

function exchangeOnSocket(socket, config, payload, { destroySocketWhenDone = true } = {}) {
  const maxTotal = config.timeoutMs || 180000;
  const idleMs = 900;
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    let settled = false;
    let idleTimer = null;

    const cleanup = () => {
      if (idleTimer) clearTimeout(idleTimer);
      socket.removeAllListeners();
      if (destroySocketWhenDone) {
        try {
          socket.destroy();
        } catch {
          // ignore
        }
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
      wlLog('Received chunk from terminal', {
        chunkBytes: chunk.length,
        totalBytesBeforeAppend: buffer.length,
      });
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

    const writeStart = () => {
      wlLog('Sending payload to terminal', {
        bytes: payload.length,
        wrapStxEtx: !!config.wrapStxEtx,
        appendLrc: !!config.appendLrc,
        payloadHexPreview: previewHex(payload),
      });
      socket.write(payload, () => {
        bumpIdle();
      });
    };

    if (socket.connecting) {
      socket.once('connect', writeStart);
    } else {
      writeStart();
    }
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
      await new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.once('error', reject);
        srv.listen(this.config.listenPort, this.config.listenHost, () => {
          srv.close(() => resolve());
        });
      });
      return {
        success: true,
        message: `This POS can listen on ${this.config.listenHost}:${this.config.listenPort}. Configure the Worldline terminal with this computer's IP and this port.`,
      };
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
    wlLog('Session created', {
      sessionId,
      amountEuro: amount,
      amountMinor,
      reference,
      mode: this.effectiveMode(),
      listenHost: this.config.listenHost,
      listenPort: this.config.listenPort,
      timeoutMs: this.config.timeoutMs,
      hasSaleBodyTemplate: !!this.config.saleBodyTemplate,
      approveRegex: this.config.approveRegex?.source || '',
      declineRegex: this.config.declineRegex?.source || '',
      wrapStxEtx: !!this.config.wrapStxEtx,
      appendLrc: !!this.config.appendLrc,
    });

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
    wlLog('Session processing started', { sessionId, mode });

    if (mode === 'unconfigured') {
      wlLog('Session failed: unconfigured mode', { sessionId });
      finish({
        state: 'ERROR',
        message:
          'Worldline CTEP is not fully configured: set bridgeUrl (HTTP gateway), or saleBodyTemplate + approveRegex for TCP after the terminal connects, or WORLDLINE_SIMULATE=1 for dev only.',
        details: { mode },
      });
      return;
    }

    if (mode === 'simulate') {
      await new Promise((r) => setTimeout(r, 1200));
      const cur = this.sessions.get(sessionId);
      if (!cur) return;
      if (cur.cancelRequested) {
        wlLog('Session cancelled during simulate', { sessionId });
        finish({ state: 'CANCELLED', message: 'Payment cancelled.', details: { mode: 'simulate' } });
        return;
      }
      wlLog('Session approved in simulate mode', { sessionId });
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
        wlLog('Bridge response received', {
          sessionId,
          status: res.status,
          bodyPreview: previewText(text, 500),
        });
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
          wlLog('Bridge returned non-OK', { sessionId, status: res.status });
          finish({
            state: 'ERROR',
            message: data.message || data.error || `Bridge HTTP ${res.status}`,
            details: { body: text.slice(0, 500) },
          });
          return;
        }
        const state = String(data.state || data.status || '').toUpperCase();
        if (state === 'APPROVED' || state === 'SUCCESS' || data.approved === true) {
          wlLog('Session approved by bridge response', { sessionId, state });
          finish({
            state: 'APPROVED',
            message: String(data.message || 'Payment approved.'),
            details: data,
          });
        } else if (state === 'DECLINED' || state === 'FAILURE') {
          wlLog('Session declined by bridge response', { sessionId, state });
          finish({
            state: 'DECLINED',
            message: String(data.message || 'Payment declined.'),
            details: data,
          });
        } else if (state === 'CANCELLED') {
          wlLog('Session cancelled by bridge response', { sessionId, state });
          finish({ state: 'CANCELLED', message: String(data.message || 'Payment cancelled.'), details: data });
        } else {
          wlLog('Bridge response could not be classified', { sessionId, state, keys: Object.keys(data || {}) });
          finish({
            state: 'ERROR',
            message: String(data.message || 'Unexpected bridge response'),
            details: data,
          });
        }
      } catch (err) {
        wlLog('Bridge request failed', { sessionId, error: err?.message || '' });
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
      wlLog('TCP template prepared', {
        sessionId,
        bodyPreview: previewText(body, 500),
        bodyLength: body.length,
        payloadBytes: payload.length,
        payloadHexPreview: previewHex(payload),
      });

      const curWait = this.sessions.get(sessionId);
      if (curWait) {
        curWait.message = `Listening on ${this.config.listenHost}:${this.config.listenPort} — connect from the terminal…`;
        this.sessions.set(sessionId, curWait);
      }
      const clientSocket = await listenForTerminalSocket(
        this.config.listenHost,
        this.config.listenPort,
        this.config.timeoutMs || 180000,
        () => {
          const s = this.sessions.get(sessionId);
          return !!(s && s.cancelRequested);
        },
        () => {
          const s = this.sessions.get(sessionId);
          if (s) {
            s.message = 'Terminal connected — processing…';
            this.sessions.set(sessionId, s);
          }
        },
      );

      const raw = await exchangeOnSocket(clientSocket, this.config, payload, { destroySocketWhenDone: true });
      const cur = this.sessions.get(sessionId);
      if (!cur) return;
      if (cur.cancelRequested) {
        finish({ state: 'CANCELLED', message: 'Payment cancelled.' });
        return;
      }
      const ascii = raw.toString('binary');
      const utf8 = raw.toString('utf8');
      const text = utf8.includes('\uFFFD') ? ascii : utf8;
      wlLog('Terminal raw response received', {
        sessionId,
        rawBytes: raw.length,
        rawHexPreview: previewHex(raw),
        textPreview: previewText(text, 800),
      });

      if (this.config.declineRegex.test(text)) {
        wlLog('Response classified as DECLINED', {
          sessionId,
          declineRegex: this.config.declineRegex?.source || '',
        });
        finish({
          state: 'DECLINED',
          message: 'Payment declined.',
          details: { rawPreview: text.slice(0, 800) },
        });
        return;
      }
      if (this.config.approveRegex.test(text)) {
        wlLog('Response classified as APPROVED', {
          sessionId,
          approveRegex: this.config.approveRegex?.source || '',
        });
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
      wlLog('Response did not match approve/decline regex', {
        sessionId,
        approveRegex: this.config.approveRegex?.source || '',
        declineRegex: this.config.declineRegex?.source || '',
      });
    } catch (err) {
      const msg = err?.message || '';
      if (msg === 'Cancelled') {
        wlLog('Session cancelled while waiting for socket/response', { sessionId });
        finish({ state: 'CANCELLED', message: 'Payment cancelled.', details: {} });
        return;
      }
      wlLog('TCP processing failed', {
        sessionId,
        error: err?.message || '',
        code: err?.code || '',
      });
      finish({
        state: 'ERROR',
        message: msg || 'Worldline TCP error',
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
    wlLog('Cancellation requested', { sessionId, state: session.state });

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
