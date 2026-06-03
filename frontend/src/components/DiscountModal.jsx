import React, { useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const KEYS = [
  ['C', '7', '8', '9'],
  [',', '4', '5', '6'],
  ['0', '1', '2', '3']
];

export function DiscountModal({ open, onClose }) {
  const { t } = useLanguage();
  const tr = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const [mode, setMode] = useState('amount');
  const [input, setInput] = useState('');

  const parsed = useMemo(() => {
    const normalized = String(input || '').replace(',', '.');
    const value = Number(normalized);
    return Number.isFinite(value) ? value : 0;
  }, [input]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-[520px] rounded-md bg-pos-panel px-8 py-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-3 items-center text-4xl text-pos-text mb-5">
          <div className="text-center">€ 0,00</div>
          <div className="text-center rounded bg-pos-bg border border-pos-inputBorder py-1 px-2 text-3xl font-semibold">
            {mode === 'percentage'
              ? (input ? `${input} %` : '0 %')
              : (input ? `€ ${input}` : '€ 0,00')}
          </div>
          <div className="text-center text-green-700">€ 0,00</div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-10">
          <div className="space-y-5">
            <button
              type="button"
              className={`w-full h-[52px] rounded text-xl font-semibold ${mode === 'amount' ? 'bg-pos-bg border border-pos-inputBorder text-green-700' : 'bg-pos-bg border border-pos-inputBorder text-pos-text active:bg-green-500'}`}
              onClick={() => setMode('amount')}
            >
              {tr('discountAmount', 'Amount')}
            </button>
            <button
              type="button"
              className={`w-full h-[52px] rounded text-xl font-semibold ${mode === 'percentage' ? 'bg-pos-bg border border-pos-inputBorder text-green-700' : 'bg-pos-bg border border-pos-inputBorder text-pos-text active:bg-green-500'}`}
              onClick={() => setMode('percentage')}
            >
              {tr('percentage', 'Percentage')}
            </button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {KEYS.flat().map((key, idx) => {
              if (!key) return <div key={`empty-${idx}`} />;
              return (
                <button
                  key={key}
                  type="button"
                  className="h-[52px] w-[52px] rounded text-4xl font-semibold text-pos-text active:bg-green-500"
                  onClick={() => {
                    if (key === 'C') {
                      setInput('');
                      return;
                    }
                    if (key === ',') {
                      setInput((prev) => (prev.includes(',') ? prev : `${prev},`));
                      return;
                    }
                    setInput((prev) => `${prev}${key}`);
                  }}
                >
                  {key}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex justify-between">
          <button
            type="button"
            className="h-[52px] min-w-[160px] rounded text-2xl font-semibold bg-pos-bg border border-pos-inputBorder text-pos-text active:bg-green-500"
            onClick={onClose}
          >
            {tr('cancel', 'Cancel')}
          </button>
          <button
            type="button"
            disabled={parsed <= 0}
            className={`h-[52px] min-w-[160px] rounded text-2xl font-semibold ${parsed > 0 ? 'bg-pos-bg border border-pos-inputBorder text-pos-text active:bg-green-500' : 'bg-pos-bg border border-pos-inputBorder text-pos-muted cursor-not-allowed'}`}
            onClick={onClose}
          >
            {tr('ok', 'Ok')}
          </button>
        </div>
      </div>
    </div>
  );
}
