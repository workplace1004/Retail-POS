import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import os from 'os';
import net from 'net';
import path from 'path';
import { writeFile, unlink, copyFile, access, readFile } from 'fs/promises';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { createCashmaticService } from './services/cashmaticService.js';
import { createPayworldService } from './services/payworldService.js';
import { createCcvService } from './services/ccvService.js';
import { createVivaService } from './services/vivaService.js';
import { buildPeriodicReportReceiptLines } from './periodicReportReceipt.js';
import { buildPeriodicReportWebSections } from './periodicReportWebSections.js';
import { buildFinancialReportReceiptLines } from './financialReportReceipt.js';
import {
  signWebpanelJwt,
  verifyWebpanelJwt,
  verifyWebpanelPassword,
  hashWebpanelPassword,
} from './lib/webpanelAuth.js';
import { signPosTerminalJwt, verifyPosTerminalJwt } from './lib/posTerminalAuth.js';

const WEBPANEL_AVATAR_MAX_LEN = 500000;

function webpanelUserIdFromBearer(req) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return null;
  const payload = verifyWebpanelJwt(auth.slice(7).trim());
  return payload?.sub || null;
}

function serializeWebpanelUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name || u.email,
    avatarDataUrl: u.avatarDataUrl || null,
  };
}

function isValidWebpanelEmail(email) {
  const s = String(email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Normalize client IP for comparison with `PosRegister.ipAddress` (IPv4 + loopback aliases). */
function normalizePosRegisterIp(ip) {
  const raw = String(ip || '')
    .trim()
    .toLowerCase()
    .replace(/^::ffff:/i, '');
  if (raw === '::1' || raw === '0:0:0:0:0:0:0:1') return '127.0.0.1';
  return raw;
}

function getPosClientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)[0];
  const raw = xf || req.socket?.remoteAddress || '';
  return normalizePosRegisterIp(raw);
}

function posTerminalRegisterIdFromBearer(req) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return null;
  const payload = verifyPosTerminalJwt(auth.slice(7).trim());
  return payload?.r || null;
}

async function resolvePosRegisterFromTerminalBearer(req) {
  const id = posTerminalRegisterIdFromBearer(req);
  if (!id) return null;
  return prisma.posRegister.findUnique({
    where: { id },
    select: { id: true, name: true, ipAddress: true },
  });
}

/** PosRegister id for new orders: terminal JWT first, else client IP match. */
async function resolvePosRegisterIdForOrder(req) {
  const fromToken = posTerminalRegisterIdFromBearer(req);
  if (fromToken) {
    const ok = await prisma.posRegister.findUnique({ where: { id: fromToken }, select: { id: true } });
    if (ok) return ok.id;
  }
  const ip = getPosClientIp(req);
  if (!ip) return null;
  const reg = await prisma.posRegister.findFirst({ where: { ipAddress: ip }, select: { id: true } });
  return reg?.id ?? null;
}

/** POS REST API only: no license issuance/activation routes and no imports from a license server package. */

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** KDS admin station (fixed id); login name `admin`, default PIN `1234` — not shown as a normal station tab. */
const KITCHEN_KDS_ADMIN_ID = 'kitchen-kds-admin';

/** Order lines include product + category (KDS consolidation / grouping). */
const orderItemsInclude = { include: { product: { include: { category: true } } } };

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  // Allow browser + mobile clients (RN/installed APK) to connect from LAN IPs.
  cors: { origin: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }
});

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.set('trust proxy', 1);

/** Lightweight reachability check for KDS / tablets (no DB). */
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

/** POS retail: is this request's IP a registered terminal? (Public; used before PIN login.) */
app.get('/api/pos-registers/current-device', async (req, res) => {
  try {
    const clientIp = getPosClientIp(req);
    const registersConfigured = await prisma.posRegister.count();
    const tokenReg = await resolvePosRegisterFromTerminalBearer(req);
    if (tokenReg) {
      return res.json({
        registersConfigured,
        deviceAllowed: true,
        clientIp,
        register: { id: tokenReg.id, name: tokenReg.name || tokenReg.ipAddress },
      });
    }
    if (registersConfigured === 0) {
      return res.json({
        registersConfigured: 0,
        deviceAllowed: false,
        clientIp,
        register: null,
      });
    }
    const reg = await prisma.posRegister.findFirst({
      where: { ipAddress: clientIp },
      select: { id: true, name: true, ipAddress: true },
    });
    return res.json({
      registersConfigured,
      deviceAllowed: Boolean(reg),
      clientIp,
      register: reg ? { id: reg.id, name: reg.name || reg.ipAddress } : null,
    });
  } catch (err) {
    console.error('GET /api/pos-registers/current-device', err);
    return res.status(500).json({ error: err.message || 'Failed to verify device' });
  }
});

/** After manual register name + IP check, issue a short-lived JWT so `/users` and PIN login work when detected LAN IP ≠ stored register IP. */
app.post('/api/pos-registers/terminal-bind', async (req, res) => {
  try {
    const name = String(req.body?.name ?? '').trim();
    const ip = normalizePosRegisterIp(req.body?.ip ?? req.body?.ipAddress ?? '');
    if (!name || !ip) {
      return res.status(400).json({ error: 'Register name and IP address are required.' });
    }
    const registersConfigured = await prisma.posRegister.count();
    if (registersConfigured === 0) {
      return res.status(403).json({ error: 'No POS registers are configured.' });
    }
    const reg = await prisma.posRegister.findFirst({
      where: { ipAddress: ip },
      select: { id: true, name: true, ipAddress: true },
    });
    if (!reg) {
      return res.status(401).json({ error: 'Invalid register name or IP address.' });
    }
    const regNameNorm = String(reg.name || '').trim().toLowerCase();
    if (regNameNorm !== name.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid register name or IP address.' });
    }
    const token = signPosTerminalJwt({ r: reg.id });
    return res.json({
      token,
      register: { id: reg.id, name: reg.name || reg.ipAddress, ipAddress: reg.ipAddress },
    });
  } catch (err) {
    console.error('POST /api/pos-registers/terminal-bind', err);
    return res.status(500).json({ error: err.message || 'Failed to bind terminal' });
  }
});

/** Webpanel e-mail + password login (user rows in `WebpanelUser`; seed creates retail@pos.com). */
app.post('/api/webpanel/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required.' });
    }
    const user = await prisma.webpanelUser.findUnique({ where: { email } });
    if (!user || !verifyWebpanelPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = signWebpanelJwt({ sub: user.id, email: user.email });
    return res.json({
      token,
      user: serializeWebpanelUser(user),
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Login failed.' });
  }
});

app.get('/api/webpanel/auth/me', async (req, res) => {
  try {
    const auth = String(req.headers.authorization || '');
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const payload = verifyWebpanelJwt(auth.slice(7).trim());
    if (!payload?.sub) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await prisma.webpanelUser.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.json({ user: serializeWebpanelUser(user) });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Session check failed.' });
  }
});

app.patch('/api/webpanel/auth/profile', async (req, res) => {
  try {
    const id = webpanelUserIdFromBearer(req);
    if (!id) return res.status(401).json({ error: 'Unauthorized' });
    const data = {};
    if (req.body?.name !== undefined) {
      data.name = String(req.body.name).trim().slice(0, 120);
    }
    if (req.body?.avatarDataUrl !== undefined) {
      const raw = req.body.avatarDataUrl;
      if (raw === null || raw === '') {
        data.avatarDataUrl = null;
      } else {
        const s = String(raw);
        if (!s.startsWith('data:image/')) {
          return res.status(400).json({ error: 'Avatar must be a data URL image (data:image/...).' });
        }
        if (s.length > WEBPANEL_AVATAR_MAX_LEN) {
          return res.status(400).json({ error: 'Avatar image is too large.' });
        }
        data.avatarDataUrl = s;
      }
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }
    const user = await prisma.webpanelUser.update({ where: { id }, data });
    return res.json({ user: serializeWebpanelUser(user) });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Profile update failed.' });
  }
});

app.patch('/api/webpanel/auth/password', async (req, res) => {
  try {
    const id = webpanelUserIdFromBearer(req);
    if (!id) return res.status(401).json({ error: 'Unauthorized' });
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }
    const user = await prisma.webpanelUser.findUnique({ where: { id } });
    if (!user || !verifyWebpanelPassword(currentPassword, user.passwordHash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    await prisma.webpanelUser.update({
      where: { id },
      data: { passwordHash: hashWebpanelPassword(newPassword) },
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Password update failed.' });
  }
});

/** List webpanel sign-in accounts (Bearer). */
app.get('/api/webpanel/users', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const rows = await prisma.webpanelUser.findMany({
      orderBy: { email: 'asc' },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    return res.json(
      rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name || r.email,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Failed to list webpanel users.' });
  }
});

app.post('/api/webpanel/users', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || '');
  const nameRaw = req.body?.name !== undefined ? String(req.body.name).trim().slice(0, 120) : '';
  if (!isValidWebpanelEmail(email)) {
    return res.status(400).json({ error: 'Valid email is required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  try {
    const created = await prisma.webpanelUser.create({
      data: {
        email,
        passwordHash: hashWebpanelPassword(password),
        name: nameRaw || email,
      },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    return res.status(201).json({
      id: created.id,
      email: created.email,
      name: created.name || created.email,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'Email is already registered.' });
    }
    return res.status(500).json({ error: err?.message || 'Failed to create webpanel user.' });
  }
});

app.patch('/api/webpanel/users/:id', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const id = req.params.id;
  const data = {};
  if (req.body?.email !== undefined) {
    const email = String(req.body.email)
      .trim()
      .toLowerCase();
    if (!isValidWebpanelEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }
    data.email = email;
  }
  if (req.body?.name !== undefined) {
    data.name = String(req.body.name).trim().slice(0, 120);
  }
  if (req.body?.password !== undefined && String(req.body.password).trim() !== '') {
    const password = String(req.body.password);
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    data.passwordHash = hashWebpanelPassword(password);
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No fields to update.' });
  }
  try {
    const updated = await prisma.webpanelUser.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, createdAt: true },
    });
    return res.json({
      id: updated.id,
      email: updated.email,
      name: updated.name || updated.email,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'Email is already registered.' });
    }
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.status(500).json({ error: err?.message || 'Failed to update webpanel user.' });
  }
});

app.delete('/api/webpanel/users/:id', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const id = req.params.id;
  if (id === actorId) {
    return res.status(403).json({ error: 'You cannot delete your own account.' });
  }
  try {
    await prisma.webpanelUser.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.status(500).json({ error: err?.message || 'Failed to delete webpanel user.' });
  }
});

function serializePosRegister(r) {
  return {
    id: r.id,
    name: r.name || '',
    ipAddress: r.ipAddress,
    users: (r.userLinks || []).map((l) => ({ id: l.user.id, name: l.user.name })),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function parsePosRegisterIpFromBody(body) {
  const raw = String(body?.ipAddress ?? '').trim();
  if (!raw) return { error: 'ipAddress is required' };
  const kind = net.isIP(raw);
  if (kind === 0) return { error: 'Invalid IP address' };
  const ip = normalizePosRegisterIp(raw);
  return { ip };
}

function parsePosRegisterNameFromBody(body) {
  const name = String(body?.name ?? '').trim().slice(0, 120);
  if (!name) return { error: 'Register name is required.' };
  return { name };
}

/** All POS users (webpanel only; bypasses terminal IP filter used by `GET /api/users`). */
app.get('/api/webpanel/pos-users', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
    return res.json(
      users.map((u) => ({ id: u.id, name: u.name, label: u.name, role: normalizeUserRole(u.role) })),
    );
  } catch (err) {
    console.error('GET /api/webpanel/pos-users', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch POS users' });
  }
});

app.get('/api/webpanel/pos-registers', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const rows = await prisma.posRegister.findMany({
      orderBy: { createdAt: 'desc' },
      include: { userLinks: { include: { user: { select: { id: true, name: true } } } } },
    });
    return res.json(rows.map(serializePosRegister));
  } catch (err) {
    console.error('GET /api/webpanel/pos-registers', err);
    return res.status(500).json({ error: err.message || 'Failed to list registers' });
  }
});

function parseMoneyAmountForReport(val) {
  const s = String(val ?? '')
    .trim()
    .replace(/\s/g, '');
  if (!s) return 0;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function parseProductStockQty(stockStr, weegschaal, unitField) {
  const raw = String(stockStr ?? '').trim();
  const m = raw.match(/-?\d+(?:[.,]\d+)?/);
  const qty = m ? parseFloat(m[0].replace(',', '.')) : 0;
  const q = Number.isFinite(qty) ? qty : 0;
  const unitRaw = String(unitField ?? '').trim();
  const unitLower = unitRaw.toLowerCase();
  const num = Number.isInteger(q) ? String(q) : String(q);
  if (weegschaal) {
    const unit = unitLower || 'kg';
    return { qty: q, qtyLabel: `${num} ${unit}` };
  }
  const unit = unitRaw || 'Piece';
  return { qty: q, qtyLabel: `${num} ${unit}` };
}

function parseNumberLoose(val) {
  const s = String(val ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Webpanel: stock list (qty × prices) for POS-style stock report modal. */
app.get('/api/webpanel/reports/stock', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const sort = String(req.query.sort || 'product').toLowerCase() === 'category' ? 'category' : 'product';
  const display = String(req.query.display || 'all').toLowerCase();
  const vat = String(req.query.vat || 'incl').toLowerCase() === 'excl' ? 'excl' : 'incl';
  try {
    const where = {};
    if (display === 'active' || display === 'screen') {
      where.category = { displayOnCashRegister: true };
    } else if (display === 'supplier') {
      where.supplierId = { not: null };
    }
    const products = await prisma.product.findMany({
      where,
      include: { category: { select: { id: true, name: true, displayOnCashRegister: true } } },
      orderBy:
        sort === 'category'
          ? [{ category: { name: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }]
          : [{ name: 'asc' }],
    });
    const rows = products.map((p) => {
      const { qty, qtyLabel } = parseProductStockQty(p.stock, !!p.weegschaal, p.unit);
      const salePrice = Number(p.price) || 0;
      const purchasePrice = parseMoneyAmountForReport(p.purchasePriceIncl) || parseMoneyAmountForReport(p.purchasePriceExcl);
      const totalSale = Math.round(qty * salePrice * 100) / 100;
      const totalPurchase = Math.round(qty * purchasePrice * 100) / 100;
      const margin = Math.round((totalSale - totalPurchase) * 100) / 100;
      return {
        productId: p.id,
        qty,
        qtyLabel,
        productName: p.name || '',
        categoryName: p.category?.name || '',
        salePrice: Math.round(salePrice * 100) / 100,
        purchasePrice: Math.round(purchasePrice * 100) / 100,
        totalSale,
        totalPurchase,
        margin,
      };
    });
    const openSale = Math.round(rows.reduce((s, r) => s + r.totalSale, 0) * 100) / 100;
    const openPurchase = Math.round(rows.reduce((s, r) => s + r.totalPurchase, 0) * 100) / 100;
    return res.json({ sort, display, vat, rows, totals: { openSale, openPurchase } });
  } catch (err) {
    console.error('GET /api/webpanel/reports/stock', err);
    return res.status(500).json({ error: err.message || 'Failed to build stock report' });
  }
});

function orderCustomerDisplayNameForReport(customer) {
  if (!customer) return '';
  const company = String(customer.companyName || '').trim();
  if (company) return company;
  const fl = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  if (fl) return fl;
  const n = String(customer.name || '').trim();
  return n || '';
}

/** Webpanel: paid orders (“tickets”) in a datetime range, optional POS user and register. */
app.get('/api/webpanel/reports/tickets', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const startDate = sanitizeReportQueryParam(req.query.startDate, 32);
  const endDate = sanitizeReportQueryParam(req.query.endDate, 32);
  const startTime = sanitizeReportQueryParam(req.query.startTime, 8);
  const endTime = sanitizeReportQueryParam(req.query.endTime, 8);
  const parsed = parsePeriodicReportRange(startDate, startTime, endDate, endTime);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const userId = sanitizeReportQueryParam(req.query.userId, 128);
  const registerId = sanitizeReportQueryParam(req.query.registerId, 128);

  const where = {
    status: 'paid',
    updatedAt: { gte: parsed.start, lt: parsed.endExclusive },
  };
  if (userId && userId !== 'all') where.userId = userId;
  if (registerId && registerId !== 'all') where.posRegisterId = registerId;

  try {
    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        user: true,
        posRegister: true,
        payments: { include: { paymentMethod: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const tickets = orders.map((o, idx) => {
      const payStr = (o.payments || [])
        .map((p) => String(p.paymentMethod?.name || '').trim())
        .filter(Boolean)
        .join(', ');
      const customerName = orderCustomerDisplayNameForReport(o.customer);
      const eventLabel = o.source === 'weborder' ? 'Web order' : 'POS';
      const reg = o.posRegister;
      const registerName = reg && String(reg.name || '').trim() ? String(reg.name).trim() : '—';
      return {
        id: o.id,
        rowNumber: idx + 1,
        event: eventLabel,
        registerName,
        settledAt: o.updatedAt.toISOString(),
        amount: Math.round(Number(o.total) * 100) / 100,
        payment: payStr || '—',
        userName: o.user && String(o.user.name || '').trim() ? String(o.user.name).trim() : '—',
        customerName,
      };
    });

    const totalAmount = Math.round(tickets.reduce((s, t) => s + t.amount, 0) * 100) / 100;
    return res.json({ tickets, totalAmount, count: tickets.length });
  } catch (err) {
    console.error('GET /api/webpanel/reports/tickets', err);
    return res.status(500).json({ error: err.message || 'Failed to load tickets' });
  }
});

/** Webpanel: periodic report sections (grid / modal), same filters as tickets. */
app.get('/api/webpanel/reports/periodic', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const startDate = sanitizeReportQueryParam(req.query.startDate, 32);
  const endDate = sanitizeReportQueryParam(req.query.endDate, 32);
  const startTime = sanitizeReportQueryParam(req.query.startTime, 8);
  const endTime = sanitizeReportQueryParam(req.query.endTime, 8);
  const parsed = parsePeriodicReportRange(startDate, startTime, endDate, endTime);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const userId = sanitizeReportQueryParam(req.query.userId, 128);
  const registerId = sanitizeReportQueryParam(req.query.registerId, 128);
  const lang = sanitizeReportQueryParam(req.query.lang, 8) || 'en';

  const where = {
    status: 'paid',
    updatedAt: { gte: parsed.start, lt: parsed.endExclusive },
  };
  if (userId && userId !== 'all') where.userId = userId;
  if (registerId && registerId !== 'all') where.posRegisterId = registerId;

  try {
    const orders = await prisma.order.findMany({
      where,
      include: {
        items: orderItemsInclude,
        payments: { include: { paymentMethod: true } },
        user: true,
        posRegister: true,
      },
      orderBy: { updatedAt: 'asc' },
    });
    const totalTurnover = Math.round(orders.reduce((s, o) => s + (Number(o.total) || 0), 0) * 100) / 100;
    const payload = buildPeriodicReportWebSections(orders, lang);
    return res.json({
      ...payload,
      orderCount: orders.length,
      totalTurnover,
      periodStart: parsed.start.toISOString(),
      periodEndExclusive: parsed.endExclusive.toISOString(),
    });
  } catch (err) {
    console.error('GET /api/webpanel/reports/periodic', err);
    return res.status(500).json({ error: err.message || 'Failed to build periodic report' });
  }
});

/** Webpanel: time clock sessions from UserWorkTimeEvent (start/end + hours). */
app.get('/api/webpanel/reports/time-clock', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const startDate = sanitizeReportQueryParam(req.query.startDate, 32);
  const endDate = sanitizeReportQueryParam(req.query.endDate, 32);
  const startTime = sanitizeReportQueryParam(req.query.startTime, 8);
  const endTime = sanitizeReportQueryParam(req.query.endTime, 8);
  const parsed = parsePeriodicReportRange(startDate, startTime, endDate, endTime);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const userId = sanitizeReportQueryParam(req.query.userId, 128);
  try {
    await ensureUserWorkTimeEventsTable();
    const startIso = parsed.start.toISOString();
    const endIso = parsed.endExclusive.toISOString();
    const baseRows =
      userId && userId !== 'all'
        ? await prisma.$queryRaw`
            SELECT
              w."id" AS "id",
              w."userId" AS "userId",
              COALESCE(u."name", w."userId") AS "userName",
              w."action" AS "action",
              w."at" AS "at",
              w."startAt" AS "startAt",
              w."endAt" AS "endAt"
            FROM "UserWorkTimeEvent" w
            LEFT JOIN "User" u ON u."id" = w."userId"
            WHERE w."userId" = ${userId}
              AND COALESCE(w."startAt", w."at") >= ${startIso}
              AND COALESCE(w."startAt", w."at") < ${endIso}
            ORDER BY "userName" ASC, COALESCE(w."startAt", w."at") ASC, w."id" ASC
          `
        : await prisma.$queryRaw`
            SELECT
              w."id" AS "id",
              w."userId" AS "userId",
              COALESCE(u."name", w."userId") AS "userName",
              w."action" AS "action",
              w."at" AS "at",
              w."startAt" AS "startAt",
              w."endAt" AS "endAt"
            FROM "UserWorkTimeEvent" w
            LEFT JOIN "User" u ON u."id" = w."userId"
            WHERE COALESCE(w."startAt", w."at") >= ${startIso}
              AND COALESCE(w."startAt", w."at") < ${endIso}
            ORDER BY "userName" ASC, COALESCE(w."startAt", w."at") ASC, w."id" ASC
          `;
    const rows = (Array.isArray(baseRows) ? baseRows : []).map((r) => {
      const startIso = r.startAt ? String(r.startAt) : r.action === 'check_in' ? String(r.at || '') : '';
      const endIso = r.endAt ? String(r.endAt) : r.action === 'check_out' ? String(r.at || '') : '';
      const startMs = startIso ? Date.parse(startIso) : NaN;
      const endMs = endIso ? Date.parse(endIso) : NaN;
      const hours = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
        ? Math.round(((endMs - startMs) / 3600000) * 100) / 100
        : 0;
      return {
        id: String(r.id),
        userId: String(r.userId || ''),
        userName: String(r.userName || r.userId || '—'),
        startAt: Number.isFinite(startMs) ? new Date(startMs).toISOString() : null,
        endAt: Number.isFinite(endMs) ? new Date(endMs).toISOString() : null,
        hours,
      };
    });
    const totalsByUser = {};
    for (const row of rows) {
      const key = row.userId || row.userName;
      totalsByUser[key] = Math.round(((totalsByUser[key] || 0) + (Number(row.hours) || 0)) * 100) / 100;
    }
    return res.json({
      rows,
      totalsByUser,
      periodStart: parsed.start.toISOString(),
      periodEndExclusive: parsed.endExclusive.toISOString(),
    });
  } catch (err) {
    console.error('GET /api/webpanel/reports/time-clock', err);
    return res.status(500).json({ error: err.message || 'Failed to build time clock report' });
  }
});

/** Webpanel: empties report totals (categories/products/transactions) from paid orders. */
app.get('/api/webpanel/reports/empties', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const startDate = sanitizeReportQueryParam(req.query.startDate, 32);
  const endDate = sanitizeReportQueryParam(req.query.endDate, 32);
  const startTime = sanitizeReportQueryParam(req.query.startTime, 8);
  const endTime = sanitizeReportQueryParam(req.query.endTime, 8);
  const parsed = parsePeriodicReportRange(startDate, startTime, endDate, endTime);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const rawMode = String(req.query.mode || 'pieces').toLowerCase();
  const mode = ['pieces', 'liters', 'kg', 'meters'].includes(rawMode) ? rawMode : 'pieces';
  try {
    const emptiesProducts = await prisma.product.findMany({
      where: { leeggoedPrijs: { not: null } },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, companyName: true } },
      },
      orderBy: [{ name: 'asc' }],
    });

    const orders = await prisma.order.findMany({
      where: {
        status: 'paid',
        updatedAt: { gte: parsed.start, lt: parsed.endExclusive },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: { select: { id: true, name: true } },
                supplier: { select: { id: true, companyName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
    });

    const categoryMap = new Map();
    const productMap = new Map();
    const txMap = new Map();

    const addToBucket = (map, key, label, outDelta, inDelta) => {
      const prev = map.get(key) || { label, out: 0, in: 0 };
      prev.out += Number(outDelta) || 0;
      prev.in += Number(inDelta) || 0;
      map.set(key, prev);
    };

    const convertQtyByMode = (qty, unitContentRaw) => {
      const unitFactor = Math.max(0, parseNumberLoose(unitContentRaw));
      if (mode === 'pieces') return qty;
      return qty * (unitFactor > 0 ? unitFactor : 1);
    };

    // "In" side: stock received / available per supplier-linked empties products.
    for (const p of emptiesProducts) {
      const leeggoedPrice = parseNumberLoose(p.leeggoedPrijs);
      if (leeggoedPrice <= 0) continue;
      const stockQty = parseProductStockQty(p.stock, !!p.weegschaal, p.unit).qty;
      const inAmount = convertQtyByMode(Number(stockQty) || 0, p.unitContent);
      if (!Number.isFinite(inAmount) || inAmount <= 0) continue;

      const catId = String(p.category?.id || 'uncat');
      const catLabel = String(p.category?.name || '—').trim() || '—';
      addToBucket(categoryMap, catId, catLabel, 0, inAmount);

      const prodId = String(p.id || 'product');
      const prodLabel = String(p.name || '—').trim() || '—';
      addToBucket(productMap, prodId, prodLabel, 0, inAmount);

      const supplierId = String(p.supplier?.id || 'no-supplier');
      const supplierLabel = String(p.supplier?.companyName || 'No supplier').trim() || 'No supplier';
      addToBucket(txMap, supplierId, supplierLabel, 0, inAmount);
    }

    for (const order of orders) {
      for (const item of order.items || []) {
        const product = item.product;
        if (!product) continue;
        const leeggoedPrice = parseNumberLoose(product.leeggoedPrijs);
        if (leeggoedPrice <= 0) continue;
        const qty = Number(item.quantity) || 0;
        if (!qty) continue;
        const baseAmount = convertQtyByMode(qty, product.unitContent);
        if (!Number.isFinite(baseAmount) || baseAmount === 0) continue;
        const outDelta = baseAmount > 0 ? baseAmount : 0;
        const inDelta = baseAmount < 0 ? Math.abs(baseAmount) : 0;

        const catId = String(product.category?.id || 'uncat');
        const catLabel = String(product.category?.name || '—').trim() || '—';
        addToBucket(categoryMap, catId, catLabel, outDelta, inDelta);

        const prodId = String(product.id || 'product');
        const prodLabel = String(product.name || '—').trim() || '—';
        addToBucket(productMap, prodId, prodLabel, outDelta, inDelta);

        const supplierId = String(product.supplier?.id || 'no-supplier');
        const supplierLabel = String(product.supplier?.companyName || 'No supplier').trim() || 'No supplier';
        addToBucket(txMap, supplierId, supplierLabel, outDelta, inDelta);
      }
    }

    const sumTotals = (map) => {
      let out = 0;
      let inn = 0;
      for (const v of map.values()) {
        out += Number(v.out) || 0;
        inn += Number(v.in) || 0;
      }
      out = Math.round(out * 100) / 100;
      inn = Math.round(inn * 100) / 100;
      return { out, in: inn, diff: Math.round((inn - out) * 100) / 100 };
    };

    const rowsFromMap = (map) =>
      Array.from(map.values())
        .map((v) => {
          const out = Math.round((Number(v.out) || 0) * 100) / 100;
          const inn = Math.round((Number(v.in) || 0) * 100) / 100;
          return {
            label: String(v.label || '—'),
            out,
            in: inn,
            diff: Math.round((inn - out) * 100) / 100,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label));

    return res.json({
      mode,
      categories: { totals: sumTotals(categoryMap), rows: rowsFromMap(categoryMap) },
      products: { totals: sumTotals(productMap), rows: rowsFromMap(productMap) },
      transactions: { totals: sumTotals(txMap), rows: rowsFromMap(txMap) },
      periodStart: parsed.start.toISOString(),
      periodEndExclusive: parsed.endExclusive.toISOString(),
    });
  } catch (err) {
    console.error('GET /api/webpanel/reports/empties', err);
    return res.status(500).json({ error: err.message || 'Failed to build empties report' });
  }
});

/** Webpanel: supplier report (category/product totals for selected supplier). */
app.get('/api/webpanel/reports/supplier', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const supplierId = sanitizeReportQueryParam(req.query.supplierId, 128);
  if (!supplierId) return res.status(400).json({ error: 'Missing supplierId' });

  const startDate = sanitizeReportQueryParam(req.query.startDate, 32);
  const endDate = sanitizeReportQueryParam(req.query.endDate, 32);
  const startTime = sanitizeReportQueryParam(req.query.startTime, 8);
  const endTime = sanitizeReportQueryParam(req.query.endTime, 8);
  const parsed = parsePeriodicReportRange(startDate, startTime, endDate, endTime);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const products = await prisma.product.findMany({
      where: { supplierId },
      include: { category: { select: { name: true } } },
      orderBy: [{ name: 'asc' }],
    });

    const categoryMap = new Map();
    const rows = products.map((p) => {
      const qtyObj = parseProductStockQty(p.stock, !!p.weegschaal, p.unit);
      const qty = Number(qtyObj.qty) || 0;
      const purchasePrice = parseMoneyAmountForReport(p.purchasePriceIncl) || parseMoneyAmountForReport(p.purchasePriceExcl);
      const amount = Math.round(qty * purchasePrice * 100) / 100;
      const categoryLabel = String(p.category?.name || '').trim() || '—';
      const unitLabel = String(p.unit || '').trim() || (p.weegschaal ? 'kg' : 'Piece');
      const prev = categoryMap.get(categoryLabel) || { qty: 0, amount: 0, units: new Set() };
      prev.units.add(unitLabel);
      categoryMap.set(categoryLabel, {
        qty: prev.qty + qty,
        amount: prev.amount + amount,
        units: prev.units,
      });
      return {
        label: String(p.name || '').trim() || '—',
        qty: Math.round(qty * 1000) / 1000,
        qtyLabel: qtyObj.qtyLabel,
        amount,
      };
    });

    const categoryRows = [...categoryMap.entries()]
      .map(([label, v]) => ({
        label,
        qty: Math.round((Number(v.qty) || 0) * 1000) / 1000,
        qtyLabel:
          v.units.size === 1
            ? `${Math.round((Number(v.qty) || 0) * 1000) / 1000} ${[...v.units][0]}`
            : `${Math.round((Number(v.qty) || 0) * 1000) / 1000}`,
        amount: Math.round((Number(v.amount) || 0) * 100) / 100,
      }))
      .sort((a, b) => b.amount - a.amount || String(a.label).localeCompare(String(b.label)));

    rows.sort((a, b) => b.amount - a.amount || String(a.label).localeCompare(String(b.label)));
    const totals = {
      qty: Math.round(rows.reduce((s, r) => s + (Number(r.qty) || 0), 0) * 1000) / 1000,
      amount: Math.round(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100,
    };

    return res.json({
      categoryRows,
      rows,
      totals,
      periodStart: parsed.start.toISOString(),
      periodEndExclusive: parsed.endExclusive.toISOString(),
    });
  } catch (err) {
    console.error('GET /api/webpanel/reports/supplier', err);
    return res.status(500).json({ error: err.message || 'Failed to build supplier report' });
  }
});

/** Webpanel: find products by barcode, product number, or partial name (label printing). */
app.get('/api/webpanel/products/label-search', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const raw = String(req.query.q ?? '').trim();
  if (!raw) return res.json([]);
  try {
    const categories = await prisma.category.findMany({ select: { id: true, name: true } });
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    const orExact = [{ barcode: raw }];
    if (/^\d+$/.test(raw)) {
      const num = parseInt(raw, 10);
      if (Number.isSafeInteger(num)) orExact.push({ number: num });
    }

    const primary = await prisma.product.findMany({
      where: { OR: orExact },
      select: {
        id: true,
        name: true,
        number: true,
        barcode: true,
        price: true,
        categoryId: true,
        unit: true,
      },
      take: 30,
      orderBy: [{ name: 'asc' }],
    });

    const mapRow = (p) => ({
      id: p.id,
      name: p.name,
      number: p.number,
      barcode: p.barcode || '',
      price: p.price,
      unit: p.unit || '',
      categoryName: catMap.get(p.categoryId) || '',
    });

    if (primary.length > 0) {
      return res.json(primary.map(mapRow));
    }

    const fuzzy = await prisma.product.findMany({
      where: {
        OR: [{ barcode: { contains: raw } }, { name: { contains: raw } }],
      },
      select: {
        id: true,
        name: true,
        number: true,
        barcode: true,
        price: true,
        categoryId: true,
        unit: true,
      },
      take: 25,
      orderBy: [{ name: 'asc' }],
    });
    return res.json(fuzzy.map(mapRow));
  } catch (err) {
    console.error('GET /api/webpanel/products/label-search', err);
    return res.status(500).json({ error: err.message || 'Failed to search products' });
  }
});

function labelQueueSnapshotColumnError(err) {
  if (err?.code === 'P2022') return true;
  const m = String(err?.message || '').toLowerCase();
  return m.includes('no such column') || m.includes('unknown column');
}

/** Webpanel: label print queue (persisted). */
app.get('/api/webpanel/labels/queue', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    let rows;
    try {
      rows = await prisma.webpanelLabelQueueItem.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { product: { select: { price: true, barcode: true } } },
      });
    } catch (err) {
      if (!labelQueueSnapshotColumnError(err)) throw err;
      console.warn('GET /api/webpanel/labels/queue: legacy DB path (run `npx prisma db push` in retail/backend)', err.message);
      const slim = await prisma.webpanelLabelQueueItem.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, productId: true, productName: true, count: true, sortOrder: true },
      });
      const ids = [...new Set(slim.map((r) => r.productId).filter(Boolean))];
      const products =
        ids.length > 0
          ? await prisma.product.findMany({
              where: { id: { in: ids } },
              select: { id: true, price: true, barcode: true },
            })
          : [];
      const pmap = new Map(products.map((p) => [p.id, p]));
      rows = slim.map((r) => ({
        ...r,
        priceSnapshot: null,
        barcodeSnapshot: null,
        product: r.productId ? pmap.get(r.productId) ?? null : null,
      }));
    }
    return res.json(
      rows.map((r) => {
        const price =
          r.priceSnapshot != null && Number.isFinite(Number(r.priceSnapshot))
            ? Number(r.priceSnapshot)
            : r.product?.price != null && Number.isFinite(Number(r.product.price))
              ? Number(r.product.price)
              : null;
        const barcodeRaw = r.barcodeSnapshot ?? r.product?.barcode ?? '';
        const barcode = String(barcodeRaw || '').trim().slice(0, 64) || null;
        return {
          id: r.id,
          productId: r.productId,
          name: r.productName,
          count: r.count,
          price,
          barcode,
        };
      }),
    );
  } catch (err) {
    console.error('GET /api/webpanel/labels/queue', err);
    return res.status(500).json({ error: err.message || 'Failed to load label queue' });
  }
});

app.post('/api/webpanel/labels/queue', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const productName = String(req.body?.productName ?? '').trim().slice(0, 200);
  const count = Math.min(999, Math.max(1, Math.floor(Number(req.body?.count) || 0)));
  let productId =
    req.body?.productId != null && String(req.body.productId).trim() !== ''
      ? String(req.body.productId).trim()
      : null;
  if (!productName) {
    return res.status(400).json({ error: 'Product name is required.' });
  }
  if (!Number.isFinite(count) || count < 1) {
    return res.status(400).json({ error: 'Count must be between 1 and 999.' });
  }
  let priceSnapshot = null;
  if (req.body?.price !== undefined && req.body?.price !== null && String(req.body.price).trim() !== '') {
    const n = Number(req.body.price);
    if (Number.isFinite(n)) priceSnapshot = Math.round(n * 100) / 100;
  }
  let barcodeSnapshot = null;
  if (req.body?.barcode !== undefined && req.body?.barcode !== null) {
    const b = String(req.body.barcode).trim().slice(0, 64);
    if (b) barcodeSnapshot = b;
  }
  try {
    if (productId) {
      const p = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, price: true, barcode: true },
      });
      if (!p) {
        productId = null;
      } else {
        if (priceSnapshot == null && p.price != null && Number.isFinite(Number(p.price))) {
          priceSnapshot = Math.round(Number(p.price) * 100) / 100;
        }
        if (!barcodeSnapshot && p.barcode) {
          const b = String(p.barcode).trim().slice(0, 64);
          if (b) barcodeSnapshot = b;
        }
      }
    }
    const maxSort = await prisma.webpanelLabelQueueItem.aggregate({ _max: { sortOrder: true } });
    const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;
    const metaPrice = priceSnapshot;
    const metaBarcode = barcodeSnapshot;
    let row;
    try {
      row = await prisma.webpanelLabelQueueItem.create({
        data: { productId, productName, count, sortOrder, priceSnapshot, barcodeSnapshot },
      });
    } catch (err) {
      if (!labelQueueSnapshotColumnError(err)) throw err;
      console.warn('POST /api/webpanel/labels/queue: DB missing snapshot columns; run `npx prisma db push` in retail/backend', err.message);
      row = await prisma.webpanelLabelQueueItem.create({
        data: { productId, productName, count, sortOrder },
      });
    }
    const outPrice =
      row.priceSnapshot != null && Number.isFinite(Number(row.priceSnapshot))
        ? Number(row.priceSnapshot)
        : metaPrice;
    const outBarcode =
      row.barcodeSnapshot != null && String(row.barcodeSnapshot).trim() !== ''
        ? String(row.barcodeSnapshot).trim()
        : metaBarcode != null && String(metaBarcode).trim() !== ''
          ? String(metaBarcode).trim()
          : null;
    return res.status(201).json({
      id: row.id,
      productId: row.productId,
      name: row.productName,
      count: row.count,
      price: outPrice,
      barcode: outBarcode,
    });
  } catch (err) {
    console.error('POST /api/webpanel/labels/queue', err);
    return res.status(500).json({
      error: err.message || 'Failed to save label queue item',
      code: err.code,
    });
  }
});

