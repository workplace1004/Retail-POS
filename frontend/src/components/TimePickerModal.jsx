import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const MINUTE_OPTIONS = [0, 15, 30, 45];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/**
 * Time picker modal: hour grid (4 columns) + minute row (00, 15, 30, 45).
 * Shown when user clicks the time display.
 */
export function TimePickerModal({ open, onClose, value, onChange }) {
  const { t } = useLanguage();
  const d = value ? new Date(value) : new Date();
  const [hour, setHour] = useState(d.getHours());
  const [minute, setMinute] = useState(() => {
    const m = d.getMinutes();
    return MINUTE_OPTIONS.reduce((prev, curr) => (Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev));
  });

  useEffect(() => {
    if (open && value) {
      const v = new Date(value);
      setHour(v.getHours());
      const m = v.getMinutes();
      setMinute(MINUTE_OPTIONS.reduce((prev, curr) => (Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev)));
    }
  }, [open, value]);

  const formatHeader = () => {
    if (!value) return '';
    const v = new Date(value);
    const dd = String(v.getDate()).padStart(2, '0');
    const mm = String(v.getMonth() + 1).padStart(2, '0');
    const yyyy = v.getFullYear();
    const hh = String(hour).padStart(2, '0');
    const min = String(minute).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}:00`;
  };

  const goPrevTime = () => {
    if (minute > 0) {
      const idx = MINUTE_OPTIONS.indexOf(minute);
      setMinute(MINUTE_OPTIONS[idx - 1] ?? MINUTE_OPTIONS[MINUTE_OPTIONS.length - 1]);
      if (idx === 0) setHour((h) => (h > 0 ? h - 1 : 23));
    } else {
      setMinute(45);
      setHour((h) => (h > 0 ? h - 1 : 23));
    }
  };
  const goNextTime = () => {
    if (minute < 45) {
      const idx = MINUTE_OPTIONS.indexOf(minute);
      setMinute(MINUTE_OPTIONS[idx + 1] ?? MINUTE_OPTIONS[0]);
      if (idx === MINUTE_OPTIONS.length - 1) setHour((h) => (h < 23 ? h + 1 : 0));
    } else {
      setMinute(0);
      setHour((h) => (h < 23 ? h + 1 : 0));
    }
  };

  const handleSave = () => {
    if (!value) return;
    const v = new Date(value);
    const dt = new Date(v.getFullYear(), v.getMonth(), v.getDate(), hour, minute, 0, 0);
    onChange?.(dt);
    onClose?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[54] flex items-center justify-center bg-black/50">
      <div
        className="bg-pos-panel rounded-lg shadow-xl overflow-hidden min-w-[500px] max-w-[600px] border border-pos-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 text-xl font-semibold text-pos-text text-center border-b border-pos-border">
          {formatHeader()}
        </div>
        <div className="p-4">
          <div className="grid grid-cols-4 gap-2 mb-4">
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                className={`py-3 px-2 rounded-lg text-center font-mono text-lg ${ hour === h ? 'bg-blue-600 text-white active:bg-green-500' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 active:bg-green-500 dark:active:bg-green-500 border border-gray-200 dark:border-gray-600' }`}
                onClick={() => setHour(h)}
              >
                {String(h).padStart(2, '0')}:{String(minute).padStart(2, '0')}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-center mb-4">
            {MINUTE_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                className={`py-3 px-6 rounded-lg font-mono text-lg ${ minute === m ? 'bg-green-500 text-white active:bg-green-500' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 active:bg-green-500 dark:active:bg-green-500 border border-gray-200 dark:border-gray-600' }`}
                onClick={() => setMinute(m)}
              >
                {String(m).padStart(2, '0')}
              </button>
            ))}
          </div>
          <div className="bg-pos-bg px-4 py-3 rounded-lg flex items-center justify-between">
            <button
              type="button"
              className="text-white p-1 active:opacity-80 active:bg-green-500"
              onClick={goPrevTime}
              aria-label="Previous time"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="text-white text-2xl font-mono">
              {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
            </span>
            <button type="button" className="text-white p-1 active:opacity-80 active:bg-green-500" onClick={goNextTime} aria-label="Next time">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex gap-3 p-4 border-t border-pos-border">
          <button
            type="button"
            className="flex-1 py-3 px-4 bg-pos-surface text-pos-text rounded-lg active:bg-green-500 font-medium"
            onClick={onClose}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            className="flex-1 py-3 px-4 bg-pos-surface text-pos-text rounded-lg active:bg-green-500 font-medium"
          >
            {t('remark')}
          </button>
          <button
            type="button"
            className="flex-1 py-3 px-4 bg-pos-surface text-pos-text rounded-lg active:bg-green-500 font-medium"
            onClick={handleSave}
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
