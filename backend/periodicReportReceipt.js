/**
 * Thermal-style periodic sales report (POS receipt layout).
 * Labels follow UI language; structure matches classic Dutch POS Z-reports.
 */

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

/** Label left, value right (fixed width line). */
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

export function labels(lang) {
  const L = {
    en: {
      tot: 'to',
      user: 'User',
      printedOn: 'Printed on',
      btwPerTarief: 'VAT by rate',
      mvhNs: 'MvH NS',
      mvhNr: 'MvH NR',
      btw: 'VAT',
      total: 'Total',
      payments: 'Payments',
      eatInTakeOut: 'Take-out',
      ticketTypes: 'Ticket types',
      issuedVatTickets: 'Issued VAT tickets',
      ns: 'NS',
      nr: 'NR',
      returnsCount: 'Return tickets count',
      drawerNoSale: 'Drawer opened without sale',
      proFormaTickets: 'Pro forma tickets',
      proFormaReturns: 'Pro forma returns',
      proFormaTurnover: 'Pro forma turnover (incl. VAT)',
      giftSold: 'Gift vouchers sold',
      giftValue: 'Gift vouchers value',
      discountsGranted: 'Discounts granted',
      discountTotal: 'Total discount (incl. VAT)',
      cashRounding: 'Total cash rounding',
      creditTopUp: 'Credit top-up',
      staffUse: 'Staff consumptions',
      onlineRefundCash: 'Online payment refunded cash',
      onlineOrders: 'Online orders count',
      rateUnknown: 'Rate —',
      subproductsCategory: 'Subproducts',
    },
    nl: {
      tot: 'tot',
      user: 'Gebruiker',
      printedOn: 'Afgedrukt op',
      btwPerTarief: 'BTW per tarief',
      mvhNs: 'MvH NS',
      mvhNr: 'MvH NR',
      btw: 'Btw',
      total: 'Totaal',
      payments: 'Betalingen',
      eatInTakeOut: 'Afhalen',
      ticketTypes: 'Ticket soorten',
      issuedVatTickets: 'Uitgereikte BTW tickets',
      ns: 'NS',
      nr: 'NR',
      returnsCount: 'Terugname tickets aantal',
      drawerNoSale: 'Lade geopend zonder verkoop',
      proFormaTickets: 'Pro Forma tickets',
      proFormaReturns: 'Pro Forma terugnames',
      proFormaTurnover: 'Pro Forma omzet (incl. BTW)',
      giftSold: 'Verkochte kadobons',
      giftValue: 'Verkochte kadobons waarde',
      discountsGranted: 'Toegekende kortingen',
      discountTotal: 'Totaalbedrag korting (incl. BTW)',
      cashRounding: 'Totaalbedrag cash afrondingen',
      creditTopUp: 'Tegoed opwaardering',
      staffUse: 'Personeel consumpties',
      onlineRefundCash: 'Online betaling cash terugbetaald',
      onlineOrders: 'Aantal online orders',
      rateUnknown: 'Tarief —',
      subproductsCategory: 'Subproducten',
    },
    fr: {
      tot: 'au',
      user: 'Utilisateur',
      printedOn: 'Imprime le',
      btwPerTarief: 'TVA par taux',
      mvhNs: 'MvH NS',
      mvhNr: 'MvH NR',
      btw: 'TVA',
      total: 'Total',
      payments: 'Paiements',
      eatInTakeOut: 'A emporter',
      ticketTypes: 'Types de tickets',
      issuedVatTickets: 'Tickets TVA emis',
      ns: 'NS',
      nr: 'NR',
      returnsCount: 'Nombre de retours',
      drawerNoSale: 'Tiroir ouvert sans vente',
      proFormaTickets: 'Tickets pro forma',
      proFormaReturns: 'Retours pro forma',
      proFormaTurnover: 'CA pro forma (TVA incl.)',
      giftSold: 'Bons cadeaux vendus',
      giftValue: 'Valeur bons cadeaux',
      discountsGranted: 'Remises accordees',
      discountTotal: 'Total remises (TVA incl.)',
      cashRounding: 'Arrondis especes',
      creditTopUp: 'Recharge credit',
      staffUse: 'Conso personnel',
      onlineRefundCash: 'Paiement en ligne rembourse especes',
      onlineOrders: 'Nombre commandes en ligne',
      rateUnknown: 'Taux —',
      subproductsCategory: 'Sous-produits',
    },
    tr: {
      tot: '-',
      user: 'Kullanici',
      printedOn: 'Yazdirma',
      btwPerTarief: 'KDV orani',
      mvhNs: 'MvH NS',
      mvhNr: 'MvH NR',
      btw: 'KDV',
      total: 'Toplam',
      payments: 'Odemeler',
      eatInTakeOut: 'Paket',
      ticketTypes: 'Bilet turleri',
      issuedVatTickets: 'Verilen KDV fisleri',
      ns: 'NS',
      nr: 'NR',
      returnsCount: 'Iade bilet adedi',
      drawerNoSale: 'Satis olmadan cekmece',
      proFormaTickets: 'Pro forma fisler',
      proFormaReturns: 'Pro forma iadeler',
      proFormaTurnover: 'Pro forma ciro (KDV dahil)',
      giftSold: 'Satilan hediye ceki',
      giftValue: 'Hediye ceki tutari',
      discountsGranted: 'Verilen indirimler',
      discountTotal: 'Indirim toplami (KDV dahil)',
      cashRounding: 'Nakit yuvarlama',
      creditTopUp: 'Bakiye yukleme',
      staffUse: 'Personel harcamalari',
      onlineRefundCash: 'Online odeme nakit iade',
      onlineOrders: 'Online siparis sayisi',
      rateUnknown: 'Oran —',
      subproductsCategory: 'Alt urunler',
    },
  };
  const key = String(lang || 'en').toLowerCase().slice(0, 2);
  return L[key] || L.en;
}