app.delete('/api/webpanel/labels/queue/all', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await prisma.webpanelLabelQueueItem.deleteMany({});
    return res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/webpanel/labels/queue/all', err);
    return res.status(500).json({ error: err.message || 'Failed to clear label queue' });
  }
});

app.delete('/api/webpanel/labels/queue/:id', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Missing id' });
  try {
    await prisma.webpanelLabelQueueItem.delete({ where: { id } });
    return res.status(204).end();
  } catch (err) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Item not found' });
    }
    console.error('DELETE /api/webpanel/labels/queue/:id', err);
    return res.status(500).json({ error: err.message || 'Failed to delete label queue item' });
  }
});

/** Webpanel: best-sellers datasets (text/pie/bar) in a datetime range. */
app.get('/api/webpanel/reports/best-sellers', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const startDate = sanitizeReportQueryParam(req.query.startDate, 32);
  const endDate = sanitizeReportQueryParam(req.query.endDate, 32);
  const startTime = sanitizeReportQueryParam(req.query.startTime, 8);
  const endTime = sanitizeReportQueryParam(req.query.endTime, 8);
  const parsed = parsePeriodicReportRange(startDate, startTime, endDate, endTime);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const modeRaw = String(req.query.mode || 'best25').toLowerCase();
  const mode = ['best25', 'worst25', 'p80', 'cust10'].includes(modeRaw) ? modeRaw : 'best25';

  try {
    const orders = await prisma.order.findMany({
      where: {
        status: 'paid',
        updatedAt: { gte: parsed.start, lt: parsed.endExclusive },
      },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: {
                category: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'asc' },
    });

    if (mode === 'cust10') {
      const customers = new Map();
      for (const o of orders) {
        const label = orderCustomerDisplayNameForReport(o.customer) || 'Walk-in';
        const cur = customers.get(label) || { label, amount: 0, tickets: 0 };
        cur.amount += Number(o.total) || 0;
        cur.tickets += 1;
        customers.set(label, cur);
      }
      const rows = [...customers.values()]
        .map((r) => ({
          label: r.label,
          qty: r.tickets,
          amount: Math.round(r.amount * 100) / 100,
          category: '',
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);
      const totalAmount = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
      const totalQty = rows.reduce((s, r) => s + r.qty, 0);
      return res.json({
        mode,
        entity: 'customers',
        rows,
        categoryRows: [],
        totals: { amount: totalAmount, qty: totalQty },
        periodStart: parsed.start.toISOString(),
        periodEndExclusive: parsed.endExclusive.toISOString(),
      });
    }

    const productMap = new Map();
    for (const o of orders) {
      for (const it of o.items || []) {
        const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
        const unitPrice = Number(it.price) || 0;
        const amount = Math.round(qty * unitPrice * 100) / 100;
        const pid = it.productId || it.product?.id || `${it.product?.name || ''}-${unitPrice}`;
        const label = String(it.product?.name || '').trim() || '—';
        const category = String(it.product?.category?.name || '').trim() || '—';
        const cur = productMap.get(pid) || { id: pid, label, category, qty: 0, amount: 0 };
        cur.qty += qty;
        cur.amount += amount;
        productMap.set(pid, cur);
      }
    }

    let rows = [...productMap.values()].map((r) => ({
      label: r.label,
      category: r.category,
      qty: r.qty,
      amount: Math.round(r.amount * 100) / 100,
    }));
    if (mode === 'worst25') {
      rows = rows
        .sort((a, b) => (a.qty - b.qty) || (a.amount - b.amount) || a.label.localeCompare(b.label))
        .slice(0, 25);
    } else if (mode === 'p80') {
      rows = rows.sort((a, b) => b.amount - a.amount || b.qty - a.qty || a.label.localeCompare(b.label));
      const totalAll = rows.reduce((s, r) => s + r.amount, 0);
      const threshold = totalAll * 0.8;
      let acc = 0;
      const selected = [];
      for (const r of rows) {
        selected.push(r);
        acc += r.amount;
        if (acc >= threshold) break;
      }
      rows = selected;
    } else {
      rows = rows
        .sort((a, b) => (b.qty - a.qty) || (b.amount - a.amount) || a.label.localeCompare(b.label))
        .slice(0, 25);
    }

    const categories = new Map();
    for (const r of rows) {
      const cur = categories.get(r.category) || { label: r.category, qty: 0, amount: 0 };
      cur.qty += r.qty;
      cur.amount += r.amount;
      categories.set(r.category, cur);
    }
    const categoryRows = [...categories.values()]
      .map((r) => ({ ...r, amount: Math.round(r.amount * 100) / 100 }))
      .sort((a, b) => b.qty - a.qty || b.amount - a.amount || a.label.localeCompare(b.label));

    const totalAmount = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
    const totalQty = rows.reduce((s, r) => s + r.qty, 0);

    return res.json({
      mode,
      entity: 'products',
      rows,
      categoryRows,
      totals: { amount: totalAmount, qty: totalQty },
      periodStart: parsed.start.toISOString(),
      periodEndExclusive: parsed.endExclusive.toISOString(),
    });
  } catch (err) {
    console.error('GET /api/webpanel/reports/best-sellers', err);
    return res.status(500).json({ error: err.message || 'Failed to build best sellers report' });
  }
});

app.post('/api/webpanel/pos-registers', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = parsePosRegisterIpFromBody(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const parsedName = parsePosRegisterNameFromBody(req.body || {});
  if (parsedName.error) return res.status(400).json({ error: parsedName.error });
  const { name } = parsedName;
  const userIds = Array.isArray(req.body?.userIds) ? [...new Set(req.body.userIds.map((x) => String(x)))].filter(Boolean) : [];
  try {
    const created = await prisma.$transaction(async (tx) => {
      const reg = await tx.posRegister.create({
        data: { ipAddress: parsed.ip, name },
      });
      if (userIds.length > 0) {
        const users = await tx.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });
        const ok = new Set(users.map((u) => u.id));
        const data = userIds.filter((id) => ok.has(id)).map((userId) => ({ registerId: reg.id, userId }));
        if (data.length) await tx.posRegisterUser.createMany({ data });
      }
      return tx.posRegister.findUniqueOrThrow({
        where: { id: reg.id },
        include: { userLinks: { include: { user: { select: { id: true, name: true } } } } },
      });
    });
    return res.status(201).json(serializePosRegister(created));
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'This IP is already registered.' });
    }
    console.error('POST /api/webpanel/pos-registers', err);
    return res.status(500).json({ error: err.message || 'Failed to create register' });
  }
});

app.patch('/api/webpanel/pos-registers/:id', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const id = req.params.id;
  const body = req.body || {};
  if (body.ipAddress !== undefined) {
    const p = parsePosRegisterIpFromBody(body);
    if (p.error) return res.status(400).json({ error: p.error });
  }
  let registerNameUpdate;
  if (body.name !== undefined) {
    const pn = parsePosRegisterNameFromBody(body);
    if (pn.error) return res.status(400).json({ error: pn.error });
    registerNameUpdate = pn.name;
  }
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.posRegister.findUnique({ where: { id } });
      if (!existing) return null;
      const data = {};
      if (registerNameUpdate !== undefined) data.name = registerNameUpdate;
      if (body.ipAddress !== undefined) {
        const p = parsePosRegisterIpFromBody(body);
        data.ipAddress = p.ip;
      }
      if (Object.keys(data).length) {
        await tx.posRegister.update({ where: { id }, data });
      }
      if (Array.isArray(body.userIds)) {
        const userIds = [...new Set(body.userIds.map((x) => String(x)))].filter(Boolean);
        await tx.posRegisterUser.deleteMany({ where: { registerId: id } });
        if (userIds.length > 0) {
          const users = await tx.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });
          const ok = new Set(users.map((u) => u.id));
          const rows = userIds.filter((uid) => ok.has(uid)).map((userId) => ({ registerId: id, userId }));
          if (rows.length) await tx.posRegisterUser.createMany({ data: rows });
        }
      }
      return tx.posRegister.findUniqueOrThrow({
        where: { id },
        include: { userLinks: { include: { user: { select: { id: true, name: true } } } } },
      });
    });
    if (!updated) return res.status(404).json({ error: 'Register not found' });
    return res.json(serializePosRegister(updated));
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'This IP is already registered.' });
    }
    if (err?.message && String(err.message).includes('ipAddress')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('PATCH /api/webpanel/pos-registers/:id', err);
    return res.status(500).json({ error: err.message || 'Failed to update register' });
  }
});

app.delete('/api/webpanel/pos-registers/:id', async (req, res) => {
  const actorId = webpanelUserIdFromBearer(req);
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await prisma.posRegister.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Register not found' });
    console.error('DELETE /api/webpanel/pos-registers/:id', err);
    return res.status(500).json({ error: err.message || 'Failed to delete register' });
  }
});

/** Live weight from configured scale (Aclas / Dialog 06). */
app.get('/api/scale/live-weight', async (req, res) => {
  try {
    const forceFresh = String(req.query?.force || '').trim() === '1';
    const out = await getLiveScaleWeight(forceFresh);
    res.json(out);
  } catch (err) {
    res.status(500).json({ grams: 0, stable: false, error: err?.message || 'Failed to read scale weight.' });
  }
});

async function resolveSqliteDbPath() {
  const candidates = [
    path.resolve(__dirname, 'prisma', 'retail.db'),
    path.resolve(process.cwd(), 'prisma', 'retail.db'),
    path.resolve(__dirname, 'retail.db'),
    path.resolve(process.cwd(), 'retail.db'),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  throw new Error('Database file not found.');
}

app.get('/api/backup/export', async (req, res) => {
  try {
    const dbPath = await resolveSqliteDbPath();
    const bytes = await readFile(dbPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `pos-backup-${timestamp}.db`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${backupName}"`);
    res.send(bytes);
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Failed to export backup.' });
  }
});

app.post('/api/backup/import', express.raw({ type: 'application/octet-stream', limit: '200mb' }), async (req, res) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'No backup file content received.' });
    }
    const dbPath = await resolveSqliteDbPath();
    const rollbackPath = `${dbPath}.pre-import-${Date.now()}.bak`;
    await copyFile(dbPath, rollbackPath);
    await prisma.$disconnect();
    await writeFile(dbPath, req.body);
    return res.json({
      ok: true,
      message: 'Backup imported successfully. Restart backend if data does not refresh immediately.',
      rollbackBackupPath: rollbackPath,
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to import backup.' });
  }
});

function serverLog(scope, message, meta = undefined) {
  const prefix = `[${new Date().toISOString()}] [${scope}]`;
  if (meta === undefined) {
    console.log(`${prefix} ${message}`);
    return;
  }
  console.log(`${prefix} ${message}`, meta);
}

function summarizeCashmaticConnection(connectionString) {
  const raw = String(connectionString || '').trim();
  if (!raw) return { configured: false };
  try {
    const parsed = JSON.parse(raw);
    const url = parsed?.url ? String(parsed.url) : '';
    let urlHost = '';
    let urlPort = '';
    if (url) {
      try {
        const u = new URL(url);
        urlHost = u.hostname || '';
        urlPort = u.port || '';
      } catch {
        // ignore invalid URL
      }
    }
    return {
      configured: true,
      ip: parsed?.ip || parsed?.ipAddress || '',
      port: parsed?.port || '',
      urlHost,
      urlPort,
      hasUsername: !!(parsed?.username || parsed?.userName || parsed?.user || parsed?.login),
      hasPassword: !!(parsed?.password || parsed?.pass || parsed?.pwd || parsed?.secret),
    };
  } catch {
    return { configured: true, raw };
  }
}

function summarizePayworldConnection(connectionString) {
  const raw = String(connectionString || '').trim();
  if (!raw) return { configured: false };
  try {
    const parsed = JSON.parse(raw);
    return {
      configured: true,
      ip: parsed?.ip || parsed?.ipAddress || '',
      port: parsed?.port || '',
      posId: parsed?.posId || '',
      currencyCode: parsed?.currencyCode || '',
      timeoutMs: parsed?.timeoutMs || '',
    };
  } catch {
    if (raw.startsWith('tcp://')) {
      const match = raw.match(/tcp:\/\/([^:]+):?(\d+)?/i);
      return {
        configured: true,
        ip: match?.[1] || '',
        port: match?.[2] || '',
      };
    }
    return { configured: true, raw };
  }
}

const SETTING_KEY_PRODUCT_SUBPRODUCT_LINKS = 'product_subproduct_links';
const SETTING_KEY_PRODUCT_KIOSK_GROUP_CONFIG = 'product_kiosk_subproduct_group_config';

async function loadProductKioskGroupConfigMap() {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_PRODUCT_KIOSK_GROUP_CONFIG } });
  if (!row?.value) return {};
  try {
    const parsed = JSON.parse(row.value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function defaultKioskGroupConfig() {
  return {
    title: '',
    mandatoryPosKiosk: false,
    multiselect: true,
    defaultSubproductId: '',
    minKiosk: 'unlimited',
    maxKiosk: 'unlimited'
  };
}

function normalizeKioskGroupConfigEntry(raw) {
  const d = defaultKioskGroupConfig();
  if (!raw || typeof raw !== 'object') return { ...d };
  return {
    title: typeof raw.title === 'string' ? raw.title : d.title,
    mandatoryPosKiosk: raw.mandatoryPosKiosk === true,
    multiselect: raw.multiselect !== false,
    defaultSubproductId: raw.defaultSubproductId != null ? String(raw.defaultSubproductId) : '',
    minKiosk:
      raw.minKiosk != null && String(raw.minKiosk).trim() !== '' ? String(raw.minKiosk) : d.minKiosk,
    maxKiosk:
      raw.maxKiosk != null && String(raw.maxKiosk).trim() !== '' ? String(raw.maxKiosk) : d.maxKiosk
  };
}

async function loadProductSubproductLinksMap() {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_PRODUCT_SUBPRODUCT_LINKS } });
  if (!row?.value) return {};
  try {
    const parsed = JSON.parse(row.value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeProductSubproductLinks(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const normalized = [];
  for (const raw of list) {
    const subproductId = raw?.subproductId != null ? String(raw.subproductId).trim() : '';
    if (!subproductId || seen.has(subproductId)) continue;
    seen.add(subproductId);
    normalized.push({
      subproductId,
      groupId: raw?.groupId != null ? String(raw.groupId).trim() : ''
    });
  }
  return normalized;
}

// REST: categories
app.get('/api/categories', async (req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' }, include: { products: true } });
  res.json(categories);
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name, inWebshop, displayOnCashRegister, nextCourse } = req.body;
    const count = await prisma.category.count();
    const created = await prisma.category.create({
      data: {
        name: name != null && String(name).trim() !== '' ? String(name).trim() : 'New category',
        inWebshop: inWebshop !== false,
        displayOnCashRegister: displayOnCashRegister !== false,
        nextCourse: nextCourse != null && String(nextCourse).trim() !== '' ? String(nextCourse).trim() : null,
        sortOrder: count + 1
      }
    });
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /api/categories', err);
    res.status(500).json({ error: err.message || 'Failed to create category' });
  }
});

app.patch('/api/categories/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { name, inWebshop, displayOnCashRegister, nextCourse, sortOrder } = req.body;
    const data = {};
    if (name !== undefined) data.name = String(name).trim() || 'New category';
    if (inWebshop !== undefined) data.inWebshop = inWebshop !== false;
    if (displayOnCashRegister !== undefined) data.displayOnCashRegister = displayOnCashRegister !== false;
    if (nextCourse !== undefined) data.nextCourse = nextCourse != null && String(nextCourse).trim() !== '' ? String(nextCourse).trim() : null;
    if (typeof sortOrder === 'number') data.sortOrder = sortOrder;
    const updated = await prisma.category.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    console.error('PATCH /api/categories/:id', err);
    res.status(500).json({ error: err.message || 'Failed to update category' });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/categories/:id', err);
    res.status(500).json({ error: err.message || 'Failed to delete category' });
  }
});

// REST: products by category
app.get('/api/categories/:id/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { categoryId: req.params.id },
      orderBy: { sortOrder: 'asc' }
    });
    res.json(products);
  } catch (err) {
    console.error('GET /api/categories/:id/products', err);
    res.status(500).json({ error: err.message || 'Failed to load products' });
  }
});

/** @param {string|null|undefined} json */
function parseKitchenProductIds(json) {
  if (json == null || json === '') return [];
  try {
    const p = JSON.parse(json);
    return Array.isArray(p) ? p.map((x) => String(x)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

// All products for Control pickers (kitchens, etc.)
app.get('/api/products/catalog', async (req, res) => {
  try {
    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        select: {
          id: true,
          name: true,
          keyName: true,
          productionName: true,
          categoryId: true,
          number: true,
          price: true,
          barcode: true,
          stock: true,
          unit: true,
          vatTakeOut: true,
        },
        orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }]
      }),
      prisma.category.findMany({ select: { id: true, name: true } })
    ]);
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    res.json(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        keyName: p.keyName,
        productionName: p.productionName,
        categoryId: p.categoryId,
        categoryName: catMap.get(p.categoryId) || '',
        number: p.number,
        price: p.price,
        barcode: p.barcode,
        stock: p.stock,
        unit: p.unit,
        vatTakeOut: p.vatTakeOut,
      }))
    );
  } catch (err) {
    console.error('GET /api/products/catalog', err);
    res.status(500).json({ error: err.message || 'Failed to load product catalog' });
  }
});

// Subproducts for a product (by product.addition = subproduct group name or id)
app.get('/api/products/:id/subproducts', async (req, res) => {
  try {
    const linksMap = await loadProductSubproductLinksMap();
    const links = normalizeProductSubproductLinks(linksMap?.[req.params.id]);
    const idOrder = new Map(links.map((l, idx) => [l.subproductId, idx]));
    const ids = links.map((l) => l.subproductId);
    if (ids.length === 0) return res.json([]);
    const items = await prisma.subproduct.findMany({
      where: { id: { in: ids } },
      include: { group: true }
    });
    const sorted = items
      .filter((sp) => idOrder.has(sp.id))
      .sort((a, b) => idOrder.get(a.id) - idOrder.get(b.id));
    res.json(sorted);
  } catch (err) {
    console.error('GET /api/products/:id/subproducts', err);
    res.status(500).json({ error: err.message || 'Failed to load subproducts' });
  }
});

// Next product number (unique numeric id for display)
app.get('/api/products/next-number', async (req, res) => {
  try {
    const max = await prisma.product.aggregate({ _max: { number: true } });
    const next = (max._max.number ?? 0) + 1;
    res.json({ nextNumber: next });
  } catch (err) {
    console.error('GET /api/products/next-number', err);
    res.status(500).json({ error: err.message || 'Failed to get next number' });
  }
});

// Full product row (webpanel edit / parity with POS product modal)
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    console.error('GET /api/products/:id', err);
    res.status(500).json({ error: err.message || 'Failed to load product' });
  }
});

// Build product payload from body (for POST create; optional fields)
function productDataFromBody(body, forCreate = false) {
  const str = (v) => (v != null && v !== '' ? String(v) : null);
  const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? parseFloat(v) : null);
  const bool = (v) => (typeof v === 'boolean' ? v : v === 'true' || v === 1);
  const data = {};
  if (body.name !== undefined) data.name = String(body.name).trim() || 'New product';
  if (body.price !== undefined) data.price = typeof body.price === 'number' ? body.price : parseFloat(body.price) || 0;
  if (body.categoryId !== undefined) data.categoryId = body.categoryId || undefined;
  if (body.sortOrder !== undefined && typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder;
  // General
  if (body.keyName !== undefined) data.keyName = str(body.keyName);
  if (body.productionName !== undefined) data.productionName = str(body.productionName);
  if (body.vatTakeOut !== undefined) data.vatTakeOut = str(body.vatTakeOut);
  if (body.barcode !== undefined) data.barcode = str(body.barcode);
  if (body.printer1 !== undefined) data.printer1 = str(body.printer1);
  if (body.printer2 !== undefined) data.printer2 = str(body.printer2);
  if (body.printer3 !== undefined) data.printer3 = str(body.printer3);
  if (body.addition !== undefined) data.addition = str(body.addition);
  if (body.categoryIdsJson !== undefined) data.categoryIdsJson = typeof body.categoryIdsJson === 'string' ? body.categoryIdsJson : JSON.stringify(body.categoryIds || []);
  // Advanced
  if (body.openPrice !== undefined) data.openPrice = bool(body.openPrice);
  if (body.weegschaal !== undefined) data.weegschaal = bool(body.weegschaal);
  if (body.subproductRequires !== undefined) data.subproductRequires = bool(body.subproductRequires);
  if (body.leeggoedPrijs !== undefined) data.leeggoedPrijs = str(body.leeggoedPrijs);
  if (body.pagerVerplicht !== undefined) data.pagerVerplicht = bool(body.pagerVerplicht);
  if (body.boldPrint !== undefined) data.boldPrint = bool(body.boldPrint);
  if (body.groupingReceipt !== undefined) data.groupingReceipt = bool(body.groupingReceipt);
  if (body.labelExtraInfo !== undefined) data.labelExtraInfo = str(body.labelExtraInfo);
  if (body.kassaPhotoPath !== undefined) data.kassaPhotoPath = str(body.kassaPhotoPath);
  if (body.voorverpakVervaltype !== undefined) data.voorverpakVervaltype = str(body.voorverpakVervaltype);
  if (body.houdbareDagen !== undefined) data.houdbareDagen = str(body.houdbareDagen);
  if (body.bewarenGebruik !== undefined) data.bewarenGebruik = str(body.bewarenGebruik);
  // Extra prices
  if (body.extraPricesJson !== undefined) data.extraPricesJson = typeof body.extraPricesJson === 'string' ? body.extraPricesJson : JSON.stringify(body.extraPrices || []);
  // Purchase and stock
  if (body.purchaseVat !== undefined) data.purchaseVat = str(body.purchaseVat);
  if (body.purchasePriceExcl !== undefined) data.purchasePriceExcl = str(body.purchasePriceExcl);
  if (body.purchasePriceIncl !== undefined) data.purchasePriceIncl = str(body.purchasePriceIncl);
  if (body.profitPct !== undefined) data.profitPct = str(body.profitPct);
  if (body.unit !== undefined) data.unit = str(body.unit);
  if (body.unitContent !== undefined) data.unitContent = str(body.unitContent);
  if (body.stock !== undefined) data.stock = str(body.stock);
  if (body.supplierId !== undefined) {
    const sid = body.supplierId;
    data.supplierId = sid == null || sid === '' ? null : String(sid).trim() || null;
  }
  if (body.supplierCode !== undefined) data.supplierCode = str(body.supplierCode);
  if (body.stockNotification !== undefined) data.stockNotification = bool(body.stockNotification);
  if (body.expirationDate !== undefined) data.expirationDate = str(body.expirationDate);
  if (body.declarationExpiryDays !== undefined) data.declarationExpiryDays = str(body.declarationExpiryDays);
  if (body.notificationSoldOutPieces !== undefined) data.notificationSoldOutPieces = str(body.notificationSoldOutPieces);
  // Webshop
  if (body.inWebshop !== undefined) data.inWebshop = bool(body.inWebshop);
  if (body.onlineOrderable !== undefined) data.onlineOrderable = bool(body.onlineOrderable);
  if (body.websiteRemark !== undefined) data.websiteRemark = str(body.websiteRemark);
  if (body.websiteOrder !== undefined) data.websiteOrder = str(body.websiteOrder);
  if (body.shortWebText !== undefined) data.shortWebText = str(body.shortWebText);
  if (body.websitePhotoPath !== undefined) data.websitePhotoPath = str(body.websitePhotoPath);
  // Kiosk
  if (body.kioskInfo !== undefined) data.kioskInfo = str(body.kioskInfo);
  if (body.kioskTakeAway !== undefined) data.kioskTakeAway = bool(body.kioskTakeAway);
  if (body.kioskEatIn !== undefined) data.kioskEatIn = str(body.kioskEatIn);
  if (body.kioskSubtitle !== undefined) data.kioskSubtitle = str(body.kioskSubtitle);
  if (body.kioskMinSubs !== undefined) data.kioskMinSubs = str(body.kioskMinSubs);
  if (body.kioskMaxSubs !== undefined) data.kioskMaxSubs = str(body.kioskMaxSubs);
  if (body.kioskPicturePath !== undefined) data.kioskPicturePath = str(body.kioskPicturePath);
  return data;
}

// REST: products CRUD
app.post('/api/products', async (req, res) => {
  try {
    const body = req.body;
    const categoryId = (body.categoryId || body.category || '').toString().trim();
    if (!categoryId) {
      return res.status(400).json({ error: 'categoryId is required' });
    }
    const max = await prisma.product.aggregate({ _max: { number: true } });
    const nextNumber = (max._max.number ?? 0) + 1;
    const count = await prisma.product.count({ where: { categoryId } });
    const data = productDataFromBody(body, true);
    data.number = nextNumber;
    data.name = (data.name || 'New product').toString().trim();
    data.price = typeof data.price === 'number' ? data.price : parseFloat(data.price) || 0;
    data.categoryId = categoryId;
    data.sortOrder = count;
    // Only pass defined values so Prisma doesn't receive undefined
    const createData = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) createData[k] = v;
    }
    const created = await prisma.product.create({ data: createData });
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /api/products', err);
    res.status(500).json({ error: err.message || 'Failed to create product' });
  }
});

app.patch('/api/products/:id', async (req, res) => {
  try {
    const data = productDataFromBody(req.body);
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No fields to update' });
    const updated = await prisma.product.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (err) {
    console.error('PATCH /api/products/:id', err);
    res.status(500).json({ error: err.message || 'Failed to update product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/products/:id', err);
    res.status(500).json({ error: err.message || 'Failed to delete product' });
  }
});

// REST: subproduct groups
app.get('/api/subproduct-groups', async (req, res) => {
  const groups = await prisma.subproductGroup.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(groups);
});

app.post('/api/subproduct-groups', async (req, res) => {
  try {
    const { name } = req.body;
    const count = await prisma.subproductGroup.count();
    const created = await prisma.subproductGroup.create({
      data: { name: name != null && String(name).trim() !== '' ? String(name).trim() : 'New group', sortOrder: count }
    });
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /api/subproduct-groups', err);
    res.status(500).json({ error: err.message || 'Failed to create group' });
  }
});

app.patch('/api/subproduct-groups/:id', async (req, res) => {
  try {
    const { name, sortOrder } = req.body;
    const data = {};
    if (name !== undefined) data.name = String(name).trim() || 'New group';
    if (typeof sortOrder === 'number') data.sortOrder = sortOrder;
    const updated = await prisma.subproductGroup.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (err) {
    console.error('PATCH /api/subproduct-groups/:id', err);
    res.status(500).json({ error: err.message || 'Failed to update group' });
  }
});

app.delete('/api/subproduct-groups/:id', async (req, res) => {
  try {
    await prisma.subproductGroup.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/subproduct-groups/:id', err);
    res.status(500).json({ error: err.message || 'Failed to delete group' });
  }
});

// REST: subproducts by group
app.get('/api/subproduct-groups/:id/subproducts', async (req, res) => {
  const subproducts = await prisma.subproduct.findMany({
    where: { groupId: req.params.id },
    orderBy: { sortOrder: 'asc' }
  });
  res.json(subproducts);
});

/** Parse subproduct price from JSON body (Control sends strings from the keypad). */
function subproductPriceFromBody(price) {
  if (price === undefined) return undefined;
  if (price === null || price === '') return null;
  const n = typeof price === 'number' ? price : parseFloat(String(price).replace(/,/g, '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/** Optional string fields for subproduct (empty or "--" → null). */
function subproductOptionalTextField(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  if (s === '' || s === '--') return null;
  return s;
}

app.post('/api/subproducts', async (req, res) => {
  try {
    const { name, groupId, price, keyName, vatTakeOut } = req.body;
    if (!groupId) return res.status(400).json({ error: 'groupId required' });
    const count = await prisma.subproduct.count({ where: { groupId } });
    const data = {
      name: name != null && String(name).trim() !== '' ? String(name).trim() : 'New subproduct',
      groupId,
      sortOrder: count
    };
    const parsedPrice = subproductPriceFromBody(price);
    if (parsedPrice !== undefined && parsedPrice !== null) data.price = parsedPrice;
    const kn = subproductOptionalTextField(keyName);
    if (kn !== undefined) data.keyName = kn;
    const vt = subproductOptionalTextField(vatTakeOut);
    if (vt !== undefined) data.vatTakeOut = vt;
    const created = await prisma.subproduct.create({ data });
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /api/subproducts', err);
    res.status(500).json({ error: err.message || 'Failed to create subproduct' });
  }
});

app.patch('/api/subproducts/:id', async (req, res) => {
  try {
    const { name, sortOrder, price, keyName, vatTakeOut } = req.body;
    const data = {};
    if (name !== undefined) data.name = String(name).trim() || 'New subproduct';
    if (typeof sortOrder === 'number') data.sortOrder = sortOrder;
    if (price !== undefined) {
      data.price = subproductPriceFromBody(price);
    }
    if (keyName !== undefined) data.keyName = subproductOptionalTextField(keyName);
    if (vatTakeOut !== undefined) data.vatTakeOut = subproductOptionalTextField(vatTakeOut);
    const updated = await prisma.subproduct.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (err) {
    console.error('PATCH /api/subproducts/:id', err);
    res.status(500).json({ error: err.message || 'Failed to update subproduct' });
  }
});

app.delete('/api/subproducts/:id', async (req, res) => {
  try {
    await prisma.subproduct.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/subproducts/:id', err);
    res.status(500).json({ error: err.message || 'Failed to delete subproduct' });
  }
});

// REST: kitchens (KDS stations; new kitchens get PIN 1234 by default)
app.get('/api/kitchens', async (req, res) => {
  try {
    const list = await prisma.kitchen.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, productIdsJson: true }
    });
    res.json(
      list.map((row) => ({
        id: row.id,
        name: row.name,
        productIds: parseKitchenProductIds(row.productIdsJson)
      }))
    );
  } catch (err) {
    console.error('GET /api/kitchens', err);
    res.status(500).json({ error: err.message || 'Failed to fetch kitchens' });
  }
});

/** KDS / tablet login — verify PIN without exposing pins in GET /kitchens. */
app.post('/api/kitchens/verify-pin', async (req, res) => {
  try {
    const kitchenId = req.body?.kitchenId != null ? String(req.body.kitchenId).trim() : '';
    const pin = req.body?.pin != null ? String(req.body.pin).trim() : '';
    if (!kitchenId) return res.status(400).json({ error: 'kitchenId required' });
    const row = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
      select: { id: true, name: true, pin: true, productIdsJson: true }
    });
    if (!row) return res.status(401).json({ error: 'Invalid kitchen or PIN' });
    if (row.pin !== pin) return res.status(401).json({ error: 'Invalid kitchen or PIN' });
    res.json({
      id: row.id,
      name: row.name,
      productIds: parseKitchenProductIds(row.productIdsJson)
    });
  } catch (err) {
    console.error('POST /api/kitchens/verify-pin', err);
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

app.post('/api/kitchens', async (req, res) => {
  try {
    const name =
      req.body?.name != null && String(req.body.name).trim() !== ''
        ? String(req.body.name).trim()
        : 'Kitchen';
    const pinRaw = req.body?.pin;
    const pin =
      pinRaw != null && String(pinRaw).trim() !== '' ? String(pinRaw).trim() : '1234';
    const created = await prisma.kitchen.create({ data: { name, pin } });
    res.status(201).json({
      id: created.id,
      name: created.name,
      productIds: parseKitchenProductIds(created.productIdsJson)
    });
    io.emit('kitchens:updated');
  } catch (err) {
    console.error('POST /api/kitchens', err);
    res.status(500).json({ error: err.message || 'Failed to create kitchen' });
  }
});

app.patch('/api/kitchens/:id', async (req, res) => {
  try {
    const kitchenId = req.params.id;
    const data = {};
    if (req.body?.name != null) {
      data.name =
        String(req.body.name).trim() !== '' ? String(req.body.name).trim() : 'Kitchen';
    }
    if (req.body?.pin != null && String(req.body.pin).trim() !== '') {
      data.pin = String(req.body.pin).trim();
    }

    if (req.body?.productIds != null) {
      const raw = Array.isArray(req.body.productIds)
        ? req.body.productIds.map((x) => String(x).trim()).filter(Boolean)
        : [];
      const arr = [...new Set(raw)];
      const newSet = new Set(arr);

      await prisma.$transaction(async (tx) => {
        const others = await tx.kitchen.findMany({
          where: { id: { not: kitchenId } },
          select: { id: true, productIdsJson: true }
        });
        for (const k of others) {
          const current = parseKitchenProductIds(k.productIdsJson);
          const filtered = current.filter((pid) => !newSet.has(pid));
          if (filtered.length !== current.length) {
            await tx.kitchen.update({
              where: { id: k.id },
              data: { productIdsJson: JSON.stringify(filtered) }
            });
          }
        }
        await tx.kitchen.update({
          where: { id: kitchenId },
          data: { ...data, productIdsJson: JSON.stringify(arr) }
        });
      });

      const updated = await prisma.kitchen.findUnique({
        where: { id: kitchenId },
        select: { id: true, name: true, productIdsJson: true }
      });
      if (!updated) return res.status(404).json({ error: 'Kitchen not found' });
      res.json({
        id: updated.id,
        name: updated.name,
        productIds: parseKitchenProductIds(updated.productIdsJson)
      });
      io.emit('kitchens:updated');
      return;
    }

    if (Object.keys(data).length === 0) {
      const row = await prisma.kitchen.findUnique({
        where: { id: kitchenId },
        select: { id: true, name: true, productIdsJson: true }
      });
      if (!row) return res.status(404).json({ error: 'Kitchen not found' });
      return res.json({
        id: row.id,
        name: row.name,
        productIds: parseKitchenProductIds(row.productIdsJson)
      });
    }
    const updated = await prisma.kitchen.update({
      where: { id: kitchenId },
      data
    });
    res.json({
      id: updated.id,
      name: updated.name,
      productIds: parseKitchenProductIds(updated.productIdsJson)
    });
    io.emit('kitchens:updated');
  } catch (err) {
    console.error('PATCH /api/kitchens/:id', err);
    res.status(500).json({ error: err.message || 'Failed to update kitchen' });
  }
});

app.delete('/api/kitchens/:id', async (req, res) => {
  try {
    if (req.params.id === KITCHEN_KDS_ADMIN_ID) {
      return res.status(400).json({ error: 'Cannot delete the KDS admin kitchen' });
    }
    await prisma.kitchen.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
    io.emit('kitchens:updated');
  } catch (err) {
    console.error('DELETE /api/kitchens/:id', err);
    res.status(500).json({ error: err.message || 'Failed to delete kitchen' });
  }
});

// REST: discounts
app.get('/api/discounts', async (req, res) => {
  try {
    const list = await prisma.discount.findMany({ orderBy: { name: 'asc' } });
    res.json(list);
  } catch (err) {
    console.error('GET /api/discounts', err);
    res.status(500).json({ error: err.message || 'Failed to fetch discounts' });
  }
});

function normalizeDiscountTargetIdsJson(body) {
  if (body?.targetIdsJson != null && String(body.targetIdsJson).trim() !== '') {
    try {
      const p = JSON.parse(String(body.targetIdsJson));
      return Array.isArray(p) ? JSON.stringify(p.map((x) => String(x)).filter(Boolean)) : null;
    } catch {
      return null;
    }
  }
  if (Array.isArray(body?.targetIds)) {
    const ids = body.targetIds.map((x) => String(x)).filter(Boolean);
    return ids.length ? JSON.stringify(ids) : null;
  }
  return null;
}

app.post('/api/discounts', async (req, res) => {
  try {
    const body = req.body || {};
    const today = new Date().toISOString().slice(0, 10);
    const created = await prisma.discount.create({
      data: {
        name: body.name != null && String(body.name).trim() !== '' ? String(body.name).trim() : 'New discount',
        trigger: body.trigger != null ? String(body.trigger) : 'number',
        type: body.type != null ? String(body.type) : 'amount',
        value: body.value != null ? String(body.value) : null,
        startDate: body.startDate != null ? String(body.startDate) : today,
        endDate: body.endDate != null ? String(body.endDate) : today,
        discountOn: body.discountOn != null ? String(body.discountOn) : 'products',
        pieces: body.pieces != null ? String(body.pieces) : null,
        combinable: body.combinable === true,
        targetIdsJson: normalizeDiscountTargetIdsJson(body),
      }
    });
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /api/discounts', err);
    res.status(500).json({ error: err.message || 'Failed to create discount' });
  }
});

app.patch('/api/discounts/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const data = {};
    if (body.name !== undefined) data.name = String(body.name ?? '').trim() || 'New discount';
    if (body.trigger !== undefined) data.trigger = String(body.trigger);
    if (body.type !== undefined) data.type = String(body.type);
    if (body.value !== undefined) data.value = body.value != null ? String(body.value) : null;
    if (body.startDate !== undefined) data.startDate = body.startDate != null ? String(body.startDate) : null;
    if (body.endDate !== undefined) data.endDate = body.endDate != null ? String(body.endDate) : null;
    if (body.discountOn !== undefined) data.discountOn = body.discountOn != null ? String(body.discountOn) : null;
    if (body.pieces !== undefined) data.pieces = body.pieces != null ? String(body.pieces) : null;
    if (body.combinable !== undefined) data.combinable = body.combinable === true;
    if (body.targetIdsJson !== undefined || body.targetIds !== undefined) {
      data.targetIdsJson = normalizeDiscountTargetIdsJson(body);
    }
    const updated = await prisma.discount.update({
      where: { id: req.params.id },
      data
    });
    res.json(updated);
  } catch (err) {
    console.error('PATCH /api/discounts/:id', err);
    res.status(500).json({ error: err.message || 'Failed to update discount' });
  }
});

app.delete('/api/discounts/:id', async (req, res) => {
  try {
    await prisma.discount.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/discounts/:id', err);
    res.status(500).json({ error: err.message || 'Failed to delete discount' });
  }
});

// REST: production messages (Control → preset texts for production tickets)
app.get('/api/production-messages', async (req, res) => {
  try {
    const list = await prisma.productionMessage.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(list);
  } catch (err) {
    console.error('GET /api/production-messages', err);
    res.status(500).json({ error: err.message || 'Failed to fetch production messages' });
  }
});

app.post('/api/production-messages', async (req, res) => {
  try {
    const text = String(req.body?.text ?? '').trim();
    if (!text) return res.status(400).json({ error: 'text required' });
    const agg = await prisma.productionMessage.aggregate({ _max: { sortOrder: true } });
    const sortOrder = (agg._max.sortOrder ?? -1) + 1;
    const created = await prisma.productionMessage.create({ data: { text, sortOrder } });
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /api/production-messages', err);
    res.status(500).json({ error: err.message || 'Failed to create production message' });
  }
});

app.patch('/api/production-messages/:id', async (req, res) => {
  try {
    const textRaw = req.body?.text;
    if (textRaw === undefined) return res.status(400).json({ error: 'text required' });
    const text = String(textRaw).trim() || 'Message';
    const updated = await prisma.productionMessage.update({
      where: { id: req.params.id },
      data: { text }
    });
    res.json(updated);
  } catch (err) {
    console.error('PATCH /api/production-messages/:id', err);
    res.status(500).json({ error: err.message || 'Failed to update production message' });
  }
});

app.delete('/api/production-messages/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await prisma.productionMessage.delete({ where: { id } });
    const rest = await prisma.productionMessage.findMany({ orderBy: { sortOrder: 'asc' } });
    await prisma.$transaction(
      rest.map((row, i) =>
        prisma.productionMessage.update({ where: { id: row.id }, data: { sortOrder: i } })
      )
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/production-messages/:id', err);
    res.status(500).json({ error: err.message || 'Failed to delete production message' });
  }
});

function printerLabelRowToApi(row) {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    sizeLabel: row.sizeLabel || row.name,
    height: row.height ?? undefined,
    width: row.width ?? undefined,
    standard: !!row.standard,
    marginLeft: row.marginLeft ?? 0,
    marginRight: row.marginRight ?? 0,
    marginBottom: row.marginBottom ?? 0,
    marginTop: row.marginTop ?? 0,
    sortOrder: row.sortOrder ?? 0,
  };
}

function parsePrinterLabelMargins(body) {
  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.trunc(x) : 0;
  };
  return {
    marginLeft: n(body?.marginLeft),
    marginRight: n(body?.marginRight),
    marginBottom: n(body?.marginBottom),
    marginTop: n(body?.marginTop),
  };
}

