import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { POS_API_PREFIX as API } from '../lib/apiOrigin.js';

function formatEuroNl(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '€ 0,00';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v);
}

/**
 * Modal: confirm weight (kg-priced product) before adding to order.
 * Polls GET /api/scale/live-weight; grams are device-driven (manual input disabled).
 */
export function ScaleWeightModal({ open, product, onCancel, onConfirm, labels }) {
  const [grams, setGrams] = useState(0);
  const [pollError, setPollError] = useState(false);
  const lastPollLogRef = useRef({ grams: null, connected: null, error: '' });

  const pricePerKg = Number(product?.price) || 0;
  const lineTotal = useMemo(
    () => Math.round(((grams / 1000) * pricePerKg) * 100) / 100,
    [grams, pricePerKg]
  );

  useEffect(() => {
    if (!open) {
      setGrams(0);
      setPollError(false);
      lastPollLogRef.current = { grams: null, connected: null, error: '' };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    let inFlight = false;
    let timerId = null;
    const tick = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const res = await fetch(`${API}/scale/live-weight`, { cache: 'no-store' });
        if (!res.ok) throw new Error('bad');
        const data = await res.json().catch(() => ({}));
        const g = Math.max(0, Math.floor(Number(data?.grams)));
        const connected = data?.connected !== false;
        const errorText = String(data?.error || '');
        const hasFreshReading = connected && String(data?.source || '') !== 'error';
        const prevLog = lastPollLogRef.current;
        if (prevLog.grams !== g || prevLog.connected !== connected || prevLog.error !== errorText) {
          console.log('[scale-modal] poll', {
            grams: g,
            connected,
            source: data?.source,
            configured: data?.configured,
            error: errorText || undefined,
          });
          lastPollLogRef.current = { grams: g, connected, error: errorText };
        }
        if (!cancelled) {
          if (Number.isFinite(g) && g >= 0 && hasFreshReading) {
            setGrams(g);
          }
          setPollError(data?.configured === false || !connected);
        }
      } catch (err) {
        console.log('[scale-modal] poll error', { error: err?.message || String(err) });
        if (!cancelled) setPollError(true);
      } finally {
        inFlight = false;
      }
    };
    const loop = async () => {
      if (cancelled) return;
      await tick();
      if (cancelled) return;
      timerId = window.setTimeout(loop, 80);
    };
    loop();
    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [open]);

  const canConfirm = grams > 0;

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    onConfirm?.({ weightGrams: grams, linePrice: lineTotal });
  }, [canConfirm, grams, lineTotal, onConfirm]);

  if (!open || !product) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-pos-bg text-stone-900 shadow-2xl border border-stone-200 p-6">
        <p className="text-center text-lg font-semibold mb-6 text-pos-text">
          {product.name} – {formatEuroNl(pricePerKg)} / KG
        </p>
        <div className="flex gap-4 mb-6">
          <div className="flex-1 rounded-xl bg-pos-bg border border-stone-200 p-4 text-center">
            <div className="text-3xl font-bold tabular-nums text-pos-text">{grams} gr</div>
            <div className="text-md text-pos-text mt-1">{labels?.weightHint ?? 'Weight'}</div>
          </div>
          <div className="flex-1 rounded-xl bg-pos-bg border border-stone-200 p-4 text-center">
            <div className="text-3xl font-bold tabular-nums text-pos-text">{formatEuroNl(lineTotal)}</div>
            <div className="text-md text-pos-text mt-1">{labels?.totalHint ?? 'Total'}</div>
          </div>
        </div>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirm();
          }}
        >
          <label className="block text-sm text-pos-text mb-2">
            <span className="sr-only">{labels?.gramsLabel ?? 'Grams'}</span>
            <input
              type="number"
              min={0}
              step={1}
              autoFocus
              value={grams}
              readOnly
              className="w-full rounded-lg bg-pos-panel border border-pos-border px-3 py-2 text-pos-text/80 cursor-not-allowed"
              placeholder={labels?.gramsPlaceholder ?? 'Weight in grams'}
            />
          </label>
          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              className="rounded-lg bg-pos-bg px-5 py-2.5 font-medium text-pos-text hover:bg-pos-bg/80 active:bg-pos-bg/80"
              onClick={onCancel}
            >
              {labels?.cancel ?? 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!canConfirm}
              className={`rounded-lg px-5 py-2.5 font-medium bg-pos-bg text-pos-text ${
                canConfirm ? 'hover:bg-pos-bg/80 active:bg-pos-bg/80' : 'cursor-not-allowed opacity-50'
              }`}
            >
              {labels?.confirm ?? 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
