import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { InPlanningDateTimeModal } from './InPlanningDateTimeModal';

const INTERVALS = [
  { value: 'daily', labelKey: 'recurringIntervalDaily' },
  { value: 'weekly', labelKey: 'recurringIntervalWeekly' },
  { value: 'monthly', labelKey: 'recurringIntervalMonthly' },
];
const PERIODS = [
  { value: '1y', labelKey: 'recurringPeriod1Year' },
  { value: '5y', labelKey: 'recurringPeriod5Years' },
  { value: '10y', labelKey: 'recurringPeriod10Years' },
];

export function AddRecurringOrderModal({ open, onClose, onAdd, initialDate }) {
  const { t } = useLanguage();
  const tr = (key, fallback) => (t(key) === key ? fallback : t(key));
  const now = initialDate ? new Date(initialDate) : new Date();
  const [startDate, setStartDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0));
  const [interval, setInterval] = useState('daily');
  const [period, setPeriod] = useState('10y');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (open && initialDate) {
      const d = new Date(initialDate);
      setStartDate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0, 0));
    } else if (open) {
      const n = new Date();
      setStartDate(new Date(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), 0, 0, 0));
    }
  }, [open, initialDate]);

  const formatStartDate = () => {
    const d = startDate;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  };

  const handleAdd = () => {
    onAdd?.({ startDate, interval, period });
    onClose?.();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50">
        <div
          className="bg-pos-panel rounded-lg shadow-xl border border-pos-border p-6 min-w-[500px] max-w-[600px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-6">
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-sm font-medium text-pos-text mb-1 text-center">
                  {tr('recurringStartDate', 'Start date')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(true)}
                  className="w-full px-4 py-2 bg-pos-surface text-pos-text rounded border border-pos-border active:bg-green-500 text-left"
                >
                  {formatStartDate()}
                </button>
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-pos-text mb-1 text-center">
                  {tr('recurringInterval', 'Interval')}
                </label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  className="w-full px-4 py-2 bg-pos-surface text-pos-text rounded border border-pos-border focus:outline-none focus:ring-2 focus:ring-pos-accent"
                >
                  {INTERVALS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {tr(opt.labelKey, opt.value.charAt(0).toUpperCase() + opt.value.slice(1))}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-pos-text mb-1 text-center">
                  {tr('recurringPeriod', 'Period')}
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full px-4 py-2 bg-pos-surface text-pos-text rounded border border-pos-border focus:outline-none focus:ring-2 focus:ring-pos-accent"
                >
                  {PERIODS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {tr(opt.labelKey, opt.value)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-4 justify-between pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-pos-surface text-pos-text rounded-lg active:bg-green-500 font-medium"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleAdd}
                className="flex-1 py-3 px-4 bg-pos-surface text-pos-text rounded-lg active:bg-green-500 font-medium"
              >
                {tr('recurringAdd', 'Add')}
              </button>
            </div>
          </div>
        </div>
      </div>
      <InPlanningDateTimeModal
        open={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        initialValue={startDate}
        zIndex={56}
        onSave={(dt) => {
          setStartDate(dt);
          setShowDatePicker(false);
        }}
      />
    </>
  );
}
