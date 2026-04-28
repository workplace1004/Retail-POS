/**
 * Plain-text lines for thermal print of User Reports (Z close / X interim).
 * Demo content until live API data exists.
 *
 * @param {'z' | 'x'} kind
 * @param {(key: string, fallback: string) => string} tr
 * @returns {string[]}
 */
export function buildUserReportPrintLines(kind, tr) {
  const total = tr('total', 'Total');
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const user = tr('control.reports.userColumnUser', 'User');
  const tickets = tr('control.reports.userColumnTickets', 'Tickets');
  const amount = tr('control.reports.userColumnAmount', 'Amount');

  if (kind === 'z') {
    const title = tr('control.reports.userZReportTitle', 'Z USER REPORT #1');
    return [
      'Retail POS',
      'BE.0.0.0',
      `Date : ${dateStr}  Tijd: ${timeStr}`,
      title,
      '',
      tr('control.reports.userReportPerUser', 'Per user'),
      `${user}     ${tickets}    ${amount}`,
      'Kiosk        124    2840.65',
      'Admin         38     912.40',
      'Waiter 2      22     416.20',
      '',
      `${total} ${tickets}: 184`,
      `${total} ${amount}: 4169.25`,
      '',
      tr('control.reports.userReportDiscountsZ', 'Discounts applied (Z): 12'),
      tr('control.reports.userReportVoidsZ', 'Void lines (Z): 3'),
      'Database ID: 1',
    ];
  }

  const title = tr('control.reports.userXReportTitle', 'X USER REPORT #3');
  return [
    'Retail POS',
    'BE.0.0.0',
    `Date : ${dateStr}  Tijd: ${timeStr}`,
    title,
    '',
    tr('control.reports.userReportPerUser', 'Per user'),
    `${user}     ${tickets}    ${amount}`,
    'Kiosk         42     986.30',
    'Admin         15     298.10',
    'Waiter 2       8     142.85',
    '',
    `${total} ${tickets}: 65`,
    `${total} ${amount}: 1427.25`,
    '',
    tr('control.reports.userReportDiscountsX', 'Discounts applied (X): 4'),
    tr('control.reports.userReportVoidsX', 'Void lines (X): 1'),
    'Database ID: 3',
  ];
}
