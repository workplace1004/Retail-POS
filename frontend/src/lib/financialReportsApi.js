import { POS_API_PREFIX } from './apiOrigin.js';
import { posTerminalAuthHeaders } from './posTerminalSession.js';

function buildQuery(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v == null || v === '') continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function fetchFinancialPeriod() {
  const res = await fetch(`${POS_API_PREFIX}/reports/financial/period`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to load reporting period');
  return data;
}

/** X report — read-only snapshot; does not close the period. */
export async function fetchFinancialXReport({ lang, userName, storeName, reportSettings } = {}) {
  const res = await fetch(
    `${POS_API_PREFIX}/reports/financial/x${buildQuery({
      lang,
      userName,
      storeName,
      reportSettings: reportSettings ? JSON.stringify(reportSettings) : '',
    })}`,
    { cache: 'no-store' },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to build X report');
  return data;
}

/** Z report — closes period, archives report, increments Z number. */
export async function closeFinancialZReport({
  lang,
  userName,
  storeName,
  closedByName,
  closedByUserId,
  registerId,
  registerName,
  reportSettings,
} = {}) {
  const res = await fetch(`${POS_API_PREFIX}/reports/financial/z/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...posTerminalAuthHeaders() },
    body: JSON.stringify({
      lang,
      userName,
      storeName,
      closedByName,
      closedByUserId,
      registerId,
      registerName,
      reportSettings,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to close Z report');
  return data;
}

export async function fetchZReportHistory(limit = 50) {
  const res = await fetch(`${POS_API_PREFIX}/reports/financial/z/history${buildQuery({ limit })}`, {
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to load Z history');
  return Array.isArray(data) ? data : [];
}

export async function fetchZReportReceiptLines(id) {
  const res = await fetch(`${POS_API_PREFIX}/reports/financial/z/${encodeURIComponent(id)}/receipt`, {
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to load Z receipt');
  return data;
}
