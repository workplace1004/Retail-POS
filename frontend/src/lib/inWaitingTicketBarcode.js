/**
 * Barcodes printed on in-waiting hold tickets (CODE39 payload, e.g. IW050 for display #50).
 * Scanners may send with or without Code 39 start/stop asterisks.
 */

/**
 * @param {unknown} raw
 * @returns {number | null} In-waiting display number, or null if this does not look like a hold ticket barcode.
 */
export function parseInWaitingHoldTicketBarcode(raw) {
  const t = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '');
  if (!t) return null;
  const core = t.replace(/^\*+/, '').replace(/\*+$/, '');
  const m = core.match(/^IW(\d{1,6})$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

/**
 * @param {unknown[]} orders
 * @param {number} displayNumber
 * @returns {object | null}
 */
export function findInWaitingOrderByDisplayNumber(orders, displayNumber) {
  const n = Number(displayNumber);
  if (!Number.isFinite(n) || n < 1) return null;
  const list = Array.isArray(orders) ? orders : [];
  return list.find((o) => o?.status === 'in_waiting' && Number(o?.inWaitingDisplayNumber) === n) || null;
}