// REST: printer label presets (Control → Labels tab)
app.get('/api/printer-labels', async (req, res) => {
  try {
    const list = await prisma.printerLabel.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(list.map(printerLabelRowToApi));
  } catch (err) {
    console.error('GET /api/printer-labels', err);
    res.status(500).json({ error: err.message || 'Failed to fetch printer labels' });
  }
});

app.post('/api/printer-labels', async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    const sizeLabel = body.sizeLabel != null && String(body.sizeLabel).trim() !== '' ? String(body.sizeLabel).trim() : name;
    const margins = parsePrinterLabelMargins(body);
    const agg = await prisma.printerLabel.aggregate({ _max: { sortOrder: true } });
    const sortOrder = (agg._max.sortOrder ?? -1) + 1;
    const created = await prisma.printerLabel.create({
      data: {
        name,
        sizeLabel,
        height: body.height != null && String(body.height).trim() !== '' ? String(body.height).trim() : null,
        width: body.width != null && String(body.width).trim() !== '' ? String(body.width).trim() : null,
        standard: body.standard === true,
        ...margins,
        sortOrder,
      }
    });
    res.status(201).json(printerLabelRowToApi(created));
  } catch (err) {
    console.error('POST /api/printer-labels', err);
    res.status(500).json({ error: err.message || 'Failed to create printer label' });
  }
});

app.patch('/api/printer-labels/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const data = {};
    if (body.name !== undefined) data.name = String(body.name ?? '').trim() || 'Label';
    if (body.sizeLabel !== undefined) data.sizeLabel = String(body.sizeLabel ?? '').trim() || null;
    if (body.height !== undefined) data.height = body.height != null && String(body.height).trim() !== '' ? String(body.height).trim() : null;
    if (body.width !== undefined) data.width = body.width != null && String(body.width).trim() !== '' ? String(body.width).trim() : null;
    if (body.standard !== undefined) data.standard = body.standard === true;
    if (body.sortOrder !== undefined) {
      const n = Number.parseInt(String(body.sortOrder), 10);
      if (Number.isInteger(n) && n >= 0) data.sortOrder = n;
    }
    if (body.marginLeft !== undefined || body.marginRight !== undefined || body.marginBottom !== undefined || body.marginTop !== undefined) {
      const m = parsePrinterLabelMargins({ ...body });
      Object.assign(data, m);
    }
    const updated = await prisma.printerLabel.update({
      where: { id: req.params.id },
      data
    });
    res.json(printerLabelRowToApi(updated));
  } catch (err) {
    console.error('PATCH /api/printer-labels/:id', err);
    res.status(500).json({ error: err.message || 'Failed to update printer label' });
  }
});

app.delete('/api/printer-labels/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await prisma.printerLabel.delete({ where: { id } });
    const rest = await prisma.printerLabel.findMany({ orderBy: { sortOrder: 'asc' } });
    await prisma.$transaction(
      rest.map((row, i) =>
        prisma.printerLabel.update({ where: { id: row.id }, data: { sortOrder: i } })
      )
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/printer-labels/:id', err);
    res.status(500).json({ error: err.message || 'Failed to delete printer label' });
  }
});

// REST: app settings (e.g. language)
const SETTING_KEY_LANGUAGE = 'language';
const SETTING_KEY_CREDIT_CARD = 'pos_credit_card';
const SETTING_KEY_BARCODE_SCANNER = 'pos_barcode_scanner';
const SETTING_KEY_RFID_READER = 'pos_rfid_reader';
const SETTING_KEY_SCALE = 'pos_scale';
const SETTING_KEY_PRODUCT_POSITIONING_LAYOUT = 'product_positioning_layout';
const SETTING_KEY_PRODUCT_POSITIONING_COLORS = 'product_positioning_colors';
const SETTING_KEY_KDS_LINE_STATES = 'kds_line_states';
const SETTING_KEY_KDS_DISMISSED = 'kds_dismissed';
const KDS_LINE_STATUS = new Set(['received', 'started', 'finished']);
const SETTING_KEY_FUNCTION_BUTTONS_LAYOUT = 'function_buttons_layout';
const SETTING_KEY_DEVICE_SETTINGS = 'device_settings';
const SETTING_KEY_SYSTEM_SETTINGS = 'system_settings';
const SETTING_KEY_PRODUCTION_MESSAGES = 'production_messages';
const SETTING_KEY_PRINTER_LABELS = 'pos_printer_labels';
const SETTING_KEY_REPORT_SETTINGS = 'report_settings';
/** Persisted kiosk self-order basket (subproduct lines); survives refresh. */
const SETTING_KEY_KIOSK_BASKET = 'kiosk_basket_draft';
const KIOSK_BASKET_MAX_LINES = 300;

function normalizeKioskBasketPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { lines: [] };
  const rawLines = raw.lines;
  if (!Array.isArray(rawLines)) return { lines: [] };
  const lines = [];
  for (const item of rawLines) {
    if (lines.length >= KIOSK_BASKET_MAX_LINES) break;
    if (!item || typeof item !== 'object') continue;
    const lineId = String(item.lineId || '').trim().slice(0, 128);
    if (!lineId) continue;
    const name = String(item.name || '').trim().slice(0, 500);
    const parentProductName = String(item.parentProductName || '').trim().slice(0, 500);
    const subproductId = item.subproductId != null ? String(item.subproductId).trim().slice(0, 64) : '';
    const price = Number(item.price);
    const safePrice = Number.isFinite(price) ? Math.max(0, Math.min(price, 999999.99)) : 0;
    let qty = Math.floor(Number(item.quantity));
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    if (qty > 999) qty = 999;
    const kioskPicture = String(item.kioskPicture || '').trim().slice(0, 512);
    const parentProductId =
      item.parentProductId != null ? String(item.parentProductId).trim().slice(0, 64) : '';
    const groupInstanceId = String(item.groupInstanceId || '').trim().slice(0, 128);
    const parentProductPriceRaw = Number(item.parentProductPrice);
    const parentProductPrice = Number.isFinite(parentProductPriceRaw)
      ? Math.max(0, Math.min(parentProductPriceRaw, 999999.99))
      : 0;
    lines.push({
      lineId,
      parentProductName,
      parentProductId,
      groupInstanceId,
      parentProductPrice,
      subproductId,
      name,
      price: safePrice,
      quantity: qty,
      kioskPicture,
    });
  }
  return { lines };
}
const FUNCTION_BUTTON_LAYOUT_ALLOWED_IDS = [
  'weborders',
  'in-wacht',
  'geplande-orders',
  'reservaties',
  'verkopers'
];
const FUNCTION_BUTTON_LAYOUT_SLOT_COUNT = 4;
const normalizeFunctionButtonsLayout = (value) => {
  if (!Array.isArray(value)) return Array(FUNCTION_BUTTON_LAYOUT_SLOT_COUNT).fill('');
  const next = Array(FUNCTION_BUTTON_LAYOUT_SLOT_COUNT).fill('');
  const used = new Set();
  for (let i = 0; i < FUNCTION_BUTTON_LAYOUT_SLOT_COUNT; i += 1) {
    const candidate = String(value[i] || '').trim();
    if (!candidate) continue;
    if (!FUNCTION_BUTTON_LAYOUT_ALLOWED_IDS.includes(candidate)) continue;
    if (used.has(candidate)) continue;
    next[i] = candidate;
    used.add(candidate);
  }
  return next;
};
function normalizeKdsLineStates(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [oid, lines] of Object.entries(raw)) {
    const orderId = String(oid || '').trim();
    if (!orderId || !lines || typeof lines !== 'object' || Array.isArray(lines)) continue;
    const inner = {};
    for (const [lk, st] of Object.entries(lines)) {
      const key = String(lk || '').trim();
      const status = String(st || '').trim();
      if (!key || !KDS_LINE_STATUS.has(status)) continue;
      inner[key] = status;
    }
    if (Object.keys(inner).length) out[orderId] = inner;
  }
  return out;
}

function normalizeReportSettings(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const autoCreateHourRaw = String(source.autoCreateHour ?? '00').trim();
  const hourNum = Number.parseInt(autoCreateHourRaw, 10);
  const hour = Number.isFinite(hourNum) ? Math.max(0, Math.min(hourNum, 23)) : 0;
  const sectionVisibilityRaw =
    source.sectionVisibility && typeof source.sectionVisibility === 'object' && !Array.isArray(source.sectionVisibility)
      ? source.sectionVisibility
      : {};
  return {
    sectionVisibility: {
      categoryTotals: sectionVisibilityRaw.categoryTotals === true,
      productTotals: sectionVisibilityRaw.productTotals === true,
      hourTotals: sectionVisibilityRaw.hourTotals === true,
      hourTotalsPerUser: sectionVisibilityRaw.hourTotalsPerUser === true,
    },
    dailyAutoCreateEnabled: source.dailyAutoCreateEnabled === true,
    autoCreateHour: String(hour).padStart(2, '0'),
    sendEmailTo: String(source.sendEmailTo ?? '').trim().slice(0, 320),
  };
}

async function loadKdsLineStatesMap() {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_KDS_LINE_STATES } });
  if (!row?.value) return {};
  try {
    return normalizeKdsLineStates(JSON.parse(row.value));
  } catch {
    return {};
  }
}

async function saveKdsLineStatesMap(map) {
  const safe = normalizeKdsLineStates(map);
  const serialized = JSON.stringify(safe);
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY_KDS_LINE_STATES },
    create: { key: SETTING_KEY_KDS_LINE_STATES, value: serialized },
    update: { value: serialized }
  });
  return safe;
}

function normalizeKdsDismissed(raw) {
  let global = [];
  let byKitchen = [];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (Array.isArray(raw.global)) global = raw.global.map((x) => String(x || '').trim()).filter(Boolean);
    if (Array.isArray(raw.byKitchen)) {
      byKitchen = raw.byKitchen.map((x) => String(x || '').trim()).filter((e) => e.includes('::'));
    }
  } else if (Array.isArray(raw)) {
    for (const e of raw) {
      if (typeof e !== 'string' || !e) continue;
      const s = e.trim();
      if (s.includes('::')) byKitchen.push(s);
      else global.push(s);
    }
  }
  return {
    global: [...new Set(global)],
    byKitchen: [...new Set(byKitchen)]
  };
}

async function loadKdsDismissed() {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_KDS_DISMISSED } });
  if (!row?.value) return { global: [], byKitchen: [] };
  try {
    return normalizeKdsDismissed(JSON.parse(row.value));
  } catch {
    return { global: [], byKitchen: [] };
  }
}

async function saveKdsDismissed(data) {
  const safe = normalizeKdsDismissed(data);
  const serialized = JSON.stringify(safe);
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY_KDS_DISMISSED },
    create: { key: SETTING_KEY_KDS_DISMISSED, value: serialized },
    update: { value: serialized }
  });
  return safe;
}

app.get('/api/settings/language', async (req, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_LANGUAGE } });
    res.json({ value: row ? row.value : 'en' });
  } catch (err) {
    console.error('GET /api/settings/language', err);
    res.status(500).json({ error: err.message || 'Failed to get language' });
  }
});

app.put('/api/settings/language', async (req, res) => {
  try {
    const value = req.body?.value != null ? String(req.body.value) : 'en';
    const allowed = ['en', 'nl', 'fr', 'tr'];
    const safe = allowed.includes(value) ? value : 'en';
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_LANGUAGE },
      create: { key: SETTING_KEY_LANGUAGE, value: safe },
      update: { value: safe }
    });
    res.json({ value: safe });
  } catch (err) {
    console.error('PUT /api/settings/language', err);
    res.status(500).json({ error: err.message || 'Failed to save language' });
  }
});

app.get('/api/settings/product-positioning-layout', async (req, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_PRODUCT_POSITIONING_LAYOUT } });
    if (!row?.value) {
      res.json({ value: {} });
      return;
    }
    const parsed = JSON.parse(row.value);
    res.json({ value: parsed && typeof parsed === 'object' ? parsed : {} });
  } catch (err) {
    console.error('GET /api/settings/product-positioning-layout', err);
    res.status(500).json({ error: err.message || 'Failed to get product positioning layout' });
  }
});

app.put('/api/settings/product-positioning-layout', async (req, res) => {
  try {
    const incoming = req.body?.value;
    const safeValue = incoming && typeof incoming === 'object' ? incoming : {};
    const serialized = JSON.stringify(safeValue);
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_PRODUCT_POSITIONING_LAYOUT },
      create: { key: SETTING_KEY_PRODUCT_POSITIONING_LAYOUT, value: serialized },
      update: { value: serialized }
    });
    res.json({ value: safeValue });
  } catch (err) {
    console.error('PUT /api/settings/product-positioning-layout', err);
    res.status(500).json({ error: err.message || 'Failed to save product positioning layout' });
  }
});

app.get('/api/settings/product-positioning-colors', async (req, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_PRODUCT_POSITIONING_COLORS } });
    if (!row?.value) {
      res.json({ value: {} });
      return;
    }
    const parsed = JSON.parse(row.value);
    res.json({ value: parsed && typeof parsed === 'object' ? parsed : {} });
  } catch (err) {
    console.error('GET /api/settings/product-positioning-colors', err);
    res.status(500).json({ error: err.message || 'Failed to get product positioning colors' });
  }
});

app.put('/api/settings/product-positioning-colors', async (req, res) => {
  try {
    const incoming = req.body?.value;
    const safeValue = incoming && typeof incoming === 'object' ? incoming : {};
    const serialized = JSON.stringify(safeValue);
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_PRODUCT_POSITIONING_COLORS },
      create: { key: SETTING_KEY_PRODUCT_POSITIONING_COLORS, value: serialized },
      update: { value: serialized }
    });
    res.json({ value: safeValue });
  } catch (err) {
    console.error('PUT /api/settings/product-positioning-colors', err);
    res.status(500).json({ error: err.message || 'Failed to save product positioning colors' });
  }
});

app.get('/api/settings/kiosk-basket', async (req, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_KIOSK_BASKET } });
    if (!row?.value) {
      res.json({ value: { lines: [] } });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(row.value);
    } catch {
      res.json({ value: { lines: [] } });
      return;
    }
    const safe = normalizeKioskBasketPayload(parsed);
    res.json({ value: safe });
  } catch (err) {
    console.error('GET /api/settings/kiosk-basket', err);
    res.status(500).json({ error: err.message || 'Failed to get kiosk basket' });
  }
});

app.put('/api/settings/kiosk-basket', async (req, res) => {
  try {
    const safe = normalizeKioskBasketPayload(req.body?.value);
    const serialized = JSON.stringify(safe);
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_KIOSK_BASKET },
      create: { key: SETTING_KEY_KIOSK_BASKET, value: serialized },
      update: { value: serialized },
    });
    res.json({ value: safe });
  } catch (err) {
    console.error('PUT /api/settings/kiosk-basket', err);
    res.status(500).json({ error: err.message || 'Failed to save kiosk basket' });
  }
});

app.get('/api/settings/kds-line-states', async (req, res) => {
  try {
    const map = await loadKdsLineStatesMap();
    res.json({ value: map });
  } catch (err) {
    console.error('GET /api/settings/kds-line-states', err);
    res.status(500).json({ error: err.message || 'Failed to get KDS line states' });
  }
});

/** Merge line statuses for one order; broadcast so all KDS clients (incl. Admin ALL) stay in sync. */
app.patch('/api/settings/kds-line-states', async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    const lines = req.body?.lines;
    if (!orderId || !lines || typeof lines !== 'object' || Array.isArray(lines)) {
      return res.status(400).json({ error: 'orderId and lines object required' });
    }
    const current = await loadKdsLineStatesMap();
    const merged = { ...(current[orderId] || {}) };
    for (const [k, v] of Object.entries(lines)) {
      const key = String(k || '').trim();
      const status = String(v || '').trim();
      if (!key || !KDS_LINE_STATUS.has(status)) continue;
      merged[key] = status;
    }
    current[orderId] = merged;
    const safe = await saveKdsLineStatesMap(current);
    io.emit('kds:line-states', { orderId, lines: safe[orderId] || {} });
    res.json({ ok: true, orderId, lines: safe[orderId] || {} });
  } catch (err) {
    console.error('PATCH /api/settings/kds-line-states', err);
    res.status(500).json({ error: err.message || 'Failed to save KDS line states' });
  }
});

/** Bon klaar / ALL dismiss — shared across KDS clients (admin + stations on different devices). */
app.get('/api/settings/kds-dismissed', async (req, res) => {
  try {
    const safe = await loadKdsDismissed();
    res.json({ value: safe });
  } catch (err) {
    console.error('GET /api/settings/kds-dismissed', err);
    res.status(500).json({ error: err.message || 'Failed to get KDS dismissed orders' });
  }
});

app.put('/api/settings/kds-dismissed', async (req, res) => {
  try {
    const safe = await saveKdsDismissed(req.body?.value);
    io.emit('kds:dismissed', { global: safe.global, byKitchen: safe.byKitchen });
    res.json({ value: safe });
  } catch (err) {
    console.error('PUT /api/settings/kds-dismissed', err);
    res.status(500).json({ error: err.message || 'Failed to save KDS dismissed orders' });
  }
});

app.patch('/api/settings/kds-dismissed', async (req, res) => {
  try {
    const addGlobal = Array.isArray(req.body?.addGlobal) ? req.body.addGlobal : [];
    const addByKitchen = Array.isArray(req.body?.addByKitchen) ? req.body.addByKitchen : [];
    if (addGlobal.length === 0 && addByKitchen.length === 0) {
      return res.status(400).json({ error: 'addGlobal and/or addByKitchen required' });
    }
    const current = await loadKdsDismissed();
    const g = new Set(current.global);
    const b = new Set(current.byKitchen);
    for (const x of addGlobal) {
      const id = String(x || '').trim();
      if (id) g.add(id);
    }
    for (const x of addByKitchen) {
      const e = String(x || '').trim();
      if (e.includes('::')) b.add(e);
    }
    const safe = await saveKdsDismissed({ global: [...g], byKitchen: [...b] });
    io.emit('kds:dismissed', { global: safe.global, byKitchen: safe.byKitchen });
    res.json({ value: safe });
  } catch (err) {
    console.error('PATCH /api/settings/kds-dismissed', err);
    res.status(500).json({ error: err.message || 'Failed to merge KDS dismissed orders' });
  }
});

app.get('/api/settings/function-buttons-layout', async (req, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_FUNCTION_BUTTONS_LAYOUT } });
    if (!row?.value) {
      res.json({ value: normalizeFunctionButtonsLayout([]) });
      return;
    }
    const parsed = JSON.parse(row.value);
    res.json({ value: normalizeFunctionButtonsLayout(parsed) });
  } catch (err) {
    console.error('GET /api/settings/function-buttons-layout', err);
    res.status(500).json({ error: err.message || 'Failed to get function buttons layout' });
  }
});

app.put('/api/settings/function-buttons-layout', async (req, res) => {
  try {
    const incoming = req.body?.value;
    const safeValue = normalizeFunctionButtonsLayout(incoming);
    const serialized = JSON.stringify(safeValue);
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_FUNCTION_BUTTONS_LAYOUT },
      create: { key: SETTING_KEY_FUNCTION_BUTTONS_LAYOUT, value: serialized },
      update: { value: serialized }
    });
    res.json({ value: safeValue });
  } catch (err) {
    console.error('PUT /api/settings/function-buttons-layout', err);
    res.status(500).json({ error: err.message || 'Failed to save function buttons layout' });
  }
});

app.get('/api/settings/device-settings', async (req, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_DEVICE_SETTINGS } });
    if (!row?.value) {
      res.json({ value: {} });
      return;
    }
    const parsed = JSON.parse(row.value);
    res.json({ value: parsed && typeof parsed === 'object' ? parsed : {} });
  } catch (err) {
    console.error('GET /api/settings/device-settings', err);
    res.status(500).json({ error: err.message || 'Failed to get device settings' });
  }
});

app.put('/api/settings/device-settings', async (req, res) => {
  try {
    const incoming = req.body?.value;
    const safeValue = incoming && typeof incoming === 'object' ? incoming : {};
    const serialized = JSON.stringify(safeValue);
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_DEVICE_SETTINGS },
      create: { key: SETTING_KEY_DEVICE_SETTINGS, value: serialized },
      update: { value: serialized }
    });
    res.json({ value: safeValue });
  } catch (err) {
    console.error('PUT /api/settings/device-settings', err);
    res.status(500).json({ error: err.message || 'Failed to save device settings' });
  }
});

app.get('/api/settings/system-settings', async (req, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_SYSTEM_SETTINGS } });
    if (!row?.value) {
      res.json({ value: {} });
      return;
    }
    const parsed = JSON.parse(row.value);
    res.json({ value: parsed && typeof parsed === 'object' ? parsed : {} });
  } catch (err) {
    console.error('GET /api/settings/system-settings', err);
    res.status(500).json({ error: err.message || 'Failed to get system settings' });
  }
});

app.put('/api/settings/system-settings', async (req, res) => {
  try {
    const incoming = req.body?.value;
    const safeValue = incoming && typeof incoming === 'object' ? incoming : {};
    const serialized = JSON.stringify(safeValue);
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_SYSTEM_SETTINGS },
      create: { key: SETTING_KEY_SYSTEM_SETTINGS, value: serialized },
      update: { value: serialized }
    });
    res.json({ value: safeValue });
  } catch (err) {
    console.error('PUT /api/settings/system-settings', err);
    res.status(500).json({ error: err.message || 'Failed to save system settings' });
  }
});

app.get('/api/settings/reports', async (req, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_REPORT_SETTINGS } });
    if (!row?.value) {
      res.json({ value: normalizeReportSettings({}) });
      return;
    }
    const parsed = JSON.parse(row.value);
    res.json({ value: normalizeReportSettings(parsed) });
  } catch (err) {
    console.error('GET /api/settings/reports', err);
    res.status(500).json({ error: err.message || 'Failed to get report settings' });
  }
});

app.put('/api/settings/reports', async (req, res) => {
  try {
    const safeValue = normalizeReportSettings(req.body?.value);
    const serialized = JSON.stringify(safeValue);
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_REPORT_SETTINGS },
      create: { key: SETTING_KEY_REPORT_SETTINGS, value: serialized },
      update: { value: serialized },
    });
    res.json({ value: safeValue });
  } catch (err) {
    console.error('PUT /api/settings/reports', err);
    res.status(500).json({ error: err.message || 'Failed to save report settings' });
  }
});

app.get('/api/settings/production-messages', async (req, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_PRODUCTION_MESSAGES } });
    if (!row?.value) {
      res.json({ value: [] });
      return;
    }
    const parsed = JSON.parse(row.value);
    const value = Array.isArray(parsed) ? parsed : [];
    res.json({ value });
  } catch (err) {
    console.error('GET /api/settings/production-messages', err);
    res.status(500).json({ error: err.message || 'Failed to get production messages' });
  }
});

app.put('/api/settings/production-messages', async (req, res) => {
  try {
    const incoming = req.body?.value;
    const raw = Array.isArray(incoming) ? incoming : [];
    const safeValue = raw
      .filter((m) => m && typeof m === 'object')
      .map((m, i) => ({
        id: String(m.id != null && String(m.id).trim() !== '' ? m.id : `pm-${Date.now()}-${i}`),
        text: String(m.text != null ? m.text : ''),
        sortOrder: typeof m.sortOrder === 'number' && Number.isFinite(m.sortOrder) ? m.sortOrder : i
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m, i) => ({ ...m, sortOrder: i }));
    const serialized = JSON.stringify(safeValue);
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_PRODUCTION_MESSAGES },
      create: { key: SETTING_KEY_PRODUCTION_MESSAGES, value: serialized },
      update: { value: serialized }
    });
    res.json({ value: safeValue });
  } catch (err) {
    console.error('PUT /api/settings/production-messages', err);
    res.status(500).json({ error: err.message || 'Failed to save production messages' });
  }
});

app.get('/api/settings/credit-card', async (req, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_CREDIT_CARD } });
    let data = { type: 'disabled' };
    if (row?.value) {
      try {
        const parsed = JSON.parse(row.value);
        if (parsed && typeof parsed === 'object' && parsed.type) {
          data = { type: String(parsed.type) };
        }
      } catch (_) { }
    }
    res.json(data);
  } catch (err) {
    console.error('GET /api/settings/credit-card', err);
    res.status(500).json({ error: err.message || 'Failed to get credit card setting' });
  }
});

app.put('/api/settings/credit-card', async (req, res) => {
  try {
    const type = req.body?.type != null ? String(req.body.type) : 'disabled';
    const allowed = ['disabled', 'payworld', 'ccv', 'viva', 'viva-wallet'];
    const safeType = allowed.includes(type) ? type : 'disabled';
    const value = JSON.stringify({ type: safeType });
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_CREDIT_CARD },
      create: { key: SETTING_KEY_CREDIT_CARD, value },
      update: { value }
    });
    res.json({ type: safeType });
  } catch (err) {
    console.error('PUT /api/settings/credit-card', err);
    res.status(500).json({ error: err.message || 'Failed to save credit card setting' });
  }
});

app.get('/api/settings/barcode-scanner', async (req, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_BARCODE_SCANNER } });
    let data = { type: 'disabled' };
    if (row?.value) {
      try {
        const parsed = JSON.parse(row.value);
        if (parsed && typeof parsed === 'object' && parsed.type) {
          data = { type: String(parsed.type) };
        }
      } catch (_) { }
    }
    res.json(data);
  } catch (err) {
    console.error('GET /api/settings/barcode-scanner', err);
    res.status(500).json({ error: err.message || 'Failed to get barcode scanner setting' });
  }
});

app.put('/api/settings/barcode-scanner', async (req, res) => {
  try {
    const type = req.body?.type != null ? String(req.body.type) : 'disabled';
    const allowed = ['disabled', 'serial', 'keyboard-input', 'tcp-ip'];
    const safeType = allowed.includes(type) ? type : 'disabled';
    const value = JSON.stringify({ type: safeType });
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_BARCODE_SCANNER },
      create: { key: SETTING_KEY_BARCODE_SCANNER, value },
      update: { value }
    });
    res.json({ type: safeType });
  } catch (err) {
    console.error('PUT /api/settings/barcode-scanner', err);
    res.status(500).json({ error: err.message || 'Failed to save barcode scanner setting' });
  }
});

app.get('/api/settings/rfid-reader', async (req, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_RFID_READER } });
    let data = { type: 'disabled' };
    if (row?.value) {
      try {
        const parsed = JSON.parse(row.value);
        if (parsed && typeof parsed === 'object' && parsed.type) {
          data = { type: String(parsed.type) };
        }
      } catch (_) { }
    }
    res.json(data);
  } catch (err) {
    console.error('GET /api/settings/rfid-reader', err);
    res.status(500).json({ error: err.message || 'Failed to get RFID reader setting' });
  }
});

app.put('/api/settings/rfid-reader', async (req, res) => {
  try {
    const type = req.body?.type != null ? String(req.body.type) : 'disabled';
    const allowed = ['disabled', 'serial', 'usb-nfc'];
    const safeType = allowed.includes(type) ? type : 'disabled';
    const value = JSON.stringify({ type: safeType });
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_RFID_READER },
      create: { key: SETTING_KEY_RFID_READER, value },
      update: { value }
    });
    res.json({ type: safeType });
  } catch (err) {
    console.error('PUT /api/settings/rfid-reader', err);
    res.status(500).json({ error: err.message || 'Failed to save RFID reader setting' });
  }
});

function normalizeScaleConnectionMode(mode) {
  let s = String(mode ?? '').replace(/^\uFEFF/, '').trim().toLowerCase();
  s = s.replace(/_/g, '-').replace(/\//g, '-');
  if (s === 'tcp-ip' || s === 'tcpip') return 'tcp-ip';
  return 'serial';
}

function normalizeScaleType(type) {
  const s = String(type || '').trim().toLowerCase();
  if (s === 'aclas' || s === 'dialog-06' || s === 'cas') return s;
  return 'disabled';
}

function normalizeScaleSettingPayload(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const type = normalizeScaleType(source.type);
  const mode = normalizeScaleConnectionMode(source.mode);
  const lsmIp = String(source.lsmIp ?? '').trim().slice(0, 120);
  const port = String(source.port ?? '').trim().slice(0, 64);
  return {
    type,
    mode,
    lsmIp,
    port,
    useWeightScaleLabels: Boolean(source.useWeightScaleLabels),
    confirmWeight: source.confirmWeight !== false,
  };
}

async function loadScaleSettingFromDb() {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_SCALE } });
    if (!row?.value) return normalizeScaleSettingPayload({});
    const parsed = JSON.parse(row.value);
    return normalizeScaleSettingPayload(parsed);
  } catch {
    return normalizeScaleSettingPayload({});
  }
}

app.get('/api/settings/scale', async (req, res) => {
  try {
    const value = await loadScaleSettingFromDb();
    res.json(value);
  } catch (err) {
    console.error('GET /api/settings/scale', err);
    res.status(500).json({ error: err.message || 'Failed to get scale setting' });
  }
});

app.put('/api/settings/scale', async (req, res) => {
  try {
    const safe = normalizeScaleSettingPayload(req.body);
    const value = JSON.stringify(safe);
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_SCALE },
      create: { key: SETTING_KEY_SCALE, value },
      update: { value }
    });
    res.json(safe);
  } catch (err) {
    console.error('PUT /api/settings/scale', err);
    res.status(500).json({ error: err.message || 'Failed to save scale setting' });
  }
});

app.get('/api/settings/printer-labels', async (req, res) => {
  try {
    const defaults = { type: 'production-labels', printer: '' };
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_PRINTER_LABELS } });
    if (!row?.value) return res.json(defaults);
    try {
      const p = JSON.parse(row.value);
      res.json({
        type: normalizeLabelType(p?.type, defaults.type),
        printer: String(p?.printer || '').trim(),
      });
    } catch {
      res.json(defaults);
    }
  } catch (err) {
    console.error('GET /api/settings/printer-labels', err);
    res.status(500).json({ error: err.message || 'Failed to get printer labels settings' });
  }
});

app.put('/api/settings/printer-labels', async (req, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_PRINTER_LABELS } });
    let cur = { type: 'production-labels', printer: '' };
    if (row?.value) {
      try {
        const p = JSON.parse(row.value);
        if (p && typeof p === 'object') {
          cur = {
            type: normalizeLabelType(p?.type, cur.type),
            printer: String(p?.printer || '').trim(),
          };
        }
      } catch (_) { /* keep cur */ }
    }
    const next = {
      type: req.body?.type != null ? normalizeLabelType(req.body.type, cur.type) : cur.type,
      printer: req.body?.printer != null ? String(req.body.printer || '').trim() : cur.printer,
    };
    const value = JSON.stringify(next);
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_PRINTER_LABELS },
      create: { key: SETTING_KEY_PRINTER_LABELS, value },
      update: { value },
    });
    res.json(next);
  } catch (err) {
    console.error('PUT /api/settings/printer-labels', err);
    res.status(500).json({ error: err.message || 'Failed to save printer labels settings' });
  }
});

app.get('/api/products/:id/subproduct-links', async (req, res) => {
  try {
    const linksMap = await loadProductSubproductLinksMap();
    const links = normalizeProductSubproductLinks(linksMap?.[req.params.id]);
    const groupIds = [...new Set(links.map((l) => l.groupId).filter(Boolean))];
    const subproductIds = links.map((l) => l.subproductId);
    const [groups, subproducts] = await Promise.all([
      groupIds.length
        ? prisma.subproductGroup.findMany({ where: { id: { in: groupIds } } })
        : Promise.resolve([]),
      subproductIds.length
        ? prisma.subproduct.findMany({ where: { id: { in: subproductIds } } })
        : Promise.resolve([])
    ]);
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const subMap = new Map(subproducts.map((s) => [s.id, s]));
    const expanded = links
      .map((l) => {
        const sub = subMap.get(l.subproductId);
        if (!sub) return null;
        const group = groupMap.get(l.groupId);
        return {
          subproductId: sub.id,
          subproductName: sub.name,
          groupId: group?.id || sub.groupId || '',
          groupName: group?.name || ''
        };
      })
      .filter(Boolean);
    res.json(expanded);
  } catch (err) {
    console.error('GET /api/products/:id/subproduct-links', err);
    res.status(500).json({ error: err.message || 'Failed to load product subproduct links' });
  }
});

app.put('/api/products/:id/subproduct-links', async (req, res) => {
  try {
    const links = normalizeProductSubproductLinks(req.body?.links);
    const linksMap = await loadProductSubproductLinksMap();
    linksMap[req.params.id] = links;
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_PRODUCT_SUBPRODUCT_LINKS },
      create: { key: SETTING_KEY_PRODUCT_SUBPRODUCT_LINKS, value: JSON.stringify(linksMap) },
      update: { value: JSON.stringify(linksMap) }
    });
    res.json({ links });
  } catch (err) {
    console.error('PUT /api/products/:id/subproduct-links', err);
    res.status(500).json({ error: err.message || 'Failed to save product subproduct links' });
  }
});

