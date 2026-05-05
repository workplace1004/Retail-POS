import net from 'net';
import crypto from 'crypto';

const sharedSessions = new Map();
const sharedRuntimes = new Map();

function wlLog(message, data) {
  const ts = new Date().toISOString();
  if (data === undefined) {
    console.log(`[${ts}] [worldline-ctep] ${message}`);
    return;
  }
  console.log(`[${ts}] [worldline-ctep] ${message}`, data);
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

  const listenPort = Number.parseInt(get('listenPort', 'port') || '9001', 10);
  const listenHost = get('listenHost', 'bindAddress') || '0.0.0.0';
  const timeoutMs = Number.parseInt(get('timeoutMs', 'timeout') || String(defaults.timeoutMs || 180000), 10);
  const recoveryDelayMs = Number.parseInt(get('recoveryDelayMs') || '100000', 10);
  const saleResponseWaitMs = Number.parseInt(get('saleResponseWaitMs') || '180000', 10);
  const heartbeatMs = Number.parseInt(get('heartbeatMs') || '12000', 10);
  const merchantRefPrefix = get('merchantRefPrefix') || 'POS';
  const rawTcpEnabled = parseBool(get('rawTcp', 'noStxEtx'));
  const wrapStxEtx = rawTcpEnabled
    ? false
    : (get('wrapStxEtx') === '' ? true : parseBool(get('wrapStxEtx')));
  const appendLrc = get('appendLrc') === '' ? true : parseBool(get('appendLrc'));
  const simulate = parseBool(get('simulate')) || String(process.env.WORLDLINE_SIMULATE || '') === '1';
  const saleTemplate =
    get('saleCommandTemplate', 'saleBodyTemplate', 'ctepSaleBody', 'sale_body_template')
    || 'ACTION=SALE|amountMinor={amountMinor}|currency={currency}|merchantRef={reference}';
  const cancelTemplate =
    get('cancelCommandTemplate', 'cancelBodyTemplate', 'cancel_body_template')
    || 'ACTION=CANCEL_RETAIL|merchantRef={reference}';
  const resetTemplate = get('resetCommandTemplate') || 'ACTION=RESET_TRANSACTION';
  const lastStatusTemplate = get('lastStatusCommandTemplate') || 'ACTION=LAST_TRANSACTION_STATUS';
  const approvalPattern = get('approveRegex', 'approvalRegex', 'approve_regex') || 'approved|accept|ok|autoris|transaction ok';
  const declinePattern = get('declineRegex', 'decline_regex') || 'declin|refus|refused|error|annul';
  let approvalRegex;
  let declineRegex;
  try { approvalRegex = new RegExp(approvalPattern, 'i'); } catch { approvalRegex = /approved|accept|ok|autoris|transaction ok/i; }
  try { declineRegex = new RegExp(declinePattern, 'i'); } catch { declineRegex = /declin|refus|refused|error|annul/i; }

  return {
    listenHost,
    listenPort: Number.isFinite(listenPort) && listenPort > 0 ? listenPort : 9001,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 180000,
    recoveryDelayMs: Number.isFinite(recoveryDelayMs) && recoveryDelayMs > 0 ? recoveryDelayMs : 100000,
    saleResponseWaitMs: Number.isFinite(saleResponseWaitMs) && saleResponseWaitMs > 0 ? saleResponseWaitMs : 180000,
    heartbeatMs: Number.isFinite(heartbeatMs) && heartbeatMs > 0 ? heartbeatMs : 12000,
    merchantRefPrefix,
    wrapStxEtx,
    appendLrc,
    simulate,
    currencyCode: (get('currencyCode', 'currency') || String(defaults.currencyCode || 'EUR')).toUpperCase(),
    saleTemplate,
    cancelTemplate,
    resetTemplate,
    lastStatusTemplate,
    approvalRegex,
    declineRegex,
  };
}

function xorLrc(buffer) {
  let lrc = 0;
  for (let i = 0; i < buffer.length; i += 1) lrc ^= buffer[i];
  return lrc & 0xff;
}

