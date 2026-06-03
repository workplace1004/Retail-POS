import net from 'net';

const sharedSessions = new Map();

function normalizeErrorMessage(message) {
  if (!message || typeof message !== 'string') return message || 'Transaction error';
  const msg = message.toLowerCase().trim();
  if (msg.includes('geweigerd') || msg.includes('declined')) return 'Payment declined';
  if (msg.includes('geannuleerd') || msg.includes('cancelled')) return 'Payment cancelled';
  if (msg.includes('timeout')) return 'Connection timeout';
  if (msg.includes('verbinding') && msg.includes('mislukt')) return 'Connection failed';
  return message;
}

function isIncorrectTransactionParameters(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') return false;
  const match = xmlString.match(/<errorText[^>]*>([^<]+)<\/errorText>/i);
  const text = (match ? match[1] : '').trim().toLowerCase();
  return text.includes('incorrect transaction parameters');
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
  const posId = get('posId', 'pos_id', 'terminalId', 'terminal_id') || String(defaults.posId || '').trim();
  const currencyCode = get('currencyCode', 'currency', 'currency_code') || String(defaults.currencyCode || '').trim();
  const timeoutMsRaw = get('timeoutMs', 'timeout', 'timeout_ms');

  if (!ip) throw new Error('Payworld IP address not found in terminal configuration.');

  const parsedPort = Number.parseInt(portRaw || '0', 10);
  const parsedTimeoutMs = Number.parseInt(timeoutMsRaw || String(defaults.timeoutMs || ''), 10);
  const normalizedPosId = posId || null;
  const normalizedCurrency = (currencyCode || 'EUR').toUpperCase();
  return {
    ip,
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 5015,
    posId: normalizedPosId,
    currencyCode: normalizedCurrency,
    timeoutMs: Number.isFinite(parsedTimeoutMs) && parsedTimeoutMs > 0 ? parsedTimeoutMs : 60000,
  };
}

class PayworldServiceInstance {
  constructor(config) {
    this.config = config;
    this.trxSyncNumber = 1;
    this.sessions = sharedSessions;
  }