app.get('/api/products/:id/kiosk-group-configuration', async (req, res) => {
  try {
    const productId = req.params.id;
    const linksMap = await loadProductSubproductLinksMap();
    const links = normalizeProductSubproductLinks(linksMap?.[productId]);
    const cfgRoot = await loadProductKioskGroupConfigMap();
    const productCfg =
      cfgRoot[productId] && typeof cfgRoot[productId] === 'object' ? cfgRoot[productId] : {};

    const orderedGroupIds = [];
    const seen = new Set();
    for (const l of links) {
      const gid = l.groupId != null ? String(l.groupId) : '';
      if (seen.has(gid)) continue;
      seen.add(gid);
      orderedGroupIds.push(gid);
    }

    const distinctRealIds = [...new Set(orderedGroupIds.filter((id) => id !== ''))];
    const subproductIds = links.map((l) => l.subproductId);
    const [groups, subproducts, productRow] = await Promise.all([
      distinctRealIds.length
        ? prisma.subproductGroup.findMany({ where: { id: { in: distinctRealIds } } })
        : Promise.resolve([]),
      subproductIds.length
        ? prisma.subproduct.findMany({ where: { id: { in: subproductIds } } })
        : Promise.resolve([]),
      prisma.product.findUnique({ where: { id: productId }, select: { name: true } })
    ]);
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const subById = new Map(subproducts.map((s) => [s.id, s]));

    orderedGroupIds.sort((a, b) => {
      if (a === '' && b === '') return 0;
      if (a === '') return 1;
      if (b === '') return -1;
      const ga = groupById.get(a);
      const gb = groupById.get(b);
      const sa = ga?.sortOrder ?? 0;
      const sb = gb?.sortOrder ?? 0;
      if (sa !== sb) return sa - sb;
      return String(ga?.name || '').localeCompare(String(gb?.name || ''));
    });

    const steps = [];
    for (let i = 0; i < 9; i++) {
      if (i >= orderedGroupIds.length) {
        steps.push({
          step: i + 1,
          groupId: null,
          groupName: '',
          sortOrder: 0,
          links: [],
          config: defaultKioskGroupConfig()
        });
        continue;
      }
      const gid = orderedGroupIds[i];
      const stepLinks = links
        .filter((l) => String(l.groupId != null ? l.groupId : '') === gid)
        .map((l) => {
          const sub = subById.get(l.subproductId);
          return {
            subproductId: l.subproductId,
            subproductName: sub?.name || ''
          };
        });
      const gmeta = gid === '' ? null : groupById.get(gid);
      const groupName = gid === '' ? '' : gmeta?.name || '';
      const sortOrder = gid === '' ? 999 : gmeta?.sortOrder ?? 0;
      steps.push({
        step: i + 1,
        groupId: gid,
        groupName,
        sortOrder,
        links: stepLinks,
        config: normalizeKioskGroupConfigEntry(productCfg[gid])
      });
    }

    res.json({ steps, productName: productRow?.name || '' });
  } catch (err) {
    console.error('GET /api/products/:id/kiosk-group-configuration', err);
    res.status(500).json({ error: err.message || 'Failed to load kiosk group configuration' });
  }
});

app.put('/api/products/:id/kiosk-group-configuration', async (req, res) => {
  try {
    const productId = req.params.id;
    const groupConfigs = req.body?.groupConfigs;
    if (!groupConfigs || typeof groupConfigs !== 'object') {
      return res.status(400).json({ error: 'groupConfigs object required' });
    }
    const map = await loadProductKioskGroupConfigMap();
    if (!map[productId] || typeof map[productId] !== 'object') map[productId] = {};
    for (const [gid, cfg] of Object.entries(groupConfigs)) {
      if (cfg == null || typeof cfg !== 'object') continue;
      const key = gid === '__none__' ? '' : String(gid);
      map[productId][key] = normalizeKioskGroupConfigEntry({ ...map[productId][key], ...cfg });
    }
    const value = JSON.stringify(map);
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_PRODUCT_KIOSK_GROUP_CONFIG },
      create: { key: SETTING_KEY_PRODUCT_KIOSK_GROUP_CONFIG, value },
      update: { value }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/products/:id/kiosk-group-configuration', err);
    res.status(500).json({ error: err.message || 'Failed to save kiosk group configuration' });
  }
});

// REST: orders (current/open/in_waiting/in_planning)
app.get('/api/orders', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const orders = await prisma.order.findMany({
    where: { status: { in: ['open', 'in_waiting', 'in_planning'] } },
    include: { items: orderItemsInclude, customer: true, user: true, payments: true }
  });
  res.json(orders);
});

function parseDdMmYyyy(str) {
  const m = String(str || '').trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const year = parseInt(m[3], 10);
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
  return d;
}

/** @param {Date} dayAnchor any moment on the target calendar day */
function dateAtTimeOnDay(dayAnchor, timeStr) {
  const t = String(timeStr || '').trim();
  const base = new Date(dayAnchor.getFullYear(), dayAnchor.getMonth(), dayAnchor.getDate());
  if (t === '24:00') {
    base.setDate(base.getDate() + 1);
    base.setHours(0, 0, 0, 0);
    return base;
  }
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  base.setHours(h, min, 0, 0);
  return base;
}

function parsePeriodicReportRange(startDate, startTime, endDate, endTime) {
  const sd = parseDdMmYyyy(startDate);
  const ed = parseDdMmYyyy(endDate);
  if (!sd || !ed) return { error: 'Invalid date. Use dd-mm-yyyy.' };
  const start = dateAtTimeOnDay(sd, startTime);
  const endExclusive = dateAtTimeOnDay(ed, endTime);
  if (!start || !endExclusive) return { error: 'Invalid time. Use HH:mm or 24:00.' };
  if (endExclusive.getTime() <= start.getTime()) return { error: 'End must be after start.' };
  return { start, endExclusive };
}

function sanitizeReportQueryParam(v, maxLen) {
  return String(v ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

const SETTING_FINANCIAL_PERIOD_START = 'financial_reporting_period_start_iso';
const SETTING_FINANCIAL_NEXT_Z = 'financial_next_z_number';

/** Start of the current open reporting period (after last Z, or epoch if never closed). */
async function getFinancialReportingPeriodStart(tx = prisma) {
  const row = await tx.appSetting.findUnique({ where: { key: SETTING_FINANCIAL_PERIOD_START } });
  const raw = row?.value?.trim();
  if (!raw) return new Date(0);
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

async function getFinancialNextZNumber(tx = prisma) {
  const row = await tx.appSetting.findUnique({ where: { key: SETTING_FINANCIAL_NEXT_Z } });
  const n = parseInt(String(row?.value ?? '1'), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

async function upsertAppSettingTx(tx, key, value) {
  await tx.appSetting.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
  });
}

const financialReportOrdersInclude = {
  items: orderItemsInclude,
  payments: { include: { paymentMethod: true } },
  user: true,
  posRegister: true,
};

function loadPaidOrdersForFinancialPeriod(tx, periodStart, periodEndExclusive) {
  return tx.order.findMany({
    where: {
      status: 'paid',
      updatedAt: { gte: periodStart, lt: periodEndExclusive },
    },
    include: financialReportOrdersInclude,
    orderBy: { updatedAt: 'asc' },
  });
}

/** Current open period + next Z number (for UI). */
app.get('/api/reports/financial/period', async (req, res) => {
  try {
    const periodStart = await getFinancialReportingPeriodStart();
    const nextZNumber = await getFinancialNextZNumber();
    res.json({
      periodStart: periodStart.toISOString(),
      nextZNumber,
    });
  } catch (err) {
    console.error('GET /api/reports/financial/period', err);
    res.status(500).json({ error: err.message || 'Failed to read reporting period' });
  }
});

/**
 * X report: interim snapshot since last Z. Read-only — no DB changes.
 */
app.get('/api/reports/financial/x', async (req, res) => {
  try {
    const periodStart = await getFinancialReportingPeriodStart();
    const periodEnd = new Date();
    const orders = await loadPaidOrdersForFinancialPeriod(prisma, periodStart, periodEnd);
    const lang = sanitizeReportQueryParam(req.query.lang, 8) || 'en';
    const userName = sanitizeReportQueryParam(req.query.userName, 120);
    const storeName = sanitizeReportQueryParam(req.query.storeName, 120);
    const { lines, summary } = buildFinancialReportReceiptLines({
      orders,
      kind: 'x',
      zNumber: null,
      periodStart,
      periodEnd,
      printedAt: new Date(),
      lang,
      userName,
      storeName,
    });
    const nextZNumber = await getFinancialNextZNumber();
    res.json({
      lines,
      summary,
      nextZNumber,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });
  } catch (err) {
    console.error('GET /api/reports/financial/x', err);
    res.status(500).json({ error: err.message || 'Failed to build X report' });
  }
});

/** Webpanel: Z preview (read-only) with register/manual-time + optional sections. */
app.post('/api/webpanel/reports/z-preview', async (req, res) => {
  try {
    const registerIdRaw = String(req.body?.registerId ?? '').trim();
    const registerId = registerIdRaw && registerIdRaw !== 'all' ? registerIdRaw : null;
    const createUntilMode = String(req.body?.createUntilMode ?? 'current').trim().toLowerCase() === 'manual' ? 'manual' : 'current';
    const manualDateRaw = String(req.body?.manualDate ?? '').trim();
    const manualHourNum = Number.parseInt(String(req.body?.manualHour ?? '0'), 10);
    const safeManualHour = Number.isFinite(manualHourNum) ? Math.max(0, Math.min(manualHourNum, 24)) : 0;
    const sectionVisibilityRaw =
      req.body?.sectionVisibility && typeof req.body.sectionVisibility === 'object' && !Array.isArray(req.body.sectionVisibility)
        ? req.body.sectionVisibility
        : {};
    const sectionVisibility = {
      categoryTotals: sectionVisibilityRaw.categoryTotals === true,
      productTotals: sectionVisibilityRaw.productTotals === true,
      hourTotals: sectionVisibilityRaw.hourTotals === true,
      hourTotalsPerUser: sectionVisibilityRaw.hourTotalsPerUser === true,
    };

    // Day-based preview only: ignore hour selection for report calculations.
    const now = new Date();
    let selectedDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    let displayPeriodEnd = new Date(now);
    if (createUntilMode === 'manual') {
      const base = parseDdMmYyyy(manualDateRaw);
      if (!base) return res.status(400).json({ error: 'Invalid manual date' });
      selectedDay = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
      displayPeriodEnd = new Date(selectedDay);
      displayPeriodEnd.setHours(safeManualHour, 0, 0, 0);
    } else {
      displayPeriodEnd = new Date(now);
    }
    const queryStart = new Date(selectedDay);
    let queryEndExclusive = new Date(selectedDay);
    queryEndExclusive.setDate(queryEndExclusive.getDate() + 1);
    // For today, don't include future time.
    if (
      selectedDay.getFullYear() === now.getFullYear() &&
      selectedDay.getMonth() === now.getMonth() &&
      selectedDay.getDate() === now.getDate()
    ) {
      queryEndExclusive = new Date(now);
    }
    const where = {
      status: 'paid',
      updatedAt: { gte: queryStart, lt: queryEndExclusive },
      ...(registerId ? { posRegisterId: registerId } : {}),
    };
    const orders = await prisma.order.findMany({
      where,
      include: financialReportOrdersInclude,
      orderBy: { updatedAt: 'asc' },
    });

    const nextZNumber = await getFinancialNextZNumber();
    const lang = sanitizeReportQueryParam(req.body?.lang, 8) || 'en';
    const isNl = String(lang).toLowerCase().startsWith('nl');
    const L = {
      date: isNl ? 'Date' : 'Date',
      time: isNl ? 'Tijd' : 'Time',
      financialZ: isNl ? 'Z FINANCIEEL' : 'Z FINANCIAL',
      terminals: isNl ? 'Terminals' : 'Terminals',
      categoryTotals: isNl ? 'Categorie totalen' : 'Category totals',
      productTotals: isNl ? 'Product totalen' : 'Product totals',
      vatPerRate: isNl ? 'BTW per tarief' : 'VAT per rate',
      vatCol: isNl ? 'Btw' : 'VAT',
      payments: isNl ? 'Betalingen' : 'Payments',
      total: isNl ? 'Totaal' : 'Total',
      takeOutOnly: isNl ? 'Take-out' : 'Take-out',
      eatIn: isNl ? 'Eat-In' : 'Eat-In',
      takeOut: isNl ? 'Take-Out' : 'Take-Out',
      ticketTypes: isNl ? 'Ticket soorten' : 'Ticket types',
      counterSales: isNl ? 'Toogverkoop' : 'Counter Sales',
      hourTotals: isNl ? 'Uur totalen' : 'Hour totals',
      hour: isNl ? 'uur' : 'hour',
      orders: isNl ? 'Orders' : 'Orders',
      amount: isNl ? 'Bedrag' : 'Amount',
      hourTotalsPerUser: isNl ? 'Uur totalen per gebruiker' : 'Hour totals per user',
      issuedVatTickets: isNl ? 'Uitgereikte BTW tickets:' : 'Issued VAT tickets:',
      returnTicketsCount: isNl ? 'Terugname tickets aantal:' : 'Return tickets count:',
      drawerNoSale: isNl ? 'Lade geopend zonder verkoop:' : 'Drawer opened without sale:',
      proFormaTickets: isNl ? 'Pro Forma tickets:' : 'Pro Forma tickets:',
      proFormaReturns: isNl ? 'Pro Forma terugnames:' : 'Pro Forma returns:',
      proFormaTurnover: isNl ? 'Pro Forma omzet (incl. BTW):' : 'Pro Forma turnover (incl. VAT):',
      soldGiftCards: isNl ? 'Verkochte kadobons:' : 'Sold gift cards:',
      soldGiftCardValue: isNl ? 'Verkochte kadobons waarde:' : 'Sold gift card value:',
      grantedDiscounts: isNl ? 'Toegekende kortingen:' : 'Granted discounts:',
      totalDiscountInclVat: isNl ? 'Totaalbedrag korting (incl. BTW):' : 'Total discount (incl. VAT):',
      totalCashRounding: isNl ? 'Totaalbedrag cash afrondingen:' : 'Total cash rounding:',
      creditTopUp: isNl ? 'Tegoed opwaardering:' : 'Credit top-up:',
      staffConsumptions: isNl ? 'Personeel consumpties:' : 'Staff consumptions:',
      onlineCashRefund: isNl ? 'Online betaling cash terugbetaald:' : 'Online payment cash refunded:',
      onlineOrders: isNl ? 'Aantal online orders:' : 'Number of online orders:',
    };
    const userName = sanitizeReportQueryParam(req.body?.userName, 120) || '';
    const storeName = sanitizeReportQueryParam(req.body?.storeName, 120) || '';
    const { lines: coreLines, summary } = buildFinancialReportReceiptLines({
      orders,
      kind: 'z',
      zNumber: nextZNumber,
      periodStart: queryStart,
      periodEnd: displayPeriodEnd,
      printedAt: new Date(),
      lang,
      userName,
      storeName,
    });

    const padRight = (value, length) => String(value ?? '').padEnd(length, ' ').slice(0, length);
    const padLeft = (value, length) => String(value ?? '').padStart(length, ' ').slice(-length);
    const dash = '-'.repeat(42);
    const sectionTitle = (label) => [dash, `    ${label}`.toUpperCase(), dash];
    const fmtMoney2 = (n) => (Number(n) || 0).toFixed(2);
    const fmtInt0 = (n) => String(Math.round(Number(n) || 0));
    const fmtHour = (h) => `${String(Math.max(0, Math.min(23, Number(h) || 0))).padStart(2, '0')}:00`;
    const lineLabelValue = (label, value) => {
      const left = String(label ?? '');
      const right = String(value ?? '');
      const maxLeft = Math.max(1, 42 - right.length - 1);
      return `${left.slice(0, maxLeft)}${' '.repeat(Math.max(1, 42 - Math.min(left.length, maxLeft) - right.length))}${right}`;
    };

    const terminalsMap = new Map();
    const categoryMap = new Map();
    const productMap = new Map();
    const hourMap = new Map();
    const hourUserMap = new Map();
    const paymentMap = new Map();
    const vatMap = new Map();
    const giftRe = /gift|kadobon|voucher|cadeau|kadobonn|hediye/i;
    const creditTopUpRe = /top[\s-]?up|opwaardering|opladen|reload|credit/i;
    const staffUseRe = /staff|personeel|employee/i;
    const cashRefundRe = /refund|terugbetaald|cash\s*back|retour/i;
    let grossTotal = 0;
    let ticketCount = 0;
    let eatInTotal = 0;
    let takeOutTotal = 0;
    let eatInCount = 0;
    let takeOutCount = 0;
    let returnTicketsCount = 0;
    let proFormaTickets = 0;
    let proFormaReturns = 0;
    let proFormaTurnover = 0;
    let soldGiftCards = 0;
    let soldGiftCardValue = 0;
    let grantedDiscounts = 0;
    let totalDiscountInclVat = 0;
    let totalCashRounding = 0;
    let creditTopUp = 0;
    let staffConsumptions = 0;
    let onlineCashRefund = 0;
    let onlineOrdersCount = 0;

    for (const o of orders) {
      const total = Number(o.total) || 0;
      grossTotal += total;
      ticketCount += 1;
      if (total < 0) returnTicketsCount += 1;
      if (String(o.source || '').toLowerCase() === 'weborder') onlineOrdersCount += 1;
      if (String(o.source || '').toLowerCase().includes('proforma')) {
        proFormaTickets += 1;
        proFormaTurnover += total;
        if (total < 0) proFormaReturns += 1;
      }
      const orderAt = new Date(o.updatedAt);
      const hour = Number(orderAt.getHours()) || 0;
      const registerName = String(o.posRegister?.name || o.posRegisterId || '—').trim() || '—';
      const terminal = terminalsMap.get(registerName) || { start: orderAt, end: orderAt };
      if (orderAt < terminal.start) terminal.start = orderAt;
      if (orderAt > terminal.end) terminal.end = orderAt;
      terminalsMap.set(registerName, terminal);

      const hourRow = hourMap.get(hour) || { hour, orders: 0, amount: 0 };
      hourRow.orders += 1;
      hourRow.amount += total;
      hourMap.set(hour, hourRow);

      const userNameRow = String(o.user?.name || o.userId || '—').trim() || '—';
      const byUser = hourUserMap.get(userNameRow) || new Map();
      const byUserHour = byUser.get(hour) || { hour, orders: 0, amount: 0 };
      byUserHour.orders += 1;
      byUserHour.amount += total;
      byUser.set(hour, byUserHour);
      hourUserMap.set(userNameRow, byUser);

      if (o.tableId) {
        eatInTotal += total;
        eatInCount += 1;
      } else {
        takeOutTotal += total;
        takeOutCount += 1;
      }

      if (Array.isArray(o.payments) && o.payments.length > 0) {
        let orderPaymentSum = 0;
        for (const p of o.payments) {
          const label = String(p.paymentMethod?.name || '—').trim() || '—';
          const amount = Number(p.amount) || 0;
          orderPaymentSum += amount;
          paymentMap.set(label, (paymentMap.get(label) || 0) + amount);
          if (giftRe.test(label)) {
            soldGiftCards += 1;
            soldGiftCardValue += amount;
          }
          if (creditTopUpRe.test(label)) creditTopUp += amount;
          if (staffUseRe.test(label)) staffConsumptions += amount;
          if (cashRefundRe.test(label)) onlineCashRefund += amount;
        }
        totalCashRounding += orderPaymentSum - total;
      } else {
        paymentMap.set('—', (paymentMap.get('—') || 0) + total);
      }

      const orderItemsGross = (o.items || []).reduce(
        (s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0),
        0,
      );
      const discountAmount = Math.max(0, orderItemsGross - total);
      if (discountAmount > 0.0001) {
        grantedDiscounts += 1;
        totalDiscountInclVat += discountAmount;
      }

      for (const it of o.items || []) {
        const qty = Number(it.quantity) || 0;
        const amount = (Number(it.price) || 0) * qty;
        const category = String(it.product?.category?.name || '—').trim() || '—';
        const product = String(it.product?.name || '—').trim() || '—';
        const c = categoryMap.get(category) || { label: category, qty: 0, amount: 0 };
        c.qty += qty;
        c.amount += amount;
        categoryMap.set(category, c);
        const p = productMap.get(product) || { label: product, qty: 0, amount: 0 };
        p.qty += qty;
        p.amount += amount;
        productMap.set(product, p);

        const eatIn = !!o.tableId;
        const vatStr = eatIn ? it.product?.vatEatIn : it.product?.vatTakeOut;
        const m = String(vatStr || '').match(/(\d+(?:[.,]\d+)?)/);
        const pct = m ? Number.parseFloat(m[1].replace(',', '.')) : null;
        const key = Number.isFinite(pct) ? `${pct}%` : '—';
        const base = vatMap.get(key) || { ns: 0, nr: 0, vat: 0, total: 0, pct: Number.isFinite(pct) ? pct : null };
        const gross = amount;
        const net = base.pct != null && base.pct > 0 ? gross / (1 + base.pct / 100) : gross;
        const vat = gross - net;
        if (eatIn) base.ns += net;
        else base.nr += net;
        base.vat += vat;
        base.total += gross;
        vatMap.set(key, base);
      }
    }

    const fmtDate = (d) => {
      const x = new Date(d);
      const dd = String(x.getDate()).padStart(2, '0');
      const mm = String(x.getMonth() + 1).padStart(2, '0');
      const yyyy = x.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };
    const fmtTime = (d) => {
      const x = new Date(d);
      const hh = String(x.getHours()).padStart(2, '0');
      const mm = String(x.getMinutes()).padStart(2, '0');
      const ss = String(x.getSeconds()).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    };

    const lines = [];
    lines.push('pospoint demo');
    lines.push('BE1234567890');
    lines.push('pospoint');
    lines.push('pospoint');
    lines.push('pospoint');
    lines.push(lineLabelValue(`${L.date} : ${fmtDate(displayPeriodEnd)}`, `${L.time}: ${fmtTime(displayPeriodEnd)}`));
    lines.push(dash);
    lines.push(`       ${L.financialZ} #${nextZNumber}`);
    lines.push(dash);
    lines.push(`${L.terminals}:`);
    for (const [name, v] of [...terminalsMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(lineLabelValue(name, `${fmtDate(v.start).slice(0, 5)}-${fmtTime(v.start).slice(0, 5)} => ${fmtDate(v.end).slice(0, 5)}-${fmtTime(v.end).slice(0, 5)}`));
    }

    if (sectionVisibility.categoryTotals) {
      const rows = [...categoryMap.values()].sort((a, b) => b.amount - a.amount);
      lines.push(...sectionTitle(L.categoryTotals));
      for (const r of rows) lines.push(`${padLeft(fmtInt0(r.qty), 3)} ${padRight(r.label, 28)} ${padLeft(fmtMoney2(r.amount), 8)}`);
      lines.push('');
      lines.push(lineLabelValue(fmtInt0(rows.reduce((s, r) => s + (Number(r.qty) || 0), 0)), `${L.total} ${fmtMoney2(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0))}`));
    }

    if (sectionVisibility.productTotals) {
      const rows = [...productMap.values()].sort((a, b) => b.amount - a.amount);
      lines.push(...sectionTitle(L.productTotals));
      for (const r of rows) lines.push(`${padLeft(fmtInt0(r.qty), 3)} ${padRight(r.label, 28)} ${padLeft(fmtMoney2(r.amount), 8)}`);
      lines.push('');
      lines.push(lineLabelValue(fmtInt0(rows.reduce((s, r) => s + (Number(r.qty) || 0), 0)), `${L.total} ${fmtMoney2(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0))}`));
    }

    lines.push(...sectionTitle(L.vatPerRate));
    lines.push(`${padRight('', 6)}${padLeft('MvH', 12)}${padLeft('MvH', 10)}${padLeft(L.vatCol, 8)}${padLeft(L.total, 9)}`);
    lines.push(`${padRight('', 6)}${padLeft('NS', 12)}${padLeft('NR', 10)}${padLeft('', 8)}${padLeft('', 9)}`);
    let vatNs = 0;
    let vatNr = 0;
    let vatVat = 0;
    let vatTotal = 0;
    for (const [rate, r] of [...vatMap.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
      vatNs += Number(r.ns) || 0;
      vatNr += Number(r.nr) || 0;
      vatVat += Number(r.vat) || 0;
      vatTotal += Number(r.total) || 0;
      lines.push(`${padRight(rate, 6)}${padLeft(fmtMoney2(r.ns), 12)}${padLeft(fmtMoney2(r.nr), 10)}${padLeft(fmtMoney2(r.vat), 8)}${padLeft(fmtMoney2(r.total), 9)}`);
    }
    lines.push('');
    lines.push(`${padRight(L.total, 6)}${padLeft(fmtMoney2(vatNs), 12)}${padLeft(fmtMoney2(vatNr), 10)}${padLeft(fmtMoney2(vatVat), 8)}${padLeft(fmtMoney2(vatTotal), 9)}`);

    lines.push(...sectionTitle(L.payments));
    for (const [name, amount] of [...paymentMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(lineLabelValue(name, fmtMoney2(amount)));
    }
    lines.push(lineLabelValue(L.total, fmtMoney2(grossTotal)));

    lines.push(...sectionTitle(L.takeOutOnly));
    lines.push(lineLabelValue(`${takeOutCount} ${L.takeOut}`, fmtMoney2(takeOutTotal)));
    lines.push(lineLabelValue(L.total, fmtMoney2(grossTotal)));

    lines.push(...sectionTitle(L.ticketTypes));
    lines.push(lineLabelValue(`${ticketCount} ${L.counterSales}`, fmtMoney2(grossTotal)));
    lines.push(lineLabelValue(L.total, fmtMoney2(grossTotal)));

    if (sectionVisibility.hourTotals) {
      lines.push(...sectionTitle(L.hourTotals));
      lines.push(`${padRight(L.hour, 8)}${padLeft(L.orders, 10)}${padLeft(L.amount, 16)}`);
      for (const r of [...hourMap.values()].sort((a, b) => a.hour - b.hour)) {
        lines.push(`${padRight(fmtHour(r.hour), 8)}${padLeft(fmtInt0(r.orders), 10)}${padLeft(fmtMoney2(r.amount), 16)}`);
      }
      lines.push('');
      lines.push(`${padRight('', 8)}${padLeft(fmtInt0([...hourMap.values()].reduce((s, r) => s + (Number(r.orders) || 0), 0)), 10)}${padLeft(fmtMoney2([...hourMap.values()].reduce((s, r) => s + (Number(r.amount) || 0), 0)), 16)}`);
    }

    if (sectionVisibility.hourTotalsPerUser) {
      lines.push(...sectionTitle(L.hourTotalsPerUser));
      for (const [name, map] of [...hourUserMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        lines.push('-'.repeat(20));
        lines.push(name);
        lines.push(`${padRight(L.hour, 8)}${padLeft(L.orders, 10)}${padLeft(L.amount, 16)}`);
        for (const r of [...map.values()].sort((a, b) => a.hour - b.hour)) {
          lines.push(`${padRight(fmtHour(r.hour), 8)}${padLeft(fmtInt0(r.orders), 10)}${padLeft(fmtMoney2(r.amount), 16)}`);
        }
        lines.push('');
        lines.push(`${padRight('', 8)}${padLeft(fmtInt0([...map.values()].reduce((s, r) => s + (Number(r.orders) || 0), 0)), 10)}${padLeft(fmtMoney2([...map.values()].reduce((s, r) => s + (Number(r.amount) || 0), 0)), 16)}`);
      }
    }

    lines.push(dash);
    lines.push(lineLabelValue(L.issuedVatTickets, fmtInt0(ticketCount)));
    lines.push(`${padRight('', 6)}${padRight('NS', 4)}${padLeft(fmtInt0(eatInCount), 18)}`);
    lines.push(`${padRight('', 6)}${padRight('NR', 4)}${padLeft(fmtInt0(takeOutCount), 18)}`);
    lines.push(lineLabelValue(L.returnTicketsCount, fmtInt0(returnTicketsCount)));
    lines.push(lineLabelValue(L.drawerNoSale, '0'));
    lines.push(lineLabelValue(L.proFormaTickets, fmtInt0(proFormaTickets)));
    lines.push(lineLabelValue(L.proFormaReturns, fmtInt0(proFormaReturns)));
    lines.push(lineLabelValue(L.proFormaTurnover, fmtMoney2(proFormaTurnover)));
    lines.push(lineLabelValue(L.soldGiftCards, fmtInt0(soldGiftCards)));
    lines.push(lineLabelValue(L.soldGiftCardValue, fmtMoney2(soldGiftCardValue)));
    lines.push(lineLabelValue(L.grantedDiscounts, fmtInt0(grantedDiscounts)));
    lines.push(lineLabelValue(L.totalDiscountInclVat, fmtMoney2(totalDiscountInclVat)));
    lines.push(lineLabelValue(L.totalCashRounding, fmtMoney2(totalCashRounding)));
    lines.push(lineLabelValue(L.creditTopUp, fmtMoney2(creditTopUp)));
    lines.push(lineLabelValue(L.staffConsumptions, fmtMoney2(staffConsumptions)));
    lines.push(lineLabelValue(L.onlineCashRefund, fmtMoney2(onlineCashRefund)));
    lines.push(lineLabelValue(L.onlineOrders, fmtInt0(onlineOrdersCount)));

    res.json({
      lines,
      coreLines,
      summary,
      nextZNumber,
      periodStart: queryStart.toISOString(),
      periodEnd: displayPeriodEnd.toISOString(),
      orderCount: orders.length,
    });
  } catch (err) {
    console.error('POST /api/webpanel/reports/z-preview', err);
    res.status(500).json({ error: err.message || 'Failed to build Z preview report' });
  }
});

/** Webpanel: persist a previewed Z report without financial period close guard. */
app.post('/api/webpanel/reports/z-save', async (req, res) => {
  try {
    const lines = Array.isArray(req.body?.lines) ? req.body.lines.map((x) => String(x ?? '')) : [];
    if (!lines.length) return res.status(400).json({ error: 'No report lines to save.' });
    const closedByName = sanitizeReportQueryParam(req.body?.closedByName, 120) || null;
    const closedByUserId = sanitizeReportQueryParam(req.body?.closedByUserId, 64) || null;
    const periodStartRaw = String(req.body?.periodStart || '').trim();
    const periodEndRaw = String(req.body?.periodEnd || '').trim();
    const periodStart = Number.isNaN(new Date(periodStartRaw).getTime()) ? new Date() : new Date(periodStartRaw);
    const periodEnd = Number.isNaN(new Date(periodEndRaw).getTime()) ? new Date() : new Date(periodEndRaw);

    const result = await prisma.$transaction(async (tx) => {
      const zNumber = await getFinancialNextZNumber(tx);
      const archive = {
        kind: 'z',
        zNumber,
        lines,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        closedAt: new Date().toISOString(),
      };
      await tx.zReport.create({
        data: {
          zNumber,
          periodStart,
          periodEnd,
          summaryJson: JSON.stringify(archive),
          closedByUserId,
          closedByName,
          scope: 'webpanel',
        },
      });
      await upsertAppSettingTx(tx, SETTING_FINANCIAL_NEXT_Z, String(zNumber + 1));
      return { zNumber };
    });

    res.json({ ok: true, zNumber: result.zNumber });
  } catch (err) {
    console.error('POST /api/webpanel/reports/z-save', err);
    res.status(500).json({ error: err.message || 'Failed to save Z report' });
  }
});

/**
 * Z report: close current period, archive totals, advance Z number, start new period.
 */
app.post('/api/reports/financial/z/close', async (req, res) => {
  try {
    const closedByName = sanitizeReportQueryParam(req.body?.closedByName, 120) || '';
    const closedByUserId = sanitizeReportQueryParam(req.body?.closedByUserId, 64) || null;
    const lang = sanitizeReportQueryParam(req.body?.lang, 8) || 'en';
    const userName = sanitizeReportQueryParam(req.body?.userName, 120) || closedByName;
    const storeName = sanitizeReportQueryParam(req.body?.storeName, 120) || '';

    const result = await prisma.$transaction(async (tx) => {
      const periodStart = await getFinancialReportingPeriodStart(tx);
      const periodEnd = new Date();
      const orders = await loadPaidOrdersForFinancialPeriod(tx, periodStart, periodEnd);
      const zNumber = await getFinancialNextZNumber(tx);
      const { lines, summary } = buildFinancialReportReceiptLines({
        orders,
        kind: 'z',
        zNumber,
        periodStart,
        periodEnd,
        printedAt: new Date(),
        lang,
        userName,
        storeName,
      });
      if ((Number(summary?.grossTotal) || 0) <= 0) {
        const e = new Error('Cannot close Z report with €0 total.');
        e.statusCode = 400;
        throw e;
      }
      const archive = {
        ...summary,
        lines,
        closedAt: periodEnd.toISOString(),
      };
      await tx.zReport.create({
        data: {
          zNumber,
          periodStart,
          periodEnd,
          summaryJson: JSON.stringify(archive),
          closedByUserId: closedByUserId || null,
          closedByName: closedByName || null,
          scope: 'store',
        },
      });
      await upsertAppSettingTx(tx, SETTING_FINANCIAL_PERIOD_START, periodEnd.toISOString());
      await upsertAppSettingTx(tx, SETTING_FINANCIAL_NEXT_Z, String(zNumber + 1));
      return { lines, summary, zNumber, periodStart, periodEnd, archive };
    });

    res.json({
      lines: result.lines,
      summary: result.summary,
      zNumber: result.zNumber,
      periodStart: result.periodStart.toISOString(),
      periodEnd: result.periodEnd.toISOString(),
    });
  } catch (err) {
    console.error('POST /api/reports/financial/z/close', err);
    res.status(err?.statusCode || 500).json({ error: err.message || 'Failed to close Z report' });
  }
});

/** List archived Z reports (newest first). */
app.get('/api/reports/financial/z/history', async (req, res) => {
  try {
    const take = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const rows = await prisma.zReport.findMany({
      orderBy: { zNumber: 'desc' },
      take,
    });
    res.json(
      rows.map((r) => {
        let grossTotal = null;
        try {
          const j = JSON.parse(r.summaryJson || '{}');
          grossTotal = j.grossTotal != null ? j.grossTotal : null;
        } catch {
          /* ignore */
        }
        return {
          id: r.id,
          zNumber: r.zNumber,
          periodStart: r.periodStart.toISOString(),
          periodEnd: r.periodEnd.toISOString(),
          closedByName: r.closedByName,
          createdAt: r.createdAt.toISOString(),
          grossTotal,
        };
      }),
    );
  } catch (err) {
    console.error('GET /api/reports/financial/z/history', err);
    res.status(500).json({ error: err.message || 'Failed to list Z reports' });
  }
});

/** Reprint lines for an archived Z report. */
app.get('/api/reports/financial/z/:id/receipt', async (req, res) => {
  try {
    const row = await prisma.zReport.findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).json({ error: 'Z report not found' });
    let archive = {};
    try {
      archive = JSON.parse(row.summaryJson || '{}');
    } catch {
      return res.status(500).json({ error: 'Invalid archived report' });
    }
    const lines = Array.isArray(archive.lines) ? archive.lines.map((l) => String(l ?? '')) : [];
    if (!lines.length) return res.status(500).json({ error: 'No receipt lines stored for this report' });
    res.json({
      lines,
      zNumber: row.zNumber,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
    });
  } catch (err) {
    console.error('GET /api/reports/financial/z/:id/receipt', err);
    res.status(500).json({ error: err.message || 'Failed to load Z receipt' });
  }
});

/** Periodic sales report: paid orders with updatedAt in [start, endExclusive). Thermal-style receipt text. */
app.get('/api/reports/periodic', async (req, res) => {
  try {
    const { startDate, startTime, endDate, endTime } = req.query;
    const parsed = parsePeriodicReportRange(startDate, startTime, endDate, endTime);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const orders = await prisma.order.findMany({
      where: {
        status: 'paid',
        updatedAt: { gte: parsed.start, lt: parsed.endExclusive },
      },
      include: {
        items: orderItemsInclude,
        payments: { include: { paymentMethod: true } },
        user: true,
      },
      orderBy: { updatedAt: 'asc' },
    });

    const totalTurnover = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);

    const lang = sanitizeReportQueryParam(req.query.lang, 8) || 'en';
    const userName = sanitizeReportQueryParam(req.query.userName, 120);
    const storeName = sanitizeReportQueryParam(req.query.storeName, 120);

    const lines = buildPeriodicReportReceiptLines({
      orders,
      startDate: sanitizeReportQueryParam(startDate, 14),
      startTime: sanitizeReportQueryParam(startTime, 6),
      endDate: sanitizeReportQueryParam(endDate, 14),
      endTime: sanitizeReportQueryParam(endTime, 6),
      printedAt: new Date(),
      lang,
      userName,
      storeName,
    });

    res.json({
      lines,
      summary: {
        orderCount: orders.length,
        totalTurnover,
        start: parsed.start.toISOString(),
        endExclusive: parsed.endExclusive.toISOString(),
      },
    });
  } catch (err) {
    console.error('GET /api/reports/periodic', err);
    res.status(500).json({ error: err.message || 'Failed to generate report' });
  }
});

/** Production webpanel: paid orders in period as JSON (Info per order cards). */
app.get('/api/reports/production/info-per-order', async (req, res) => {
  try {
    const { startDate, startTime, endDate, endTime } = req.query;
    const parsed = parsePeriodicReportRange(startDate, startTime, endDate, endTime);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const orders = await prisma.order.findMany({
      where: {
        status: 'paid',
        updatedAt: { gte: parsed.start, lt: parsed.endExclusive },
      },
      include: {
        items: orderItemsInclude,
      },
      orderBy: { updatedAt: 'asc' },
    });

    const payload = orders.map((o) => ({
      id: o.id,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      total: Number(o.total) || 0,
      kioskServiceType: o.kioskServiceType,
      source: o.source,
      items: (o.items || []).map((it) => ({
        id: it.id,
        quantity: it.quantity,
        name: it.product?.name ?? '',
        notes: it.notes ?? null,
      })),
    }));

    res.json({
      orders: payload,
      periodStart: parsed.start.toISOString(),
      periodEndExclusive: parsed.endExclusive.toISOString(),
    });
  } catch (err) {
    console.error('GET /api/reports/production/info-per-order', err);
    res.status(500).json({ error: err.message || 'Failed to load production orders' });
  }
});

/** Subproduct tokens on order lines (same rules as POS HistoryModal / usePos appendSubproductNoteToItem). */
function parseSubproductNamesFromOrderNotes(rawNotes) {
  const tokens = String(rawNotes || '')
    .split(/[;,]/)
    .map((n) => n.trim())
    .filter(Boolean);
  const names = [];
  for (const token of tokens) {
    const rawName = String(token).split('::')[0];
    const name = String(rawName || '').trim();
    if (name) names.push(name);
  }
  return names;
}

/** Production 2: paid orders in period aggregated by category → product → subproduct (from line notes). */
app.get('/api/reports/production/production-2', async (req, res) => {
  try {
    const { startDate, startTime, endDate, endTime } = req.query;
    const parsed = parsePeriodicReportRange(startDate, startTime, endDate, endTime);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const orders = await prisma.order.findMany({
      where: {
        status: 'paid',
        updatedAt: { gte: parsed.start, lt: parsed.endExclusive },
      },
      include: {
        items: orderItemsInclude,
      },
      orderBy: { updatedAt: 'asc' },
    });

    /** @type {Map<string, { id: string, name: string, sortOrder: number, products: Map<string, { id: string, name: string, sortOrder: number, quantity: number, firstOrderAt: Date|null, lastOrderAt: Date|null, subQuantities: Map<string, { quantity: number, firstOrderAt: Date, lastOrderAt: Date }> }> }>} */
    const catMap = new Map();

    for (const order of orders) {
      const t = order.updatedAt;
      for (const it of order.items || []) {
        const p = it.product;
        if (!p) continue;
        const cat = p.category;
        if (!cat) continue;
        const qty = Math.max(0, Number(it.quantity) || 0);
        if (qty <= 0) continue;

        if (!catMap.has(cat.id)) {
          catMap.set(cat.id, {
            id: cat.id,
            name: cat.name || '—',
            sortOrder: cat.sortOrder ?? 0,
            products: new Map(),
          });
        }
        const cEntry = catMap.get(cat.id);
        if (!cEntry.products.has(p.id)) {
          cEntry.products.set(p.id, {
            id: p.id,
            name: p.name || '—',
            sortOrder: p.sortOrder ?? 0,
            quantity: 0,
            firstOrderAt: null,
            lastOrderAt: null,
            subQuantities: new Map(),
          });
        }
        const pEntry = cEntry.products.get(p.id);
        pEntry.quantity += qty;
        if (pEntry.firstOrderAt == null || t < pEntry.firstOrderAt) pEntry.firstOrderAt = t;
        if (pEntry.lastOrderAt == null || t > pEntry.lastOrderAt) pEntry.lastOrderAt = t;

        const subs = parseSubproductNamesFromOrderNotes(it.notes);
        for (const subName of subs) {
          if (!pEntry.subQuantities.has(subName)) {
            pEntry.subQuantities.set(subName, { quantity: qty, firstOrderAt: t, lastOrderAt: t });
          } else {
            const s = pEntry.subQuantities.get(subName);
            s.quantity += qty;
            if (t < s.firstOrderAt) s.firstOrderAt = t;
            if (t > s.lastOrderAt) s.lastOrderAt = t;
          }
        }
      }
    }

    const categories = [...catMap.values()]
      .sort((a, b) => (a.sortOrder - b.sortOrder) || String(a.name).localeCompare(String(b.name)))
      .map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        products: [...c.products.values()].map((p) => ({
          id: p.id,
          name: p.name,
          sortOrder: p.sortOrder,
          quantity: p.quantity,
          firstOrderAt: p.firstOrderAt ? p.firstOrderAt.toISOString() : null,
          lastOrderAt: p.lastOrderAt ? p.lastOrderAt.toISOString() : null,
          subproducts: [...p.subQuantities.entries()].map(([name, s]) => ({
            name,
            quantity: s.quantity,
            firstOrderAt: s.firstOrderAt.toISOString(),
            lastOrderAt: s.lastOrderAt.toISOString(),
          })),
        })),
      }));

    res.json({
      categories,
      periodStart: parsed.start.toISOString(),
      periodEndExclusive: parsed.endExclusive.toISOString(),
    });
  } catch (err) {
    console.error('GET /api/reports/production/production-2', err);
    res.status(500).json({ error: err.message || 'Failed to load production-2 report' });
  }
});

// REST: order history (paid orders, newest settlement first)
app.get('/api/orders/history', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: 'paid' },
      include: { items: orderItemsInclude, customer: true, user: true, payments: true },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });
    res.json(orders);
  } catch (err) {
    console.error('GET /api/orders/history', err);
    res.status(500).json({ error: err.message || 'Failed to fetch order history' });
  }
});

