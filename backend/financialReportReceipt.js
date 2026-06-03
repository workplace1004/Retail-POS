/**
 * X (interim) / Z (period close) financial reports from paid orders in the open period.
 * Body layout matches periodicReportReceipt; header identifies X vs Z.
 */

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
  if (L.length > maxL) L = L.slice(0, Math.max(0, maxL - 1)) + '\u2026';
  const sp = w - L.length - r.length;
  return L + ' '.repeat(Math.max(1, sp)) + r;
}

function lineIndentedLR(indent, left, right, w = WIDTH) {
  return lineLR(' '.repeat(indent) + left, right, w);
}

function fmtMoney(n) {
  return (Number(n) || 0).toFixed(2);
}

function fmtInt(n) {
  return String(Math.round(Number(n) || 0));
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

const GIFT_RE = /gift|kadobon|voucher|cadeau|kadobonn|hediye/i;

/**
 * @param {object} opts
 * @param {object[]} opts.orders paid orders (same shape as periodic report)
 * @param {'x'|'z'} opts.kind
 * @param {number|null|undefined} opts.zNumber required when kind === 'z'
 * @param {Date} opts.periodStart
 * @param {Date} opts.periodEnd
 * @param {Date} [opts.printedAt]
 * @param {string} [opts.lang]
 * @param {string} [opts.userName]
 * @param {string} [opts.storeName]
 * @returns {{ lines: string[], summary: object }}
 */
export function buildFinancialReportReceiptLines(opts) {
  const {
    orders = [],
    kind = 'x',
    zNumber = null,
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
    const value = row[settingsColumn];
    return value !== false;
  };

  const title = storeName.trim() || 'Retail POS';
  lines.push(center(title));
  const reportTitle =
    kind === 'z' && zNumber != null && Number.isFinite(Number(zNumber))
      ? `Z FINANCIEEL #${zNumber}`
      : 'X FINANCIEEL (interim)';
  lines.push(center(reportTitle));
  lines.push(lineLR('Period from:', fmtPrintedAt(periodStart)));
  lines.push(lineLR('Period to:', fmtPrintedAt(periodEnd)));
  lines.push(lineLR(`${L.user}:`, userName.trim() || '—'));
  lines.push(lineLR(`${L.printedOn}:`, fmtPrintedAt(printedAt)));
  lines.push(dashLine());

  const vatMap = new Map();
  for (const o of orders) {
    const eatIn = !!o.tableId;
    for (const it of o.items || []) {
      const gross = (Number(it.price) || 0) * (Number(it.quantity) || 0);
      const vatStr = eatIn ? it.product?.vatEatIn : it.product?.vatTakeOut;
      const pct = parseVatPct(vatStr);
      const key = pct == null ? '—' : String(pct);
      const { net, vat } = splitGrossToNetVat(gross, pct ?? 0);
      const cur = vatMap.get(key) || { mvhNs: 0, mvhNr: 0, btw: 0, totaal: 0, pct: pct ?? 0 };
      if (eatIn) cur.mvhNs += net;
      else cur.mvhNr += net;
      cur.btw += vat;
      cur.totaal += gross;
      vatMap.set(key, cur);
    }
  }

  let sumMvhNs = 0;
  let sumMvhNr = 0;
  let sumBtw = 0;
  let sumBruto = 0;

  if (sectionEnabled('vat-totals')) {
    lines.push(center(L.btwPerTarief));
    lines.push(
      `${padL(L.mvhNs, 9)} ${padL(L.mvhNr, 9)} ${padL(L.btw, 9)} ${padL(L.total, 11)}`.slice(0, WIDTH),
    );
  }

  const sortedRates = [...vatMap.keys()].sort((a, b) => {
    if (a === '—') return 1;
    if (b === '—') return -1;
    return Number(a) - Number(b);
  });

  for (const key of sortedRates) {
    const row = vatMap.get(key);
    sumMvhNs += row.mvhNs;
    sumMvhNr += row.mvhNr;
    sumBtw += row.btw;
    sumBruto += row.totaal;
    const lab = key === '—' ? L.rateUnknown : `${key}%`;
    if (sectionEnabled('vat-totals')) {
      lines.push(
        `${padR(lab.slice(0, 11), 11)}${padL(fmtMoney(row.mvhNs), 7)} ${padL(fmtMoney(row.mvhNr), 7)} ${padL(fmtMoney(row.btw), 7)} ${padL(fmtMoney(row.totaal), 7)}`.slice(
          0,
          WIDTH,
        ),
      );
    }
  }

  if (sectionEnabled('vat-totals')) {
    lines.push(
      `${padR(L.total, 11)}${padL(fmtMoney(sumMvhNs), 7)} ${padL(fmtMoney(sumMvhNr), 7)} ${padL(fmtMoney(sumBtw), 7)} ${padL(fmtMoney(sumBruto), 7)}`.slice(0, WIDTH),
    );
    lines.push(dashLine());
  }

  const payMap = new Map();
  for (const o of orders) {
    if (o.payments?.length) {
      for (const p of o.payments) {
        const label = p.paymentMethod?.name || '—';
        payMap.set(label, (payMap.get(label) || 0) + (Number(p.amount) || 0));
      }
    } else {
      const k = '—';
      payMap.set(k, (payMap.get(k) || 0) + (Number(o.total) || 0));
    }
  }
  let payTotal = 0;
  for (const v of payMap.values()) payTotal += v;

  if (sectionEnabled('payments')) {
    lines.push(center(L.payments));
    lines.push(dashLine());
    [...payMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([k, v]) => {
        lines.push(lineLR(` ${k}`, fmtMoney(v)));
      });
    lines.push(lineLR(L.total, fmtMoney(payTotal)));
    lines.push(dashLine());
  }

  let eatInTot = 0;
  let takeTot = 0;
  let eatInCnt = 0;
  let takeCnt = 0;
  for (const o of orders) {
    const t = Number(o.total) || 0;
    if (o.tableId) {
      eatInTot += t;
      eatInCnt += 1;
    } else {
      takeTot += t;
      takeCnt += 1;
    }
  }
  const eatGrand = eatInTot + takeTot;

  if (sectionEnabled('eat-in-take-out')) {
    lines.push(center(L.eatInTakeOut));
    lines.push(dashLine());
    lines.push(lineLR(L.total, fmtMoney(eatGrand)));
    lines.push(lineIndentedLR(2, L.ns, fmtMoney(eatInTot)));
    lines.push(lineIndentedLR(2, L.nr, fmtMoney(takeTot)));
    lines.push(dashLine());
  }

  const orderCount = orders.length;
  let giftCount = 0;
  let giftAmount = 0;
  for (const o of orders) {
    for (const p of o.payments || []) {
      const name = p.paymentMethod?.name || '';
      if (GIFT_RE.test(name)) {
        giftCount += 1;
        giftAmount += Number(p.amount) || 0;
      }
    }
  }
  const webTurnover = orders
    .filter((o) => String(o.source || '') === 'weborder')
    .reduce((s, o) => s + (Number(o.total) || 0), 0);

  if (sectionEnabled('ticket-types')) {
    lines.push(lineLR(L.total, fmtMoney(sumBruto)));
    lines.push(dashLine());
    lines.push(center(L.ticketTypes));
    lines.push(dashLine());
    lines.push(lineLR(L.total, fmtMoney(sumBruto)));
    lines.push(lineLR(L.issuedVatTickets, fmtInt(orderCount)));
    lines.push(lineIndentedLR(2, L.ns, fmtInt(eatInCnt)));
    lines.push(lineIndentedLR(2, L.nr, fmtInt(takeCnt)));
    lines.push(lineLR(L.returnsCount, fmtInt(0)));
    lines.push(lineLR(L.drawerNoSale, fmtInt(0)));
    lines.push(lineLR(L.proFormaTickets, fmtInt(0)));
    lines.push(lineLR(L.proFormaReturns, fmtInt(0)));
    lines.push(lineLR(L.proFormaTurnover, fmtMoney(0)));
    lines.push(lineLR(L.giftSold, fmtInt(giftCount)));
    lines.push(lineLR(L.giftValue, fmtMoney(giftAmount)));
    lines.push(lineLR(L.discountsGranted, fmtInt(0)));
    lines.push(lineLR(L.discountTotal, fmtMoney(0)));
    lines.push(lineLR(L.cashRounding, fmtMoney(0)));
    lines.push(lineLR(L.creditTopUp, fmtMoney(0)));
    lines.push(lineLR(L.staffUse, fmtMoney(0)));
    lines.push(lineLR(L.onlineRefundCash, fmtMoney(0)));
    lines.push(lineLR(L.onlineOrders, fmtMoney(webTurnover)));
  }

  if (sectionEnabled('category-totals')) {
    const categoryMap = new Map();
    for (const o of orders) {
      for (const it of o.items || []) {
        const qty = Number(it.quantity) || 0;
        const amount = (Number(it.price) || 0) * qty;
        const label = String(it.product?.category?.name || '—').trim() || '—';
        const row = categoryMap.get(label) || { qty: 0, amount: 0 };
        row.qty += qty;
        row.amount += amount;
        categoryMap.set(label, row);
      }
    }
    const rows = [...categoryMap.entries()].sort((a, b) => b[1].amount - a[1].amount);
    lines.push(dashLine());
    lines.push(center(L.categoryTotals));
    lines.push(dashLine());
    for (const [label, row] of rows) {
      lines.push(`${padL(fmtInt(row.qty), 3)} ${padR(label, 28)} ${padL(fmtMoney(row.amount), 8)}`.slice(0, WIDTH));
    }
  }

  if (sectionEnabled('product-totals')) {
    const productMap = new Map();
    for (const o of orders) {
      for (const it of o.items || []) {
        const qty = Number(it.quantity) || 0;
        const amount = (Number(it.price) || 0) * qty;
        const label = String(it.product?.name || '—').trim() || '—';
        const row = productMap.get(label) || { qty: 0, amount: 0 };
        row.qty += qty;
        row.amount += amount;
        productMap.set(label, row);
      }
    }
    const rows = [...productMap.entries()].sort((a, b) => b[1].amount - a[1].amount);
    lines.push(dashLine());
    lines.push(center(L.productTotals));
    lines.push(dashLine());
    for (const [label, row] of rows) {
      lines.push(`${padL(fmtInt(row.qty), 3)} ${padR(label, 28)} ${padL(fmtMoney(row.amount), 8)}`.slice(0, WIDTH));
    }
  }

  if (sectionEnabled('hour-totals')) {
    const hourMap = new Map();
    for (const o of orders) {
      const hour = new Date(o.updatedAt).getHours();
      const row = hourMap.get(hour) || { orders: 0, amount: 0 };
      row.orders += 1;
      row.amount += Number(o.total) || 0;
      hourMap.set(hour, row);
    }
    lines.push(dashLine());
    lines.push(center(L.hourTotals));
    lines.push(dashLine());
    lines.push(`${padR(L.hour, 8)}${padL(L.orders, 10)}${padL(L.amount, 16)}`.slice(0, WIDTH));
    for (const [hour, row] of [...hourMap.entries()].sort((a, b) => a[0] - b[0])) {
      lines.push(`${padR(fmtHour(hour), 8)}${padL(fmtInt(row.orders), 10)}${padL(fmtMoney(row.amount), 16)}`.slice(0, WIDTH));
    }
  }

  if (sectionEnabled('hour-totals-per-user')) {
    const userHourMap = new Map();
    for (const o of orders) {
      const userLabel = String(o.user?.name || o.userId || '—').trim() || '—';
      const hour = new Date(o.updatedAt).getHours();
      const byHour = userHourMap.get(userLabel) || new Map();
      const row = byHour.get(hour) || { orders: 0, amount: 0 };
      row.orders += 1;
      row.amount += Number(o.total) || 0;
      byHour.set(hour, row);
      userHourMap.set(userLabel, byHour);
    }
    lines.push(dashLine());
    lines.push(center(L.hourTotalsPerUser));
    lines.push(dashLine());
    for (const [userLabel, byHour] of [...userHourMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(userLabel.slice(0, WIDTH));
      lines.push(`${padR(L.hour, 8)}${padL(L.orders, 10)}${padL(L.amount, 16)}`.slice(0, WIDTH));
      for (const [hour, row] of [...byHour.entries()].sort((a, b) => a[0] - b[0])) {
        lines.push(`${padR(fmtHour(hour), 8)}${padL(fmtInt(row.orders), 10)}${padL(fmtMoney(row.amount), 16)}`.slice(0, WIDTH));
      }
      lines.push(dashLine());
    }
  }

  if (kind === 'x') {
    lines.push(dashLine());
    lines.push(center('X = interim (no reset)'));
  } else {
    lines.push(dashLine());
    lines.push(center('Z = period closed'));
  }

  const paymentTotals = Object.fromEntries([...payMap.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  const vatGroups = sortedRates.map((key) => {
    const row = vatMap.get(key) || { mvhNs: 0, mvhNr: 0, btw: 0, totaal: 0 };
    return {
      rateLabel: key === '—' ? L.rateUnknown : `${key}%`,
      ratePct: key === '—' ? null : Number(key),
      mvhNs: row.mvhNs,
      mvhNr: row.mvhNr,
      netTotal: row.mvhNs + row.mvhNr,
      vatTotal: row.btw,
      grossTotal: row.totaal,
    };
  });

  return {
    lines,
    summary: {
      kind,
      zNumber: kind === 'z' ? zNumber : null,
      orderCount,
      grossTotal: sumBruto,
      vatTotal: sumBtw,
      vatGroups,
      paymentTotal: payTotal,
      paymentTotals,
      eatInCount: eatInCnt,
      takeCount: takeCnt,
      eatInTotal: eatInTot,
      takeTotal: takeTot,
      periodStart: new Date(periodStart).toISOString(),
      periodEnd: new Date(periodEnd).toISOString(),
    },
  };
}