function framePayload(config, bodyUtf8, transport = null) {
  const wrapStxEtx = transport?.wrapStxEtx ?? config.wrapStxEtx;
  const appendLrc = transport?.appendLrc ?? config.appendLrc;
  const body = Buffer.from(bodyUtf8, 'utf8');
  if (!wrapStxEtx) return body;
  const core = Buffer.concat([Buffer.from([0x02]), body, Buffer.from([0x03])]);
  if (!appendLrc) return core;
  return Buffer.concat([core, Buffer.from([xorLrc(core)])]);
}

function deframeToText(raw) {
  if (!raw || !raw.length) return '';
  let payload = raw;
  const stx = payload.indexOf(0x02);
  const etx = payload.lastIndexOf(0x03);
  if (stx >= 0 && etx > stx) payload = payload.slice(stx + 1, etx);
  const utf8 = payload.toString('utf8');
  if (!utf8.includes('\uFFFD')) return utf8;
  return payload.toString('binary');
}

function buildCtepCommand(action, fields = {}) {
  const parts = [`ACTION=${action}`];
  Object.entries(fields).forEach(([k, v]) => {
    if (v == null || v === '') return;
    parts.push(`${k}=${String(v)}`);
  });
  return parts.join('|');
}

function fillTemplate(template, vars) {
  return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const v = vars[key];
    if (v == null) {
      throw new Error(`Missing template variable: ${key}`);
    }
    return String(v);
  });
}

function unresolvedTemplateTokens(template) {
  const tokens = String(template || '').match(/\{([a-zA-Z0-9_]+)\}/g) || [];
  return [...new Set(tokens.map((t) => t.slice(1, -1)))];
}

function looksLikeJsonPayload(command) {
  const s = String(command || '').trim();
  return s.startsWith('{') || s.startsWith('[');
}

class CtepRuntime {
  constructor(config) {
    this.config = config;
    this.server = null;
    this.socket = null;
    this.socketBuffer = Buffer.alloc(0);
    this.pending = null;
    this.heartbeatTimer = null;
    this.detectedPoiId = null;
  }

  key() {
    return `${this.config.listenHost}:${this.config.listenPort}`;
  }