  packFrame(xml) {
    const xmlBytes = Buffer.from(xml, 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32BE(xmlBytes.length, 0);
    return Buffer.concat([header, xmlBytes]);
  }

  generatePingXml() {
    const posIdElement = this.config.posId ? `<posId>${this.config.posId}</posId>` : '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<vcs-pos:pingRequest xmlns:vcs-pos="http://www.vibbek.com/pos">
  ${posIdElement}
</vcs-pos:pingRequest>`;
  }

  generateAbortXml() {
    return `<?xml version="1.0" encoding="utf-8"?>
<vcs-device:abortCardEntryNotification xmlns:vcs-device="http://www.vibbek.com/device">
  <abortCode>01</abortCode>
</vcs-device:abortCardEntryNotification>`;
  }

  generateFinancialTrxXml({ amountCents, syncNumber, overrides = {} }) {
    const cfg = {
      ...this.config,
      ...overrides,
    };
    const posIdElement = cfg.posId ? `  <posId>${cfg.posId}</posId>\n` : '';
    const currencyElement = cfg.currencyCode ? `    <currency>${cfg.currencyCode}</currency>\n` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<vcs-pos:financialTrxRequest xmlns:vcs-pos="http://www.vibbek.com/pos">
${posIdElement}  <trxSyncNumber>${syncNumber}</trxSyncNumber>
  <trxData>
    <amount>${amountCents}</amount>
${currencyElement}    <transactionType>0</transactionType>
    <partialApprovalCap>1</partialApprovalCap>
    <noDCC>true</noDCC>
  </trxData>
  <trxInfo>AAAf</trxInfo>
  <receiptFormat>1</receiptFormat>
  <selectedLang>en</selectedLang>
</vcs-pos:financialTrxRequest>`;
  }

  parseFinancialTrxResponse(xmlString) {
    const isFinancial = xmlString.includes('financialTrxResponse') || xmlString.includes('<vcs-pos:financialTrxResponse');
    if (!isFinancial) {
      return { approved: false, error: 'Unexpected terminal response', rawXml: xmlString };
    }

    const stripCdata = (s) => {
      if (s == null) return s;
      const trimmed = String(s).trim();
      const match = trimmed.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
      return (match ? match[1] : trimmed).trim();
    };

    const getTag = (tag) => {
      const re = new RegExp(`<([a-zA-Z0-9_-]+:)?${tag}[^>]*>([\\s\\S]*?)</([a-zA-Z0-9_-]+:)?${tag}>`, 'i');
      const match = xmlString.match(re);
      return match ? stripCdata(match[2]) : null;
    };

    const trxResult = Number.parseInt(getTag('trxResult'), 10);
    const ep2AuthResult = Number.parseInt(getTag('ep2AuthResult'), 10);
    const ep2AuthResponseCode = getTag('ep2AuthResponseCode');
    const ep2AuthCode = getTag('ep2AuthCode');
    const approved = trxResult === 0;

    return {
      approved,
      trxResult: Number.isFinite(trxResult) ? trxResult : null,
      ep2AuthResult: Number.isFinite(ep2AuthResult) ? ep2AuthResult : null,
      ep2AuthResponseCode,
      ep2AuthCode,
      rawXml: xmlString,
      error: approved ? null : `Transaction declined (trxResult=${Number.isFinite(trxResult) ? trxResult : '?'})`,
    };
  }

  sendAndParse(xml, timeoutMs = 60000) {
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
        reject(new Error('Payworld timeout - terminal not responding'));
      }, timeoutMs);

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
              reject(new Error(`Invalid Payworld frame length: ${msgLen}`));
            }
            return;
          }
          if (buffer.length < 4 + msgLen) return;

          const xmlResponse = buffer.slice(4, 4 + msgLen).toString('utf8');
          buffer = buffer.slice(4 + msgLen);

          if (!settled && (xmlResponse.includes('pingResponse') || xmlResponse.includes('financialTrxResponse') || xmlResponse.includes('errorNotification'))) {
            settled = true;
            clearTimeout(timer);
            cleanup();
            resolve(xmlResponse);
            return;
          }
        }
      });

      socket.connect(this.config.port, this.config.ip, () => {
        socket.write(this.packFrame(xml));
      });
    });
  }

  async testConnection() {
    try {
      const xml = this.generatePingXml();
      const responseXml = await this.sendAndParse(xml, 10000);
      const ok = responseXml.includes('pingResponse');
      return {
        success: ok,
        message: ok ? 'Payworld terminal connection successful' : 'Payworld ping failed',
      };
    } catch (err) {
      return {
        success: false,
        message: `Payworld connection failed: ${err.message}`,
      };
    }
  }

  createSession(amountEuro) {
    const amount = Number(amountEuro);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: 'Invalid amount for Payworld' };
    }

    const amountCents = Math.round(amount * 100);
    this.trxSyncNumber = (this.trxSyncNumber + 1) % 1000000 || 1;
    const sessionId = `PAYWORLD-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const session = {
      id: sessionId,
      amountCents,
      trxSyncNumber: this.trxSyncNumber,
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
        amountInCents: amountCents,
      },
    };
  }

  async processPaymentAsync(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const xml = this.generateFinancialTrxXml({
      amountCents: session.amountCents,
      syncNumber: session.trxSyncNumber,
    });

    try {
      let responseXml = await this.sendAndParse(xml, this.config.timeoutMs || 120000);
      const current = this.sessions.get(sessionId);
      if (!current) return;
      if (current.cancelRequested) {
        current.state = 'CANCELLED';
        current.message = 'Payment cancelled.';
        current.completed = true;
        this.sessions.set(sessionId, current);
        return;
      }

      if (responseXml.includes('errorNotification') && isIncorrectTransactionParameters(responseXml)) {
        const fallbackXml = this.generateFinancialTrxXml({
          amountCents: session.amountCents,
          syncNumber: session.trxSyncNumber,
          overrides: {
            posId: null,
            currencyCode: this.config.currencyCode === 'EUR' ? '978' : this.config.currencyCode,
          },
        });
        responseXml = await this.sendAndParse(fallbackXml, this.config.timeoutMs || 120000);
      }

      if (responseXml.includes('errorNotification')) {
        const match = responseXml.match(/<errorText[^>]*>([^<]+)<\/errorText>/i);
        current.state = 'ERROR';
        current.message = normalizeErrorMessage(match ? match[1].trim() : 'Terminal error');
        current.details = { rawXml: responseXml };
        current.completed = true;
        this.sessions.set(sessionId, current);
        return;
      }

      const parsed = this.parseFinancialTrxResponse(responseXml);
      current.details = parsed;
      current.state = parsed.approved ? 'APPROVED' : 'DECLINED';
      current.message = parsed.approved ? 'Payment approved.' : normalizeErrorMessage(parsed.error || 'Payment declined.');
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
      provider: 'payworld',
      sessionId,
      amountInCents: session.amountCents,
      state: session.state,
      message: session.message,
      details: session.details,
      cancelRequested: session.cancelRequested,
    };
  }

  async sendAbortStandalone(config = this.config) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(10000);
      socket.on('error', (err) => {
        try {
          socket.destroy();
        } catch {
          // ignore
        }
        reject(err);
      });
      socket.on('timeout', () => {
        try {
          socket.destroy();
        } catch {
          // ignore
        }
        reject(new Error('Timeout while sending Payworld abort.'));
      });
      socket.connect(config.port, config.ip, () => {
        socket.write(this.packFrame(this.generateAbortXml()), () => {
          socket.end();
          resolve();
        });
      });
    });
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
      await this.sendAbortStandalone(session.config || this.config);
      return { success: true, message: 'Payment cancelled.' };
    } catch (err) {
      return { success: false, message: normalizeErrorMessage(err.message) };
    }
  }
}

export function createPayworldService(terminal) {
  if (!terminal || !terminal.connection_string) {
    throw new Error('Terminal connection_string is missing.');
  }
  const config = parseTerminalConnection(terminal.connection_string, {
    posId: terminal.posId || terminal.terminalId || '',
    currencyCode: terminal.currencyCode || 'EUR',
    timeoutMs: terminal.timeoutMs || 60000,
  });
  return new PayworldServiceInstance(config);
}