// REST: single order by id (full detail)
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: orderItemsInclude, customer: true, user: true, payments: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    console.error('GET /api/orders/:id', err);
    res.status(500).json({ error: err.message || 'Failed to fetch order' });
  }
});

// REST: create order
app.post('/api/orders', async (req, res) => {
  const { items, kioskServiceType: kioskServiceTypeRaw } = req.body;
  let kioskServiceType = null;
  if (kioskServiceTypeRaw != null && String(kioskServiceTypeRaw).trim() !== '') {
    const k = String(kioskServiceTypeRaw).trim();
    if (k === 'dine_in' || k === 'takeaway') kioskServiceType = k;
  }
  const posRegisterId = await resolvePosRegisterIdForOrder(req);
  const order = await prisma.order.create({
    data: {
      posRegisterId,
      kioskServiceType,
      status: 'open',
      total: 0,
      items: items?.length
        ? {
            create: items.map(({ productId, quantity, price, notes }) => ({
              productId,
              quantity,
              price,
              notes: notes || null
            }))
          }
        : undefined
    },
    include: { items: orderItemsInclude }
  });
  if (order.items?.length) {
    const total = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
    await prisma.order.update({ where: { id: order.id }, data: { total } });
    order.total = total;
  }
  io.emit('order:updated', order);
  res.json(order);
});

// REST: update order (add/remove items, status, customer, userId, printed, itemBatchBoundaries, itemBatchMeta)
app.patch('/api/orders/:id', async (req, res) => {
  const {
    status,
    items,
    paymentBreakdown,
    customerName,
    customerId: customerIdBody,
    userId,
    printed,
    itemBatchBoundaries,
    itemBatchMeta
  } = req.body;
  const updates = {};
  if (status !== undefined) updates.status = status;
  if (userId !== undefined) updates.userId = userId || null;
  if (printed !== undefined) updates.printed = !!printed;
  if (itemBatchBoundaries !== undefined) {
    updates.itemBatchBoundariesJson = Array.isArray(itemBatchBoundaries)
      ? JSON.stringify(itemBatchBoundaries)
      : null;
  }
  if (itemBatchMeta !== undefined) {
    updates.itemBatchMetaJson = Array.isArray(itemBatchMeta)
      ? JSON.stringify(itemBatchMeta)
      : null;
  }
  if (customerIdBody !== undefined) {
    if (customerIdBody === null || customerIdBody === '') {
      updates.customerId = null;
    } else {
      const id = String(customerIdBody).trim();
      const existing = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
      if (existing) updates.customerId = existing.id;
    }
  } else if (customerName !== undefined) {
    const name = String(customerName || '').trim();
    if (name) {
      const customer = await prisma.customer.create({
        data: { name, companyName: null, firstName: null, lastName: null }
      });
      updates.customerId = customer.id;
    } else {
      updates.customerId = null;
    }
  }
  if (items !== undefined) {
    await prisma.orderItem.deleteMany({ where: { orderId: req.params.id } });
    if (items.length) {
      await prisma.orderItem.createMany({
        data: items.map(({ productId, quantity, price, notes }) => ({
          orderId: req.params.id,
          productId,
          quantity,
          price,
          notes: notes || null
        }))
      });
    }
    const orderWithItems = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true }
    });
    updates.total = orderWithItems?.items?.reduce((s, i) => s + i.price * i.quantity, 0) ?? 0;
  }
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: updates,
    include: { items: orderItemsInclude, customer: true, user: true, payments: true }
  });

  // Save payment breakdown to OrderPayment for reports when order is marked paid or in_planning (pay-now-from-in-waiting flow)
  if ((status === 'paid' || status === 'in_planning') && paymentBreakdown?.amounts && typeof paymentBreakdown.amounts === 'object') {
    const amounts = paymentBreakdown.amounts;
    const methodIds = Object.keys(amounts).filter((id) => Math.max(0, Number(amounts[id]) || 0) > 0.0001);
    if (methodIds.length > 0) {
      const methods = await prisma.paymentMethod.findMany({ where: { id: { in: methodIds } } });
      const validMethodIds = new Set(methods.map((m) => m.id));
      await prisma.orderPayment.deleteMany({ where: { orderId: req.params.id } });
      await prisma.orderPayment.createMany({
        data: methodIds
          .filter((id) => validMethodIds.has(id))
          .map((id) => ({
            orderId: req.params.id,
            paymentMethodId: id,
            amount: Math.round(Math.max(0, Number(amounts[id]) || 0) * 100) / 100
          }))
      });
    }
  }

  io.emit('order:updated', order);
  res.json(order);
});

// REST: add item to order
app.post('/api/orders/:id/items', async (req, res) => {
  const { productId, quantity = 1, price, notes } = req.body;
  const item = await prisma.orderItem.create({
    data: { orderId: req.params.id, productId, quantity, price, notes: notes || null },
    include: { product: { include: { category: true } } }
  });
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: orderItemsInclude }
  });
  const total = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  await prisma.order.update({ where: { id: req.params.id }, data: { total } });
  const updated = { ...order, total };
  io.emit('order:updated', updated);
  res.json(updated);
});

// REST: update order item quantity
app.patch('/api/orders/:id/items/:itemId', async (req, res) => {
  try {
    const orderId = req.params.id;
    const itemId = req.params.itemId;

    const item = await prisma.orderItem.findFirst({
      where: { id: itemId, orderId }
    });
    if (!item) {
      return res.status(404).json({ error: 'Order item not found' });
    }

    const patchData = {};
    if (req.body?.quantity !== undefined) {
      patchData.quantity = Math.max(1, Math.floor(Number(req.body?.quantity)) || 1);
    }
    if (req.body?.notes !== undefined) {
      const notes = String(req.body.notes ?? '').trim();
      patchData.notes = notes ? notes : null;
    }
    if (req.body?.price !== undefined) {
      const parsedPrice = Number(req.body.price);
      if (!Number.isFinite(parsedPrice)) {
        return res.status(400).json({ error: 'Invalid price value' });
      }
      patchData.price = Math.max(0, parsedPrice);
    }
    if (req.body?.ticketStrikeJson !== undefined) {
      const v = req.body.ticketStrikeJson;
      if (v === null || v === '') {
        patchData.ticketStrikeJson = null;
      } else {
        try {
          const raw = typeof v === 'string' ? v : JSON.stringify(v);
          const o = JSON.parse(raw);
          if (!o || typeof o !== 'object') {
            return res.status(400).json({ error: 'Invalid ticketStrikeJson' });
          }
          const parent = Boolean(o.parent);
          const noteIndexes = Array.isArray(o.noteIndexes)
            ? [...new Set(o.noteIndexes.map((x) => Math.floor(Number(x))).filter((n) => n >= 0 && n < 500))]
                .sort((a, b) => a - b)
            : [];
          patchData.ticketStrikeJson = JSON.stringify({ parent, noteIndexes });
        } catch {
          return res.status(400).json({ error: 'Invalid ticketStrikeJson' });
        }
      }
    }
    if (Object.keys(patchData).length === 0) {
      return res.status(400).json({ error: 'No item fields to update' });
    }

    await prisma.orderItem.update({
      where: { id: itemId },
      data: patchData
    });
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: orderItemsInclude }
    });
    const total = order?.items?.reduce((s, i) => s + i.price * i.quantity, 0) ?? 0;
    await prisma.order.update({ where: { id: orderId }, data: { total } });
    const updated = { ...order, total };
    io.emit('order:updated', updated);
    res.json(updated);
  } catch (err) {
    console.error('PATCH /api/orders/:id/items/:itemId', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// REST: remove order item
app.delete('/api/orders/:id/items/:itemId', async (req, res) => {
  await prisma.orderItem.delete({ where: { id: req.params.itemId } });
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: orderItemsInclude }
  });
  const total = order?.items?.reduce((s, i) => s + i.price * i.quantity, 0) ?? 0;
  await prisma.order.update({ where: { id: req.params.id }, data: { total } });
  const updated = { ...order, total };
  io.emit('order:updated', updated);
  res.json(updated);
});

// REST: delete single order (OrderItem cascades)
app.delete('/api/orders/:id', async (req, res) => {
  const id = req.params.id;
  const { count } = await prisma.order.deleteMany({ where: { id } });
  if (count > 0) {
    try {
      const current = await loadKdsLineStatesMap();
      if (current[id]) {
        delete current[id];
        await saveKdsLineStatesMap(current);
        io.emit('kds:line-states', { removeOrder: true, orderId: id });
      }
    } catch (e) {
      console.error('KDS line states prune on order delete', e);
    }
    io.emit('order:deleted', { id });
  }
  res.json({ ok: true });
});

// REST: delete only open orders (preserve in_waiting and in_planning); OrderItem cascades
app.delete('/api/orders', async (req, res) => {
  await prisma.order.deleteMany({
    where: { status: 'open' }
  });
  try {
    await saveKdsLineStatesMap({});
    io.emit('kds:line-states', { replace: true, value: {} });
  } catch (e) {
    console.error('KDS line states clear on orders:cleared', e);
  }
  io.emit('orders:cleared');
  res.json({ ok: true });
});

// REST: weborders list (source weborder, open/in_planning) for modal
app.get('/api/weborders', async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { source: 'weborder', status: { in: ['open', 'in_planning'] } },
    include: { customer: true, items: orderItemsInclude },
    orderBy: { createdAt: 'asc' }
  });
  res.json(orders);
});

// REST: weborders count (orders with source weborder, open/in_planning)
app.get('/api/weborders/count', async (req, res) => {
  const count = await prisma.order.count({ where: { source: 'weborder', status: { in: ['open', 'in_planning'] } } });
  res.json({ count });
});

// REST: in-planning count
app.get('/api/orders/in-planning/count', async (req, res) => {
  const count = await prisma.order.count({ where: { status: 'in_planning' } });
  res.json({ count });
});

// REST: in-waiting count (In waiting orders - saved in DB with status in_waiting)
app.get('/api/orders/in-waiting/count', async (req, res) => {
  const count = await prisma.order.count({ where: { status: 'in_waiting' } });
  res.json({ count });
});

// REST: users (for login screen and control view)
function normalizeUserRole(role) {
  const r = String(role || '').toLowerCase().trim();
  return r === 'admin' ? 'admin' : 'waiter';
}

function isValidFourDigitPosPin(pin) {
  return /^[0-9]{4}$/.test(String(pin ?? '').trim());
}

async function listPosUsersForClientIp(clientIp) {
  const regCount = await prisma.posRegister.count();
  if (regCount === 0) {
    return [];
  }
  const ip = normalizePosRegisterIp(clientIp);
  const reg = await prisma.posRegister.findFirst({
    where: { ipAddress: ip },
    include: { userLinks: { include: { user: true } } },
  });
  if (!reg) return [];
  return reg.userLinks.map((l) => l.user).sort((a, b) => a.name.localeCompare(b.name));
}

async function listPosUsersForRegisterId(registerId) {
  const reg = await prisma.posRegister.findUnique({
    where: { id: registerId },
    include: { userLinks: { include: { user: true } } },
  });
  if (!reg) return [];
  return reg.userLinks.map((l) => l.user).sort((a, b) => a.name.localeCompare(b.name));
}

const WORK_TIME_ACTIONS = new Set(['check_in', 'check_out']);
const USER_WORK_TIME_EVENTS_MAX = 5000;
const USER_WORK_TIME_EVENTS_KEY_PREFIX = 'user_work_time_events:';
let userWorkTimeTableReadyPromise = null;

