import React, { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * `new Date("YYYY-MM-DD")` is UTC midnight and shows as the previous local day in many timezones.
 * Parse date-only strings as a local calendar date instead.
 */
function parseLocalDateValue(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const s = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const y = Number(m[1], 10);
    const mo = Number(m[2], 10) - 1;
    const d = Number(m[3], 10);
    return new Date(y, mo, d);
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

export function CalendarModal({ open, onClose, value, onChange }) {
  const { t } = useLanguage();
  const [viewYear, setViewYear] = useState(() => (parseLocalDateValue(value) ?? new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (parseLocalDateValue(value) ?? new Date()).getMonth());

  useEffect(() => {
    const parsed = parseLocalDateValue(value);
    if (!parsed) return;
    setViewYear(parsed.getFullYear());
    setViewMonth(parsed.getMonth());
  }, [value]);

  const monthName = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }, [viewYear, viewMonth]);

  const grid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const startDay = first.getDay();
    const monFirst = startDay === 0 ? 6 : startDay - 1;
    const prevMonth = new Date(viewYear, viewMonth, 0);
    const prevCount = prevMonth.getDate();
    const rows = [];
    let dayCount = 1 - monFirst;
    const totalDays = last.getDate();
    for (let row = 0; row < 6; row++) {
      const week = [];
      for (let col = 0; col < 7; col++) {
        if (dayCount < 1) {
          week.push({ type: 'prev', day: prevCount + dayCount, date: new Date(viewYear, viewMonth - 1, prevCount + dayCount) });
        } else if (dayCount > totalDays) {
          week.push({ type: 'next', day: dayCount - totalDays, date: new Date(viewYear, viewMonth + 1, dayCount - totalDays) });
        } else {
          week.push({ type: 'current', day: dayCount, date: new Date(viewYear, viewMonth, dayCount) });
        }
        dayCount++;
      }
      rows.push(week);
    }
    return rows;
  }, [viewYear, viewMonth]);

  const today = new Date();
  const valueDate = parseLocalDateValue(value);
  const isToday = (d) => d && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  const isSelected = (d) =>
    valueDate &&
    d &&
    d.getFullYear() === valueDate.getFullYear() &&
    d.getMonth() === valueDate.getMonth() &&
    d.getDate() === valueDate.getDate();

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const handleSelect = (cell) => {
    if (cell.type === 'current' || cell.type === 'prev' || cell.type === 'next') {
      onChange?.(cell.date);
      onClose?.();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
    >
      <div className="bg-white rounded-lg shadow-xl overflow-hidden min-w-[800px] h-[700px]" onClick={(e) => e.stopPropagation()}>
        <div className="bg-pos-bg px-4 py-5 flex items-center justify-between">
          <button type="button" className="text-white p-1 active:opacity-80 active:bg-green-500" onClick={goPrev} aria-label="Previous month">
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span className="text-white text-5xl font-medium capitalize">{monthName}</span>
          <button type="button" className="text-white p-1 active:opacity-80 active:bg-green-500" onClick={goNext} aria-label="Next month">
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-7 gap-0.5 text-center text-gray-500 text-3xl mb-2">
            {DAYS.map((d) => (
              <div key={d} className="py-1">{t(`calendarDay${d}`)}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {grid.flat().map((cell, i) => {
              const grey = cell.type !== 'current';
              const todayCell = cell.type === 'current' && isToday(cell.date);
              const selectedCell = (cell.type === 'current' || cell.type === 'prev' || cell.type === 'next') && isSelected(cell.date);
              return (
                <button
                  key={i}
                  type="button"
                  className={`py-6 rounded flex flex-col items-center justify-center text-5xl relative ${ grey ? 'text-gray-400 active:bg-green-500' : 'text-gray-800 active:bg-green-500' } ${todayCell ? 'bg-pos-bg text-white active:bg-green-500 active:opacity-90' : ''} ${ selectedCell && !todayCell ? 'bg-blue-600 text-white active:bg-green-500' : '' } ${selectedCell && todayCell ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}
                  onClick={() => handleSelect(cell)}
                >
                  {todayCell && <span className="absolute -mt-[72px] text-[20px] font-medium text-white leading-tight">{t('calendarToday')}</span>}
                  <span>{cell.day}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
