/**
 * Plain-text lines for thermal print of Financial Reports (Z / X / History).
 * Matches demo content shown in ControlView (until live API data exists).
 *
 * @param {'z' | 'x' | 'history'} kind
 * @param {(key: string, fallback: string) => string} tr
 * @returns {string[]}
 */
export function buildFinancialReportPrintLines(kind, tr) {
  const total = tr('total', 'Total');
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  if (kind === 'history') {
    return [
      tr('control.reports.financialHistoryTitle', 'Financial report history'),
      '',
      tr('control.reports.zReports', 'Z reports (close of day)'),
      '  11-04-2026 09:44 — Z FINANCIEEL #2',
      '  10-04-2026 23:58 — Z FINANCIEEL #1',
      '  09-04-2026 23:45 — Z FINANCIEEL #3',
      '',
      tr('control.reports.xReports', 'X reports (interim)'),
      '  11-04-2026 08:00 — X FINANCIEEL #4',
      '  10-04-2026 14:30 — X FINANCIEEL #3',
      '  10-04-2026 09:00 — X FINANCIEEL #2',
    ];
  }

  const isZ = kind === 'z';
  const title = isZ ? 'Z FINANCIEEL #2' : 'X FINANCIEEL #4';
  const m = {
    ns: isZ ? '333.73' : '128.40',
    nr: isZ ? '2.83' : '0.00',
    btw: isZ ? '19.85' : '8.12',
    tot: isZ ? '350.75' : '136.52',
  };

  return [
    'Retail POS',
    'BE.0.0.0',
    `Date : ${dateStr}  Tijd: ${timeStr}`,
    title,
    '',
    'Terminals:',
    'Kassa 2 — 16/01-08:26 => 25/01-11:04',
    'Kassa 4 — 13/01-19:07 => 25/02-14:27',
    '',
    'BTW per tarief',
    `MvH NS  MvH NR  Btw  ${total}`,
    `${m.ns}  ${m.nr}  ${m.btw}  ${m.tot}`,
    `${total}  ${m.ns}  ${m.nr}  ${m.tot}`,
    '',
    'Betalingen',
    `Cash — ${isZ ? '174.75' : '62.00'}`,
    `Credit Card — ${isZ ? '117.00' : '48.52'}`,
    `Visa — ${isZ ? '59.00' : '26.00'}`,
    `${total} ${m.tot}`,
    '',
    'Take-out',
    isZ ? '10 Take-Out — 350.75' : '4 Take-Out — 136.52',
    `${total} ${m.tot}`,
    '',
    'Ticket types',
    isZ ? '11 Counter Sales — 350.75' : '5 Counter Sales — 136.52',
    `${total} ${m.tot}`,
    '',
    'Issued VAT tickets:',
    `NS: ${isZ ? '10' : '4'}`,
    `NR: ${isZ ? '1' : '0'}`,
    `Number of return tickets: ${isZ ? '1' : '0'}`,
    'Drawer opened without sale: 0',
    `Pro Forma tickets: ${isZ ? '7' : '2'}`,
    'Pro Forma returns: 0',
    `Pro Forma turnover (incl. VAT): ${isZ ? '126.20' : '34.50'}`,
    'Gift vouchers sold: 0',
    'Value of gift vouchers sold: 0.00',
    'Applied discounts: 0',
    'Total discount amount (incl. VAT): 0.00',
    'Total cash rounding amount: 0.00',
    'Credit top-up: 0.00',
    'Staff consumption: 0.00',
    'Online payment cash refunded: 0.00',
    'Number of online orders: 0.00',
    `Database ID: ${isZ ? '2' : '4'}`,
  ];
}