  async ensureStarted() {
    if (this.server) return;
    this.server = net.createServer((socket) => {
      if (this.socket) {
        this.socket.destroy();
      }
      this.socket = socket;
      this.socketBuffer = Buffer.alloc(0);
      wlLog('Terminal connected to C-TEP service', {
        remoteAddress: socket.remoteAddress || '',
        remotePort: socket.remotePort || '',
      });
      socket.on('data', (chunk) => {
        this.socketBuffer = Buffer.concat([this.socketBuffer, chunk]);
        if (this.pending) this.pending.onData();
      });
      socket.on('error', (err) => {
        wlLog('Terminal socket error', { error: err?.message || String(err) });
      });
      socket.on('close', () => {
        this.socket = null;
        this.socketBuffer = Buffer.alloc(0);
      });
    });
    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.config.listenPort, this.config.listenHost, resolve);
    });
    this.startHeartbeat();
    wlLog('C-TEP service started', { key: this.key() });
  }

  startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (!this.socket) return;
      if (this.pending) return;
      const ping = framePayload(this.config, buildCtepCommand('HEARTBEAT'));
      this.socket.write(ping);
    }, this.config.heartbeatMs);
  }

  async waitForTerminal(timeoutMs) {
    const start = Date.now();
    while (!this.socket) {
      if (Date.now() - start > timeoutMs) {
        throw new Error('Timeout waiting for terminal connection to C-TEP service');
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  async sendAndRead(command, timeoutMs, transport = null) {
    await this.ensureStarted();
    await this.waitForTerminal(timeoutMs);
    if (!this.socket) throw new Error('No terminal connected');
    if (this.pending) throw new Error('Another C-TEP command is in progress');
    const commandText = String(command ?? '');
    if (looksLikeJsonPayload(commandText)) {
      try {
        JSON.parse(commandText);
      } catch (err) {
        throw new Error(`Invalid JSON sale command: ${err?.message || String(err)}`);
      }
    }
    const payload = framePayload(this.config, commandText, transport);
    const payloadSha1 = crypto.createHash('sha1').update(payload).digest('hex');
    wlLog('Sending C-TEP command', {
      commandPreview: commandText.slice(0, 500),
      commandLength: commandText.length,
      payloadBytes: payload.length,
      payloadSha1,
      transport: {
        wrapStxEtx: transport?.wrapStxEtx ?? this.config.wrapStxEtx,
        appendLrc: transport?.appendLrc ?? this.config.appendLrc,
      },
      timeoutMs,
    });
    this.socket.write(payload, () => {
      wlLog('C-TEP payload write completed', {
        payloadBytes: payload.length,
        payloadSha1,
      });
    });

    return new Promise((resolve, reject) => {
      let done = false;
      let idleTimer = null;
      let interimFinalTimer = null;
      const isProtocolAdviceFrame = (text) => {
        const trimmed = String(text || '').trim();
        return /^C[ui]\b/.test(trimmed) || /^Ri\b/.test(trimmed);
      };
      const updateDetectedPoiId = (text) => {
        const s = String(text || '');
        const m = s.match(/[A-Z]{2}\d{6}/);
        if (m && m[0]) {
          this.detectedPoiId = m[0];
          wlLog('Detected terminal POIID from advice frame', { poiId: this.detectedPoiId });
        }
      };
      const isIgnorableControlFrame = (frame, text) => {
        const size = frame?.length || 0;
        if (!size) return true;
        if (size === 1 && frame[0] === 0x06) return true; // ACK
        // Very small non-text payloads are usually transport/control chatter.
        if (size <= 4) {
          const printable = String(text || '').replace(/[^\x20-\x7E]/g, '').trim();
          if (!printable || printable.length <= 1) return true;
        }
        // Ignore frames that are almost entirely non-printable.
        const asciiPrintableCount = [...String(text || '')].filter((ch) => {
          const c = ch.charCodeAt(0);
          return c >= 0x20 && c <= 0x7e;
        }).length;
        if (size <= 10 && asciiPrintableCount <= 2) return true;
        return false;
      };
      const isInterimProcessingFrame = (frame) => {
        const size = frame?.length || 0;
        if (size < 6) return false;
        // Common C-TEP interim status observed on RX5000:
        // starts with "MC" and contains TLV DF2D020002 (status "processing/pending").
        const startsMc = frame[0] === 0x4d && frame[1] === 0x43; // "MC"
        if (!startsMc) return false;
        const tlv = Buffer.from([0xdf, 0x2d, 0x02, 0x00, 0x02]);
        return frame.indexOf(tlv) >= 0;
      };
      const acknowledgeFrame = () => {
        if (!this.socket || this.socket.destroyed) return;
        try {
          this.socket.write(Buffer.from([0x06]));
        } catch {
          // ignore ACK errors
        }
      };
      const finish = (fn, value) => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        if (idleTimer) clearTimeout(idleTimer);
        if (interimFinalTimer) clearTimeout(interimFinalTimer);
        this.pending = null;
        fn(value);
      };
      const startInterimFinalTimer = () => {
        if (interimFinalTimer) return;
        interimFinalTimer = setTimeout(() => {
          finish(reject, new Error('C-TEP interim without final response'));
        }, 8000);
      };
      const bumpIdle = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          if (!this.socketBuffer.length) return;
          const frame = this.socketBuffer;
          this.socketBuffer = Buffer.alloc(0);
          acknowledgeFrame();
          wlLog('Received idle-delimited C-TEP response', { bytes: frame.length });
          const text = deframeToText(frame);
          if (isProtocolAdviceFrame(text)) {
            updateDetectedPoiId(text);
            wlLog('Ignoring protocol advice frame while waiting response', {
              preview: text.slice(0, 120),
            });
            bumpIdle();
            return;
          }
          if (isIgnorableControlFrame(frame, text)) {
            wlLog('Ignoring control frame while waiting response', {
              bytes: frame.length,
              preview: text.slice(0, 120),
            });
            bumpIdle();
            return;
          }
          if (isInterimProcessingFrame(frame)) {
            wlLog('Ignoring interim processing frame while waiting final response', {
              bytes: frame.length,
              preview: text.slice(0, 120),
            });
            startInterimFinalTimer();
            bumpIdle();
            return;
          }
          finish(resolve, frame);
        }, 900);
      };
      const readNow = () => {
        while (true) {
          const buf = this.socketBuffer;
          if (!buf.length) return;
          // Ignore a standalone ACK frame and wait for the business response.
          if (buf.length === 1 && buf[0] === 0x06) {
            this.socketBuffer = Buffer.alloc(0);
            bumpIdle();
            return;
          }
          const etxAt = buf.indexOf(0x03);
          if (etxAt >= 0) {
            const frame = buf.slice(0, etxAt + 1);
            this.socketBuffer = buf.slice(etxAt + 1);
            acknowledgeFrame();
            wlLog('Received ETX-delimited C-TEP response', { bytes: frame.length });
            const text = deframeToText(frame);
            if (isProtocolAdviceFrame(text)) {
              updateDetectedPoiId(text);
              wlLog('Ignoring protocol advice frame while waiting response', {
                preview: text.slice(0, 120),
              });
              continue;
            }
            if (isIgnorableControlFrame(frame, text)) {
              wlLog('Ignoring control frame while waiting response', {
                bytes: frame.length,
                preview: text.slice(0, 120),
              });
              continue;
            }
            if (isInterimProcessingFrame(frame)) {
              wlLog('Ignoring interim processing frame while waiting final response', {
                bytes: frame.length,
                preview: text.slice(0, 120),
              });
              startInterimFinalTimer();
              continue;
            }
            finish(resolve, frame);
            return;
          }
          // Some terminals/dialects return plain text without ETX.
          bumpIdle();
          return;
        }
      };
      const timer = setTimeout(() => {
        finish(reject, new Error('C-TEP command timeout'));
      }, timeoutMs);
      this.pending = { onData: readNow };
      readNow();
    });
  }
}

