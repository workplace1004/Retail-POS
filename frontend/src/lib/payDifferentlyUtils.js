/** Shared helpers for Pay differently modal (OrderPanel + Kiosk). */

export const roundCurrency = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const formatPaymentAmount = (n) => `€${roundCurrency(n).toFixed(2)}`;

export function sumAmountsByIntegration(methods, amounts, integration) {
  return methods
    .filter((m) => m.integration === integration)
    .reduce((sum, m) => sum + (Number(amounts[m.id]) || 0), 0);
}

/** Build payment breakdown { amounts: { methodId: amount } } from methods and amounts */
export function buildPaymentBreakdown(methods, amounts) {
  const result = {};
  for (const m of methods) {
    const v = Number(amounts[m.id]) || 0;
    if (v > 0.0001) result[m.id] = roundCurrency(v);
  }
  return Object.keys(result).length > 0 ? { amounts: result } : null;
}