async function ensureUserWorkTimeEventsTable() {
  if (!userWorkTimeTableReadyPromise) {
    userWorkTimeTableReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "UserWorkTimeEvent" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "userId" TEXT NOT NULL,
          "action" TEXT NOT NULL,
          "at" TEXT NOT NULL,
          "startAt" TEXT,
          "endAt" TEXT,
          "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "idx_UserWorkTimeEvent_user_at"
         ON "UserWorkTimeEvent" ("userId", "at")`
      );
    })().catch((err) => {
      userWorkTimeTableReadyPromise = null;
      throw err;
    });
  }
  await userWorkTimeTableReadyPromise;
}

function userWorkTimeEventsKey(userId) {
  return `${USER_WORK_TIME_EVENTS_KEY_PREFIX}${String(userId || '').trim()}`;
}

function normalizeUserWorkTimeEvents(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const action = String(item.action || '').trim();
    const atIso = String(item.at || '').trim();
    if (!WORK_TIME_ACTIONS.has(action) || !atIso) continue;
    const atMs = Date.parse(atIso);
    if (Number.isNaN(atMs)) continue;
    out.push({ action, at: new Date(atMs).toISOString() });
  }
  return out.slice(-USER_WORK_TIME_EVENTS_MAX);
}

async function loadLegacyUserWorkTimeEvents(userId) {
  const key = userWorkTimeEventsKey(userId);
  if (!key || key === USER_WORK_TIME_EVENTS_KEY_PREFIX) return [];
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (!row?.value) return [];
  try {
    return normalizeUserWorkTimeEvents(JSON.parse(row.value));
  } catch {
    return [];
  }
}

async function trimUserWorkTimeEvents(userId) {
  await prisma.$executeRaw`
    DELETE FROM "UserWorkTimeEvent"
    WHERE "userId" = ${String(userId || '').trim()}
      AND "id" NOT IN (
        SELECT "id" FROM "UserWorkTimeEvent"
        WHERE "userId" = ${String(userId || '').trim()}
        ORDER BY "at" DESC, "id" DESC
        LIMIT ${USER_WORK_TIME_EVENTS_MAX}
      )
  `;
}

async function loadUserWorkTimeEvents(userId) {
  const safeUserId = String(userId || '').trim();
  if (!safeUserId) return [];
  await ensureUserWorkTimeEventsTable();
  const rows = await prisma.$queryRaw`
    SELECT "action", "at"
    FROM "UserWorkTimeEvent"
    WHERE "userId" = ${safeUserId}
    ORDER BY "at" ASC, "id" ASC
    LIMIT ${USER_WORK_TIME_EVENTS_MAX}
  `;
  const normalized = normalizeUserWorkTimeEvents(rows);
  if (normalized.length > 0) return normalized;

  // Legacy fallback: migrate old AppSetting JSON into table once.
  const legacy = await loadLegacyUserWorkTimeEvents(safeUserId);
  if (legacy.length === 0) return [];
  for (const event of legacy) {
    const startAt = event.action === 'check_in' ? event.at : null;
    const endAt = event.action === 'check_out' ? event.at : null;
    await prisma.$executeRaw`
      INSERT INTO "UserWorkTimeEvent" ("userId", "action", "at", "startAt", "endAt")
      VALUES (${safeUserId}, ${event.action}, ${event.at}, ${startAt}, ${endAt})
    `;
  }
  await trimUserWorkTimeEvents(safeUserId);
  return legacy;
}

async function saveUserWorkTimeEvent(userId, event) {
  const safeUserId = String(userId || '').trim();
  if (!safeUserId) return null;
  const [safe] = normalizeUserWorkTimeEvents([event]);
  if (!safe) return null;
  await ensureUserWorkTimeEventsTable();
  if (safe.action === 'check_out') {
    const openRows = await prisma.$queryRaw`
      SELECT "id"
      FROM "UserWorkTimeEvent"
      WHERE "userId" = ${safeUserId}
        AND "endAt" IS NULL
        AND ("startAt" IS NOT NULL OR "action" = 'check_in')
      ORDER BY "startAt" DESC, "id" DESC
      LIMIT 1
    `;
    const openRowId = Array.isArray(openRows) && openRows[0]?.id != null ? Number(openRows[0].id) : null;
    if (openRowId != null && Number.isFinite(openRowId)) {
      await prisma.$executeRaw`
        UPDATE "UserWorkTimeEvent"
        SET "action" = ${safe.action},
            "at" = ${safe.at},
            "startAt" = COALESCE("startAt", "at"),
            "endAt" = ${safe.at}
        WHERE "id" = ${openRowId}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "UserWorkTimeEvent" ("userId", "action", "at", "startAt", "endAt")
        VALUES (${safeUserId}, ${safe.action}, ${safe.at}, ${null}, ${safe.at})
      `;
    }
  } else {
    await prisma.$executeRaw`
      INSERT INTO "UserWorkTimeEvent" ("userId", "action", "at", "startAt", "endAt")
      VALUES (${safeUserId}, ${safe.action}, ${safe.at}, ${safe.at}, ${null})
    `;
  }
  await trimUserWorkTimeEvents(safeUserId);
  return safe;
}

app.get('/api/users', async (req, res) => {
  try {
    const regId = posTerminalRegisterIdFromBearer(req);
    const users = regId
      ? await listPosUsersForRegisterId(regId)
      : await listPosUsersForClientIp(getPosClientIp(req));
    res.json(users.map((u) => ({ id: u.id, name: u.name, label: u.name, role: normalizeUserRole(u.role) })));
  } catch (err) {
    console.error('GET /api/users', err);
    res.status(500).json({ error: err.message || 'Failed to fetch users' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, name: user.name, label: user.name, pin: user.pin, role: normalizeUserRole(user.role) });
  } catch (err) {
    console.error('GET /api/users/:id', err);
    res.status(500).json({ error: err.message || 'Failed to fetch user details' });
  }
});

app.get('/api/users/:id/work-time-status', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const events = await loadUserWorkTimeEvents(user.id);
    const last = events.length ? events[events.length - 1] : null;
    res.json({
      userId: user.id,
      lastAction: last?.action || null,
      lastAt: last?.at || null,
    });
  } catch (err) {
    console.error('GET /api/users/:id/work-time-status', err);
    res.status(500).json({ error: err.message || 'Failed to fetch user work-time status' });
  }
});

app.post('/api/users/:id/work-time-events', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const action = String(req.body?.action || '').trim();
    if (!WORK_TIME_ACTIONS.has(action)) {
      return res.status(400).json({ error: 'Invalid action. Use check_in or check_out.' });
    }
    const event = { action, at: new Date().toISOString() };
    const saved = await saveUserWorkTimeEvent(user.id, event);
    res.status(201).json({ ok: true, event: saved || event });
  } catch (err) {
    console.error('POST /api/users/:id/work-time-events', err);
    res.status(500).json({ error: err.message || 'Failed to save user work-time event' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, pin, role } = req.body;
    const pinStr = pin != null ? String(pin).trim() : '';
    if (!isValidFourDigitPosPin(pinStr)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }
    const created = await prisma.user.create({
      data: {
        name: name != null && String(name).trim() !== '' ? String(name).trim() : 'New user',
        role: normalizeUserRole(role),
        pin: pinStr
      }
    });
    res.status(201).json({
      id: created.id,
      name: created.name,
      label: created.name,
      role: normalizeUserRole(created.role)
    });
  } catch (err) {
    console.error('POST /api/users', err);
    res.status(500).json({ error: err.message || 'Failed to create user' });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { name, pin, role } = req.body;
    const data = {};
    if (name !== undefined) data.name = String(name).trim() || 'New user';
    if (pin !== undefined) {
      const pinStr = String(pin).trim();
      if (!isValidFourDigitPosPin(pinStr)) {
        return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
      }
      data.pin = pinStr;
    }
    if (role !== undefined) data.role = normalizeUserRole(role);
    const updated = await prisma.user.update({ where: { id }, data });
    res.json({ id: updated.id, name: updated.name, label: updated.name, role: normalizeUserRole(updated.role) });
  } catch (err) {
    console.error('PATCH /api/users/:id', err);
    res.status(500).json({ error: err.message || 'Failed to update user' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/users/:id', err);
    res.status(500).json({ error: err.message || 'Failed to delete user' });
  }
});

// REST: login (validate user + PIN)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { userId, pin } = req.body;
    if (!userId || pin === undefined) {
      return res.status(400).json({ error: 'userId and pin required' });
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.pin !== String(pin)) {
      return res.status(401).json({ error: 'Wrong PIN' });
    }
    const regCount = await prisma.posRegister.count();
    const clientIp = getPosClientIp(req);
    if (regCount === 0) {
      return res.status(403).json({
        error: 'No POS registers are configured. Create a register in the web panel (Registers) before signing in.',
      });
    }
    const regIdFromToken = posTerminalRegisterIdFromBearer(req);
    let reg = null;
    if (regIdFromToken) {
      reg = await prisma.posRegister.findUnique({ where: { id: regIdFromToken }, select: { id: true } });
    } else {
      reg = await prisma.posRegister.findFirst({
        where: { ipAddress: clientIp },
        select: { id: true },
      });
    }
    if (!reg) {
      return res.status(403).json({ error: 'Terminal IP is not registered for this POS.' });
    }
    const link = await prisma.posRegisterUser.findFirst({
      where: { registerId: reg.id, userId: user.id },
    });
    if (!link) {
      return res.status(403).json({ error: 'This user is not assigned to this register.' });
    }
    res.json({
      id: user.id,
      name: user.name,
      label: user.name,
      role: normalizeUserRole(user.role)
    });
  } catch (err) {
    console.error('POST /api/auth/login', err);
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// REST: price groups
app.get('/api/price-groups', async (req, res) => {
  try {
    const list = await prisma.priceGroup.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(list);
  } catch (err) {
    console.error('GET /api/price-groups', err);
    res.status(500).json({ error: err.message || 'Failed to fetch price groups' });
  }
});

app.post('/api/price-groups', async (req, res) => {
  try {
    const { name, tax } = req.body;
    const count = await prisma.priceGroup.count();
    const taxValue = tax != null && String(tax).trim() !== '' ? String(tax).trim() : null;
    const created = await prisma.priceGroup.create({
      data: {
        name: name != null && String(name).trim() !== '' ? String(name).trim() : 'New price group',
        tax: taxValue,
        sortOrder: count + 1
      }
    });
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /api/price-groups', err);
    res.status(500).json({ error: err.message || 'Failed to create price group' });
  }
});

app.patch('/api/price-groups/:id', async (req, res) => {
  try {
    const { name, tax } = req.body;
    const data = {};
    if (name !== undefined) data.name = String(name ?? '').trim() || 'New price group';
    if (tax !== undefined) data.tax = tax != null && String(tax).trim() !== '' ? String(tax).trim() : null;
    const updated = await prisma.priceGroup.update({
      where: { id: req.params.id },
      data
    });
    res.json(updated);
  } catch (err) {
    console.error('PATCH /api/price-groups/:id', err);
    res.status(500).json({ error: err.message || 'Failed to update price group' });
  }
});

app.delete('/api/price-groups/:id', async (req, res) => {
  try {
    await prisma.priceGroup.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/price-groups/:id', err);
    res.status(500).json({ error: err.message || 'Failed to delete price group' });
  }
});

// ---------- Payment terminals (Cashmatic / Bancontact) – same API as 123 ----------
function paymentTerminalToApi(t) {
  if (!t) return t;
  return {
    id: t.id,
    name: t.name,
    type: t.type,
    connection_type: t.connectionType,
    connection_string: t.connectionString,
    enabled: t.enabled,
    is_main: t.isMain ?? 0,
  };
}

app.get('/api/payment-terminals', async (req, res) => {
  try {
    const list = await prisma.paymentTerminal.findMany({ orderBy: [{ isMain: 'desc' }, { createdAt: 'desc' }] });
    res.json({ data: list.map(paymentTerminalToApi) });
  } catch (err) {
    console.error('GET /api/payment-terminals', err);
    res.status(500).json({ error: err.message || 'Failed to fetch payment terminals' });
  }
});

app.get('/api/payment-terminals/:id', async (req, res) => {
  try {
    const t = await prisma.paymentTerminal.findUnique({ where: { id: req.params.id } });
    if (!t) return res.status(404).json({ error: 'Payment terminal not found' });
    res.json(paymentTerminalToApi(t));
  } catch (err) {
    console.error('GET /api/payment-terminals/:id', err);
    res.status(500).json({ error: err.message || 'Failed to fetch terminal' });
  }
});

app.post('/api/payment-terminals', async (req, res) => {
  try {
    const { name, type, connection_type, connection_string, enabled, is_main } = req.body;
    if (!name || type == null) return res.status(400).json({ error: 'name and type are required' });
    if (is_main) await prisma.paymentTerminal.updateMany({ data: { isMain: 0 } });
    const created = await prisma.paymentTerminal.create({
      data: {
        name: String(name).trim(),
        type: String(type).trim(),
        connectionType: (connection_type != null ? connection_type : 'tcp').toString().trim(),
        connectionString: connection_string != null ? String(connection_string).trim() : '',
        enabled: enabled === 0 || enabled === false ? 0 : 1,
        isMain: is_main ? 1 : 0,
      },
    });
    res.status(201).json(paymentTerminalToApi(created));
  } catch (err) {
    console.error('POST /api/payment-terminals', err);
    res.status(500).json({ error: err.message || 'Failed to create payment terminal' });
  }
});

app.put('/api/payment-terminals/:id', async (req, res) => {
  try {
    const { name, type, connection_type, connection_string, enabled, is_main } = req.body;
    const id = req.params.id;
    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (type !== undefined) data.type = String(type).trim();
    if (connection_type !== undefined) data.connectionType = String(connection_type).trim();
    if (connection_string !== undefined) data.connectionString = String(connection_string).trim();
    if (enabled !== undefined) data.enabled = enabled === 0 || enabled === false ? 0 : 1;
    if (is_main !== undefined) {
      if (is_main) await prisma.paymentTerminal.updateMany({ where: { id: { not: id } }, data: { isMain: 0 } });
      data.isMain = is_main ? 1 : 0;
    }
    const updated = await prisma.paymentTerminal.update({
      where: { id },
      data,
    });
    res.json(paymentTerminalToApi(updated));
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Payment terminal not found' });
    console.error('PUT /api/payment-terminals/:id', err);
    res.status(500).json({ error: err.message || 'Failed to update payment terminal' });
  }
});

app.delete('/api/payment-terminals/:id', async (req, res) => {
  try {
    await prisma.paymentTerminal.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Payment terminal not found' });
    console.error('DELETE /api/payment-terminals/:id', err);
    res.status(500).json({ error: err.message || 'Failed to delete payment terminal' });
  }
});

app.post('/api/payment-terminals/:id/test', async (req, res) => {
  try {
    const t = await prisma.paymentTerminal.findUnique({ where: { id: req.params.id } });
    if (!t) return res.status(404).json({ success: false, error: 'Payment terminal not found' });
    if (t.type === 'cashmatic') {
      const service = createCashmaticService({ connection_string: t.connectionString });
      const result = await service.testConnection();
      if (result.success) res.json({ success: true, message: result.message });
      else res.status(500).json({ success: false, error: result.message });
    } else if (t.type === 'payworld' || t.type === 'bancontact' || t.type === 'payword') {
      const service = createPayworldService({ connection_string: t.connectionString });
      const result = await service.testConnection();
      if (result.success) res.json({ success: true, message: result.message });
      else res.status(500).json({ success: false, error: result.message });
    } else if (t.type === 'ccv') {
      const service = createCcvService({ connection_string: t.connectionString });
      const result = await service.testConnection();
      if (result.success) res.json({ success: true, message: result.message });
      else res.status(500).json({ success: false, error: result.message });
    } else if (t.type === 'viva' || t.type === 'viva-wallet') {
      const service = createVivaService({ connection_string: t.connectionString });
      const result = await service.testConnection();
      if (result.success) res.json({ success: true, message: result.message });
      else res.status(500).json({ success: false, error: result.message });
    } else {
      res.json({ success: true, message: 'Terminal test not implemented for this type' });
    }
  } catch (err) {
    console.error('POST /api/payment-terminals/:id/test', err);
    res.status(500).json({ success: false, error: err.message || 'Test failed' });
  }
});

// ---------- Payment methods (Control + checkout) ----------
app.get('/api/payment-methods', async (req, res) => {
  try {
    const activeOnly =
      req.query.active === '1' ||
      req.query.active === 'true' ||
      req.query.activeOnly === '1' ||
      req.query.activeOnly === 'true';
    const list = await prisma.paymentMethod.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ data: list.map(paymentMethodToApi) });
  } catch (err) {
    console.error('GET /api/payment-methods', err);
    res.status(500).json({ error: err.message || 'Failed to fetch payment methods' });
  }
});

app.post('/api/payment-methods', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    const integration = normalizePaymentIntegration(req.body?.integration);
    const active = !(req.body?.active === false || req.body?.active === 0);
    const maxRow = await prisma.paymentMethod.aggregate({ _max: { sortOrder: true } });
    const sortOrder = Number.isFinite(Number(req.body?.sortOrder))
      ? Number(req.body.sortOrder)
      : (maxRow._max.sortOrder ?? -1) + 1;
    const created = await prisma.paymentMethod.create({
      data: { name, integration, active, sortOrder },
    });
    res.status(201).json({ data: paymentMethodToApi(created) });
  } catch (err) {
    console.error('POST /api/payment-methods', err);
    res.status(500).json({ error: err.message || 'Failed to create payment method' });
  }
});

app.put('/api/payment-methods/reorder', async (req, res) => {
  try {
    const ids = req.body?.orderedIds || req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'orderedIds array is required' });
    }
    await prisma.$transaction(
      ids.map((id, i) =>
        prisma.paymentMethod.update({
          where: { id: String(id) },
          data: { sortOrder: i },
        }),
      ),
    );
    const list = await prisma.paymentMethod.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({ data: list.map(paymentMethodToApi) });
  } catch (err) {
    console.error('PUT /api/payment-methods/reorder', err);
    res.status(500).json({ error: err.message || 'Failed to reorder payment methods' });
  }
});

app.put('/api/payment-methods/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const data = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: 'name cannot be empty' });
      data.name = name;
    }
    if (req.body.active !== undefined) data.active = !(req.body.active === false || req.body.active === 0);
    if (req.body.integration !== undefined) data.integration = normalizePaymentIntegration(req.body.integration);
    if (req.body.sortOrder !== undefined) data.sortOrder = Number(req.body.sortOrder);
    const updated = await prisma.paymentMethod.update({ where: { id }, data });
    res.json({ data: paymentMethodToApi(updated) });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Payment method not found' });
    console.error('PUT /api/payment-methods/:id', err);
    res.status(500).json({ error: err.message || 'Failed to update payment method' });
  }
});

app.delete('/api/payment-methods/:id', async (req, res) => {
  try {
    await prisma.paymentMethod.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Payment method not found' });
    console.error('DELETE /api/payment-methods/:id', err);
    res.status(500).json({ error: err.message || 'Failed to delete payment method' });
  }
});

// ---------- Printers – same API as 123 ----------
function printerToApi(p) {
  if (!p) return p;
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    connection_string: p.connectionString ?? '',
    baud_rate: p.baudRate,
    data_bits: p.dataBits,
    parity: p.parity,
    stop_bits: p.stopBits,
    is_main: p.isMain,
    enabled: p.enabled,
  };
}

function validatePrinterConnection(type, connectionString) {
  const safeType = String(type || '').trim().toLowerCase();
  const safeConnection = String(connectionString || '').trim();
  if (!safeConnection) return { ok: false, error: 'connection_string is required' };

  if (safeType === 'serial') {
    if (!safeConnection.startsWith('serial://') && !safeConnection.startsWith('\\\\.\\')) {
      return { ok: false, error: 'Invalid serial printer connection string' };
    }
    return { ok: true };
  }

  if (safeType === 'windows') {
    if (safeConnection.startsWith('tcp://')) {
      const [ip, port] = safeConnection.substring(6).split(':');
      if (!ip || !port) return { ok: false, error: 'Invalid network printer address' };
      return { ok: true };
    }
    return { ok: true };
  }

  return { ok: false, error: 'Unsupported printer type' };
}

function formatEuroAmount(value) {
  return `€${(Math.round((Number(value) || 0) * 100) / 100).toFixed(2)}`;
}

/** Amounts sent to ESC/POS — use ASCII only; UTF-8 € is often shown as garbage (e.g. 鈧) on thermal printers. */
function formatPrinterEuroAmount(value) {
  return `EUR ${(Math.round((Number(value) || 0) * 100) / 100).toFixed(2)}`;
}

/** Amounts sent to label printers — use real euro symbol on labels. */
function formatLabelEuroAmount(value) {
  return `€ ${(Math.round((Number(value) || 0) * 100) / 100).toFixed(2)}`;
}

/** Notes tokens on order items — same rules as POS OrderPanel. */
function parseReceiptNoteToken(token) {
  const raw = String(token || '').trim();
  if (!raw) return null;
  const [labelPart, pricePart] = raw.split('::');
  const label = String(labelPart || '').trim();
  if (!label) return null;
  if (pricePart == null) return { label, price: 0 };
  const parsed = Number(pricePart);
  if (!Number.isFinite(parsed)) return { label, price: 0 };
  return { label, price: parsed };
}

function parseReceiptItemNotes(item) {
  return String(item?.notes || '')
    .split(/[;,]/)
    .map((n) => parseReceiptNoteToken(n))
    .filter(Boolean);
}

function normalizeReceiptTicketStrike(raw) {
  try {
    if (raw == null || raw === '') return { parent: false, noteIndexes: [] };
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!o || typeof o !== 'object') return { parent: false, noteIndexes: [] };
    const noteIndexes = Array.isArray(o.noteIndexes)
      ? o.noteIndexes.map((x) => Math.floor(Number(x))).filter((n) => n >= 0 && n < 500)
      : [];
    return { parent: Boolean(o.parent), noteIndexes };
  } catch {
    return { parent: false, noteIndexes: [] };
  }
}

function receiptItemBaseUnitPrice(item) {
  const productBase = Number(item?.product?.price);
  if (Number.isFinite(productBase)) {
    return Math.round(productBase * 100) / 100;
  }
  const orderUnit = Number(item.price) || 0;
  const noteUnitTotal = parseReceiptItemNotes(item).reduce((s, n) => s + (Number(n.price) || 0), 0);
  return Math.round(Math.max(0, orderUnit - noteUnitTotal) * 100) / 100;
}

function receiptPadLine(left, right, width = 40) {
  const l = String(left || '');
  const r = String(right || '');
  const pad = Math.max(1, width - l.length - r.length);
  return `${l}${' '.repeat(pad)}${r}`;
}

/**
 * @returns {{ product: string, quantity: number, unitPrice: number, lineTotal: number, vatTakeOut: any,
 *   receiptPrintParts: { text: string, strike: boolean }[], slipPrintParts: { text: string, strike: boolean }[],
 *   printer1Id?: string|null, printer2Id?: string|null, printer3Id?: string|null }}
 */
function buildReceiptItemStructured(item, printersById = null) {
  const productName = item?.product?.name || 'Unknown item';
  const qty = Math.max(1, Number(item.quantity) || 1);
  const unitPrice = Math.round((Number(item.price) || 0) * 100) / 100;
  const lineTotal = Math.round(unitPrice * qty * 100) / 100;
  const notes = parseReceiptItemNotes(item);
  const strike = normalizeReceiptTicketStrike(item?.ticketStrikeJson);
  const idxSet = new Set(strike.noteIndexes);
  const parentStruck =
    strike.parent || (notes.length > 0 && notes.every((_, i) => idxSet.has(i)));
  const noteStruck = (i) => strike.parent || idxSet.has(i);

  const receiptPrintParts = [];
  const slipPrintParts = [];

  if (notes.length === 0) {
    receiptPrintParts.push({
      text: receiptPadLine(`${qty}x ${productName}`, formatPrinterEuroAmount(lineTotal)),
      strike: parentStruck
    });
    slipPrintParts.push({
      text: receiptPadLine(`${qty}x ${productName}`, '', 40),
      strike: parentStruck,
    });
  } else {
    const baseUnit = receiptItemBaseUnitPrice(item);
    const baseLineTotal = Math.round(baseUnit * qty * 100) / 100;
    receiptPrintParts.push({
      text: receiptPadLine(`${qty}x ${productName}`, formatPrinterEuroAmount(baseLineTotal)),
      strike: parentStruck
    });
    slipPrintParts.push({
      text: receiptPadLine(`${qty}x ${productName}`, '', 40),
      strike: parentStruck,
    });
    notes.forEach((note, i) => {
      const nt = Math.round((Number(note.price) || 0) * qty * 100) / 100;
      receiptPrintParts.push({
        text: receiptPadLine(`   - ${note.label}`, formatPrinterEuroAmount(nt)),
        strike: noteStruck(i)
      });
      slipPrintParts.push({
        text: receiptPadLine(`   - ${note.label}`, '', 40),
        strike: noteStruck(i),
      });
    });
  }

  const noteSummary =
    notes.length > 0
      ? ` (${notes.map((n) => n.label).join(', ')})`
      : item?.notes
        ? ` (${String(item.notes).trim()})`
        : '';

  const out = {
    product: `${productName}${noteSummary}`,
    quantity: qty,
    unitPrice,
    lineTotal,
    vatTakeOut: item?.product?.vatTakeOut || null,
    receiptPrintParts,
    slipPrintParts
  };

  if (printersById) {
    const p1 = String(item?.product?.printer1 || '').trim();
    const p2 = String(item?.product?.printer2 || '').trim();
    const p3 = String(item?.product?.printer3 || '').trim();
    out.printer1Id = p1 && printersById.has(p1) ? p1 : null;
    out.printer2Id = p2 && printersById.has(p2) ? p2 : null;
    out.printer3Id = p3 && printersById.has(p3) ? p3 : null;
  }

  return out;
}

/** ESC/POS character size: GS ! n — width/height multiples 1–8 (here 1×, 2×, 3×). */
const ESCPOS_SIZE_NORMAL = Buffer.from([0x1d, 0x21, 0x00]);
const ESCPOS_SIZE_DOUBLE = Buffer.from([0x1d, 0x21, 0x11]);
const ESCPOS_SIZE_TRIPLE = Buffer.from([0x1d, 0x21, 0x22]);
const ESCPOS_BOLD_ON = Buffer.from([0x1b, 0x45, 0x01]);
const ESCPOS_BOLD_OFF = Buffer.from([0x1b, 0x45, 0x00]);

function escPosSelectSize(size) {
  if (size === 'triple') return ESCPOS_SIZE_TRIPLE;
  if (size === 'double') return ESCPOS_SIZE_DOUBLE;
  return ESCPOS_SIZE_NORMAL;
}

function normalizePrinterRowSize(raw) {
  if (raw === 'triple' || raw === '3' || raw === 'xlarge') return 'triple';
  if (raw === 'double' || raw === '2' || raw === 'large') return 'double';
  return 'normal';
}

function normalizePrinterReceiptRows(receiptLines) {
  if (!Array.isArray(receiptLines)) {
    return [{ text: String(receiptLines ?? ''), strike: false, size: 'normal', bold: false }];
  }
  return receiptLines.map((row) => {
    if (row == null) return { text: '', strike: false, size: 'normal', bold: false };
    if (typeof row === 'string') return { text: row, strike: false, size: 'normal', bold: false };
    return {
      text: String(row.text ?? ''),
      strike: !!row.strike,
      size: normalizePrinterRowSize(row.size),
      bold: !!row.bold,
    };
  });
}

function formatPrinterRowsPlainText(receiptLines) {
  return normalizePrinterReceiptRows(receiptLines)
    .map(({ text, strike }) => (strike ? `[VOID] ${text}` : text))
    .join('\n');
}

function buildEscPosPayloadFromRows(rows) {
  const init = Buffer.from([0x1b, 0x40]); // ESC @
  const INV_ON = Buffer.from([0x1d, 0x42, 0x01]); // GS B 1 inverse
  const INV_OFF = Buffer.from([0x1d, 0x42, 0x00]); // GS B 0 normal
  const chunks = [init];
  for (const row of rows) {
    chunks.push(escPosSelectSize(row.size));
    chunks.push(row.bold ? ESCPOS_BOLD_ON : ESCPOS_BOLD_OFF);
    const line = `${String(row.text)}\n`;
    const lineBuf = Buffer.from(line, 'utf8');
    if (row.strike) {
      chunks.push(INV_ON, lineBuf, INV_OFF);
    } else {
      chunks.push(lineBuf);
    }
  }
  chunks.push(ESCPOS_SIZE_NORMAL, ESCPOS_BOLD_OFF);
  const feed = Buffer.from([0x1b, 0x64, 0x04]);
  const cut = Buffer.from([0x1d, 0x56, 0x00]);
  return Buffer.concat([...chunks, feed, cut]);
}

/** Kitchen / production slip: enlarged lines for ESC/POS (serial / TCP). */
function kitchenProductionSlipRows(order, printedAt, slipParts) {
  const sep = { text: '------------------------------', size: 'normal', bold: false, strike: false };
  return [
    { text: `Order ${order.id}`, size: 'double', bold: true, strike: false },
    { text: `Printed at ${printedAt}`, size: 'double', bold: false, strike: false },
    { text: `Customer: ${order.customer?.name || '-'}`, size: 'double', bold: false, strike: false },
    sep,
    ...slipParts.map((p) => ({
      text: p.text,
      strike: !!p.strike,
      size: 'double',
      bold: false,
    })),
    sep,
  ];
}

function buildProductLabelPrintRows({
  productName,
  price,
  barcode,
  formatLabel,
  includeProductName,
  includePrice,
  includeBarcode,
}) {
  const rows = [];
  const safeFormat = String(formatLabel || '').trim();
  const safeName = String(productName || '').trim();
  const safeBarcode = String(barcode || '').trim();
  const numericPrice = Number(price);

  if (safeFormat) rows.push({ text: safeFormat, size: 'double', bold: true, strike: false });
  if (includeProductName && safeName) rows.push({ text: safeName, size: 'double', bold: true, strike: false });
  if (includePrice && Number.isFinite(numericPrice)) {
    rows.push({ text: `PRICE: ${formatPrinterEuroAmount(numericPrice)}`, size: 'double', bold: true, strike: false });
  }
  if (includeBarcode && safeBarcode) rows.push({ text: `BARCODE: ${safeBarcode}`, size: 'normal', bold: false, strike: false });
  if (rows.length === 0) rows.push({ text: 'LABEL', size: 'double', bold: true, strike: false });
  return rows;
}

function normalizeBarcodeForEscPos(raw) {
  const text = String(raw || '').trim().toUpperCase();
  if (!text) return '';
  // CODE39 supported chars: 0-9 A-Z space - . $ / + %
  return text.replace(/[^0-9A-Z \-.\$\/+%]/g, '');
}

function buildEscPosProductLabelPayload({
  productName,
  price,
  barcode,
  includeProductName,
  includePrice,
  includeBarcode,
}) {
  const chunks = [Buffer.from([0x1b, 0x40])]; // ESC @
  const addTextLine = (text, { size = 'normal', bold = false } = {}) => {
    if (!text) return;
    chunks.push(escPosSelectSize(size));
    chunks.push(bold ? ESCPOS_BOLD_ON : ESCPOS_BOLD_OFF);
    chunks.push(Buffer.from(`${String(text)}\n`, 'utf8'));
  };

  if (includeProductName) addTextLine(String(productName || '').trim(), { size: 'double', bold: true });
  if (includePrice && Number.isFinite(Number(price))) {
    addTextLine(formatPrinterEuroAmount(Number(price)), { size: 'double', bold: true });
  }
  chunks.push(ESCPOS_SIZE_NORMAL, ESCPOS_BOLD_OFF);

  if (includeBarcode) {
    const safeBarcode = normalizeBarcodeForEscPos(barcode);
    if (safeBarcode) {
      // Barcode presentation config
      chunks.push(
        Buffer.from([0x1d, 0x48, 0x02]), // GS H 2 (HRI below barcode)
        Buffer.from([0x1d, 0x66, 0x00]), // GS f 0 (font A)
        Buffer.from([0x1d, 0x68, 0x60]), // GS h 96 (barcode height)
        Buffer.from([0x1d, 0x77, 0x02]), // GS w 2 (module width)
      );
      const data = Buffer.from(safeBarcode, 'ascii');
      // GS k m n d... : CODE39 (m=69)
      chunks.push(Buffer.concat([Buffer.from([0x1d, 0x6b, 0x45, data.length]), data, Buffer.from([0x0a])]));
    }
  }

  chunks.push(ESCPOS_SIZE_NORMAL, ESCPOS_BOLD_OFF, Buffer.from([0x1b, 0x64, 0x04]), Buffer.from([0x1d, 0x56, 0x00]));
  return Buffer.concat(chunks);
}

function parseLabelDimensionMm(raw, fallback) {
  const text = String(raw ?? '').trim().toLowerCase();
  if (!text) return fallback;
  const n = Number.parseFloat(text.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  // If value looks like cm (e.g. 5.6), convert to mm. If already large, keep as mm.
  return n <= 30 ? n * 10 : n;
}

const LABEL_TYPE_VALUES = new Set(['production-labels', 'article-label', 'scale-labels', 'pre-packaging-labels']);

function normalizeLabelType(raw, fallback = 'production-labels') {
  const value = String(raw ?? '').trim().toLowerCase();
  if (LABEL_TYPE_VALUES.has(value)) return value;
  const safeFallback = String(fallback ?? '').trim().toLowerCase();
  return LABEL_TYPE_VALUES.has(safeFallback) ? safeFallback : 'production-labels';
}

function buildTsplProductLabelPayload({
  productName,
  price,
  barcode,
  includeProductName,
  includePrice,
  includeBarcode,
  formatWidth,
  formatHeight,
  marginLeft,
  marginRight,
  marginBottom,
  marginTop,
}) {
  const wrapLabelText = (text, maxCharsPerLine, maxLines) => {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const words = raw.split(/\s+/).filter(Boolean);
    const out = [];
    let current = '';
    const pushCurrent = () => {
      if (!current) return;
      out.push(current);
      current = '';
    };
    for (const word of words) {
      if (!current) {
        if (word.length <= maxCharsPerLine) {
          current = word;
        } else {
          // Hard-wrap very long single words.
          let rest = word;
          while (rest.length > maxCharsPerLine && out.length < maxLines) {
            out.push(rest.slice(0, maxCharsPerLine));
            rest = rest.slice(maxCharsPerLine);
          }
          if (out.length >= maxLines) return out.slice(0, maxLines);
          current = rest;
        }
        continue;
      }
      const next = `${current} ${word}`;
      if (next.length <= maxCharsPerLine) {
        current = next;
        continue;
      }
      pushCurrent();
      if (out.length >= maxLines) return out.slice(0, maxLines);
      if (word.length <= maxCharsPerLine) {
        current = word;
      } else {
        let rest = word;
        while (rest.length > maxCharsPerLine && out.length < maxLines) {
          out.push(rest.slice(0, maxCharsPerLine));
          rest = rest.slice(maxCharsPerLine);
        }
        if (out.length >= maxLines) return out.slice(0, maxLines);
        current = rest;
      }
    }
    pushCurrent();
    return out.slice(0, maxLines);
  };

  const widthMm = parseLabelDimensionMm(formatWidth, 56);
  const heightMm = parseLabelDimensionMm(formatHeight, 35);
  const labelWidthDots = Math.max(200, Math.round(widthMm * 8));
  const labelHeightDots = Math.max(200, Math.round(heightMm * 8));
  const x0 = Math.max(0, Math.round(Number(marginLeft) || 0));
  const x1 = Math.max(0, Math.round(Number(marginRight) || 0));
  const y0 = Math.max(0, Math.round(Number(marginTop) || 0));
  const y1 = Math.max(0, Math.round(Number(marginBottom) || 0));
  const printableLeft = x0;
  const printableRight = Math.max(printableLeft + 32, labelWidthDots - x1);
  const printableWidthDots = Math.max(32, printableRight - printableLeft);
  const contentLeft = x0 + 12;
  const contentRight = Math.max(contentLeft + 32, labelWidthDots - x1 - 12);
  const contentWidthDots = Math.max(32, contentRight - contentLeft);
  const safeName = String(productName || '').trim().replace(/"/g, '');
  const safeBarcode = String(barcode || '').trim().replace(/"/g, '');
  const lines = [
    `SIZE ${widthMm.toFixed(1)} mm,${heightMm.toFixed(1)} mm`,
    'GAP 2 mm,0 mm',
    'CODEPAGE UTF-8',
    // Use top-left origin; DIRECTION 1 can flip coordinates and hide TEXT on some label printers.
    'DIRECTION 0',
    'CLS',
  ];
  let y = y0 + 12;
  const nameFontMul = 1.8;
  const priceFontMul = 3.5;
  const nameLineHeight = 32;
  const nameLinePaddingDots = 8; // 3 mm at ~8 dots/mm
  const nameToPriceGapDots = 40; // 0.5 cm (5 mm) at ~8 dots/mm
  const priceLiftDots = 24; // 3 mm at ~8 dots/mm
  const priceLineHeight = 38;
  const barcodeHeightMin = 20;
  const barcodeHeightMax = 40;
  const barcodeHriReserve = 34; // Space for centered number below barcode
  const barcodeBottomPadding = 8;
  const barcodeLiftDots = 10; // Move barcode block slightly upward
  const barcodeBlockReserve = includeBarcode && safeBarcode ? (barcodeHeightMax + barcodeHriReserve + barcodeBottomPadding) : 0;
  const maxTextBottom = Math.max(y, labelHeightDots - y1 - barcodeBlockReserve);
  const maxNameChars = Math.max(6, Math.floor(contentWidthDots / (14 * nameFontMul)));
  const maxPriceChars = Math.max(6, Math.floor(contentWidthDots / (8 * priceFontMul)));
  let hasPrintedName = false;
  if (includeProductName && safeName) {
    const nameLines = wrapLabelText(safeName, maxNameChars, 2);
    for (let i = 0; i < nameLines.length; i += 1) {
      const nameLine = nameLines[i];
      const isLastNameLine = i === nameLines.length - 1;
      const lineAdvance = nameLineHeight + (isLastNameLine ? 0 : nameLinePaddingDots);
      if (y + lineAdvance > maxTextBottom) break;
      lines.push(`TEXT ${contentLeft},${y},"3",0,${nameFontMul},${nameFontMul},"${nameLine}"`);
      y += lineAdvance;
      hasPrintedName = true;
    }
    if (hasPrintedName && includePrice) {
      y += nameToPriceGapDots;
    }
  }
  if (includePrice && Number.isFinite(Number(price))) {
    const priceText = formatLabelEuroAmount(Number(price)).replace(/"/g, '');
    const priceLine = priceText.slice(0, maxPriceChars);
    const priceY = Math.max(y0 + 12, y - priceLiftDots);
    if (priceY + priceLineHeight <= maxTextBottom) {
      lines.push(`TEXT ${contentLeft},${priceY},"3",0,${priceFontMul},${priceFontMul},"${priceLine}"`);
      y = priceY + priceLineHeight;
    }
  }
  if (includeBarcode && safeBarcode) {
    const availableHeight = Math.max(barcodeHeightMin, labelHeightDots - y - y1 - 24);
    const barcodeHeight = Math.max(barcodeHeightMin, Math.min(barcodeHeightMax, availableHeight));
    const moduleWidth = 2;
    const estimatedBarcodeWidth = Math.max(120, Math.min(printableWidthDots, Math.round((safeBarcode.length * 11 + 35) * moduleWidth)));
    const barcodeX = Math.max(printableLeft, Math.round(printableLeft + ((printableWidthDots - estimatedBarcodeWidth) / 2)));
    const barcodeCenterX = barcodeX + Math.round(estimatedBarcodeWidth / 2);
    const maxBottomBarcodeY = labelHeightDots - y1 - barcodeHeight - barcodeHriReserve - barcodeBottomPadding;
    const barcodeY = Math.max(y, maxBottomBarcodeY - barcodeLiftDots);
    // Print barcode without built-in HRI, then draw centered number manually below it.
    lines.push(`BARCODE ${barcodeX},${barcodeY},"128",${barcodeHeight},0,0,2,2,"${safeBarcode}"`);
    const hriText = safeBarcode;
    const hriCharDots = 12;
    const hriTextWidth = Math.max(20, hriText.length * hriCharDots);
    const hriX = Math.max(printableLeft, Math.round(barcodeCenterX - (hriTextWidth / 2)));
    const hriY = Math.min(labelHeightDots - y1 - 34, barcodeY + barcodeHeight + 4);
    lines.push(`TEXT ${hriX},${hriY},"3",0,1,1,"${hriText}"`);
  }
  lines.push('PRINT 1,1');
  return Buffer.from(`${lines.join('\r\n')}\r\n`, 'utf8');
}

function planningTotalsReceiptRows(order, printedAt, custLabel, receiptPrintParts, dbTotal, vatSummary) {
  const sep = { text: '------------------------------', size: 'normal', bold: false, strike: false };
  return [
    { text: `Planning / totals ${order.id}`, size: 'double', bold: true, strike: false },
    { text: `Printed at ${printedAt}`, size: 'double', bold: false, strike: false },
    { text: `Customer: ${custLabel}`, size: 'double', bold: false, strike: false },
    sep,
    ...receiptPrintParts.map((p) => ({
      text: p.text,
      strike: !!p.strike,
      size: 'double',
      bold: false,
    })),
    sep,
    { text: `SUBTOTAL: ${formatPrinterEuroAmount(dbTotal)}`, size: 'double', bold: true, strike: false },
    ...vatSummary.lines.map((entry) => ({
      text: entry.display,
      size: 'double',
      bold: false,
      strike: false,
    })),
    { text: `BTW: ${formatPrinterEuroAmount(vatSummary.totalVat)}`, size: 'double', bold: true, strike: false },
    { text: `TOTAL: ${formatPrinterEuroAmount(dbTotal)}`, size: 'triple', bold: true, strike: false },
  ];
}

/** Final customer receipt: large body; TOTAL / PAID extra-large (3×). */
function finalReceiptTicketRows({
  title,
  headerLines,
  printerLine,
  receiptPrintParts,
  dbTotal,
  vatSummary,
  paidTotal,
  paymentMethodLines,
}) {
  const sep = { text: '------------------------------', size: 'normal', bold: false, strike: false };
  const rows = [
    { text: title, size: 'double', bold: true, strike: false },
    ...headerLines.map((t) => ({ text: t, size: 'double', bold: false, strike: false })),
  ];
  if (printerLine) rows.push({ text: printerLine, size: 'double', bold: false, strike: false });
  rows.push(
    sep,
    ...receiptPrintParts.map((p) => ({
      text: p.text,
      strike: !!p.strike,
      size: 'double',
      bold: false,
    })),
    sep,
    { text: `SUBTOTAL: ${formatPrinterEuroAmount(dbTotal)}`, size: 'double', bold: true, strike: false },
    ...vatSummary.lines.map((entry) => ({
      text: entry.display,
      size: 'double',
      bold: false,
      strike: false,
    })),
    { text: `BTW: ${formatPrinterEuroAmount(vatSummary.totalVat)}`, size: 'double', bold: true, strike: false },
    { text: `TOTAL: ${formatPrinterEuroAmount(dbTotal)}`, size: 'triple', bold: true, strike: false },
    { text: `PAID: ${formatPrinterEuroAmount(paidTotal)}`, size: 'triple', bold: true, strike: false },
    ...paymentMethodLines.map((t) => ({ text: t, size: 'double', bold: false, strike: false })),
  );
  return rows;
}

function parseVatPercent(rawValue) {
  const cleaned = String(rawValue || '')
    .replace(',', '.')
    .replace('%', '')
    .trim();
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100) / 100;
}

/** Receipt BTW/TVA split always uses take-out VAT rates. */
function buildReceiptVatSummary(itemLines) {
  const grossByRate = new Map();
  for (const line of itemLines || []) {
    const gross = Math.round((Number(line?.lineTotal) || 0) * 100) / 100;
    if (gross <= 0) continue;
    const vatRaw = line?.vatTakeOut;
    const rate = parseVatPercent(vatRaw);
    grossByRate.set(rate, Math.round(((grossByRate.get(rate) || 0) + gross) * 100) / 100);
  }
  const sortedRates = Array.from(grossByRate.keys()).sort((a, b) => a - b);
  const lines = [];
  let totalVat = 0;
  sortedRates.forEach((rate, idx) => {
    const gross = Math.round((grossByRate.get(rate) || 0) * 100) / 100;
    const base = rate > 0 ? Math.round((gross * 100 / (100 + rate)) * 100) / 100 : gross;
    const vat = Math.round((gross - base) * 100) / 100;
    totalVat = Math.round((totalVat + vat) * 100) / 100;
    const code = String.fromCharCode(65 + idx); // A, B, C...
    lines.push({
      code,
      rate,
      base,
      vat,
      display: `${code}  ${rate}%  ${formatPrinterEuroAmount(base)}`
    });
  });
  return { lines, totalVat };
}

const PAYMENT_INTEGRATIONS = new Set([
  'manual_cash',
  'cashmatic',
  'payworld',
  'ccv',
  'worldline',
  'viva',
  'multisafepay',
  'card',
  'generic',
]);

function normalizePaymentIntegration(value) {
  const v = String(value || '').trim().toLowerCase();
  return PAYMENT_INTEGRATIONS.has(v) ? v : 'generic';
}

function paymentMethodToApi(m) {
  if (!m) return m;
  return {
    id: m.id,
    name: m.name,
    active: !!m.active,
    sortOrder: m.sortOrder ?? 0,
    integration: m.integration || 'generic',
  };
}

/** Build paid total and receipt lines from new `amounts` map or legacy cash/bancontact/visa/payworld. */
async function resolveReceiptPaymentBreakdown(paymentBreakdown, dbTotal) {
  const raw = paymentBreakdown || {};
  const amounts = raw.amounts && typeof raw.amounts === 'object' ? raw.amounts : null;

  if (amounts && Object.keys(amounts).length > 0) {
    const ids = Object.keys(amounts).filter((id) => Math.max(0, Number(amounts[id]) || 0) > 0.0001);
    if (ids.length === 0) {
      return { paidTotal: 0, paymentMethodLines: [], paymentMethodsSummary: {} };
    }
    const methods = await prisma.paymentMethod.findMany({ where: { id: { in: ids } } });
    const byId = new Map(methods.map((m) => [m.id, m]));
    let paidTotalRaw = 0;
    const paymentMethodLines = [];
    const paymentMethodsSummary = {};
    for (const id of ids) {
      const amt = Math.round(Math.max(0, Number(amounts[id]) || 0) * 100) / 100;
      if (amt <= 0) continue;
      paidTotalRaw += amt;
      const m = byId.get(id);
      const label = m?.name ? String(m.name).toUpperCase() : 'METHOD';
      paymentMethodLines.push(`${label}: ${formatPrinterEuroAmount(amt)}`);
      paymentMethodsSummary[id] = { name: m?.name || id, amount: amt, integration: m?.integration || 'generic' };
    }
    const paidTotal = Math.round(paidTotalRaw * 100) / 100;
    return { paidTotal, paymentMethodLines, paymentMethodsSummary };
  }

  const cash = Math.max(0, Number(raw.cash) || 0);
  const bancontact = Math.max(0, Number(raw.bancontact) || 0);
  const visa = Math.max(0, Number(raw.visa) || 0);
  const payworld = Math.max(0, Number(raw.payworld) || 0);
  const paidTotalRaw = cash + bancontact + visa + payworld;
  const paidTotal = Math.round((paidTotalRaw > 0 ? paidTotalRaw : dbTotal) * 100) / 100;
  const paymentMethodLines = [
    cash > 0 ? `CASHMATIC: ${formatPrinterEuroAmount(cash)}` : null,
    bancontact > 0 ? `BANCONTACT: ${formatPrinterEuroAmount(bancontact)}` : null,
    visa > 0 ? `VISA: ${formatPrinterEuroAmount(visa)}` : null,
    payworld > 0 ? `PAYWORLD: ${formatPrinterEuroAmount(payworld)}` : null,
  ].filter(Boolean);
  return {
    paidTotal,
    paymentMethodLines,
    paymentMethodsSummary: { cash, bancontact, visa, payworld },
  };
}

async function ensureKitchenKdsAdminStation() {
  const existing = await prisma.kitchen.findUnique({ where: { id: KITCHEN_KDS_ADMIN_ID } });
  if (existing) return;
  await prisma.kitchen.create({
    data: {
      id: KITCHEN_KDS_ADMIN_ID,
      name: 'admin',
      pin: '1234'
    }
  });
  serverLog('kitchen', 'Created default KDS admin station (kitchen id kitchen-kds-admin, login name admin, PIN 1234)');
}

function parseTcpTarget(connectionString) {
  const s = String(connectionString || '').trim();
  if (!s.startsWith('tcp://')) {
    throw new Error('Printer connection_string is not tcp:// format.');
  }
  const [host = '', port = '9100'] = s.substring(6).split(':');
  const safeHost = host.trim();
  const safePort = Number.parseInt(String(port || '9100').trim(), 10);
  if (!safeHost || !Number.isInteger(safePort) || safePort <= 0 || safePort > 65535) {
    throw new Error(`Invalid TCP printer target: ${s}`);
  }
  return { host: safeHost, port: safePort };
}

const SCALE_POLL_CACHE_MS = 120;
const SCALE_TCP_DEFAULT_PORT = 2000;
const scaleLiveRuntime = {
  lastOk: false,
  lastConnected: false,
  lastConfigured: false,
  lastSource: 'disabled',
  lastGrams: 0,
  lastStable: false,
  lastAt: 0,
  lastError: '',
  inFlight: null,
};
const scaleCommandPreference = new Map();
const dialog06Runtime = {
  lastGrams: 0,
  lastAt: 0,
};

function describeScaleCommand(command) {
  if (!Buffer.isBuffer(command) || command.length === 0) return '<none>';
  return command.toString('hex').toUpperCase();
}

function previewScalePayload(payload, maxBytes = 24) {
  if (!Buffer.isBuffer(payload) || payload.length === 0) return '';
  return payload.subarray(0, maxBytes).toString('hex').toUpperCase();
}

function isTransientSerialBusyError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('access denied')
    || msg.includes('permission denied')
    || msg.includes('ebusy')
    || msg.includes('resource busy')
    || msg.includes('file busy')
    || msg.includes('cannot lock port')
    || msg.includes('opening \\\\.\\com')
  );
}

function normalizeScalePortPath(port) {
  const p = String(port || '').trim();
  if (!p) return '';
  if (p.startsWith('\\\\.\\')) return p;
  const upper = p.toUpperCase();
  if (upper.startsWith('COM')) {
    const suffix = upper.replace(/\s+/g, '').slice(3);
    if (suffix) return `\\\\.\\COM${suffix}`;
  }
  return p;
}

function parseScaleTcpEndpoint(rawHostPort) {
  const raw = String(rawHostPort || '').trim();
  if (!raw) return { host: '', port: SCALE_TCP_DEFAULT_PORT };
  const s = raw.startsWith('tcp://') ? raw.slice(6) : raw;
  const [hostPart, portPart] = s.split(':');
  const host = String(hostPart || '').trim();
  const portNumber = Number.parseInt(String(portPart || '').trim(), 10);
  return {
    host,
    port: Number.isInteger(portNumber) && portNumber > 0 && portNumber <= 65535
      ? portNumber
      : SCALE_TCP_DEFAULT_PORT,
  };
}

function scaleCommandCandidates(scaleType) {
  if (scaleType === 'dialog-06') {
    return [Buffer.from([0x04, 0x05]), Buffer.from([0x05]), Buffer.from('W\r\n', 'ascii')];
  }
  if (scaleType === 'aclas') {
    return [Buffer.from('W\r\n', 'ascii'), Buffer.from([0x05])];
  }
  return [null];
}

const SCALE_CTRL = {
  ACK: 0x06,
  NAK: 0x15,
  EOT: 0x04,
  ENQ: 0x05,
  SOH: 0x01,
  DC1: 0x11,
  STX: 0x02,
  ETX: 0x03,
  ESC: 0x1b,
};

const DIALOG06_STATUS_MESSAGES = {
  '00': 'No error present.',
  '01': 'General error on scale.',
  '02': 'Parity error, or more characters than permitted.',
  '10': 'Incorrect record number detected.',
  '11': 'No valid unit price.',
  '12': 'No valid tare value received.',
  '13': 'No valid text received.',
  '20': 'Scale still in motion (no equilibrium).',
  '21': 'No motion since last weighing operation.',
  '22': 'Price calculation not yet available.',
  '30': 'Scale in MIN range.',
  '31': 'Scale in underload range or negative weight display.',
  '32': 'Scale in overload range.',
};

const DIALOG06_RECORD_01_DUMMY_PRICE = Buffer.from([0x04, 0x02, 0x30, 0x31, 0x1b, 0x30, 0x30, 0x30, 0x30, 0x30, 0x31, 0x1b, 0x03]);
const DIALOG06_REQUEST_WEIGHT = Buffer.from([0x04, 0x05]);
const DIALOG06_REQUEST_STATUS = Buffer.from([0x04, 0x02, 0x30, 0x38, 0x03]);
const CAS_REQUEST_DATA = Buffer.from([SCALE_CTRL.DC1]);
const CAS_HANDSHAKE_AND_REQUEST = Buffer.from([SCALE_CTRL.ENQ, SCALE_CTRL.DC1]);

function splitDialog06EscSegments(frameBody) {
  const parts = [];
  let start = 0;
  for (let i = 0; i < frameBody.length; i += 1) {
    if (frameBody[i] === SCALE_CTRL.ESC) {
      parts.push(frameBody.subarray(start, i));
      start = i + 1;
    }
  }
  parts.push(frameBody.subarray(start));
  return parts;
}

function toAscii(buffer) {
  return Buffer.from(buffer || []).toString('ascii');
}

function parseDialog06Frames(payloadBuffer) {
  const buf = Buffer.isBuffer(payloadBuffer) ? payloadBuffer : Buffer.from(payloadBuffer || []);
  const out = [];
  let idx = 0;
  while (idx < buf.length) {
    const stxIdx = buf.indexOf(SCALE_CTRL.STX, idx);
    if (stxIdx < 0) break;
    const etxIdx = buf.indexOf(SCALE_CTRL.ETX, stxIdx + 1);
    if (etxIdx < 0) break;
    const frame = buf.subarray(stxIdx + 1, etxIdx);
    const segments = splitDialog06EscSegments(frame);
    const recordNo = toAscii(segments[0]).slice(0, 2);
    out.push({ recordNo, segments, raw: buf.subarray(stxIdx, etxIdx + 1) });
    idx = etxIdx + 1;
  }
  return out;
}

function parseDialog06Record02WeightGrams(recordFrame) {
  const statusChar = toAscii(recordFrame?.segments?.[1] || Buffer.alloc(0)).slice(0, 1);
  const rawWeightDigits = toAscii(recordFrame?.segments?.[2] || Buffer.alloc(0)).replace(/[^\d]/g, '');
  if (!rawWeightDigits) return null;
  const weightInt = Number.parseInt(rawWeightDigits, 10);
  if (!Number.isFinite(weightInt) || weightInt < 0) return null;
  if (statusChar === '3') {
    return weightInt;
  }
  if (statusChar === '1') {
    return Math.max(0, Math.round((weightInt / 100) * 453.59237));
  }
  if (statusChar === '2') {
    return Math.max(0, Math.round(weightInt * 0.005 * 453.59237));
  }
  if (statusChar === '0') {
    return Math.max(0, Math.round(weightInt * 3.543690389));
  }
  return null;
}

function parseDialog06Record09Status(recordFrame) {
  const status = toAscii(recordFrame?.segments?.[1] || Buffer.alloc(0)).replace(/[^\d]/g, '').slice(0, 2);
  if (status.length !== 2) return { status: '', message: 'Unknown status payload.' };
  return { status, message: DIALOG06_STATUS_MESSAGES[status] || 'Unknown Dialog 06 status.' };
}

function parseDialog06Record11(recordFrame) {
  const payload = toAscii(recordFrame?.segments?.[1] || Buffer.alloc(0));
  const state = payload.slice(0, 1);
  const randomHex = payload.slice(1).replace(/[^0-9A-F]/gi, '');
  return { state, randomHex };
}

function casUnitToGrams(value, unit) {
  const u = String(unit || '').trim().toLowerCase();
  if (!Number.isFinite(value)) return null;
  if (u === 'kg') return Math.round(value * 1000);
  if (u === 'g') return Math.round(value);
  if (u === 'lb') return Math.round(value * 453.59237);
  if (u === 'oz') return Math.round(value * 28.349523125);
  // CAS default commonly reports kg if unknown unit text appears.
  return Math.round(value * 1000);
}

function parseCasFrameWeightGrams(frame, withStatus2) {
  if (!Buffer.isBuffer(frame)) return null;
  const startsWithSoh = frame[0] === SCALE_CTRL.SOH;
  const minLen = startsWithSoh
    ? (withStatus2 ? 16 : 15)
    : (withStatus2 ? 15 : 14);
  if (frame.length < minLen) return null;
  const offset = frame[0] === SCALE_CTRL.SOH ? 1 : 0;
  if (frame[offset] !== SCALE_CTRL.STX) return null;
  const statusByte = frame[offset + 1];
  const signByte = frame[offset + 2];
  const weightRaw = frame.subarray(offset + 3, offset + 9).toString('ascii');
  const unitRaw = frame.subarray(offset + 9, offset + 11).toString('ascii');
  const bcc = frame[offset + 11];
  if (frame[offset + 12] !== SCALE_CTRL.ETX || frame[offset + 13] !== SCALE_CTRL.EOT) return null;
  if (withStatus2 && frame[offset + 14] == null) return null;

  let checksum = 0;
  for (let i = offset + 1; i <= offset + 10; i += 1) checksum ^= frame[i];
  if ((checksum & 0xff) !== bcc) return null;

  const status = String.fromCharCode(statusByte);
  if (status === 'F') return null;
  const sign = String.fromCharCode(signByte) === '-' ? -1 : 1;
  const numericText = weightRaw.replace(/[^0-9.]/g, '');
  const value = Number.parseFloat(numericText);
  if (!Number.isFinite(value)) return null;
  const grams = casUnitToGrams(sign * value, unitRaw);
  if (!Number.isFinite(grams)) return null;
  return Math.max(0, grams);
}

function parseCasWeightGrams(payloadBuffer) {
  const buf = Buffer.isBuffer(payloadBuffer) ? payloadBuffer : Buffer.from(payloadBuffer || []);
  if (buf.length === 0) return null;

  for (let i = 0; i < buf.length; i += 1) {
    // Active frame with SOH STX ... ETX EOT STA2
    if (buf[i] === SCALE_CTRL.SOH && i + 15 < buf.length && buf[i + 1] === SCALE_CTRL.STX) {
      const grams = parseCasFrameWeightGrams(buf.subarray(i + 1, i + 16), true);
      if (grams != null) return grams;
    }
    // Passive frame with SOH STX ... ETX EOT
    if (buf[i] === SCALE_CTRL.SOH && i + 14 < buf.length && buf[i + 1] === SCALE_CTRL.STX) {
      const grams = parseCasFrameWeightGrams(buf.subarray(i + 1, i + 15), false);
      if (grams != null) return grams;
    }
    // Tolerate missing SOH in some implementations.
    if (buf[i] === SCALE_CTRL.STX && i + 13 < buf.length) {
      const candidateWithStatus2 = parseCasFrameWeightGrams(buf.subarray(i, Math.min(i + 15, buf.length)), true);
      if (candidateWithStatus2 != null) return candidateWithStatus2;
      const candidatePassive = parseCasFrameWeightGrams(buf.subarray(i, i + 14), false);
      if (candidatePassive != null) return candidatePassive;
    }
  }
  return null;
}

function extractScaleWeightGrams(payloadBuffer) {
  const text = Buffer.isBuffer(payloadBuffer)
    ? payloadBuffer.toString('utf8').replace(/\0/g, ' ')
    : String(payloadBuffer || '');
  const normalized = text.replace(/,/g, '.');

  const withUnits = [...normalized.matchAll(/(-?\d+(?:\.\d+)?)\s*(kg|g)\b/gi)];
  if (withUnits.length > 0) {
    const last = withUnits[withUnits.length - 1];
    const value = Number.parseFloat(last[1]);
    if (!Number.isFinite(value)) return null;
    const unit = String(last[2] || '').toLowerCase();
    const grams = unit === 'kg' ? Math.round(value * 1000) : Math.round(value);
    return Number.isFinite(grams) ? Math.max(0, grams) : null;
  }

  const numbers = [...normalized.matchAll(/-?\d+(?:\.\d+)?/g)];
  if (numbers.length === 0) return null;
  const fallback = Number.parseFloat(numbers[numbers.length - 1][0]);
  if (!Number.isFinite(fallback)) return null;
  // Most devices report kilograms when decimals are present and no unit is provided.
  const grams = String(numbers[numbers.length - 1][0]).includes('.')
    ? Math.round(fallback * 1000)
    : Math.round(fallback);
  return Number.isFinite(grams) ? Math.max(0, grams) : null;
}

async function readScaleViaSerial({ port, command, baudRate = 9600, dataBits = 8, stopBits = 1, parity = 'none', timeoutMs = 500, settleMs = 120 }) {
  let SerialPort;
  try {
    ({ SerialPort } = await import('serialport'));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`serialport module failed to load (${msg})`);
  }
  const path = normalizeScalePortPath(port);
  if (!path) throw new Error('Scale serial port is empty.');
  return await new Promise((resolve, reject) => {
    let serial = null;
    let settled = false;
    const chunks = [];
    let dataTimer = null;
    let timeoutTimer = null;
    const settle = (err, out = null) => {
      if (err) reject(err);
      else resolve(out);
    };
    const closeThenSettle = (err, out = null) => {
      try {
        const canClose = serial && (serial.isOpen || serial.opening);
        if (canClose) {
          serial.close(() => settle(err, out));
          return;
        }
      } catch {
        // ignore close errors
      }
      settle(err, out);
    };
    const finish = (err, out = null) => {
      if (settled) return;
      settled = true;
      if (dataTimer) clearTimeout(dataTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      closeThenSettle(err, out);
    };
    serial = new SerialPort({
      path,
      baudRate,
      dataBits,
      stopBits,
      parity,
      autoOpen: false,
    });
    const armSettle = () => {
      if (dataTimer) clearTimeout(dataTimer);
      dataTimer = setTimeout(() => {
        finish(null, Buffer.concat(chunks));
      }, settleMs);
    };
    timeoutTimer = setTimeout(() => {
      finish(null, Buffer.concat(chunks));
    }, timeoutMs);
    serial.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
      armSettle();
    });
    serial.on('error', (err) => finish(err));
    serial.on('open', () => {
      if (!command || command.length === 0) return;
      serial.write(command, () => {
        serial.drain(() => {});
      });
    });
    serial.open((err) => {
      if (err) finish(err);
    });
  });
}

async function readScaleViaTcp({ host, port, command, timeoutMs = 500, settleMs = 120 }) {
  if (!host) throw new Error('Scale TCP host is empty.');
  return await new Promise((resolve, reject) => {
    let settled = false;
    const chunks = [];
    let dataTimer = null;
    let timeoutTimer = null;
    const socket = net.createConnection({ host, port });
    const finish = (err, out = null) => {
      if (settled) return;
      settled = true;
      if (dataTimer) clearTimeout(dataTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      socket.destroy();
      if (err) reject(err);
      else resolve(out);
    };
    const armSettle = () => {
      if (dataTimer) clearTimeout(dataTimer);
      dataTimer = setTimeout(() => finish(null, Buffer.concat(chunks)), settleMs);
    };
    timeoutTimer = setTimeout(() => {
      finish(null, Buffer.concat(chunks));
    }, timeoutMs);
    socket.on('connect', () => {
      if (command && command.length > 0) socket.write(command);
    });
    socket.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
      armSettle();
    });
    socket.on('error', (err) => finish(err));
    socket.on('close', () => {
      if (!settled) finish(null, Buffer.concat(chunks));
    });
  });
}

async function readDialog06WeightGrams(scaleConfig) {
  const mode = normalizeScaleConnectionMode(scaleConfig.mode);
  const serialPort = scaleConfig.port;
  const tcp = parseScaleTcpEndpoint(scaleConfig.lsmIp);
  const commandCandidates = [DIALOG06_REQUEST_WEIGHT, Buffer.from([SCALE_CTRL.ENQ])];
  const prefIdxRaw = Number(scaleCommandPreference.get('dialog-06'));
  const prefIdx = Number.isInteger(prefIdxRaw) && prefIdxRaw >= 0 && prefIdxRaw < commandCandidates.length ? prefIdxRaw : 0;
  const indexes = [...new Set([prefIdx, ...commandCandidates.map((_, i) => i)])];
  const rememberedGrams = () => Math.max(0, Math.floor(Number(dialog06Runtime.lastGrams) || 0));
  const readOnce = async (command) => {
    if (mode === 'tcp-ip') {
      return await readScaleViaTcp({
        host: tcp.host,
        port: tcp.port,
        command,
        timeoutMs: 140,
        settleMs: 35,
      });
    }
    return await readScaleViaSerial({
      port: serialPort,
      command,
      baudRate: 9600,
      dataBits: 7,
      stopBits: 1,
      parity: 'odd',
      timeoutMs: 140,
      settleMs: 35,
    });
  };

  let lastErr = null;
  for (const idx of indexes) {
    const command = commandCandidates[idx];
    const startedAt = Date.now();
    const commandHex = describeScaleCommand(command);
    try {
      const payload = await readOnce(command);
      const frames = parseDialog06Frames(payload);
      const record02 = frames.find((f) => f.recordNo === '02');
      if (record02) {
        const grams = parseDialog06Record02WeightGrams(record02);
        if (grams != null) {
          scaleCommandPreference.set('dialog-06', idx);
          dialog06Runtime.lastGrams = grams;
          dialog06Runtime.lastAt = Date.now();
          console.log('[scale][dialog06] read ok', {
            grams,
            command: commandHex,
            elapsedMs: Date.now() - startedAt,
          });
          return grams;
        }
      }

      const record11 = frames.find((f) => f.recordNo === '11');
      if (record11) {
        const parsed11 = parseDialog06Record11(record11);
        const remembered = rememberedGrams();
        console.log('[scale][dialog06] record11 fast reuse', {
          state: parsed11.state,
          randomHex: parsed11.randomHex || undefined,
          grams: remembered,
          command: commandHex,
          elapsedMs: Date.now() - startedAt,
        });
        return remembered;
      }

      if (Buffer.isBuffer(payload) && payload.includes(SCALE_CTRL.NAK)) {
        const remembered = rememberedGrams();
        console.log('[scale][dialog06] nak immediate reuse', {
          grams: remembered,
          command: commandHex,
          elapsedMs: Date.now() - startedAt,
        });
        return remembered;
      }

      // Some Dialog-06 devices reply as plain ASCII text; accept immediate weight fallback.
      const fallback = extractScaleWeightGrams(payload);
      if (fallback != null) {
        scaleCommandPreference.set('dialog-06', idx);
        dialog06Runtime.lastGrams = fallback;
        dialog06Runtime.lastAt = Date.now();
        console.log('[scale][dialog06] read fallback ok', {
          grams: fallback,
          command: commandHex,
          elapsedMs: Date.now() - startedAt,
          payloadPreview: previewScalePayload(payload),
        });
        return fallback;
      }

      console.log('[scale][dialog06] unreadable payload', {
        command: commandHex,
        elapsedMs: Date.now() - startedAt,
        payloadPreview: previewScalePayload(payload),
      });
      lastErr = new Error('No valid Dialog 06 payload received.');
    } catch (err) {
      lastErr = err;
      console.log('[scale][dialog06] read error', {
        command: commandHex,
        elapsedMs: Date.now() - startedAt,
        error: err?.message || String(err),
      });
    }
  }

  if (dialog06Runtime.lastAt > 0) {
    const remembered = rememberedGrams();
    console.log('[scale][dialog06] fallback last known', {
      grams: remembered,
      reason: lastErr?.message || 'no valid payload',
    });
    return remembered;
  }
  throw lastErr || new Error('Dialog 06 read failed.');
}

async function readAclasWeightGrams(scaleConfig) {
  const commandCandidates = scaleCommandCandidates('aclas');
  const mode = normalizeScaleConnectionMode(scaleConfig.mode);
  const serialPort = scaleConfig.port;
  const tcp = parseScaleTcpEndpoint(scaleConfig.lsmIp);
  const prefIdxRaw = Number(scaleCommandPreference.get('aclas'));
  const prefIdx = Number.isInteger(prefIdxRaw) && prefIdxRaw >= 0 && prefIdxRaw < commandCandidates.length ? prefIdxRaw : 0;
  const indexes = [...new Set([prefIdx, ...commandCandidates.map((_, i) => i)])];
  let lastErr = null;
  const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (const idx of indexes) {
    const command = commandCandidates[idx];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const startedAt = Date.now();
      try {
        const payload = mode === 'tcp-ip'
          ? await readScaleViaTcp({ host: tcp.host, port: tcp.port, command, timeoutMs: 260, settleMs: 70 })
          : await readScaleViaSerial({ port: serialPort, command, timeoutMs: 260, settleMs: 70 });
        const grams = extractScaleWeightGrams(payload);
        if (grams != null) {
          scaleCommandPreference.set('aclas', idx);
          console.log('[scale][aclas] read ok', {
            grams,
            command: describeScaleCommand(command),
            elapsedMs: Date.now() - startedAt,
            attempt: attempt + 1,
          });
          return grams;
        }
        console.log('[scale][aclas] unreadable payload', {
          command: describeScaleCommand(command),
          elapsedMs: Date.now() - startedAt,
          payloadPreview: previewScalePayload(payload),
          attempt: attempt + 1,
        });
        lastErr = new Error('No readable Aclas payload.');
        break;
      } catch (err) {
        lastErr = err;
        console.log('[scale][aclas] read error', {
          command: describeScaleCommand(command),
          elapsedMs: Date.now() - startedAt,
          error: err?.message || String(err),
          attempt: attempt + 1,
        });
        const shouldRetryBusy = mode !== 'tcp-ip' && attempt === 0 && isTransientSerialBusyError(err);
        if (shouldRetryBusy) {
          await waitMs(80);
          continue;
        }
        break;
      }
    }
  }

  throw lastErr || new Error('Aclas read failed.');
}

async function readCasWeightGrams(scaleConfig) {
  const commandCandidates = [CAS_REQUEST_DATA, CAS_HANDSHAKE_AND_REQUEST, null, Buffer.from([SCALE_CTRL.ENQ])];
  const mode = normalizeScaleConnectionMode(scaleConfig.mode);
  const serialPort = scaleConfig.port;
  const tcp = parseScaleTcpEndpoint(scaleConfig.lsmIp);
  const prefIdxRaw = Number(scaleCommandPreference.get('cas'));
  const prefIdx = Number.isInteger(prefIdxRaw) && prefIdxRaw >= 0 && prefIdxRaw < commandCandidates.length ? prefIdxRaw : 0;
  const indexes = [...new Set([prefIdx, ...commandCandidates.map((_, i) => i)])];
  let lastErr = null;
  const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (const idx of indexes) {
    const command = commandCandidates[idx];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const startedAt = Date.now();
      try {
        const payload = mode === 'tcp-ip'
          ? await readScaleViaTcp({ host: tcp.host, port: tcp.port, command, timeoutMs: 200, settleMs: 45 })
          : await readScaleViaSerial({
            port: serialPort,
            command,
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            timeoutMs: 200,
            settleMs: 45,
          });
        const grams = parseCasWeightGrams(payload);
        if (grams != null) {
          scaleCommandPreference.set('cas', idx);
          console.log('[scale][cas] read ok', {
            grams,
            command: describeScaleCommand(command),
            elapsedMs: Date.now() - startedAt,
            attempt: attempt + 1,
          });
          return grams;
        }
        const fallback = extractScaleWeightGrams(payload);
        if (fallback != null) {
          scaleCommandPreference.set('cas', idx);
          console.log('[scale][cas] read fallback ok', {
            grams: fallback,
            command: describeScaleCommand(command),
            elapsedMs: Date.now() - startedAt,
            attempt: attempt + 1,
            payloadPreview: previewScalePayload(payload),
          });
          return fallback;
        }
        console.log('[scale][cas] unreadable payload', {
          command: describeScaleCommand(command),
          elapsedMs: Date.now() - startedAt,
          payloadPreview: previewScalePayload(payload),
          attempt: attempt + 1,
        });
        lastErr = new Error('No readable CAS payload.');
        break;
      } catch (err) {
        lastErr = err;
        console.log('[scale][cas] read error', {
          command: describeScaleCommand(command),
          elapsedMs: Date.now() - startedAt,
          error: err?.message || String(err),
          attempt: attempt + 1,
        });
        const shouldRetryBusy = mode !== 'tcp-ip' && attempt === 0 && isTransientSerialBusyError(err);
        if (shouldRetryBusy) {
          await waitMs(80);
          continue;
        }
        break;
      }
    }
  }

  throw lastErr || new Error('CAS read failed.');
}

async function readConfiguredScaleWeightGrams(scaleConfig) {
  if (scaleConfig.type === 'dialog-06') {
    return await readDialog06WeightGrams(scaleConfig);
  }
  if (scaleConfig.type === 'aclas') {
    return await readAclasWeightGrams(scaleConfig);
  }
  if (scaleConfig.type === 'cas') {
    return await readCasWeightGrams(scaleConfig);
  }
  const commandCandidates = scaleCommandCandidates(scaleConfig.type);
  const mode = normalizeScaleConnectionMode(scaleConfig.mode);
  const serialPort = scaleConfig.port;
  const tcp = parseScaleTcpEndpoint(scaleConfig.lsmIp);
  const prefIdxRaw = Number(scaleCommandPreference.get(scaleConfig.type));
  const prefIdx = Number.isInteger(prefIdxRaw) && prefIdxRaw >= 0 && prefIdxRaw < commandCandidates.length ? prefIdxRaw : 0;
  const indexes = [...new Set([prefIdx, ...commandCandidates.map((_, i) => i)])];
  let lastErr = null;
  for (const idx of indexes) {
    const command = commandCandidates[idx];
    try {
      const payload = mode === 'tcp-ip'
        ? await readScaleViaTcp({ host: tcp.host, port: tcp.port, command })
        : await readScaleViaSerial({ port: serialPort, command });
      const grams = extractScaleWeightGrams(payload);
      if (grams != null) {
        scaleCommandPreference.set(scaleConfig.type, idx);
        return grams;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
  throw new Error('No readable weight payload from scale.');
}

async function refreshScaleRuntime() {
  const cfg = await loadScaleSettingFromDb();
  if (!cfg || cfg.type === 'disabled') {
    return { grams: 0, stable: false, source: 'disabled', configured: false, connected: false };
  }
  const grams = await readConfiguredScaleWeightGrams(cfg);
  return { grams, stable: grams > 0, source: cfg.type, configured: true, connected: true };
}

function getScaleRuntimeSnapshot() {
  const cachedGrams = scaleLiveRuntime.lastOk ? scaleLiveRuntime.lastGrams : 0;
  return {
    grams: cachedGrams,
    stable: scaleLiveRuntime.lastOk ? scaleLiveRuntime.lastStable : false,
    source: scaleLiveRuntime.lastSource,
    configured: scaleLiveRuntime.lastConfigured,
    connected: scaleLiveRuntime.lastConnected,
    error: scaleLiveRuntime.lastError || undefined,
  };
}

function beginScaleRefresh() {
  if (scaleLiveRuntime.inFlight) return scaleLiveRuntime.inFlight;
  scaleLiveRuntime.inFlight = (async () => {
    try {
      const out = await refreshScaleRuntime();
      scaleLiveRuntime.lastOk = true;
      scaleLiveRuntime.lastError = '';
      scaleLiveRuntime.lastGrams = Math.max(0, Math.floor(Number(out.grams) || 0));
      scaleLiveRuntime.lastStable = Boolean(out.stable);
      scaleLiveRuntime.lastSource = String(out.source || 'device');
      scaleLiveRuntime.lastConfigured = Boolean(out.configured);
      scaleLiveRuntime.lastConnected = Boolean(out.connected);
      scaleLiveRuntime.lastAt = Date.now();
      return {
        grams: scaleLiveRuntime.lastGrams,
        stable: scaleLiveRuntime.lastStable,
        source: scaleLiveRuntime.lastSource,
        configured: scaleLiveRuntime.lastConfigured,
        connected: scaleLiveRuntime.lastConnected,
      };
    } catch (err) {
      scaleLiveRuntime.lastOk = false;
      scaleLiveRuntime.lastError = err?.message || 'Scale read failed.';
      scaleLiveRuntime.lastGrams = 0;
      scaleLiveRuntime.lastStable = false;
      scaleLiveRuntime.lastConfigured = true;
      scaleLiveRuntime.lastConnected = false;
      scaleLiveRuntime.lastSource = 'error';
      scaleLiveRuntime.lastAt = Date.now();
      return {
        grams: 0,
        stable: false,
        source: scaleLiveRuntime.lastSource,
        configured: scaleLiveRuntime.lastConfigured,
        connected: scaleLiveRuntime.lastConnected,
        error: scaleLiveRuntime.lastError,
      };
    } finally {
      scaleLiveRuntime.inFlight = null;
    }
  })();
  return scaleLiveRuntime.inFlight;
}

async function getLiveScaleWeight(forceFresh = false) {
  const now = Date.now();
  if (forceFresh) {
    return await beginScaleRefresh();
  }
  const hasFreshCache = SCALE_POLL_CACHE_MS > 0 && now - scaleLiveRuntime.lastAt <= SCALE_POLL_CACHE_MS;
  if (!hasFreshCache && !scaleLiveRuntime.inFlight) {
    void beginScaleRefresh();
  }
  if (scaleLiveRuntime.lastAt === 0 && scaleLiveRuntime.inFlight) {
    return await scaleLiveRuntime.inFlight;
  }
  return getScaleRuntimeSnapshot();
}

function parseSerialPath(connectionString) {
  const s = String(connectionString || '').trim();
  if (!s) throw new Error('Serial printer connection string is empty.');
  if (s.startsWith('serial://')) return (s.substring(9).split('?')[0] || '').trim();
  if (s.startsWith('\\\\.\\')) return s;
  return s;
}

function sendTcpPrint(connectionString, payload) {
  const { host, port } = parseTcpTarget(connectionString);
  const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload || '');
  return new Promise((resolve, reject) => {
    let settled = false;
    let receivedBytes = 0;
    const socket = net.createConnection({ host, port });
    const finish = (err, details = undefined) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(details);
    };
    socket.setTimeout(7000);
    socket.on('connect', () => {
      serverLog('printer', 'TCP connected', { host, port });
      serverLog('printer', 'TCP send command', {
        host,
        port,
        bytes: payloadBuffer.length,
        previewHex: payloadBuffer.subarray(0, Math.min(64, payloadBuffer.length)).toString('hex'),
      });
      socket.write(payloadBuffer, (err) => {
        if (err) {
          socket.destroy();
          return finish(err);
        }
        socket.end();
      });
    });
    socket.on('data', (chunk) => {
      receivedBytes += chunk.length;
      serverLog('printer', 'TCP receive response', { host, port, bytes: chunk.length });
    });
    socket.on('timeout', () => {
      socket.destroy();
      finish(new Error(`Printer TCP timeout (${host}:${port})`));
    });
    socket.on('error', (err) => {
      finish(err);
    });
    socket.on('close', (hadError) => {
      serverLog('printer', 'TCP connection closed', { host, port, hadError, receivedBytes });
      if (!hadError) {
        finish(null, { transport: 'tcp', host, port, sentBytes: payloadBuffer.length, receivedBytes });
      }
    });
  });
}

/** Loaded on first serial print only so the API can start if the native addon fails (e.g. missing MSVC runtime on Windows). */
async function sendSerialPrint(connectionString, baudRate, payload) {
  let SerialPort;
  try {
    ({ SerialPort } = await import('serialport'));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[printer] serialport failed to load:', msg);
    throw new Error(
      `Serial printer module failed to load (${msg}). Install Microsoft Visual C++ Redistributable (x64) or use a TCP/network printer.`
    );
  }
  const path = parseSerialPath(connectionString);
  const baud = Number.parseInt(String(baudRate || 9600), 10) || 9600;
  const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload || '');
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err, details = undefined) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(details);
    };
    const serial = new SerialPort({ path, baudRate: baud, autoOpen: false });
    serial.on('open', () => {
      serverLog('printer', 'Serial connected', { path, baudRate: baud });
      serverLog('printer', 'Serial send command', {
        path,
        bytes: payloadBuffer.length,
        previewHex: payloadBuffer.subarray(0, Math.min(64, payloadBuffer.length)).toString('hex'),
      });
      serial.write(payloadBuffer, (writeErr) => {
        if (writeErr) {
          serial.close(() => finish(writeErr));
          return;
        }
        serial.drain((drainErr) => {
          serial.close((closeErr) => {
            if (drainErr) return finish(drainErr);
            if (closeErr) return finish(closeErr);
            finish(null, { transport: 'serial', path, baudRate: baud, sentBytes: payloadBuffer.length, receivedBytes: 0 });
          });
        });
      });
    });
    serial.on('data', (chunk) => {
      serverLog('printer', 'Serial receive response', { path, bytes: chunk.length });
    });
    serial.on('error', (err) => {
      finish(err);
    });
    serial.open((err) => {
      if (err) finish(err);
    });
  });
}

/** Windows printer by name: send ESC/POS bytes via spooler RAW job (thermal double-height works). Falls back to Out-Printer text if this fails. */
async function sendWindowsEscPosRaw(printerName, payloadBuffer) {
  const tmp = path.join(os.tmpdir(), `pos-escpos-${process.pid}-${Date.now()}.bin`);
  await writeFile(tmp, payloadBuffer);
  const escPrinter = printerName.replace(/'/g, "''");
  const escPath = tmp.replace(/'/g, "''");
  const ps = `
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
public class DOCINFOA {
    public string pDocName;
    public string pOutputFile;
    public string pDataType;
}
public static class RawPrinter {
    [DllImport("winspool.drv", EntryPoint="OpenPrinterA", CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.drv", EntryPoint="ClosePrinter", CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint="StartDocPrinterA", CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, ref DOCINFOA di);
    [DllImport("winspool.drv", EntryPoint="EndDocPrinter", CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint="StartPagePrinter", CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint="EndPagePrinter", CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint="WritePrinter", CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
}
"@
$binPath = '${escPath}'
$printer = '${escPrinter}'
$bytes = [System.IO.File]::ReadAllBytes($binPath)
$h = [IntPtr]::Zero
if (-not [RawPrinter]::OpenPrinter($printer, [ref]$h, [IntPtr]::Zero)) { throw 'OpenPrinter failed' }
try {
  $di = New-Object DOCINFOA
  $di.pDocName = 'POS'
  $di.pOutputFile = $null
  $di.pDataType = 'RAW'
  if (-not [RawPrinter]::StartDocPrinter($h, 1, [ref]$di)) { throw 'StartDocPrinter failed' }
  if (-not [RawPrinter]::StartPagePrinter($h)) { throw 'StartPagePrinter failed' }
  $ptr = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
  try {
    [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
    $w = 0
    if (-not [RawPrinter]::WritePrinter($h, $ptr, $bytes.Length, [ref]$w)) { throw 'WritePrinter failed' }
  } finally {
    [Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
  }
  [void][RawPrinter]::EndPagePrinter($h)
  [void][RawPrinter]::EndDocPrinter($h)
} finally {
  [void][RawPrinter]::ClosePrinter($h)
}
`;
  try {
    await new Promise((resolve, reject) => {
      execFile(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
        { timeout: 30000, windowsHide: true },
        (err, stdout, stderr) => {
          if (stdout) serverLog('printer', 'Windows RAW stdout', { stdout: String(stdout).trim().slice(0, 200) });
          if (stderr) serverLog('printer', 'Windows RAW stderr', { stderr: String(stderr).trim().slice(0, 400) });
          if (err) reject(err);
          else resolve();
        },
      );
    });
    return { transport: 'windows-raw-escpos', printerName, sentBytes: payloadBuffer.length, receivedBytes: 0 };
  } finally {
    try {
      await unlink(tmp);
    } catch {
      /* ignore */
    }
  }
}

async function sendToPrinter(printer, receiptLines) {
  const safeType = String(printer?.type || '').trim().toLowerCase();
  const connectionString = String(printer?.connectionString || '').trim();
  const rows = normalizePrinterReceiptRows(receiptLines);
  const payload = buildEscPosPayloadFromRows(rows);
  return await sendEscPosPayloadToPrinter(printer, payload, receiptLines);
}

async function sendEscPosPayloadToPrinter(printer, payload, fallbackReceiptLines = []) {
  const safeType = String(printer?.type || '').trim().toLowerCase();
  const connectionString = String(printer?.connectionString || '').trim();
  const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload || '');
  if (safeType === 'serial') {
    return await sendSerialPrint(connectionString, printer?.baudRate, payloadBuffer);
  }
  if (safeType === 'windows') {
    if (connectionString.startsWith('tcp://')) {
      return sendTcpPrint(connectionString, payloadBuffer);
    }
    const printerName = connectionString;
    if (!printerName) throw new Error('Windows printer name is empty.');
    if (process.platform !== 'win32') {
      throw new Error(`Windows printer-name transport is only supported on Windows host. Current platform: ${process.platform}`);
    }
    try {
      return await sendWindowsEscPosRaw(printerName, payloadBuffer);
    } catch (rawErr) {
      serverLog('printer', 'Windows RAW ESC/POS failed, using Out-Printer (text only)', {
        printerName,
        error: rawErr?.message || String(rawErr),
      });
    }
    const text = `${formatPrinterRowsPlainText(fallbackReceiptLines)}\n\n\n`;
    const escapedPrinterName = printerName.replace(/'/g, "''");
    const script =
      `$printerName = '${escapedPrinterName}';\n` +
      `$text = @'\n${text}\n'@;\n` +
      `$text | Out-Printer -Name $printerName`;
    serverLog('printer', 'Windows queue send command', { printerName, bytes: Buffer.byteLength(text, 'utf8') });
    await new Promise((resolve, reject) => {
      execFile(
        'powershell',
        ['-NoProfile', '-Command', script],
        { timeout: 12000, windowsHide: true },
        (err, stdout, stderr) => {
          if (stdout) serverLog('printer', 'Windows queue stdout', { printerName, stdout: String(stdout).trim() });
          if (stderr) serverLog('printer', 'Windows queue stderr', { printerName, stderr: String(stderr).trim() });
          if (err) {
            reject(new Error(`Out-Printer failed for "${printerName}": ${err.message}`));
            return;
          }
          resolve();
        }
      );
    });
    return { transport: 'windows-queue', printerName, sentBytes: Buffer.byteLength(text, 'utf8'), receivedBytes: 0 };
  }
  throw new Error(`Unsupported printer type for send: ${safeType}`);
}

app.get('/api/printers', async (req, res) => {
  try {
    const list = await prisma.printer.findMany({
      orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
    });
    res.json({ data: list.map(printerToApi) });
  } catch (err) {
    console.error('GET /api/printers', err);
    res.status(500).json({ error: err.message || 'Failed to fetch printers' });
  }
});

app.get('/api/printers/defaults', async (req, res) => {
  try {
    const main = await prisma.printer.findFirst({ where: { isMain: 1 } });
    const defaults = {
      serial: { com_port: '', baud_rate: '', data_bits: '', parity: '', stop_bits: '' },
      windows: { windows_ip: '', windows_port: '', printer_name: '' },
    };
    if (main && main.connectionString) {
      if (main.type === 'serial') {
        const s = main.connectionString;
        if (s.startsWith('serial://')) {
          const [portPart] = s.substring(9).split('?');
          defaults.serial.com_port = portPart || '';
        } else if (s.startsWith('\\\\.\\')) defaults.serial.com_port = s.substring(4);
        else defaults.serial.com_port = s;
        defaults.serial.baud_rate = String(main.baudRate ?? '');
        defaults.serial.data_bits = String(main.dataBits ?? '');
        defaults.serial.parity = String(main.parity ?? '');
        defaults.serial.stop_bits = String(main.stopBits ?? '');
      } else if (main.type === 'windows') {
        if (main.connectionString.startsWith('tcp://')) {
          const parts = main.connectionString.substring(6).split(':');
          defaults.windows.windows_ip = parts[0] || '';
          defaults.windows.windows_port = parts[1] || '';
        } else defaults.windows.printer_name = main.connectionString;
      }
    }
    res.json({ data: defaults });
  } catch (err) {
    console.error('GET /api/printers/defaults', err);
    res.status(500).json({ error: err.message || 'Failed to get printer defaults' });
  }
});

app.get('/api/printers/:id', async (req, res) => {
  try {
    const p = await prisma.printer.findUnique({ where: { id: req.params.id } });
    if (!p) return res.status(404).json({ error: 'Printer not found' });
    res.json(printerToApi(p));
  } catch (err) {
    console.error('GET /api/printers/:id', err);
    res.status(500).json({ error: err.message || 'Failed to fetch printer' });
  }
});

app.post('/api/printers', async (req, res) => {
  try {
    const body = req.body;
    if (!body.name || body.type == null) return res.status(400).json({ error: 'name and type are required' });
    if (body.is_main) await prisma.printer.updateMany({ data: { isMain: 0 } });
    const created = await prisma.printer.create({
      data: {
        name: String(body.name).trim(),
        type: String(body.type).trim(),
        connectionString: body.connection_string != null ? String(body.connection_string).trim() : null,
        baudRate: body.baud_rate != null ? parseInt(body.baud_rate, 10) : null,
        dataBits: body.data_bits != null ? parseInt(body.data_bits, 10) : null,
        parity: body.parity != null ? String(body.parity) : null,
        stopBits: body.stop_bits != null ? parseInt(body.stop_bits, 10) : null,
        isMain: body.is_main ? 1 : 0,
        enabled: body.enabled === 0 || body.enabled === false ? 0 : 1,
      },
    });
    res.status(201).json(printerToApi(created));
  } catch (err) {
    console.error('POST /api/printers', err);
    res.status(500).json({ error: err.message || 'Failed to create printer' });
  }
});

app.put('/api/printers/:id', async (req, res) => {
  try {
    const body = req.body;
    const id = req.params.id;
    if (body.is_main) await prisma.printer.updateMany({ where: { id: { not: id } }, data: { isMain: 0 } });
    const data = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.type !== undefined) data.type = String(body.type).trim();
    if (body.connection_string !== undefined) data.connectionString = body.connection_string != null ? String(body.connection_string).trim() : null;
    if (body.baud_rate !== undefined) data.baudRate = body.baud_rate != null ? parseInt(body.baud_rate, 10) : null;
    if (body.data_bits !== undefined) data.dataBits = body.data_bits != null ? parseInt(body.data_bits, 10) : null;
    if (body.parity !== undefined) data.parity = body.parity != null ? String(body.parity) : null;
    if (body.stop_bits !== undefined) data.stopBits = body.stop_bits != null ? parseInt(body.stop_bits, 10) : null;
    if (body.is_main !== undefined) data.isMain = body.is_main ? 1 : 0;
    if (body.enabled !== undefined) data.enabled = body.enabled === 0 || body.enabled === false ? 0 : 1;
    const updated = await prisma.printer.update({ where: { id }, data });
    res.json(printerToApi(updated));
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Printer not found' });
    console.error('PUT /api/printers/:id', err);
    res.status(500).json({ error: err.message || 'Failed to update printer' });
  }
});

app.delete('/api/printers/:id', async (req, res) => {
  try {
    await prisma.printer.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Printer not found' });
    console.error('DELETE /api/printers/:id', err);
    res.status(500).json({ error: err.message || 'Failed to delete printer' });
  }
});

/** Plain-text / monospace report lines → ESC/POS on the main (default) POS printer. */
app.post('/api/printers/text-report', async (req, res) => {
  try {
    const rawLines = req.body?.lines;
    const lines = Array.isArray(rawLines) ? rawLines.map((l) => String(l ?? '')) : [];
    if (!lines.length) return res.status(400).json({ error: 'lines array is required' });

    const enabledPrinters = await prisma.printer.findMany({
      where: { enabled: 1 },
      orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
    });
    if (!enabledPrinters.length) {
      return res.status(400).json({ error: 'No enabled printer configured.' });
    }
    const mainPrinter = enabledPrinters.find((p) => p.isMain === 1) || enabledPrinters[0];
    const validation = validatePrinterConnection(mainPrinter.type, mainPrinter.connectionString);
    if (!validation.ok) return res.status(400).json({ error: validation.error });

    serverLog('printer', 'Text report print to main printer', {
      printerId: mainPrinter.id,
      printerName: mainPrinter.name,
      lineCount: lines.length,
    });
    const sendResult = await sendToPrinter(mainPrinter, lines);
    return res.json({
      success: true,
      message: 'Report sent to main printer',
      data: {
        printed: true,
        printerId: mainPrinter.id,
        printerName: mainPrinter.name,
        ...sendResult,
      },
    });
  } catch (err) {
    console.error('POST /api/printers/text-report', err);
    return res.status(500).json({ error: err.message || 'Failed to print report' });
  }
});

/** Product label print to an explicitly selected printer (Labels tab setting). */
app.post('/api/printers/label', async (req, res) => {
  try {
    const body = req.body || {};
    const printerId = String(body.printerId || '').trim();
    if (!printerId) return res.status(400).json({ error: 'printerId is required' });

    const printer = await prisma.printer.findUnique({ where: { id: printerId } });
    if (!printer || printer.enabled !== 1) {
      return res.status(400).json({ error: 'Configured label printer is missing or disabled.' });
    }
    const validation = validatePrinterConnection(printer.type, printer.connectionString);
    if (!validation.ok) return res.status(400).json({ error: validation.error });

    const copiesRaw = Number.parseInt(String(body.copies ?? '1'), 10);
    const copies = Number.isInteger(copiesRaw) ? Math.min(50, Math.max(1, copiesRaw)) : 1;
    const rows = buildProductLabelPrintRows({
      productName: body.productName,
      price: body.price,
      barcode: body.barcode,
      formatLabel: body.formatLabel,
      includeProductName: body.includeProductName !== false,
      includePrice: body.includePrice !== false,
      includeBarcode: body.includeBarcode !== false,
    });
    const escPayload = buildEscPosProductLabelPayload({
      productName: body.productName,
      price: body.price,
      barcode: body.barcode,
      includeProductName: body.includeProductName !== false,
      includePrice: body.includePrice !== false,
      includeBarcode: body.includeBarcode !== false,
    });
    const tsplPayload = buildTsplProductLabelPayload({
      productName: body.productName,
      price: body.price,
      barcode: body.barcode,
      includeProductName: body.includeProductName !== false,
      includePrice: body.includePrice !== false,
      includeBarcode: body.includeBarcode !== false,
      formatWidth: body.formatWidth,
      formatHeight: body.formatHeight,
      marginLeft: body.marginLeft,
      marginRight: body.marginRight,
      marginBottom: body.marginBottom,
      marginTop: body.marginTop,
    });
    const labelType = normalizeLabelType(body.labelType, 'production-labels');
    const isWindowsTcpPrinter = String(printer?.type || '').toLowerCase() === 'windows' && String(printer?.connectionString || '').startsWith('tcp://');
    // Label endpoint is primarily used by label printers; for Windows TCP we prefer TSPL
    // even if labelType is missing from frontend payload.
    const shouldPreferTspl = isWindowsTcpPrinter && (labelType === 'article-label' || !labelType);

    let lastSendResult = null;
    for (let i = 0; i < copies; i += 1) {
      if (shouldPreferTspl) {
        lastSendResult = await sendEscPosPayloadToPrinter(printer, tsplPayload, rows);
      } else {
        lastSendResult = await sendEscPosPayloadToPrinter(printer, escPayload, rows);
      }
    }

    serverLog('printer', 'Product label print sent', {
      printerId: printer.id,
      printerName: printer.name,
      copies,
      labelType,
      includeProductName: body.includeProductName !== false,
      includePrice: body.includePrice !== false,
      includeBarcode: body.includeBarcode !== false,
      transportProfile: shouldPreferTspl ? 'tspl' : 'escpos',
      formatLabel: String(body.formatLabel || ''),
      productName: String(body.productName || ''),
    });
    return res.json({
      success: true,
      message: 'Label sent to configured printer',
      data: {
        printed: true,
        copies,
        printerId: printer.id,
        printerName: printer.name,
        ...lastSendResult,
      },
    });
  } catch (err) {
    console.error('POST /api/printers/label', err);
    return res.status(500).json({ error: err.message || 'Failed to print label' });
  }
});

// Production print: order items without prices to printer1, printer2, printer3 (product-configured production printers)
app.post('/api/printers/production', async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    serverLog('printer', 'Production print requested', { orderId });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: orderItemsInclude, customer: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!Array.isArray(order.items) || order.items.length === 0) {
      return res.status(400).json({ error: 'Order has no items to print' });
    }

    const enabledPrinters = await prisma.printer.findMany({
      where: { enabled: 1 },
      orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }]
    });
    const printersById = new Map(enabledPrinters.map((p) => [p.id, p]));

    const itemLines = order.items.map((item) => buildReceiptItemStructured(item, printersById));

    const printedAt = new Date().toISOString();
    const productionByPrinterId = new Map();
    for (const line of itemLines) {
      const printerIds = new Set([line.printer1Id, line.printer2Id, line.printer3Id].filter(Boolean));
      for (const pid of printerIds) {
        if (!productionByPrinterId.has(pid)) productionByPrinterId.set(pid, []);
        productionByPrinterId.get(pid).push(line);
      }
    }

    const printJobs = [];
    for (const [printerId, lines] of productionByPrinterId.entries()) {
      const printer = printersById.get(printerId);
      if (!printer) continue;
      const validation = validatePrinterConnection(printer.type, printer.connectionString);
      if (!validation.ok) continue;
      const slipLines = kitchenProductionSlipRows(order, printedAt, lines.flatMap((line) => line.slipPrintParts));
      try {
        const sendResult = await sendToPrinter(printer, slipLines);
        printJobs.push({ printerId: printer.id, printerName: printer.name, items: lines.length, ...sendResult });
        serverLog('printer', 'Production slip sent', { orderId: order.id, printerId: printer.id, items: lines.length });
      } catch (slipErr) {
        serverLog('printer', 'Production slip failed', { orderId: order.id, printerId, error: slipErr?.message });
      }
    }

    return res.json({
      success: true,
      message: `Production print sent for order "${order.id}"`,
      data: { orderId: order.id, printJobs }
    });
  } catch (err) {
    console.error('POST /api/printers/production', err);
    res.status(500).json({ error: err.message || 'Production print failed' });
  }
});

// Planning / history: totals slip with line prices (no payment) — main printer only
app.post('/api/printers/planning-totals', async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    serverLog('printer', 'Planning totals slip requested', { orderId });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: orderItemsInclude, customer: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!Array.isArray(order.items) || order.items.length === 0) {
      return res.status(400).json({ error: 'Order has no items to print' });
    }

    const enabledPrinters = await prisma.printer.findMany({
      where: { enabled: 1 },
      orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }]
    });
    if (!enabledPrinters.length) {
      return res.status(400).json({ error: 'No enabled printer configured.' });
    }
    const mainPrinter = enabledPrinters.find((p) => p.isMain === 1) || enabledPrinters[0];
    const validation = validatePrinterConnection(mainPrinter.type, mainPrinter.connectionString);
    if (!validation.ok) return res.status(400).json({ error: validation.error });

    const dbTotal = Math.round(order.items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0) * 100) / 100;
    const itemLines = order.items.map((item) => buildReceiptItemStructured(item, null));

    const vatSummary = buildReceiptVatSummary(itemLines);
    const printedAt = new Date().toISOString();
    const cust = order.customer;
    const custLabel = cust ? (cust.companyName || cust.name || '–') : '–';
    const slipLines = planningTotalsReceiptRows(
      order,
      printedAt,
      custLabel,
      itemLines.flatMap((line) => line.receiptPrintParts),
      dbTotal,
      vatSummary,
    );

    const sendResult = await sendToPrinter(mainPrinter, slipLines);
    return res.json({
      success: true,
      message: `Planning totals slip sent for order "${order.id}"`,
      data: {
        orderId: order.id,
        printJobs: [{ printerId: mainPrinter.id, printerName: mainPrinter.name, items: itemLines.length, ...sendResult }]
      }
    });
  } catch (err) {
    console.error('POST /api/printers/planning-totals', err);
    return res.status(500).json({ error: err.message || 'Planning totals print failed' });
  }
});

app.post('/api/printers/receipt', async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    serverLog('printer', 'Receipt print requested', { orderId });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: orderItemsInclude, customer: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!Array.isArray(order.items) || order.items.length === 0) {
      return res.status(400).json({ error: 'Order has no items to print' });
    }

    const dbTotal = Math.round(order.items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0) * 100) / 100;
    const paymentBreakdown = req.body?.paymentBreakdown || {};
    const { paidTotal, paymentMethodLines, paymentMethodsSummary } = await resolveReceiptPaymentBreakdown(paymentBreakdown, dbTotal);
    if (Math.abs(paidTotal - dbTotal) > 0.009) {
      return res.status(400).json({ error: `Paid total (${formatEuroAmount(paidTotal)}) must match order total (${formatEuroAmount(dbTotal)}).` });
    }

    const enabledPrinters = await prisma.printer.findMany({
      where: { enabled: 1 },
      orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }]
    });
    if (!enabledPrinters.length) {
      return res.status(400).json({ error: 'No enabled printer configured for receipt printing.' });
    }
    const printersById = new Map(enabledPrinters.map((p) => [p.id, p]));
    const mainPrinter = enabledPrinters.find((p) => p.isMain === 1) || enabledPrinters[0];
    serverLog('printer', 'Main printer selected for final ticket', {
      orderId,
      printerId: mainPrinter.id,
      printerName: mainPrinter.name,
      isMain: mainPrinter.isMain === 1,
    });

    const itemLines = order.items.map((item) => buildReceiptItemStructured(item, printersById));

    const printedAt = new Date().toISOString();

    // Final ticket (with prices): always only to main printer
    const validation = validatePrinterConnection(mainPrinter.type, mainPrinter.connectionString);
    if (!validation.ok) return res.status(400).json({ error: validation.error });
    const vatSummary = buildReceiptVatSummary(itemLines);
    const receiptLines = finalReceiptTicketRows({
      title: `Receipt ${order.id}`,
      headerLines: [`Printed at ${printedAt}`, `Customer: ${order.customer?.name || '-'}`],
      printerLine: `Printer: ${mainPrinter.name || mainPrinter.id}`,
      receiptPrintParts: itemLines.flatMap((line) => line.receiptPrintParts),
      dbTotal,
      vatSummary,
      paidTotal,
      paymentMethodLines,
    });
    const printJobs = [];
    const sendResult = await sendToPrinter(mainPrinter, receiptLines);
    printJobs.push({
      printerId: mainPrinter.id,
      printerName: mainPrinter.name,
      items: itemLines.length,
      subtotal: dbTotal,
      receipt_text: formatPrinterRowsPlainText(receiptLines),
      ...sendResult
    });
    serverLog('printer', 'Final ticket sent to main printer', {
      orderId: order.id,
      printerId: mainPrinter.id,
      printerName: mainPrinter.name,
      items: itemLines.length,
      transport: sendResult?.transport || 'unknown',
      sentBytes: sendResult?.sentBytes ?? 0,
      receivedBytes: sendResult?.receivedBytes ?? 0,
    });

    const noPriceSlipsByPrinterId = new Map();
    for (const line of itemLines) {
      const printerIds = new Set([line.printer1Id, line.printer2Id, line.printer3Id].filter(Boolean));
      for (const pid of printerIds) {
        if (!noPriceSlipsByPrinterId.has(pid)) noPriceSlipsByPrinterId.set(pid, []);
        noPriceSlipsByPrinterId.get(pid).push(line);
      }
    }
    for (const [printerId, lines] of noPriceSlipsByPrinterId.entries()) {
      const printer = printersById.get(printerId);
      if (!printer) continue;
      const validation = validatePrinterConnection(printer.type, printer.connectionString);
      if (!validation.ok) continue;
      const slipLines = kitchenProductionSlipRows(order, printedAt, lines.flatMap((line) => line.slipPrintParts));
      try {
        const sendResult = await sendToPrinter(printer, slipLines);
        printJobs.push({
          printerId: printer.id,
          printerName: printer.name,
          items: lines.length,
          noPrices: true,
          receipt_text: formatPrinterRowsPlainText(slipLines),
          ...sendResult
        });
        serverLog('printer', 'No-price slip sent to printer', {
          orderId: order.id,
          printerId: printer.id,
          printerName: printer.name,
          items: lines.length,
        });
      } catch (slipErr) {
        serverLog('printer', 'No-price slip failed', { orderId: order.id, printerId, error: slipErr?.message });
      }
    }
    serverLog('printer', 'Receipt payload prepared', {
      orderId: order.id,
      items: itemLines.length,
      total: dbTotal,
      paidTotal,
      paymentMethods: paymentMethodsSummary,
    });
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { printed: true },
      include: { items: orderItemsInclude, customer: true, user: true, payments: true }
    });
    io.emit('order:updated', updatedOrder);
    return res.json({
      success: true,
      message: `Receipt print request sent for order "${order.id}"`,
      data: {
        orderId: order.id,
        printerId: mainPrinter.id,
        printerName: mainPrinter.name,
        total: dbTotal,
        paidTotal,
        vatSummary,
        paymentMethods: paymentMethodsSummary,
        items: itemLines,
        printJobs,
        printed: true,
      }
    });
  } catch (err) {
    console.error('POST /api/printers/receipt', err);
    return res.status(500).json({ error: err.message || 'Failed to print receipt' });
  }
});

app.post('/api/printers/test', async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const type = String(body.type || '').trim().toLowerCase();
    const connectionString = String(body.connection_string || '').trim();
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
    const validation = validatePrinterConnection(type, connectionString);
    if (!validation.ok) return res.status(400).json({ error: validation.error });

    const receiptLines = [
      { text: `TEST PRINT - ${name}`, size: 'double', bold: true },
      { text: `Type: ${type}`, size: 'double' },
      { text: `Time: ${new Date().toISOString()}`, size: 'double' },
      { text: '------------------------------', size: 'normal' },
      { text: 'If this is printed, printer transport works.', size: 'double' },
    ];
    const sendResult = await sendToPrinter({ type, connectionString, baudRate: body.baud_rate }, receiptLines);
    serverLog('printer', 'Test print sent', { name, type, connectionString, ...sendResult });
    return res.json({
      success: true,
      message: `Test print sent for "${name}"`,
      data: { printed: true, ...sendResult },
    });
  } catch (err) {
    console.error('POST /api/printers/test', err);
    return res.status(500).json({ error: err.message || 'Failed to test printer' });
  }
});

// ---------- Cashmatic payment – same API as 123 ----------
app.post('/api/cashmatic/start', async (req, res) => {
  try {
    const amount = req.body?.amount;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount should be greater than 0' });
    serverLog('cashmatic', 'Start payment requested', { amount });
    const terminal = await prisma.paymentTerminal.findFirst({ where: { type: 'cashmatic', enabled: 1 }, orderBy: { isMain: 'desc' } });
    if (!terminal) {
      return res.status(503).json({ error: 'Cashmatic terminal not configured or not enabled.' });
    }
    serverLog('cashmatic', 'Using terminal configuration', {
      terminalId: terminal.id,
      terminalName: terminal.name,
      connectionType: terminal.connectionType,
      connection: summarizeCashmaticConnection(terminal.connectionString),
    });
    const terminalForService = { connection_string: terminal.connectionString };
    const service = createCashmaticService(terminalForService);
    const result = await service.createSession(amount);
    if (!result?.success) {
      return res.status(500).json({ error: result?.message || 'Failed to start Cashmatic payment' });
    }
    serverLog('cashmatic', 'Payment session started', { sessionId: result.sessionId, amount });
    res.json({ data: { sessionId: result.sessionId } });
  } catch (err) {
    console.error('POST /api/cashmatic/start', err);
    const networkErrorCodes = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN']);
    const code = networkErrorCodes.has(err.code) ? 503 : 500;
    const isNetworkError = networkErrorCodes.has(err.code);
    const message = isNetworkError
      ? `Unable to connect to Cashmatic terminal. Please verify IP/port and network connectivity. (${err.message || err.code})`
      : (err.message || 'Failed to start Cashmatic payment');
    serverLog('cashmatic', 'Start payment failed', { code: err.code || 'UNKNOWN', message: err.message || String(err) });
    res.status(code).json({ error: message });
  }
});

app.get('/api/cashmatic/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const terminal = await prisma.paymentTerminal.findFirst({ where: { type: 'cashmatic', enabled: 1 }, orderBy: { isMain: 'desc' } });
    if (!terminal) {
      return res.status(503).json({ success: false, error: 'Cashmatic terminal not configured or not enabled.' });
    }
    const service = createCashmaticService({ connection_string: terminal.connectionString });
    const result = await service.getSessionStatus(sessionId);
    if (!result?.success) {
      serverLog('cashmatic', 'Status lookup failed', { sessionId, message: result?.message || 'Session not found' });
      return res.status(404).json({ success: false, error: result?.message || 'Session not found' });
    }
    if (['PAID', 'FINISHED', 'FINISHED_MANUAL', 'CANCELLED', 'ERROR'].includes(String(result.state || '').toUpperCase())) {
      serverLog('cashmatic', 'Status update', {
        sessionId,
        state: result.state,
        requestedAmount: result.requestedAmount ?? 0,
        insertedAmount: result.insertedAmount ?? 0,
      });
    }
    res.json({
      success: true,
      data: {
        state: result.state,
        requestedAmount: result.requestedAmount ?? 0,
        insertedAmount: result.insertedAmount ?? 0,
        dispensedAmount: result.dispensedAmount ?? 0,
        notDispensedAmount: result.notDispensedAmount ?? 0,
      },
    });
  } catch (err) {
    console.error('GET /api/cashmatic/status/:sessionId', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to get payment status' });
  }
});

app.post('/api/cashmatic/finish/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    serverLog('cashmatic', 'Finish payment requested', { sessionId });
    const terminal = await prisma.paymentTerminal.findFirst({ where: { type: 'cashmatic', enabled: 1 }, orderBy: { isMain: 'desc' } });
    if (!terminal) {
      return res.status(503).json({ success: false, error: 'Cashmatic terminal not configured or not enabled.' });
    }
    const service = createCashmaticService({ connection_string: terminal.connectionString });
    const result = await service.commitAndRemoveSession(sessionId);
    if (!result?.success) {
      return res.status(404).json({ success: false, error: result?.message || 'Session not found' });
    }
    serverLog('cashmatic', 'Finish payment succeeded', { sessionId });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('POST /api/cashmatic/finish/:sessionId', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to finish payment' });
  }
});

app.post('/api/cashmatic/cancel/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    serverLog('cashmatic', 'Cancel payment requested', { sessionId });
    const terminal = await prisma.paymentTerminal.findFirst({ where: { type: 'cashmatic', enabled: 1 }, orderBy: { isMain: 'desc' } });
    if (!terminal) {
      return res.status(503).json({ success: false, error: 'Cashmatic terminal not configured or not enabled.' });
    }
    const service = createCashmaticService({ connection_string: terminal.connectionString });
    const result = await service.cancelSession(sessionId);
    serverLog('cashmatic', 'Cancel payment completed', { sessionId, state: result?.state || 'CANCELLED' });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('POST /api/cashmatic/cancel/:sessionId', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to cancel payment' });
  }
});

// ---------- Payworld payment (session-based) ----------
app.post('/api/payworld/start', async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid amount for Payworld' });
    }

    const terminal = await prisma.paymentTerminal.findFirst({
      where: { type: { in: ['payworld', 'bancontact', 'payword'] }, enabled: 1 },
      orderBy: { isMain: 'desc' },
    });
    if (!terminal) {
      return res.status(503).json({
        ok: false,
        error: 'Payworld terminal not configured or not enabled.',
      });
    }

    serverLog('payworld', 'Start payment requested', {
      amount,
      terminalId: terminal.id,
      terminalName: terminal.name,
      connection: summarizePayworldConnection(terminal.connectionString),
    });

    const service = createPayworldService({ connection_string: terminal.connectionString });
    const result = service.createSession(amount);
    if (!result?.success) {
      return res.status(500).json({ ok: false, error: result?.message || 'Failed to start Payworld payment.' });
    }

    return res.json({
      ok: true,
      provider: 'payworld',
      sessionId: result.sessionId,
      state: result?.data?.state || 'IN_PROGRESS',
      message: result?.data?.message || 'Starting payment...',
      amountInCents: result?.data?.amountInCents,
    });
  } catch (err) {
    console.error('POST /api/payworld/start', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to start Payworld payment' });
  }
});

app.get('/api/payworld/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ ok: false, error: 'No sessionId provided.' });

    const terminal = await prisma.paymentTerminal.findFirst({
      where: { type: { in: ['payworld', 'bancontact', 'payword'] }, enabled: 1 },
      orderBy: { isMain: 'desc' },
    });
    if (!terminal) {
      return res.status(503).json({ ok: false, error: 'Payworld terminal not configured or not enabled.' });
    }

    const service = createPayworldService({ connection_string: terminal.connectionString });
    const status = service.getSessionStatus(sessionId);
    if (!status?.success) return res.status(404).json({ ok: false, error: status?.message || 'Session not found' });
    return res.json(status);
  } catch (err) {
    console.error('GET /api/payworld/status/:sessionId', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to get Payworld status' });
  }
});

app.post('/api/payworld/cancel/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ ok: false, error: 'No sessionId provided.' });

    const terminal = await prisma.paymentTerminal.findFirst({
      where: { type: { in: ['payworld', 'bancontact', 'payword'] }, enabled: 1 },
      orderBy: { isMain: 'desc' },
    });
    if (!terminal) {
      return res.status(503).json({ ok: false, error: 'Payworld terminal not configured or not enabled.' });
    }

    const service = createPayworldService({ connection_string: terminal.connectionString });
    const result = await service.cancelSession(sessionId);
    if (!result?.success) return res.status(400).json({ ok: false, error: result?.message || 'Cancel failed' });
    return res.json({ ok: true, message: result.message || 'Payment cancelled.' });
  } catch (err) {
    console.error('POST /api/payworld/cancel/:sessionId', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to cancel Payworld payment' });
  }
});

// ---------- Viva payment (session-based) ----------
app.post('/api/viva/start', async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid amount for Viva' });
    }

    const terminal = await prisma.paymentTerminal.findFirst({
      where: { type: { in: ['viva', 'viva-wallet'] }, enabled: 1 },
      orderBy: { isMain: 'desc' },
    });
    if (!terminal) {
      return res.status(503).json({
        ok: false,
        error: 'Viva terminal not configured or not enabled.',
      });
    }

    serverLog('viva', 'Start payment requested', {
      amount,
      terminalId: terminal.id,
      terminalName: terminal.name,
      connection: summarizePayworldConnection(terminal.connectionString),
    });

    const service = createVivaService({ connection_string: terminal.connectionString });
    const result = service.createSession(amount);
    if (!result?.success) {
      return res.status(500).json({ ok: false, error: result?.message || 'Failed to start Viva payment.' });
    }

    return res.json({
      ok: true,
      provider: 'viva',
      sessionId: result.sessionId,
      state: result?.data?.state || 'IN_PROGRESS',
      message: result?.data?.message || 'Starting payment...',
      amountInCents: result?.data?.amountInCents,
    });
  } catch (err) {
    console.error('POST /api/viva/start', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to start Viva payment' });
  }
});

app.get('/api/viva/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ ok: false, error: 'No sessionId provided.' });

    const terminal = await prisma.paymentTerminal.findFirst({
      where: { type: { in: ['viva', 'viva-wallet'] }, enabled: 1 },
      orderBy: { isMain: 'desc' },
    });
    if (!terminal) {
      return res.status(503).json({ ok: false, error: 'Viva terminal not configured or not enabled.' });
    }

    const service = createVivaService({ connection_string: terminal.connectionString });
    const status = service.getSessionStatus(sessionId);
    if (!status?.success) return res.status(404).json({ ok: false, error: status?.message || 'Session not found' });
    return res.json(status);
  } catch (err) {
    console.error('GET /api/viva/status/:sessionId', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to get Viva status' });
  }
});

app.post('/api/viva/cancel/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ ok: false, error: 'No sessionId provided.' });

    const terminal = await prisma.paymentTerminal.findFirst({
      where: { type: { in: ['viva', 'viva-wallet'] }, enabled: 1 },
      orderBy: { isMain: 'desc' },
    });
    if (!terminal) {
      return res.status(503).json({ ok: false, error: 'Viva terminal not configured or not enabled.' });
    }

    const service = createVivaService({ connection_string: terminal.connectionString });
    const result = await service.cancelSession(sessionId);
    if (!result?.success) return res.status(400).json({ ok: false, error: result?.message || 'Cancel failed' });
    return res.json({ ok: true, message: result.message || 'Payment cancelled.' });
  } catch (err) {
    console.error('POST /api/viva/cancel/:sessionId', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to cancel Viva payment' });
  }
});

app.get('/api/viva/config', async (req, res) => {
  try {
    const terminal = await prisma.paymentTerminal.findFirst({
      where: { type: { in: ['viva', 'viva-wallet'] } },
      orderBy: { isMain: 'desc' },
    });
    if (!terminal) return res.json({ ok: true, config: {} });

    let config = {};
    try {
      config = JSON.parse(String(terminal.connectionString || '{}'));
    } catch {
      config = {};
    }
    return res.json({ ok: true, config });
  } catch (err) {
    console.error('GET /api/viva/config', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to load Viva config' });
  }
});

app.post('/api/viva/config', async (req, res) => {
  try {
    const cfg = req.body || {};
    const connectionString = JSON.stringify({
      ip: cfg.ip || '',
      port: cfg.port || '',
      posId: cfg.posId || '',
      currencyCode: cfg.currencyCode || '',
      timeoutMs: cfg.timeoutMs || 60000,
    });

    const existing = await prisma.paymentTerminal.findFirst({
      where: { type: { in: ['viva', 'viva-wallet'] } },
      orderBy: { isMain: 'desc' },
    });

    if (existing) {
      await prisma.paymentTerminal.update({
        where: { id: existing.id },
        data: {
          connectionString,
          connectionType: existing.connectionType || 'tcp',
          enabled: existing.enabled ?? 1,
          type: 'viva',
        },
      });
    } else {
      await prisma.paymentTerminal.create({
        data: {
          name: 'Viva Terminal',
          type: 'viva',
          connectionType: 'tcp',
          connectionString,
          enabled: 1,
          isMain: 0,
        },
      });
    }

    return res.json({ ok: true, message: 'Viva config saved.', config: cfg });
  } catch (err) {
    console.error('POST /api/viva/config', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to save Viva config' });
  }
});

// ---------- CCV payment (session-based) ----------
app.post('/api/ccv/start', async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid amount for CCV' });
    }

    const terminal = await prisma.paymentTerminal.findFirst({
      where: { type: { in: ['ccv'] }, enabled: 1 },
      orderBy: { isMain: 'desc' },
    });
    if (!terminal) {
      return res.status(503).json({
        ok: false,
        error: 'CCV terminal not configured or not enabled.',
      });
    }

    serverLog('ccv', 'Start payment requested', {
      amount,
      terminalId: terminal.id,
      terminalName: terminal.name,
      connection: summarizePayworldConnection(terminal.connectionString),
    });

    const service = createCcvService({ connection_string: terminal.connectionString });
    const result = service.createSession(amount);
    if (!result?.success) {
      return res.status(500).json({ ok: false, error: result?.message || 'Failed to start CCV payment.' });
    }

    return res.json({
      ok: true,
      provider: 'ccv',
      sessionId: result.sessionId,
      state: result?.data?.state || 'IN_PROGRESS',
      message: result?.data?.message || 'Starting payment...',
      amount: result?.data?.amount,
    });
  } catch (err) {
    console.error('POST /api/ccv/start', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to start CCV payment' });
  }
});

app.get('/api/ccv/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ ok: false, error: 'No sessionId provided.' });

    const terminal = await prisma.paymentTerminal.findFirst({
      where: { type: { in: ['ccv'] }, enabled: 1 },
      orderBy: { isMain: 'desc' },
    });
    if (!terminal) {
      return res.status(503).json({ ok: false, error: 'CCV terminal not configured or not enabled.' });
    }

    const service = createCcvService({ connection_string: terminal.connectionString });
    const status = service.getSessionStatus(sessionId);
    if (!status?.success) return res.status(404).json({ ok: false, error: status?.message || 'Session not found' });
    return res.json(status);
  } catch (err) {
    console.error('GET /api/ccv/status/:sessionId', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to get CCV status' });
  }
});

app.post('/api/ccv/cancel/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ ok: false, error: 'No sessionId provided.' });

    const terminal = await prisma.paymentTerminal.findFirst({
      where: { type: { in: ['ccv'] }, enabled: 1 },
      orderBy: { isMain: 'desc' },
    });
    if (!terminal) {
      return res.status(503).json({ ok: false, error: 'CCV terminal not configured or not enabled.' });
    }

    const service = createCcvService({ connection_string: terminal.connectionString });
    const result = await service.cancelSession(sessionId);
    if (!result?.success) return res.status(400).json({ ok: false, error: result?.message || 'Cancel failed' });
    return res.json({ ok: true, message: result.message || 'Payment cancelled.' });
  } catch (err) {
    console.error('POST /api/ccv/cancel/:sessionId', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to cancel CCV payment' });
  }
});

app.get('/api/ccv/config', async (req, res) => {
  try {
    const terminal = await prisma.paymentTerminal.findFirst({
      where: { type: { in: ['ccv'] } },
      orderBy: { isMain: 'desc' },
    });
    if (!terminal) return res.json({ ok: true, config: {} });

    let config = {};
    try {
      config = JSON.parse(String(terminal.connectionString || '{}'));
    } catch {
      config = {};
    }
    return res.json({ ok: true, config });
  } catch (err) {
    console.error('GET /api/ccv/config', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to load CCV config' });
  }
});

app.post('/api/ccv/config', async (req, res) => {
  try {
    const cfg = req.body || {};
    const connectionString = JSON.stringify({
      ip: cfg.ip || '',
      commandPort: cfg.commandPort || cfg.port || '',
      devicePort: cfg.devicePort || '',
      workstationId: cfg.workstationId || 'POS',
      languageCode: cfg.languageCode || 'en',
      currencyCode: cfg.currencyCode || 'EUR',
      timeoutMs: cfg.timeoutMs || 120000,
    });

    const existing = await prisma.paymentTerminal.findFirst({
      where: { type: { in: ['ccv'] } },
      orderBy: { isMain: 'desc' },
    });

    if (existing) {
      await prisma.paymentTerminal.update({
        where: { id: existing.id },
        data: {
          connectionString,
          connectionType: existing.connectionType || 'tcp',
          enabled: existing.enabled ?? 1,
          type: 'ccv',
        },
      });
    } else {
      await prisma.paymentTerminal.create({
        data: {
          name: 'CCV Terminal',
          type: 'ccv',
          connectionType: 'tcp',
          connectionString,
          enabled: 1,
          isMain: 0,
        },
      });
    }

    return res.json({ ok: true, message: 'CCV config saved.', config: cfg });
  } catch (err) {
    console.error('POST /api/ccv/config', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to save CCV config' });
  }
});

app.get('/api/payworld/config', async (req, res) => {
  try {
    const terminal = await prisma.paymentTerminal.findFirst({
      where: { type: { in: ['payworld', 'bancontact', 'payword'] } },
      orderBy: { isMain: 'desc' },
    });
    if (!terminal) return res.json({ ok: true, config: {} });

    let config = {};
    try {
      config = JSON.parse(String(terminal.connectionString || '{}'));
    } catch {
      config = {};
    }
    return res.json({ ok: true, config });
  } catch (err) {
    console.error('GET /api/payworld/config', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to load Payworld config' });
  }
});

app.post('/api/payworld/config', async (req, res) => {
  try {
    const cfg = req.body || {};
    const connectionString = JSON.stringify({
      ip: cfg.ip || '',
      port: cfg.port || '',
      posId: cfg.posId || '',
      currencyCode: cfg.currencyCode || '',
      timeoutMs: cfg.timeoutMs || 60000,
    });

    const existing = await prisma.paymentTerminal.findFirst({
      where: { type: { in: ['payworld', 'bancontact', 'payword'] } },
      orderBy: { isMain: 'desc' },
    });

    if (existing) {
      await prisma.paymentTerminal.update({
        where: { id: existing.id },
        data: {
          connectionString,
          connectionType: existing.connectionType || 'tcp',
          enabled: existing.enabled ?? 1,
        },
      });
    } else {
      await prisma.paymentTerminal.create({
        data: {
          name: 'Payworld Terminal',
          type: 'payworld',
          connectionType: 'tcp',
          connectionString,
          enabled: 1,
          isMain: 0,
        },
      });
    }

    return res.json({ ok: true, message: 'Payworld config saved.', config: cfg });
  } catch (err) {
    console.error('POST /api/payworld/config', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to save Payworld config' });
  }
});

// REST: suppliers (webpanel)
function supplierToNullable(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
}

app.get('/api/suppliers', async (req, res) => {
  try {
    const rows = await prisma.supplier.findMany({ orderBy: { companyName: 'asc' } });
    res.json(rows);
  } catch (err) {
    console.error('GET /api/suppliers', err);
    res.status(500).json({ error: err.message || 'Failed to fetch suppliers' });
  }
});

app.post('/api/suppliers', async (req, res) => {
  try {
    const body = req.body || {};
    const companyName = String(body.companyName ?? '').trim();
    if (!companyName) return res.status(400).json({ error: 'companyName is required' });
    const created = await prisma.supplier.create({
      data: {
        companyName,
        vatNumber: supplierToNullable(body.vatNumber),
        street: supplierToNullable(body.street),
        postalCode: supplierToNullable(body.postalCode),
        city: supplierToNullable(body.city),
        country: supplierToNullable(body.country) || 'BE',
        phone: supplierToNullable(body.phone),
        email: supplierToNullable(body.email),
        remarks: supplierToNullable(body.remarks),
      },
    });
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /api/suppliers', err);
    res.status(500).json({ error: err.message || 'Failed to create supplier' });
  }
});

app.patch('/api/suppliers/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const data = {};
    if (body.companyName !== undefined) {
      const name = String(body.companyName ?? '').trim();
      if (!name) return res.status(400).json({ error: 'companyName cannot be empty' });
      data.companyName = name;
    }
    if (body.vatNumber !== undefined) data.vatNumber = supplierToNullable(body.vatNumber);
    if (body.street !== undefined) data.street = supplierToNullable(body.street);
    if (body.postalCode !== undefined) data.postalCode = supplierToNullable(body.postalCode);
    if (body.city !== undefined) data.city = supplierToNullable(body.city);
    if (body.country !== undefined) data.country = supplierToNullable(body.country) || 'BE';
    if (body.phone !== undefined) data.phone = supplierToNullable(body.phone);
    if (body.email !== undefined) data.email = supplierToNullable(body.email);
    if (body.remarks !== undefined) data.remarks = supplierToNullable(body.remarks);
    const updated = await prisma.supplier.update({
      where: { id: req.params.id },
      data,
    });
    res.json(updated);
  } catch (err) {
    console.error('PATCH /api/suppliers/:id', err);
    res.status(500).json({ error: err.message || 'Failed to update supplier' });
  }
});

app.delete('/api/suppliers/:id', async (req, res) => {
  try {
    await prisma.supplier.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/suppliers/:id', err);
    res.status(500).json({ error: err.message || 'Failed to delete supplier' });
  }
});

// REST: customers (list with optional search) - filter in memory for SQLite compatibility
app.get('/api/customers', async (req, res) => {
  try {
    const { companyName, name, street, phone } = req.query;
    const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } });
    const lower = (s) => (s == null || s === '' ? '' : String(s).toLowerCase());
    const matches = (value, filter) => !filter || lower(value).includes(lower(filter));
    const filtered = customers.filter(
      (c) =>
        matches(c.companyName, companyName) &&
        matches(c.name, name) &&
        matches(c.street, street) &&
        matches(c.phone, phone)
    );
    res.json(filtered);
  } catch (err) {
    console.error('GET /api/customers', err);
    res.status(500).json({ error: err.message || 'Failed to fetch customers' });
  }
});

// REST: create customer
app.post('/api/customers', async (req, res) => {
  const {
    companyName,
    firstName,
    lastName,
    name,
    street,
    postalCode,
    city,
    country,
    phone,
    email,
    discount,
    priceGroup,
    vatNumber,
    loyaltyCardBarcode,
    creditTag
  } = req.body;
  const toNullable = (value) => {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized === '' ? null : normalized;
  };
  const countryNorm = toNullable(country) || 'BE';
  const customer = await prisma.customer.create({
    data: {
      companyName: toNullable(companyName),
      firstName: toNullable(firstName),
      lastName: toNullable(lastName),
      name: toNullable(name) || '',
      street: toNullable(street),
      postalCode: toNullable(postalCode),
      city: toNullable(city),
      country: countryNorm,
      phone: toNullable(phone),
      email: toNullable(email),
      discount: toNullable(discount),
      priceGroup: toNullable(priceGroup),
      vatNumber: toNullable(vatNumber),
      loyaltyCardBarcode: toNullable(loyaltyCardBarcode),
      creditTag: toNullable(creditTag)
    }
  });
  res.json(customer);
});

// REST: update customer
app.patch('/api/customers/:id', async (req, res) => {
  const {
    companyName,
    firstName,
    lastName,
    name,
    street,
    postalCode,
    city,
    country,
    phone,
    email,
    discount,
    priceGroup,
    vatNumber,
    loyaltyCardBarcode,
    creditTag
  } = req.body;
  const toNullable = (value) => {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized === '' ? null : normalized;
  };
  const data = {};
  if (companyName !== undefined) data.companyName = toNullable(companyName);
  if (firstName !== undefined) data.firstName = toNullable(firstName);
  if (lastName !== undefined) data.lastName = toNullable(lastName);
  if (name !== undefined) data.name = toNullable(name) || '';
  if (street !== undefined) data.street = toNullable(street);
  if (postalCode !== undefined) data.postalCode = toNullable(postalCode);
  if (city !== undefined) data.city = toNullable(city);
  if (country !== undefined) data.country = toNullable(country) || 'BE';
  if (phone !== undefined) data.phone = toNullable(phone);
  if (email !== undefined) data.email = toNullable(email);
  if (discount !== undefined) data.discount = toNullable(discount);
  if (priceGroup !== undefined) data.priceGroup = toNullable(priceGroup);
  if (vatNumber !== undefined) data.vatNumber = toNullable(vatNumber);
  if (loyaltyCardBarcode !== undefined) data.loyaltyCardBarcode = toNullable(loyaltyCardBarcode);
  if (creditTag !== undefined) data.creditTag = toNullable(creditTag);
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data
  });
  res.json(customer);
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await prisma.order.updateMany({ where: { customerId: id }, data: { customerId: null } });
    await prisma.customer.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/customers/:id', err);
    res.status(500).json({ error: err.message || 'Failed to delete customer' });
  }
});

// Socket: join room for POS updates
io.on('connection', (socket) => {
  socket.on('pos:subscribe', () => {
    socket.join('pos');
  });
});

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '0.0.0.0';

httpServer.on('error', (err) => {
  console.error('[backend] HTTP server error:', err?.message || err);
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      `[backend] Port ${PORT} is already in use. Set env PORT to a free port (e.g. 4040) or stop the other program.`
    );
  }
  process.exit(1);
});

(async () => {
  try {
    await ensureKitchenKdsAdminStation();
  } catch (e) {
    console.error('ensureKitchenKdsAdminStation failed', e);
  }
  httpServer.listen(PORT, HOST, () => {
    const nets = os.networkInterfaces();
    const ipv4s = [];
    for (const items of Object.values(nets)) {
      for (const info of items || []) {
        if (info.family === 'IPv4' && !info.internal) ipv4s.push(info.address);
      }
    }
    console.log(`POS Backend running on ${HOST}:${PORT}`);
    console.log(`Local:  http://localhost:${PORT}`);
    if (ipv4s.length) {
      console.log('LAN URLs:');
      for (const ip of ipv4s) console.log(`- http://${ip}:${PORT}`);
    }
  });
})();