class WorldlineServiceInstance {
  constructor(config) {
    this.config = config;
    this.sessions = sharedSessions;
    const runtimeKey = `${config.listenHost}:${config.listenPort}`;
    if (!sharedRuntimes.has(runtimeKey)) sharedRuntimes.set(runtimeKey, new CtepRuntime(config));
    this.runtime = sharedRuntimes.get(runtimeKey);
  }

  async testConnection() {
    try {
      await this.runtime.ensureStarted();
      return {
        success: true,
        message: `C-TEP service listening on ${this.config.listenHost}:${this.config.listenPort}. Configure terminal CTEP + Sync Service.`,
      };
    } catch (err) {
      return { success: false, message: err?.message || 'Failed to start C-TEP service' };
    }
  }

  createSession(amountEuro) {
    const amount = Number(amountEuro);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: 'Invalid amount for Worldline' };
    }
    const amountMinor = Math.round(amount * 100);
    const sessionId = `WORLDLINE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const reference = `${this.config.merchantRefPrefix}-${Date.now()}`.slice(0, 32);
    const session = {
      id: sessionId,
      amountEuro: amount,
      amountMinor,
      reference,
      state: 'IN_PROGRESS',
      message: 'Starting C-TEP sale...',
      details: null,
      cancelRequested: false,
      completed: false,
      startedAt: Date.now(),
    };
    this.sessions.set(sessionId, session);
    this.processPaymentAsync(sessionId).catch((err) => {
      const current = this.sessions.get(sessionId);
      if (!current) return;
      current.state = 'ERROR';
      current.message = err?.message || 'C-TEP transaction failed';
      current.details = { error: err?.message || String(err) };
      current.completed = true;
      this.sessions.set(sessionId, current);
    });
    return {
      success: true,
      sessionId,
      data: {
        state: session.state,
        message: session.message,
        amount: amount,
        amountInCents: amountMinor,
      },
    };
  }

  classifyResponseText(text) {
    const normalized = String(text || '').trim();
    if (!normalized) return { state: 'ERROR', message: 'Empty C-TEP response' };
    try {
      const parsed = JSON.parse(normalized);
      const flat = JSON.stringify(parsed).toLowerCase();
      const statusHints = [
        parsed?.status,
        parsed?.state,
        parsed?.result,
        parsed?.transactionStatus,
        parsed?.TransactionStatus,
        parsed?.ResponseCode,
        parsed?.responseCode,
        parsed?.ResultCode,
        parsed?.resultCode,
        parsed?.Outcome,
        parsed?.outcome,
      ]
        .filter((v) => v != null)
        .map((v) => String(v).trim().toLowerCase());
      if (parsed?.approved === true || statusHints.some((v) => /approved|success|ok|accept|00/.test(v))) {
        return { state: 'APPROVED', message: 'Payment approved.' };
      }
      if (parsed?.approved === false || statusHints.some((v) => /declin|refus|reject|error|fail/.test(v))) {
        return { state: 'DECLINED', message: 'Payment declined.' };
      }
      if (/approved|success|ok|accept/.test(flat)) return { state: 'APPROVED', message: 'Payment approved.' };
      if (/declin|refus|reject|error|fail/.test(flat)) return { state: 'DECLINED', message: 'Payment declined.' };
      if (/cancel/.test(flat)) return { state: 'CANCELLED', message: 'Payment cancelled.' };
    } catch {
      // Not JSON; fall back to regex matching below.
    }
    if (this.config.declineRegex.test(normalized)) return { state: 'DECLINED', message: 'Payment declined.' };
    if (this.config.approvalRegex.test(normalized)) return { state: 'APPROVED', message: 'Payment approved.' };
    if (/CANCELLED|ABORT|CANCELED/i.test(normalized)) return { state: 'CANCELLED', message: 'Payment cancelled.' };
    return { state: 'ERROR', message: 'Unrecognized C-TEP sale response' };
  }

  getTransportCandidates() {
    const base = {
      wrapStxEtx: !!this.config.wrapStxEtx,
      appendLrc: !!this.config.appendLrc,
      label: 'configured',
    };
    const variants = [base];
    const pushUnique = (v) => {
      if (variants.some((x) => x.wrapStxEtx === v.wrapStxEtx && x.appendLrc === v.appendLrc)) return;
      variants.push(v);
    };
    // Common RX5000 interoperability fallbacks.
    pushUnique({ wrapStxEtx: true, appendLrc: false, label: 'stx-etx-no-lrc' });
    pushUnique({ wrapStxEtx: false, appendLrc: false, label: 'raw-tcp' });
    return variants;
  }

  async processPaymentAsync(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const patch = (values) => {
      const cur = this.sessions.get(sessionId);
      if (!cur) return;
      Object.assign(cur, values);
      this.sessions.set(sessionId, cur);
    };
    const finish = (patch) => {
      const cur = this.sessions.get(sessionId);
      if (!cur) return;
      Object.assign(cur, patch);
      cur.completed = true;
      this.sessions.set(sessionId, cur);
      setTimeout(() => this.sessions.delete(sessionId), 5 * 60 * 1000);
    };

    if (this.config.simulate) {
      await new Promise((r) => setTimeout(r, 1000));
      finish({ state: 'APPROVED', message: 'Payment approved (simulate mode).', details: { mode: 'simulate' } });
      return;
    }

    const nowIso = new Date().toISOString();
    const defaultServiceId = `S${Date.now().toString(36).slice(-8)}`;
    const defaultTxnId = session.reference;
    const defaultPoiId = String(
      this.config.poiId
      || this.config.POIID
      || this.config.poiid
      || this.runtime.detectedPoiId
      || 'KR539577',
    );
    const configuredSaleCommand = fillTemplate(this.config.saleTemplate, {
      amountMinor: session.amountMinor,
      amount: session.amountEuro.toFixed(2),
      amountNumber: session.amountEuro.toFixed(2),
      amountCents: session.amountMinor,
      amountEuro: session.amountEuro.toFixed(2).replace('.', ','),
      amountEuroDot: session.amountEuro.toFixed(2),
      currency: this.config.currencyCode,
      reference: session.reference,
      merchantRef: session.reference,
      sessionId,
      serviceId: defaultServiceId,
      saleId: 'POS',
      transactionId: defaultTxnId,
      timeStamp: nowIso,
      timestamp: nowIso,
      poiId: defaultPoiId,
      POIID: defaultPoiId,
    }) || buildCtepCommand('SALE', {
      amountMinor: session.amountMinor,
      currency: this.config.currencyCode,
      merchantRef: session.reference,
    });
    const genericSaleCommand = buildCtepCommand('SALE', {
      amountMinor: session.amountMinor,
      currency: this.config.currencyCode,
      merchantRef: session.reference,
    });
    const saleCommandCandidates = configuredSaleCommand === genericSaleCommand
      ? [configuredSaleCommand]
      : [configuredSaleCommand, genericSaleCommand];
    const transportCandidates = this.getTransportCandidates();
    try {
      patch({
        state: 'IN_PROGRESS',
        message: `Starting C-TEP service on ${this.config.listenHost}:${this.config.listenPort}...`,
      });
      await this.runtime.ensureStarted();
      patch({
        state: 'IN_PROGRESS',
        message: `Waiting for terminal connection on ${this.config.listenHost}:${this.config.listenPort}...`,
      });
      await this.runtime.waitForTerminal(this.config.timeoutMs);
      patch({
        state: 'IN_PROGRESS',
        message: 'Terminal connected. Sending sale request...',
      });
      let rawSale = null;
      let sentCommandPreview = '';
      let lastSendError = null;
      let forceRecovery = false;
      for (let i = 0; i < saleCommandCandidates.length; i += 1) {
        const candidate = saleCommandCandidates[i];
        const isFallback = i > 0;
        if (!isFallback && looksLikeJsonPayload(candidate)) {
          lastSendError = new Error(
            'NEXO/JSON sale payload is disabled. Configure Sale body template as C-TEP command text (e.g. ACTION=SALE|amountMinor={amountMinor}|currency={currency}|merchantRef={reference}).',
          );
          wlLog('Rejected non-CTEP sale template', {
            preview: String(candidate).slice(0, 240),
          });
          continue;
        }
        for (let t = 0; t < transportCandidates.length; t += 1) {
          const transport = transportCandidates[t];
          patch({
            state: 'IN_PROGRESS',
            message: isFallback
              ? `Trying fallback sale format (${transport.label})...`
              : `Terminal connected. Sending sale request (${transport.label})...`,
          });
          try {
            sentCommandPreview = String(candidate || '').slice(0, 500);
            // Do not fallback too early: RX5000 can stay in processing state
            // while waiting for card/PIN and only then emits final response.
            rawSale = await this.runtime.sendAndRead(
              candidate,
              Math.max(this.config.timeoutMs, this.config.saleResponseWaitMs),
              transport,
            );
            if (rawSale) break;
          } catch (err) {
            lastSendError = err;
            if (String(err?.message || '').includes('interim without final response')) {
              forceRecovery = true;
              wlLog('Moving to recovery after interim-only terminal flow', {
                attempt: i + 1,
                fallbackTried: i > 0,
                transport: transport.label,
              });
              break;
            }
            wlLog('Sale command attempt failed', {
              attempt: i + 1,
              fallback: isFallback,
              transport: transport.label,
              error: err?.message || String(err),
            });
          }
        }
        if (rawSale || forceRecovery) break;
      }
      if (!rawSale && !forceRecovery) {
        throw new Error(
          lastSendError?.message
            || 'No business sale response from terminal. Verify sale template/terminal protocol mapping.',
        );
      }
      let saleText = '';
      if (rawSale) {
        saleText = deframeToText(rawSale);
        wlLog('Decoded SALE response text', {
          text: saleText.slice(0, 2000),
          commandPreview: sentCommandPreview,
        });
        patch({ message: 'Sale response received. Validating status...' });
        const classified = this.classifyResponseText(saleText);
        if (classified.state === 'APPROVED' || classified.state === 'DECLINED' || classified.state === 'CANCELLED') {
          finish({ state: classified.state, message: classified.message, details: { raw: saleText.slice(0, 1200) } });
          return;
        }
      }

      // C++ guide equivalent: after uncertainty, do reset + last status.
      // Try these commands across transport variants as some RX5000 setups only
      // answer on one framing mode.
      patch({
        state: 'IN_PROGRESS',
        message: forceRecovery
          ? 'Sale still processing without final response. Starting status recovery...'
          : 'Sale status uncertain. Starting recovery (reset + last transaction status)...',
        details: { saleRaw: saleText.slice(0, 1200), recoveryPending: true },
      });
      await new Promise((r) => setTimeout(r, forceRecovery ? 2000 : this.config.recoveryDelayMs));

      const recoveryTransports = this.getTransportCandidates();
      const tryCommandAcrossTransports = async (command, timeoutMs, rounds = 1) => {
        let lastErr = null;
        for (let r = 0; r < rounds; r += 1) {
          for (let t = 0; t < recoveryTransports.length; t += 1) {
            const transport = recoveryTransports[t];
            try {
              wlLog('Recovery command attempt', {
                round: r + 1,
                transport: transport.label,
                commandPreview: String(command).slice(0, 120),
              });
              // eslint-disable-next-line no-await-in-loop
              const raw = await this.runtime.sendAndRead(command, timeoutMs, transport);
              if (raw) return raw;
            } catch (err) {
              lastErr = err;
              wlLog('Recovery command failed', {
                round: r + 1,
                transport: transport.label,
                error: err?.message || String(err),
              });
            }
          }
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r2) => setTimeout(r2, 500));
        }
        throw lastErr || new Error('Recovery command did not return a response');
      };

      const resetCommand =
        fillTemplate(this.config.resetTemplate, { reference: session.reference, sessionId })
        || buildCtepCommand('RESET_TRANSACTION');
      await tryCommandAcrossTransports(resetCommand, 6000, 2).catch(() => null);

      const lastStatusCommand =
        fillTemplate(this.config.lastStatusTemplate, { reference: session.reference, sessionId })
        || buildCtepCommand('LAST_TRANSACTION_STATUS');
      const rawLast = await tryCommandAcrossTransports(lastStatusCommand, 10000, 3);
      const lastText = deframeToText(rawLast);
      wlLog('Decoded LAST_TRANSACTION_STATUS response text', { text: lastText.slice(0, 2000) });
      const recovered = this.classifyResponseText(lastText);
      if (recovered.state === 'APPROVED' || recovered.state === 'DECLINED') {
        finish({
          state: recovered.state,
          message: `${recovered.message} (Recovered via last transaction status)`,
          details: { raw: lastText.slice(0, 1200), recovered: true },
        });
        return;
      }
      finish({
        state: 'ERROR',
        message: 'Sale uncertain and recovery did not return a final status.',
        details: { saleRaw: saleText.slice(0, 1200), lastRaw: lastText.slice(0, 1200) },
      });
    } catch (err) {
      finish({
        state: 'ERROR',
        message: err?.message || 'C-TEP transaction error',
        details: { error: err?.message || String(err) },
      });
    }
  }

  getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
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
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, message: 'Session not found' };
    if (session.completed) return { success: false, message: 'Transaction already completed' };
    session.cancelRequested = true;
    session.state = 'CANCELLED';
    session.message = 'Cancellation requested...';
    this.sessions.set(sessionId, session);
    try {
      const cancelCmd =
        fillTemplate(this.config.cancelTemplate, { reference: session.reference, merchantRef: session.reference, sessionId })
        || buildCtepCommand('CANCEL_RETAIL', { merchantRef: session.reference });
      await this.runtime.sendAndRead(cancelCmd, 20000);
    } catch {
      // Best effort cancel as with CTEP interaction constraints.
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
