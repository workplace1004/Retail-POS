import { labels } from './periodicReportReceipt.js';

const WIDTH = 42;

function dashLine() {
  return '-'.repeat(WIDTH);
}

function center(s, w = WIDTH) {
  const t = String(s).trim();
  if (t.length >= w) return t.slice(0, w);
  const left = Math.floor((w - t.length) / 2);
  return ' '.repeat(left) + t + ' '.repeat(w - t.length - left);
}

function padL(s, len) {
  const x = String(s);
  return x.length >= len ? x.slice(-len) : ' '.repeat(len - x.length) + x;
}

function padR(s, len) {
  const x = String(s);
  return x.length >= len ? x.slice(0, len) : x + ' '.repeat(len - x.length);
}

function lineLR(left, right, w = WIDTH) {
  const r = String(right);
  const maxL = w - r.length - 1;
  let L = String(left);
  if (L.length > maxL) L = L.slice(0, Math.max(0, maxL - 1)) + '…';
  const sp = w - L.length - r.length;
  return L + ' '.repeat(Math.max(1, sp)) + r;
}

function fmtMoney(n) {
  return (Number(n) || 0).toFixed(2);
}

function fmtInt(n) {
  return String(Math.round(Number(n) || 0));
}

function fmtPrintedAt(d) {
  const x = new Date(d);
  const dd = String(x.getDate()).padStart(2, '0');
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const yyyy = x.getFullYear();
  const h = String(x.getHours()).padStart(2, '0');
  const m = String(x.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${h}:${m}`;
}

function fmtHour(h) {
  return `${String(Math.max(0, Math.min(23, Number(h) || 0))).padStart(2, '0')}:00`;
}

function parseVatPct(str) {
  const m = String(str || '').match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const p = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(p) || p < 0 || p > 100) return null;
  return p;
}

function splitGrossToNetVat(gross, pct) {
  if (pct == null || pct <= 0) return { net: gross, vat: 0 };
  const net = gross / (1 + pct / 100);
  const vat = gross - net;
  return { net, vat };
}

export function buildUserReportReceiptLines(opts) {
  const {
    orders = [],
    kind = 'x',
    periodStart = new Date(0),
    periodEnd = new Date(),
    printedAt = new Date(),
    lang = 'en',
    userName = '',
    storeName = '',
    reportSettings = null,
  } = opts;
  const L = labels(lang);
  const lines = [];
  const settingsColumn = kind === 'z' ? 'z' : 'x';
  const sectionEnabled = (rowId) => {
    const row = reportSettings && typeof reportSettings === 'object' ? reportSettings[rowId] : null;
    if (!row || typeof row !== 'object') return true;
    return row[settingsColumn] !== false;
  };

  lines.push(center(storeName.trim() || 'Retail POS'));
  lines.push(center(kind === 'z' ? 'Z USER REPORT' : 'X USER REPORT'));
  lines.push(lineLR('Period from:', fmtPrintedAt(periodStart)));
  lines.push(lineLR('Period to:', fmtPrintedAt(periodEnd)));
  lines.push(lineLR(`${L.user}:`, userName.trim() || '—'));
  lines.push(lineLR(`${L.printedOn}:`, fmtPrintedAt(printedAt)));
  lines.push(dashLine());

  const byUser = new Map();
  const byHour = new Map();
  const byHourUser = new Map();
  const byCategory = new Map();
  const byProduct = new Map();
  const paymentMap = new Map();
  const vatMap = new Map();
  let eatInTotal = 0;
  let takeOutTotal = 0;
  let eatInCount = 0;
  let takeOutCount = 0;
  let grossTotal = 0;

  for (const o of orders) {
    const orderTotal = Number(o.total) || 0;
    const label = String(o.user?.name || o.userId || '—').trim() || '—';
    const u = byUser.get(label) || { tickets: 0, amount: 0 };
    u.tickets += 1;
    u.amount += orderTotal;
    byUser.set(label, u);
    grossTotal += orderTotal;

    const hour = new Date(o.updatedAt).getHours();
    const h = byHour.get(hour) || { orders: 0, amount: 0 };
    h.orders += 1;
    h.amount += orderTotal;
    byHour.set(hour, h);

    const userHours = byHourUser.get(label) || new Map();
    const uh = userHours.get(hour) || { orders: 0, amount: 0 };
    uh.orders += 1;
    uh.amount += orderTotal;
    userHours.set(hour, uh);
    byHourUser.set(label, userHours);

    if (o.tableId) {
      eatInTotal += orderTotal;
      eatInCount += 1;
    } else {
      takeOutTotal += orderTotal;
      takeOutCount += 1;
    }

    if (o.payments?.length) {
      for (const p of o.payments) {
        const name = String(p.paymentMethod?.name || '—').trim() || '—';
        paymentMap.set(name, (paymentMap.get(name) || 0) + (Number(p.amount) || 0));
      }
    }

    for (const it of o.items || []) {
      const qty = Number(it.quantity) || 0;
      const amount = (Number(it.price) || 0) * qty;
      const category = String(it.product?.category?.name || '—').trim() || '—';
      const product = String(it.product?.name || '—').trim() || '—';
      const c = byCategory.get(category) || { qty: 0, amount: 0 };
      c.qty += qty;
      c.amount += amount;
      byCategory.set(category, c);
      const p = byProduct.get(product) || { qty: 0, amount: 0 };
      p.qty += qty;
      p.amount += amount;
      byProduct.set(product, p);

      const eatIn = !!o.tableId;
      const vatStr = eatIn ? it.product?.vatEatIn : it.product?.vatTakeOut;
      const pct = parseVatPct(vatStr);
      const key = pct == null ? '—' : `${pct}%`;
      const gross = amount;
      const { net, vat } = splitGrossToNetVat(gross, pct ?? 0);
      const row = vatMap.get(key) || { ns: 0, nr: 0, vat: 0, total: 0 };
      if (eatIn) row.ns += net;
      else row.nr += net;
      row.vat += vat;
      row.total += gross;
      vatMap.set(key, row);
    }
  }

  lines.push(center('PER USER'));
  lines.push(`${padR('User', 18)}${padL('Tickets', 8)}${padL('Amount', 16)}`);
  for (const [name, row] of [...byUser.entries()].sort((a, b) => b[1].amount - a[1].amount)) {
    lines.push(`${padR(name, 18)}${padL(fmtInt(row.tickets), 8)}${padL(fmtMoney(row.amount), 16)}`.slice(0, WIDTH));
  }
  lines.push(lineLR('Total tickets', fmtInt([...byUser.values()].reduce((s, r) => s + r.tickets, 0))));
  lines.push(lineLR('Total amount', fmtMoney([...byUser.values()].reduce((s, r) => s + r.amount, 0))));

  if (sectionEnabled('vat-totals')) {
    lines.push(dashLine());
    lines.push(center('VAT TOTALS'));
    lines.push(`${padR('', 6)}${padL('MvH NS', 10)}${padL('MvH NR', 10)}${padL('VAT', 8)}${padL('Total', 8)}`);
    for (const [rate, row] of [...vatMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`${padR(rate, 6)}${padL(fmtMoney(row.ns), 10)}${padL(fmtMoney(row.nr), 10)}${padL(fmtMoney(row.vat), 8)}${padL(fmtMoney(row.total), 8)}`.slice(0, WIDTH));
    }
  }

  if (sectionEnabled('payments')) {
    lines.push(dashLine());
    lines.push(center(L.payments));
    for (const [name, amount] of [...paymentMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(lineLR(name, fmtMoney(amount)));
    }
  }

  if (sectionEnabled('eat-in-take-out')) {
    lines.push(dashLine());
    lines.push(center(L.eatInTakeOut));
    lines.push(lineLR(`NS (${fmtInt(eatInCount)})`, fmtMoney(eatInTotal)));
    lines.push(lineLR(`NR (${fmtInt(takeOutCount)})`, fmtMoney(takeOutTotal)));
    lines.push(lineLR(L.total, fmtMoney(grossTotal)));
  }

  if (sectionEnabled('ticket-types')) {
    lines.push(dashLine());
    lines.push(center(L.ticketTypes));
    lines.push(lineLR('Issued VAT tickets', fmtInt(orders.length)));
    lines.push(lineLR(L.total, fmtMoney(grossTotal)));
  }

  if (sectionEnabled('category-totals')) {
    lines.push(dashLine());
    lines.push(center('CATEGORY TOTALS'));
    for (const [name, row] of [...byCategory.entries()].sort((a, b) => b[1].amount - a[1].amount)) {
      lines.push(`${padL(fmtInt(row.qty), 3)} ${padR(name, 28)} ${padL(fmtMoney(row.amount), 8)}`.slice(0, WIDTH));
    }
  }

  if (sectionEnabled('product-totals')) {
    lines.push(dashLine());
    lines.push(center('PRODUCT TOTALS'));
    for (const [name, row] of [...byProduct.entries()].sort((a, b) => b[1].amount - a[1].amount)) {
      lines.push(`${padL(fmtInt(row.qty), 3)} ${padR(name, 28)} ${padL(fmtMoney(row.amount), 8)}`.slice(0, WIDTH));
    }
  }

  if (sectionEnabled('hour-totals')) {
    lines.push(dashLine());
    lines.push(center('HOUR TOTALS'));
    lines.push(`${padR('Hour', 8)}${padL('Orders', 10)}${padL('Amount', 16)}`);
    for (const [hour, row] of [...byHour.entries()].sort((a, b) => a[0] - b[0])) {
      lines.push(`${padR(fmtHour(hour), 8)}${padL(fmtInt(row.orders), 10)}${padL(fmtMoney(row.amount), 16)}`);
    }
  }

  if (sectionEnabled('hour-totals-per-user')) {
    lines.push(dashLine());
    lines.push(center('HOUR TOTALS PER USER'));
    for (const [name, map] of [...byHourUser.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(name.slice(0, WIDTH));
      lines.push(`${padR('Hour', 8)}${padL('Orders', 10)}${padL('Amount', 16)}`);
      for (const [hour, row] of [...map.entries()].sort((a, b) => a[0] - b[0])) {
        lines.push(`${padR(fmtHour(hour), 8)}${padL(fmtInt(row.orders), 10)}${padL(fmtMoney(row.amount), 16)}`);
      }
      lines.push(dashLine());
    }
  }

  return { lines };
}
