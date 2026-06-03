import crypto from 'crypto';
import http from 'http';
import https from 'https';

const sharedSessions = new Map();

function createSessionId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `viva-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
}

const EVENT_ID_MESSAGES = {
  1000: 'Transaction canceled by user.',
  1001: 'Terminal SDK is busy.',
  1003: 'Terminal timed out.',
  1004: 'Transaction declined by terminal.',
  1006: 'Transaction declined by server.',
  1007: 'Transaction declined by card.',
  1016: 'Transaction aborted.',
  1019: 'Try another card.',
  1020: 'Insufficient funds.',
  1099: 'Generic transaction error.',
  3000: 'Terminal is not connected.',
  3001: 'Terminal connection error.',
  3002: 'Terminal connection timeout.',
  3099: 'Generic terminal error.',
  4000: 'Network connection error.',
  6000: 'Wrong request parameters.',
};

function parseBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;
  const v = String(value).trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return fallback;
}

function parseTerminalConnection(connectionString) {
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

  const ip = String(config.ip || config.host || '').trim();
  if (!ip) throw new Error('Viva IP address not found in terminal configuration.');

  const parsedPort = Number.parseInt(String(config.port || '9564').trim(), 10);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 9564;
  const protocolRaw = String(config.protocol || '').trim().toLowerCase();
  const protocol = protocolRaw === 'http' ? 'http' : 'https';
  const timeoutRaw = Number.parseInt(String(config.timeoutMs || config.timeout || '60000').trim(), 10);
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 60000;
  const rejectUnauthorized = parseBool(config.rejectUnauthorized, false);
  const currencyCodeRaw = String(config.currencyCode || '978').trim();
  const currencyCode = currencyCodeRaw || '978';
  const showTransactionResult = parseBool(config.showTransactionResult, true);
  const showReceipt = parseBool(config.showReceipt, true);
  const paymentMethod = String(config.paymentMethod || 'CardPresent').trim() || 'CardPresent';
  const merchantReferencePrefix = String(config.merchantReferencePrefix || 'POS').trim() || 'POS';
  const customerTrnsPrefix = String(config.customerTrnsPrefix || 'POS payment').trim() || 'POS payment';

  return {
    ip,
    port,
    protocol,
    timeoutMs,
    rejectUnauthorized,
    currencyCode,
    showTransactionResult,
    showReceipt,
    paymentMethod,
    merchantReferencePrefix,
    customerTrnsPrefix,
  };
}

function normalizeErrorMessage(message, details = null) {
  const msg = String(message || '').trim();
  if (!msg && details?.eventId != null) {
    return EVENT_ID_MESSAGES[details.eventId] || `Terminal error (${details.eventId}).`;
  }
  return msg || 'Viva transaction error.';
}

function mapSessionState(vivaState, saleResponse = null) {
  const state = String(vivaState || '').toUpperCase();
  if (state === 'PROCESSING' || state === 'PENDING') return 'IN_PROGRESS';
  if (state === 'SUCCESS') {
    if (saleResponse && (saleResponse.isSuccess === false || saleResponse.merchantApproved === false)) {
      return 'DECLINED';
    }
    return 'APPROVED';
  }
  if (state === 'CANCELLED' || state === 'ABORTED') return 'CANCELLED';
  if (state === 'FAILED' || state === 'FAILURE' || state === 'DECLINED') return 'DECLINED';
  if (state === 'ERROR') return 'ERROR';
  return 'IN_PROGRESS';
}

function inferMessageFromSaleResponse(saleResponse, fallbackState) {
  if (!saleResponse || typeof saleResponse !== 'object') {
    if (fallbackState === 'APPROVED') return 'Payment approved.';
    if (fallbackState === 'DECLINED') return 'Payment declined.';
    if (fallbackState === 'CANCELLED') return 'Payment cancelled.';
    if (fallbackState === 'ERROR') return 'Error during payment.';
    return 'Payment in progress on terminal...';
  }

  const eventId = Number(saleResponse.eventId);
  const rawMessage = String(saleResponse.message || '').trim();
  if (fallbackState === 'APPROVED') return rawMessage || 'Payment approved.';
  if (fallbackState === 'DECLINED' || fallbackState === 'ERROR') {
    if (rawMessage) return rawMessage;
    if (Number.isFinite(eventId) && EVENT_ID_MESSAGES[eventId]) return EVENT_ID_MESSAGES[eventId];
    return fallbackState === 'DECLINED' ? 'Payment declined.' : 'Error during payment.';
  }
  if (fallbackState === 'CANCELLED') return rawMessage || 'Payment cancelled.';
  return rawMessage || 'Payment in progress on terminal...';
}

function requestJson(config, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const mod = config.protocol === 'https' ? https : http;
    const payload = body == null ? null : JSON.stringify(body);
    const req = mod.request(
      {
        host: config.ip,
        port: config.port,
        method,
        path,
        headers: payload
          ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          }
          : {},
        timeout: config.timeoutMs,
        rejectUnauthorized: config.rejectUnauthorized,
      },
      (res) => {
        let chunks = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          chunks += chunk;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = chunks ? JSON.parse(chunks) : null;
          } catch {
            parsed = null;
          }
          resolve({
            status: Number(res.statusCode || 0),
            ok: Number(res.statusCode || 0) >= 200 && Number(res.statusCode || 0) < 300,
            body: parsed,
            raw: chunks,
          });
        });
      },
    );

    req.on('timeout', () => {
      req.destroy(new Error('Viva terminal request timeout.'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (payload) req.write(payload);
    req.end();
  });
}

class VivaP2PService {
  constructor(config) {
    this.config = config;
    this.sessions = sharedSessions;
  }

  async testConnection() {
    const probeSessionId = createSessionId();
    try {
      const response = await requestJson(this.config, 'GET', `/pos/v1/sessions/${encodeURIComponent(probeSessionId)}`);
      if (response.status === 400 || response.status === 404 || response.ok) {
        return { success: true, message: 'Viva terminal is reachable.' };
      }
      const errorText =
        response.body?.message ||
        response.body?.error ||
        (response.raw ? String(response.raw).slice(0, 200) : `HTTP ${response.status}`);
      return { success: false, message: `Viva terminal probe failed: ${errorText}` };
    } catch (err) {
      return { success: false, message: `Viva connection failed: ${err.message}` };
    }
  }

  createSession(amountEuro) {
    const amount = Number(amountEuro);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: 'Invalid amount for Viva.' };
    }

    const amountInCents = Math.round(amount * 100);
    const sessionId = createSessionId();
    const localSession = {
      id: sessionId,
      amountInCents,
      state: 'IN_PROGRESS',
      message: 'Starting payment...',
      details: null,
      completed: false,
      createdAt: Date.now(),
    };
    this.sessions.set(sessionId, localSession);

    const payload = {
      sessionId,
      amount: amountInCents,
      merchantReference: `${this.config.merchantReferencePrefix}-${sessionId}`,
      customerTrns: `${this.config.customerTrnsPrefix}-${sessionId.slice(0, 8)}`,
      paymentMethod: this.config.paymentMethod,
      showTransactionResult: this.config.showTransactionResult,
      showReceipt: this.config.showReceipt,
      currencyCode: this.config.currencyCode,
    };

    requestJson(this.config, 'POST', '/pos/v1/sale', payload)
      .then((response) => {
        const current = this.sessions.get(sessionId) || localSession;
        if (!response.ok) {
          current.state = 'ERROR';
          current.completed = true;
          current.details = response.body || response.raw || null;
          current.message = normalizeErrorMessage(response.body?.message || response.body?.error || `Viva start failed (HTTP ${response.status}).`, response.body);
          this.sessions.set(sessionId, current);
          return;
        }

        const remoteState = String(response.body?.state || '').toUpperCase();
        if (remoteState && remoteState !== 'PROCESSING') {
          const mapped = mapSessionState(remoteState, response.body?.payloadData?.saleResponse || null);
          current.state = mapped;
          current.completed = mapped !== 'IN_PROGRESS';
          current.details = response.body || null;
          current.message = inferMessageFromSaleResponse(response.body?.payloadData?.saleResponse || null, mapped);
        } else {
          current.state = 'IN_PROGRESS';
          current.completed = false;
          current.details = response.body || null;
          current.message = 'Payment in progress on terminal...';
        }
        this.sessions.set(sessionId, current);
      })
      .catch((err) => {
        const current = this.sessions.get(sessionId) || localSession;
        current.state = 'ERROR';
        current.completed = true;
        current.details = { error: err.message };
        current.message = normalizeErrorMessage(err.message);
        this.sessions.set(sessionId, current);
      });

    return {
      success: true,
      sessionId,
      data: {
        state: localSession.state,
        message: localSession.message,
        amountInCents,
      },
    };
  }

  async getSessionStatus(sessionId) {
    if (!sessionId) {
      return { success: false, ok: false, message: 'Session ID is required.' };
    }
    const local = this.sessions.get(sessionId);

    try {
      const response = await requestJson(
        this.config,
        'GET',
        `/pos/v1/sessions/${encodeURIComponent(sessionId)}`,
      );

      if (!response.ok) {
        if (local) {
          if (response.status >= 500) {
            return {
              success: true,
              ok: true,
              provider: 'viva',
              sessionId,
              amountInCents: local.amountInCents,
              state: local.state,
              message: local.message,
              details: local.details,
            };
          }
          return {
            success: false,
            ok: false,
            message: response.body?.message || response.body?.error || `Unable to fetch session (HTTP ${response.status}).`,
          };
        }
        return {
          success: false,
          ok: false,
          message: response.body?.message || response.body?.error || `Session not found (HTTP ${response.status}).`,
        };
      }

      const saleResponse = response.body?.payloadData?.saleResponse || null;
      const mappedState = mapSessionState(response.body?.state, saleResponse);
      const details = response.body || null;
      const message = inferMessageFromSaleResponse(saleResponse, mappedState);

      const nextLocal = local || {
        id: sessionId,
        amountInCents: Number(saleResponse?.amount) || 0,
        createdAt: Date.now(),
      };
      nextLocal.state = mappedState;
      nextLocal.message = message;
      nextLocal.details = details;
      nextLocal.completed = mappedState !== 'IN_PROGRESS';
      this.sessions.set(sessionId, nextLocal);

      if (nextLocal.completed) {
        setTimeout(() => {
          this.sessions.delete(sessionId);
        }, 5 * 60 * 1000);
      }

      return {
        success: true,
        ok: true,
        provider: 'viva',
        sessionId,
        amountInCents: nextLocal.amountInCents,
        state: mappedState,
        message,
        details,
      };
    } catch (err) {
      if (!local) {
        return {
          success: false,
          ok: false,
          message: normalizeErrorMessage(err.message),
        };
      }
      return {
        success: true,
        ok: true,
        provider: 'viva',
        sessionId,
        amountInCents: local.amountInCents,
        state: local.state,
        message: local.message,
        details: local.details,
      };
    }
  }

  async cancelSession(sessionId) {
    if (!sessionId) return { success: false, message: 'Session ID is required.' };
    const local = this.sessions.get(sessionId);

    try {
      const response = await requestJson(this.config, 'POST', '/pos/v1/abort', { sessionId });
      if (!response.ok) {
        const message =
          response.body?.message ||
          response.body?.error ||
          `Unable to abort session (HTTP ${response.status}).`;
        return { success: false, message };
      }

      const nextLocal = local || {
        id: sessionId,
        amountInCents: 0,
        createdAt: Date.now(),
      };
      nextLocal.state = 'CANCELLED';
      nextLocal.message = 'Payment cancelled.';
      nextLocal.details = response.body || null;
      nextLocal.completed = true;
      this.sessions.set(sessionId, nextLocal);

      setTimeout(() => {
        this.sessions.delete(sessionId);
      }, 2 * 60 * 1000);

      return { success: true, message: 'Payment cancelled.' };
    } catch (err) {
      return { success: false, message: normalizeErrorMessage(err.message) };
    }
  }
}

export function createVivaService(terminal) {
  if (!terminal || !terminal.connection_string) {
    throw new Error('Terminal connection_string is missing.');
  }
  const config = parseTerminalConnection(terminal.connection_string);
  return new VivaP2PService(config);
}
