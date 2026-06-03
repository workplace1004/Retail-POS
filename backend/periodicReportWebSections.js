/**
 * Structured periodic sales report sections for the webpanel (grid layout).
 * Uses the same VAT / payment / eat-in rules as `periodicReportReceipt.js`.
 */

import { labels } from './periodicReportReceipt.js';

const GIFT_RE = /gift|kadobon|voucher|cadeau|kadobonn|hediye/i;

/** Subproduct tokens on order lines (same as server.js / production reports). */
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

function fmtMoney(n) {
  return (Number(n) || 0).toFixed(2);
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

function hasTable(o) {
  return o && o.tableId != null && String(o.tableId).trim() !== '';
}

function channelKey(o) {
  if (String(o.source || '') === 'weborder') return 'web';
  if (hasTable(o)) return 'table';
  return 'counter';
}

function channelLabelsForLang(lang) {
  const lc = String(lang || 'en').toLowerCase().slice(0, 2);
  const map = {
    en: { table: 'Table sale', counter: 'Counter sale', web: 'Web order' },
    nl: { table: 'Tafel verkoop', counter: 'Toog verkoop', web: 'Weborder' },
    fr: { table: 'Vente salle', counter: 'Comptoir', web: 'Commande web' },
    tr: { table: 'Masa satisi', counter: 'Tezgah satisi', web: 'Web siparis' },
  };
  return map[lc] || map.en;
}

/**
 * @param {object[]} orders paid orders with items (product + category), payments, user, source, total, tableId?
 * @param {string} lang
 */
export function buildPeriodicReportWebSections(orders, lang = 'en') {
  const L = labels(lang);
  const CL = channelLabelsForLang(lang);

  // --- Category totals (orderCount = distinct paid orders that include that category; not line count, not piece qty) ---
  const catMap = new Map();
  for (const o of orders) {
    const oid = String(o.id ?? '');
    for (const it of o.items || []) {
      const name = String(it.product?.category?.name || '').trim() || '—';
      const qty = Math.max(0, Math.round(Number(it.quantity) || 0));
      const gross = (Number(it.price) || 0) * qty;
      let cur = catMap.get(name);
      if (!cur) {
        cur = { orderIds: new Set(), amount: 0 };
        catMap.set(name, cur);
      }
      if (oid) cur.orderIds.add(oid);
      cur.amount += gross;
    }
  }
  let categoryRows = [...catMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, v]) => ({
      label,
      orderCount: v.orderIds.size,
      amount: Math.round(v.amount * 100) / 100,
    }));

  // --- Subproducts row (order lines with choices in notes; amount 0 — priced on parent line, classic Z-report style) ---
  const subproductOrderIds = new Set();
  for (const o of orders) {
    const oid = String(o.id ?? '');
    if (!oid) continue;
    for (const it of o.items || []) {
      if (parseSubproductNamesFromOrderNotes(it.notes).length > 0) {
        subproductOrderIds.add(oid);
        break;
      }
    }
  }
  const subproductOrderCount = subproductOrderIds.size;
  if (subproductOrderCount > 0) {
    categoryRows = [
      ...categoryRows,
      {
        label: L.subproductsCategory,
        orderCount: subproductOrderCount,
        amount: 0,
        isSubproducts: true,
      },
    ];
  }

  const categoryTotal = Math.round(categoryRows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  /** Sum of displayed row counters (classic Z-report; not distinct order count). */
  const categoryTotalOrderCount = categoryRows.reduce((s, r) => s + (Number(r.orderCount) || 0), 0);
  const totalOrdersInReport = orders.length;

  // --- Product totals ---
  const prodMap = new Map();
  for (const o of orders) {
    for (const it of o.items || []) {
      const name = String(it.product?.name || '').trim() || '—';
      const qty = Math.max(0, Math.round(Number(it.quantity) || 0));
      const gross = (Number(it.price) || 0) * qty;
      const cur = prodMap.get(name) || { qty: 0, amount: 0 };
      cur.qty += qty;
      cur.amount += gross;
      prodMap.set(name, cur);
    }
  }
  const productRows = [...prodMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, v]) => ({
      label,
      qty: v.qty,
      amount: Math.round(v.amount * 100) / 100,
    }));
  const productTotal = Math.round(productRows.reduce((s, r) => s + r.amount, 0) * 100) / 100;

  // --- VAT by rate (same as receipt) ---
  const vatMap = new Map();
  for (const o of orders) {
    const eatIn = hasTable(o);
    for (const it of o.items || []) {
      const gross = (Number(it.price) || 0) * (Number(it.quantity) || 0);
      const vatStr = eatIn ? it.product?.vatEatIn : it.product?.vatTakeOut;
      const pct = parseVatPct(vatStr);
      const key = pct == null ? '—' : String(pct);
      const { vat } = splitGrossToNetVat(gross, pct ?? 0);
      const cur = vatMap.get(key) || { mvhNs: 0, mvhNr: 0, btw: 0, totaal: 0, pct: pct ?? 0 };
      cur.btw += vat;
      cur.totaal += gross;
      vatMap.set(key, cur);
    }
  }
  let sumMvhNs = 0;
  let sumMvhNr = 0;
  let sumBtw = 0;
  let sumBruto = 0;
  const sortedRates = [...vatMap.keys()].sort((a, b) => {
    if (a === '—') return 1;
    if (b === '—') return -1;
    return Number(a) - Number(b);
  });
  const vatRows = [];
  for (const key of sortedRates) {
    const row = vatMap.get(key);
    sumMvhNs += row.mvhNs;
    sumMvhNr += row.mvhNr;
    sumBtw += row.btw;
    sumBruto += row.totaal;
    const lab = key === '—' ? L.rateUnknown : `${key}%`;
    const net = row.totaal - row.btw;
    vatRows.push({
      rateLabel: lab,
      mvhNs: Math.round(row.mvhNs * 100) / 100,
      mvhNr: Math.round(row.mvhNr * 100) / 100,
      vat: Math.round(row.btw * 100) / 100,
      gross: Math.round(row.totaal * 100) / 100,
      net: Math.round(net * 100) / 100,
    });
  }
  const vatSums = {
    mvhNs: Math.round(sumMvhNs * 100) / 100,
    mvhNr: Math.round(sumMvhNr * 100) / 100,
    vat: Math.round(sumBtw * 100) / 100,
    gross: Math.round(sumBruto * 100) / 100,
    net: Math.round((sumBruto - sumBtw) * 100) / 100,
  };

  // --- Payments (orderCount = distinct orders with that method, like category totals) ---
  const payMap = new Map();
  for (const o of orders) {
    const oid = String(o.id ?? '');
    if (o.payments?.length) {
      for (const p of o.payments) {
        const label = p.paymentMethod?.name || '—';
        let cur = payMap.get(label);
        if (!cur) {
          cur = { orderIds: new Set(), amount: 0 };
          payMap.set(label, cur);
        }
        cur.amount += Number(p.amount) || 0;
        if (oid) cur.orderIds.add(oid);
      }
    } else {
      const k = '—';
      let cur = payMap.get(k);
      if (!cur) {
        cur = { orderIds: new Set(), amount: 0 };
        payMap.set(k, cur);
      }
      cur.amount += Number(o.total) || 0;
      if (oid) cur.orderIds.add(oid);
    }
  }
  let payTotal = 0;
  for (const v of payMap.values()) payTotal += v.amount;
  const paymentRows = [...payMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, v]) => ({
      label,
      orderCount: v.orderIds.size,
      amount: Math.round(v.amount * 100) / 100,
    }));
  payTotal = Math.round(payTotal * 100) / 100;

  // --- Eat-in / take-out (NS/NR + channels) ---
  let eatInTot = 0;
  let takeTot = 0;
  let eatInCnt = 0;
  let takeCnt = 0;
  const channelAgg = { table: { count: 0, amount: 0 }, counter: { count: 0, amount: 0 }, web: { count: 0, amount: 0 } };
  for (const o of orders) {
    const t = Number(o.total) || 0;
    const ch = channelKey(o);
    channelAgg[ch].count += 1;
    channelAgg[ch].amount += t;
    if (hasTable(o)) {
      eatInTot += t;
      eatInCnt += 1;
    } else {
      takeTot += t;
      takeCnt += 1;
    }
  }
  const eatGrand = Math.round((eatInTot + takeTot) * 100) / 100;
  const channelRows = [
    { key: 'table', label: CL.table, count: channelAgg.table.count, amount: Math.round(channelAgg.table.amount * 100) / 100 },
    { key: 'counter', label: CL.counter, count: channelAgg.counter.count, amount: Math.round(channelAgg.counter.amount * 100) / 100 },
    { key: 'web', label: CL.web, count: channelAgg.web.count, amount: Math.round(channelAgg.web.amount * 100) / 100 },
  ].filter((r) => r.count > 0 || r.amount > 0);

  // --- Ticket-type style stats ---
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
  const webTurnover = Math.round(
    orders.filter((o) => String(o.source || '') === 'weborder').reduce((s, o) => s + (Number(o.total) || 0), 0) * 100,
  ) / 100;

  const ticketTypeRows = [
    { label: L.total, value: fmtMoney(sumBruto) },
    { label: L.issuedVatTickets, value: String(orderCount) },
    { label: L.ns, value: String(eatInCnt) },
    { label: L.nr, value: String(takeCnt) },
    { label: L.giftSold, value: String(giftCount) },
    { label: L.giftValue, value: fmtMoney(giftAmount) },
    { label: L.onlineOrders, value: fmtMoney(webTurnover) },
  ];

  // --- Hour totals (bucket by local hour of settlement) ---
  const hourMap = new Map();
  for (const o of orders) {
    const d = new Date(o.updatedAt);
    const h = d.getHours();
    const cur = hourMap.get(h) || { tickets: 0, amount: 0 };
    cur.tickets += 1;
    cur.amount += Number(o.total) || 0;
    hourMap.set(h, cur);
  }
  const hourRows = [...hourMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, v]) => ({
      hour,
      tickets: v.tickets,
      amount: Math.round(v.amount * 100) / 100,
    }));

  // --- Hour totals per user ---
  const userHourMap = new Map();
  for (const o of orders) {
    const uid = o.userId || '—';
    const uname =
      (o.user && String(o.user.name || '').trim()) || (uid === '—' ? '—' : String(uid).slice(0, 12));
    const d = new Date(o.updatedAt);
    const h = d.getHours();
    if (!userHourMap.has(uid)) userHourMap.set(uid, { userName: uname, hours: new Map() });
    const block = userHourMap.get(uid);
    const hm = block.hours;
    const cur = hm.get(h) || { tickets: 0, amount: 0 };
    cur.tickets += 1;
    cur.amount += Number(o.total) || 0;
    hm.set(h, cur);
  }
  const hourTotalsPerUser = [...userHourMap.values()]
    .sort((a, b) => a.userName.localeCompare(b.userName))
    .map(({ userName, hours }) => ({
      userName,
      rows: [...hours.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([hour, v]) => ({
          hour,
          tickets: v.tickets,
          amount: Math.round(v.amount * 100) / 100,
        })),
    }));

  return {
    labels: {
      eatInTakeOutTitle: L.eatInTakeOut,
      ns: L.ns,
      nr: L.nr,
      total: L.total,
    },
    sections: {
      categoryTotals: {
        rows: categoryRows,
        total: categoryTotal,
        totalOrderCount: categoryTotalOrderCount,
      },
      productTotals: { rows: productRows, total: productTotal },
      vatTotals: { rows: vatRows, sums: vatSums },
      payments: {
        rows: paymentRows,
        total: payTotal,
        totalOrderCount: totalOrdersInReport,
      },
      eatInTakeOut: {
        nsAmount: Math.round(eatInTot * 100) / 100,
        nrAmount: Math.round(takeTot * 100) / 100,
        totalAmount: eatGrand,
        nsCount: eatInCnt,
        nrCount: takeCnt,
        channelRows,
      },
      ticketTypes: { rows: ticketTypeRows },
      hourTotals: { rows: hourRows },
      hourTotalsPerUser: { users: hourTotalsPerUser },
    },
  };
}
