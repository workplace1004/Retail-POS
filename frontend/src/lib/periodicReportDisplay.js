/**
 * Matches backend `periodicReportReceipt.js` `center()` / WIDTH — centered section headings.
 */
import { POS_API_PREFIX } from './apiOrigin.js';

export const PERIODIC_REPORT_LINE_WIDTH = 42;

export function isCenteredReceiptSectionLine(line) {
  const width = PERIODIC_REPORT_LINE_WIDTH;
  const s = String(line);
  if (s.length !== width) return false;
  const t = s.trim();
  if (!t || t.length >= width) return false;
  const left = Math.floor((width - t.length) / 2);
  const expected = ' '.repeat(left) + t + ' '.repeat(width - t.length - left);
  return s === expected;
}

/**
 * @param {string} body multiline text (lines after the main store title)
 * @returns {{ kind: 'title' | 'mono', text: string }[]}
 */
export function splitPeriodicReportBodyIntoChunks(body) {
  const lines = body.split('\n');
  const chunks = [];
  let buf = [];
  const flush = () => {
    if (buf.length) chunks.push({ kind: 'mono', text: buf.join('\n') });
    buf = [];
  };
  for (const line of lines) {
    if (isCenteredReceiptSectionLine(line)) {
      flush();
      chunks.push({ kind: 'title', text: line.trim() });
    } else {
      buf.push(line);
    }
  }
  flush();
  return chunks;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Full HTML document for optional preview / legacy tooling (not used for thermal print).
 * @param {string[]|null|undefined} lines
 * @returns {string} empty string if nothing to print
 */
export function buildPeriodicReportPrintHtml(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return '';
  const mainTitle = lines[0]?.trim() || '';
  const displayTitle = mainTitle || 'Report';
  const body = lines.length > 1 ? lines.slice(1).join('\n') : '';
  const chunks = splitPeriodicReportBodyIntoChunks(body);

  const parts = [];
  for (const c of chunks) {
    if (c.kind === 'title') parts.push(`<h2>${escapeHtml(c.text)}</h2>`);
    else if (c.text) parts.push(`<pre>${escapeHtml(c.text)}</pre>`);
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(displayTitle)}</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 12px 18px; color: #111; }
  h1 { text-align: center; font-size: 26pt; font-weight: 700; margin: 0 0 14px; line-height: 1.15; }
  h2 { text-align: center; font-size: 18pt; font-weight: 700; margin: 16px 0 8px; line-height: 1.2; }
  pre { font-family: ui-monospace, "Cascadia Mono", Consolas, "Lucida Console", monospace; font-size: 10.5pt; line-height: 1.38; margin: 0 0 6px; white-space: pre-wrap; word-break: break-word; tab-size: 2; }
  @media print { body { margin: 0; } @page { margin: 10mm; size: auto; } }
</style></head><body>
<h1>${escapeHtml(displayTitle)}</h1>
${parts.join('')}
</body></html>`;
}

/**
 * Print the periodic report on the main POS printer (backend ESC/POS), same path as receipts.
 * @param {string[]|null|undefined} lines
 * @returns {Promise<boolean>}
 * @throws {Error} on API / printer failure
 */
export async function printPeriodicReportLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return false;
  const normalized = lines.map((l) => String(l ?? ''));
  const res = await fetch(`${POS_API_PREFIX}/printers/text-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lines: normalized }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Print failed (${res.status})`);
  }
  if (data?.success !== true || data?.data?.printed !== true) {
    throw new Error(data?.error || 'Printer did not confirm successful print.');
  }
  return true;
}
