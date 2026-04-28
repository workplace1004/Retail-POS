import net from 'net';

const sharedSessions = new Map();
let requestCounter = 1;

const OPI_NS = 'http://www.nrf-arts.org/IXRetail/namespace';

function normalizeErrorMessage(message) {
  if (!message || typeof message !== 'string') return message || 'Transaction error';
  const msg = message.toLowerCase().trim();
  if (msg.includes('declined') || msg.includes('failure')) return 'Payment declined';
  if (msg.includes('cancel') || msg.includes('aborted')) return 'Payment cancelled';
  if (msg.includes('timeout')) return 'Connection timeout';
  if (msg.includes('management') || msg.includes('deviceunavailable')) return 'Terminal temporarily unavailable';
  return message;
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseTerminalConnection(connectionString, defaults = {}) {
  let config = {};
  if (typeof connectionString === 'string') {
    try {
      config = JSON.parse(connectionString);
    } catch {
      if (connectionString.startsWith('tcp://')) {
        const match = connectionString.match(/tcp:\/\/([^:]+):?(\d+)?/i);
        if (match) config = { ip: match[1], commandPort: match[2] || '' };
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
  if (!ip) throw new Error('CCV IP address not found in terminal configuration.');

  const commandPortRaw = get('commandPort', 'channel0Port', 'port');
  const devicePortRaw = get('devicePort', 'channel1Port', 'posDevicePort');
  const workstationId = get('workstationId', 'workstationID', 'posId') || String(defaults.workstationId || 'POS');
  const languageCode = (get('languageCode', 'language') || String(defaults.languageCode || 'en')).toLowerCase();
  const currencyCode = (get('currencyCode', 'currency') || String(defaults.currencyCode || 'EUR')).toUpperCase();
  const timeoutMsRaw = get('timeoutMs', 'timeout', 'timeout_ms');
  const bindAddress = get('bindAddress', 'posBindAddress') || String(defaults.bindAddress || '0.0.0.0');

  const commandPort = Number.parseInt(commandPortRaw || '0', 10);
  const devicePort = Number.parseInt(devicePortRaw || '0', 10);
  const timeoutMs = Number.parseInt(timeoutMsRaw || String(defaults.timeoutMs || ''), 10);

  return {
    ip,
    commandPort: Number.isFinite(commandPort) && commandPort > 0 ? commandPort : 4100,
    devicePort: Number.isFinite(devicePort) && devicePort > 0 ? devicePort : 4102,
    workstationId: workstationId.slice(0, 16) || 'POS',
    languageCode: ['nl', 'en', 'de', 'fr'].includes(languageCode) ? languageCode : 'en',
    currencyCode: currencyCode || 'EUR',
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120000,
    bindAddress,
  };
}

function nextRequestId() {
  requestCounter = (requestCounter % 9) + 1;
  return `P${String(Date.now()).slice(-8)}${requestCounter}`;
}

function extractTagAttributes(xml, tagName) {
  const regex = new RegExp(`<(?:[\\w-]+:)?${tagName}\\b([^>]*)>`, 'i');
  const match = xml.match(regex);
  if (!match) return {};
  const attrs = {};
  const attrRegex = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = attrRegex.exec(match[1])) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function buildCardServiceRequestXml(config, requestType, requestId, amount) {
  const timestamp = new Date().toISOString();
  const amountLine = requestType === 'CardPayment'
    ? `\n  <TotalAmount Currency="${escapeXml(config.currencyCode)}">${Number(amount).toFixed(2)}</TotalAmount>\n  <CardCircuitCollection>\n  </CardCircuitCollection>`
    : '';
  return `<?xml version="1.0" encoding="utf-8"?>
<CardServiceRequest WorkstationID="${escapeXml(config.workstationId)}" RequestID="${escapeXml(requestId)}" RequestType="${escapeXml(requestType)}" xmlns="${OPI_NS}">
  <POSdata LanguageCode="${escapeXml(config.languageCode)}">
    <POSTimeStamp>${escapeXml(timestamp)}</POSTimeStamp>
    <ShiftNumber>0</ShiftNumber>
    <PrinterStatus>Available</PrinterStatus>
    <JournalPrinterStatus>Available</JournalPrinterStatus>
    <E-JournalStatus>Available</E-JournalStatus>
  </POSdata>${amountLine}
</CardServiceRequest>`;
}

function buildServiceRequestGetStatusXml(config, requestId) {
  const timestamp = new Date().toISOString();
  return `<?xml version="1.0" encoding="utf-8"?>
<ServiceRequest WorkstationID="${escapeXml(config.workstationId)}" RequestID="${escapeXml(requestId)}" RequestType="GetStatus" xmlns="${OPI_NS}">
  <POSdata LanguageCode="${escapeXml(config.languageCode)}">
    <POSTimeStamp>${escapeXml(timestamp)}</POSTimeStamp>
    <ShiftNumber>0</ShiftNumber>
    <PrinterStatus>Available</PrinterStatus>
  </POSdata>
</ServiceRequest>`;
}

function buildDeviceResponseXml(config, requestXml) {
  const headerAttrs = extractTagAttributes(requestXml, 'DeviceRequest');
  const outputAttrs = extractTagAttributes(requestXml, 'Output');
  const workstationId = headerAttrs.WorkstationID || config.workstationId;
  const requestId = headerAttrs.RequestID || nextRequestId();
  const requestType = headerAttrs.RequestType || 'Output';
  const outDeviceTarget = outputAttrs.OutDeviceTarget || 'CashierDisplay';

  return `<?xml version="1.0" encoding="utf-8"?>
<DeviceResponse WorkstationID="${escapeXml(workstationId)}" RequestID="${escapeXml(requestId)}" RequestType="${escapeXml(requestType)}" OverallResult="Success" xmlns="${OPI_NS}">
  <Output OutDeviceTarget="${escapeXml(outDeviceTarget)}" OutResult="Success">
  </Output>
</DeviceResponse>`;
}

function parseCardServiceResponse(xmlString) {
  const header = extractTagAttributes(xmlString, 'CardServiceResponse');
  const auth = extractTagAttributes(xmlString, 'Authorisation');
  const terminal = extractTagAttributes(xmlString, 'Terminal');
  const overallResult = String(header.OverallResult || '').trim() || 'Failure';
  const upper = overallResult.toUpperCase();
  const approved = upper === 'SUCCESS';
  const cancelled = upper === 'ABORTED';

  let state = 'ERROR';
  if (approved) state = 'APPROVED';
  else if (cancelled) state = 'CANCELLED';
  else if (upper === 'FAILURE' || upper === 'TIMEDOUT') state = 'DECLINED';

  const message = approved
    ? 'Payment approved.'
    : cancelled
      ? 'Payment cancelled.'
      : normalizeErrorMessage(`CCV payment ${overallResult.toLowerCase()}.`);

  return {
    approved,
    cancelled,
    state,
    message,
    overallResult,
    approvalCode: auth.ApprovalCode || null,
    cardCircuit: auth.CardCircuit || null,
    stan: terminal.STAN || null,
    terminalId: terminal.TerminalID || null,
    rawXml: xmlString,
  };
}

class CcvServiceInstance {
  constructor(config) {
    this.config = config;
    this.sessions = sharedSessions;
  }

  packFrame(xml) {
    const xmlBytes = Buffer.from(xml, 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32BE(xmlBytes.length, 0);
    return Buffer.concat([header, xmlBytes]);
  }

  async withDeviceResponder(run) {
    const config = this.config;
    const clients = new Set();
    const server = net.createServer((socket) => {
      clients.add(socket);
      let buffer = Buffer.alloc(0);

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 4) {
          const msgLen = buffer.readUInt32BE(0);
          if (msgLen <= 0 || msgLen > 10 * 1024 * 1024 || buffer.length < 4 + msgLen) return;
          const xmlRequest = buffer.slice(4, 4 + msgLen).toString('utf8');
          buffer = buffer.slice(4 + msgLen);
          if (xmlRequest.includes('<DeviceRequest')) {
            const xmlResponse = buildDeviceResponseXml(config, xmlRequest);
            socket.write(this.packFrame(xmlResponse));
          }
        }
      });
      socket.on('close', () => clients.delete(socket));
      socket.on('error', () => clients.delete(socket));
    });

    await new Promise((resolve, reject) => {
      const onError = (err) => {
        server.removeListener('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        server.removeListener('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(config.devicePort, config.bindAddress);
    });

    try {
      return await run();
    } finally {
      for (const client of clients) {
        try {
          client.destroy();
        } catch {
          // ignore
        }
      }
      await new Promise((resolve) => server.close(() => resolve()));
    }
  }

  sendCommandAndWait(xml, expectedMarkers, timeoutMs) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let buffer = Buffer.alloc(0);
      let settled = false;

      const cleanup = () => {
        socket.removeAllListeners();
        try {
          socket.destroy();
        } catch {
          // ignore
        }
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('CCV timeout - terminal not responding'));
      }, timeoutMs || this.config.timeoutMs);

      socket.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        reject(err);
      });

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 4) {
          const msgLen = buffer.readUInt32BE(0);
          if (msgLen <= 0 || msgLen > 10 * 1024 * 1024) {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              cleanup();
              reject(new Error(`Invalid CCV frame length: ${msgLen}`));
            }
            return;
          }
          if (buffer.length < 4 + msgLen) return;
          const xmlResponse = buffer.slice(4, 4 + msgLen).toString('utf8');
          buffer = buffer.slice(4 + msgLen);

          if (!settled && expectedMarkers.some((marker) => xmlResponse.includes(marker))) {
            settled = true;
            clearTimeout(timer);
            cleanup();
            resolve(xmlResponse);
            return;
          }
        }
      });

      socket.connect(this.config.commandPort, this.config.ip, () => {
        socket.write(this.packFrame(xml));
      });
    });
  }

  async testConnection() {
    try {
      const requestId = nextRequestId();
      const xml = buildServiceRequestGetStatusXml(this.config, requestId);
      const responseXml = await this.sendCommandAndWait(xml, ['<ServiceResponse', ':ServiceResponse'], 10000);
      const ok = responseXml.includes('ServiceResponse');
      return {
        success: ok,
        message: ok ? 'CCV terminal connection successful' : 'CCV status request failed',
      };
    } catch (err) {
      return {
        success: false,
        message: `CCV connection failed: ${err.message}`,
      };
    }
  }

  createSession(amountEuro) {
    const amount = Number(amountEuro);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: 'Invalid amount for CCV' };
    }

    const sessionId = `CCV-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const session = {
      id: sessionId,
      amount,
      requestId: nextRequestId(),
      state: 'IN_PROGRESS',
      message: 'Starting payment...',
      details: null,
      cancelRequested: false,
      completed: false,
    };
    this.sessions.set(sessionId, session);

    this.processPaymentAsync(sessionId).catch((err) => {
      const current = this.sessions.get(sessionId);
      if (!current) return;
      current.state = 'ERROR';
      current.message = normalizeErrorMessage(err.message);
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
        amount,
      },
    };
  }

  async processPaymentAsync(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const xml = buildCardServiceRequestXml(this.config, 'CardPayment', session.requestId, session.amount);
      const responseXml = await this.withDeviceResponder(async () =>
        this.sendCommandAndWait(xml, ['<CardServiceResponse', ':CardServiceResponse'], this.config.timeoutMs),
      );

      const current = this.sessions.get(sessionId);
      if (!current) return;
      if (current.cancelRequested) {
        current.state = 'CANCELLED';
        current.message = 'Payment cancelled.';
        current.completed = true;
        this.sessions.set(sessionId, current);
        return;
      }

      const parsed = parseCardServiceResponse(responseXml);
      current.details = parsed;
      current.state = parsed.state;
      current.message = parsed.message;
      current.completed = true;
      this.sessions.set(sessionId, current);
    } catch (err) {
      const current = this.sessions.get(sessionId);
      if (!current) return;
      current.state = 'ERROR';
      current.message = normalizeErrorMessage(err.message);
      current.details = { error: err.message, code: err.code };
      current.completed = true;
      this.sessions.set(sessionId, current);
    } finally {
      setTimeout(() => {
        this.sessions.delete(sessionId);
      }, 5 * 60 * 1000);
    }
  }

  getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        ok: false,
        message: 'Session not found',
      };
    }
    return {
      success: true,
      ok: true,
      provider: 'ccv',
      sessionId,
      amount: session.amount,
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
      const abortRequestId = nextRequestId();
      const xml = buildCardServiceRequestXml(this.config, 'AbortRequest', abortRequestId, 0);
      await this.sendCommandAndWait(xml, ['<CardServiceResponse', ':CardServiceResponse'], 20000);
      return { success: true, message: 'Payment cancelled.' };
    } catch (err) {
      return { success: false, message: normalizeErrorMessage(err.message) };
    }
  }
}

export function createCcvService(terminal) {
  if (!terminal || !terminal.connection_string) {
    throw new Error('Terminal connection_string is missing.');
  }
  const config = parseTerminalConnection(terminal.connection_string, {
    workstationId: terminal.workstationId || terminal.posId || 'POS',
    languageCode: terminal.languageCode || 'en',
    currencyCode: terminal.currencyCode || 'EUR',
    timeoutMs: terminal.timeoutMs || 120000,
  });
  return new CcvServiceInstance(config);
}

