/**
 * Small thermal ticket when an order is placed “In waiting” (main printer, ESC/POS via backend).
 */
import { POS_API_PREFIX } from './apiOrigin.js';

/**
 * @param {{ displayNumber: number; header?: string; orderLine: string; apiPrefix?: string }} opts
 */
export async function printInWaitingHoldTicket(opts) {
  const displayNumber = Number(opts?.displayNumber);
  if (!Number.isFinite(displayNumber) || displayNumber < 1) {
    throw new Error('Invalid in-waiting display number.');
  }
  const api = String(opts?.apiPrefix || POS_API_PREFIX || '/api').replace(/\/$/, '');
  const header = String(opts?.header || 'Retail POS').trim() || 'Retail POS';
  const orderLine = String(opts?.orderLine || `Order #${displayNumber}`).trim();
  const res = await fetch(`${api}/printers/in-waiting-hold-ticket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayNumber: Math.floor(displayNumber),
      header,
      orderLine,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Print failed (${res.status})`);
  }
  if (data?.success !== true || data?.data?.printed !== true) {
    throw new Error(data?.error || 'Printer did not confirm successful print.');
  }
  return data?.data || {};
}
