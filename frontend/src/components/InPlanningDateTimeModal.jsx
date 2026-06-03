import React, { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { TimePickerModal } from './TimePickerModal';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MINUTE_OPTIONS = [0, 15, 30, 45];

/**
 * Calendar + time picker modal for In planning flow.
 * Shows date/time selection with Cancel, Remark, Save buttons.
 */
export function InPlanningDateTimeModal({ open, onClose, onSave, initialValue, zIndex = 53 }) {
  const { t } = useLanguage();
  const now = initialValue ? new Date(initialValue) : new Date();
  const [selectedDate, setSelectedDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const snapMinute = (m) => MINUTE_OPTIONS.reduce((prev, curr) => (Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev));
  const [hour, setHour] = useState(now.getHours());
  const [minute, setMinute] = useState(() => snapMinute(now.getMinutes()));
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  useEffect(() => {
    if (open) {
      const n = initialValue ? new Date(initialValue) : new Date();
      setSelectedDate(new Date(n.getFullYear(), n.getMonth(), n.getDate()));
      setHour(n.getHours());
      setMinute(snapMinute(n.getMinutes()));
      setViewYear(n.getFullYear());
      setViewMonth(n.getMonth());
    }
  }, [open, initialValue]);

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
  const isToday = (d) =>
    d &&
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const isSelected = (d) =>
    d &&
    d.getFullYear() === selectedDate.getFullYear() &&
    d.getMonth() === selectedDate.getMonth() &&
    d.getDate() === selectedDate.getDate();

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const currentDateTime = useMemo(() => {
    return new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hour,
      minute,
      0,
      0
    );
  }, [selectedDate, hour, minute]);

  const handleTimePickerChange = (dt) => {
    setHour(dt.getHours());
    setMinute(snapMinute(dt.getMinutes()));
  };

  const handleSelectDate = (cell) => {
    if (cell.type === 'current' || cell.type === 'prev' || cell.type === 'next') {
      setSelectedDate(cell.date);
      setViewYear(cell.date.getFullYear());
      setViewMonth(cell.date.getMonth());
    }
  };

  const handleSave = () => {
    const dt = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hour,
      minute,
      0,
      0
    );
    onSave?.(dt);
    onClose?.();
  };

  const formatDisplay = () => {
    const d = selectedDate;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(hour).padStart(2, '0');
    const min = String(minute).padStart(2, '0');
    const ss = '00';
    return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
  };

  if (!open) return null;

  return (
    <div className={`fixed inset-0 flex items-center justify-center bg-black/40`} style={{ zIndex }}>
      <div
        className="bg-pos-panel rounded-lg shadow-xl overflow-hidden min-w-[700px] max-w-[900px] border border-pos-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 text-2xl font-semibold text-pos-text text-center border-b border-pos-border">
          {formatDisplay()}
        </div>
        <div className="bg-pos-bg px-4 py-3 flex items-center justify-between">
          <button type="button" className="text-white p-1 active:opacity-80 active:bg-green-500" onClick={goPrevMonth} aria-label="Previous month">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="text-white text-2xl font-medium capitalize">{monthName}</span>
          <button type="button" className="text-white p-1 active:opacity-80 active:bg-green-500" onClick={goNextMonth} aria-label="Next month">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-7 gap-0.5 text-center text-pos-muted text-sm mb-1">
            {DAYS.map((d) => (
              <div key={d} className="py-1">
                {t(`calendarDay${d}`)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {grid.flat().map((cell, i) => {
              const grey = cell.type !== 'current';
              const todayCell = cell.type === 'current' && isToday(cell.date);
              const selectedCell =
                (cell.type === 'current' || cell.type === 'prev' || cell.type === 'next') && isSelected(cell.date);
              return (
                <button
                  key={i}
                  type="button"
                  className={`py-4 rounded flex flex-col items-center justify-center text-xl relative ${ grey ? 'text-gray-500 active:bg-green-500' : 'text-pos-text active:bg-green-500' } ${todayCell ? 'bg-pos-bg text-white active:bg-green-500 active:opacity-90' : ''} ${ selectedCell && !todayCell ? 'bg-blue-600 text-white active:bg-green-500' : '' } ${selectedCell && todayCell ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}
                  onClick={() => handleSelectDate(cell)}
                >
                  {todayCell && (
                    <span className="absolute -mt-10 text-xs font-medium text-white leading-tight">
                      {t('calendarToday')}
                    </span>
                  )}
                  <span>{cell.day}</span>
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          className="w-full bg-pos-bg px-4 py-3 flex items-center justify-between active:opacity-90 cursor-pointer active:bg-green-500"
          onClick={() => setShowTimePickerModal(true)}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white shrink-0">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="text-white text-2xl font-mono">
            {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
          </span>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white shrink-0">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        <TimePickerModal
          open={showTimePickerModal}
          onClose={() => setShowTimePickerModal(false)}
          value={currentDateTime}
          onChange={handleTimePickerChange}
        />
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
            onClick={() => {}}
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
