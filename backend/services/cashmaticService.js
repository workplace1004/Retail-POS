/**
 * Cashmatic payment service – same logic as 123 server.
 * Uses terminal config (connection_string JSON: ip, port, username, password) to talk to Cashmatic device HTTPS API.
 */
import https from 'https';
import axios from 'axios';

const sharedSessions = new Map();

function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

class CashmaticServiceInstance {
  constructor(config) {
    this.config = config || {};
    this.sessions = sharedSessions;
  }

  getBaseUrl() {
    const ip = this.config.ip;
    const port = this.config.port || '50301';
    return `https://${ip}:${port}`;
  }

  getHttpClient() {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    return axios.create({ httpsAgent, timeout: 5000 });
  }

  async testConnection() {
    try {
      await this.login();
      return { success: true, message: 'Connection successful' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async login() {
    const client = this.getHttpClient();
    const baseUrl = this.getBaseUrl();
    if (!this.config.username || !this.config.password) {
      throw new Error('Cashmatic username/password not configured.');
    }
    const res = await client.post(`${baseUrl}/api/user/Login`, {
      username: this.config.username,
      password: this.config.password,
    });
    const data = res.data || {};
    const token =
      data.token || data.accessToken || data.jwt || data.bearer || data.Token ||
      (data.data && (data.data.token || data.data.accessToken || data.data.jwt)) ||
      (typeof data === 'string' ? data : null);
    if (!token) throw new Error('No token in Cashmatic login response.');
    return token;
  }

  async createSession(amountInCents) {
    const token = await this.login();
    const client = this.getHttpClient();
    const baseUrl = this.getBaseUrl();
    await client.post(
      `${baseUrl}/api/transaction/StartPayment`,
      { reason: 'POS payment', reference: `POS-${Date.now()}`, amount: amountInCents, queueAllowed: false },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const sessionId = generateSessionId();
    this.sessions.set(sessionId, {
      token,
      amount: amountInCents,
      state: 'IN_PROGRESS',
      createdAt: Date.now(),
      insertedAmount: 0,
      dispensedAmount: 0,
      notDispensedAmount: 0,
    });
    return { success: true, sessionId };
  }

  async getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, state: 'ERROR', message: 'Session not found' };

    const client = this.getHttpClient();
    const baseUrl = this.getBaseUrl();
    try {
      const res = await client.post(`${baseUrl}/api/device/ActiveTransaction`, null, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const body = res.data || {};
      const data = body.data || body;
      const operation = (data.operation || body.operation || '').toString().toUpperCase();
      let requested = Number(data.requested ?? session.amount) || session.amount;
      let inserted = Number(data.inserted ?? 0) || 0;
      const dispensed = Number(data.dispensed ?? data.dispensedAmount ?? data.paymentDispensed ?? 0);
      const notDispensed = Number(data.notDispensed ?? data.notDispensedAmount ?? data.paymentNotDispensed ?? 0);
      if (requested > 0) session.amount = requested;
      if (inserted > 0) session.insertedAmount = inserted;
      if (dispensed > 0) session.dispensedAmount = dispensed;
      if (notDispensed > 0) session.notDispensedAmount = notDispensed;
      const effectiveRequested = requested > 0 ? requested : session.amount;
      const effectiveInserted = inserted > 0 ? inserted : session.insertedAmount;
      let state = session.state || 'IN_PROGRESS';
      if (operation && operation !== 'IDLE') {
        state = effectiveRequested > 0 && effectiveInserted >= effectiveRequested ? 'PAID' : 'IN_PROGRESS';
      } else {
        if (effectiveRequested > 0 && effectiveInserted >= effectiveRequested) {
          state = (session.notDispensedAmount > 0 || notDispensed > 0) ? 'FINISHED_MANUAL' : 'FINISHED';
        } else if (session.state === 'PAID' || session.state === 'FINISHED' || session.state === 'FINISHED_MANUAL') {
          state = session.state;
        } else if (effectiveInserted > 0 && effectiveInserted < effectiveRequested) {
          state = 'CANCELLED';
        } else if (requested === 0 && inserted === 0 && session.insertedAmount >= session.amount && session.amount > 0) {
          state = session.notDispensedAmount > 0 ? 'FINISHED_MANUAL' : 'FINISHED';
        }
      }
      session.state = state;
      this.sessions.set(sessionId, session);
      return {
        success: true,
        state,
        requestedAmount: requested || session.amount || 0,
        insertedAmount: inserted || session.insertedAmount || 0,
        dispensedAmount: session.dispensedAmount || 0,
        notDispensedAmount: session.notDispensedAmount || 0,
      };
    } catch (err) {
      session.state = session.state || 'IN_PROGRESS';
      this.sessions.set(sessionId, session);
      return {
        success: false,
        state: 'ERROR',
        requestedAmount: session.amount,
        insertedAmount: session.insertedAmount || 0,
        dispensedAmount: session.dispensedAmount || 0,
        notDispensedAmount: session.notDispensedAmount || 0,
        message: err.message || 'Error communicating with Cashmatic',
      };
    }
  }

  async cancelSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, state: 'ERROR', message: 'Session not found' };
    try {
      const client = this.getHttpClient();
      const baseUrl = this.getBaseUrl();
      await client.post(`${baseUrl}/api/transaction/CancelPayment`, null, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
    } catch (err) {
      console.error('Cashmatic cancelSession:', err.message);
    }
    session.state = 'CANCELLED';
    this.sessions.set(sessionId, session);
    return { success: true, state: 'CANCELLED' };
  }

  async commitAndRemoveSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, message: 'Session not found' };
    try {
      const client = this.getHttpClient();
      const baseUrl = this.getBaseUrl();
      await client.post(`${baseUrl}/api/transaction/CommitPayment`, null, {
        headers: { Authorization: `Bearer ${session.token}` },
        timeout: 3000,
      });
    } catch (err) {
      console.error('Cashmatic CommitPayment:', err.message);
    }
    this.sessions.delete(sessionId);
    return { success: true };
  }
}