const GIFT_RE = /gift|kadobon|voucher|cadeau|kadobonn|hediye/i;

/**
 * @param {object} opts
 * @param {object[]} opts.orders paid orders with items (product vatEatIn/vatTakeOut), payments, tableId, source, total
 * @param {string} opts.startDate dd-mm-yyyy
 * @param {string} opts.startTime HH:mm or 24:00
 * @param {string} opts.endDate
 * @param {string} opts.endTime
 * @param {Date} opts.printedAt
 * @param {string} opts.lang
 * @param {string} opts.userName
 * @param {string} opts.storeName
 */
export function buildPeriodicReportReceiptLines(opts) {
  const {
    orders = [],
    startDate = '',
    startTime = '',
    endDate = '',
    endTime = '',
    printedAt = new Date(),
    lang = 'en',
    userName = '',
    storeName = '',
    reportSettings = null,
  } = opts;

  const L = labels(lang);
  const lines = [];
  const sectionEnabled = (rowId) => {
    const row = reportSettings && typeof reportSettings === 'object' ? reportSettings[rowId] : null;
    if (!row || typeof row !== 'object') return true;
    return row.periodic !== false;
  };

  const title = storeName.trim() || 'POS';
  lines.push(center(title));
  lines.push(`${padR(String(startDate).trim(), 10)} ${String(startTime).trim()}  ${L.tot}  ${String(endDate).trim()} ${String(endTime).trim()}`.slice(0, WIDTH));
  lines.push(lineLR(`${L.user}:`, userName.trim() || '—'));
  lines.push(lineLR(`${L.printedOn}:`, fmtPrintedAt(printedAt)));
  lines.push(dashLine());

  // --- VAT by rate (MvH columns reserved; Btw / Totaal from product VAT) ---
  const vatMap = new Map();
  for (const o of orders) {
    const eatIn = !!o.tableId;
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

  // --- Payments ---
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

  // --- Eat-in / take-out ---
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

  // --- Ticket types & stats ---
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

  return lines;
}