/**
 * @param {Object} terminal - { connection_string, connection_type? } (connection_string = JSON with ip, port, username, password)
 */
export function createCashmaticService(terminal) {
  if (!terminal || !terminal.connection_string) {
    throw new Error('Terminal connection_string is missing.');
  }
  let config = {};
  const connectionString = terminal.connection_string;
  try {
    if (typeof connectionString === 'string') {
      try {
        config = JSON.parse(connectionString);
      } catch (e) {
        if (connectionString.startsWith('tcp://')) {
          const match = connectionString.match(/tcp:\/\/([^:]+):?(\d+)?/);
          if (match) config = { ip: match[1], port: match[2] || '' };
        } else if (connectionString.trim() !== '') {
          config = { ip: connectionString.trim() };
        }
      }
    } else if (connectionString && typeof connectionString === 'object') {
      config = connectionString;
    }
    const get = (...keys) => {
      for (const k of keys) {
        if (config[k] != null && config[k] !== '') return String(config[k]).trim();
        const lower = k.toLowerCase();
        for (const ck of Object.keys(config)) {
          if (ck.toLowerCase() === lower && config[ck] != null && config[ck] !== '') return String(config[ck]).trim();
        }
      }
      return '';
    };
    const urlValue = get('url', 'apiUrl', 'api_url', 'endpoint');
    let parsedUrl = null;
    if (urlValue) {
      try {
        parsedUrl = new URL(urlValue);
      } catch {
        parsedUrl = null;
      }
    }
    const ip = get('ip', 'ipAddress', 'ip_address', 'IP') || parsedUrl?.hostname || '';
    const username =
      get('username', 'userName', 'user_name', 'USERNAME', 'user', 'login', 'account') ||
      parsedUrl?.username ||
      '';
    const password =
      get('password', 'Password', 'PASSWORD', 'pass', 'pwd', 'secret') ||
      parsedUrl?.password ||
      '';
    const port = get('port', 'Port', 'PORT') || (parsedUrl?.port ? String(parsedUrl.port) : '');
    if (!ip) throw new Error('Cashmatic IP address not found in terminal configuration.');
    if (!username || !password) throw new Error('Cashmatic username/password not found in terminal configuration.');
    return new CashmaticServiceInstance({ ip, username, password, port: port || '50301' });
  } catch (err) {
    throw new Error(`Failed to parse Cashmatic configuration: ${err.message}`);
  }
}
