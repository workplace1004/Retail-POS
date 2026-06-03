import React, { useRef, useState, useEffect } from 'react';
import { CalendarModal } from './CalendarModal';
import { AddRecurringOrderModal } from './AddRecurringOrderModal';
import { useLanguage } from '../contexts/LanguageContext';
import { POS_API_PREFIX as API } from '../lib/apiOrigin.js';

const SortIcon = () => (
  <span className="ml-0.5 align-middle" aria-hidden>^</span>
);

const toDateOnly = (d) => {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
};

const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function MonthPickerModal({ open, onClose, value, onChange, prevYearLabel, nextYearLabel }) {
  // value: Date (first day of selected month) or null
  const initial = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const selectedMonth = value ? new Date(value).getMonth() : null;
  const selectedYear = value ? new Date(value).getFullYear() : null;

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[52] flex items-center justify-center bg-black/40">
      <div
        className="bg-white rounded-lg shadow-xl overflow-hidden min-w-[800px] h-[600px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#1e3a5f] flex items-center justify-between px-4 py-3">
          <button type="button" className="text-white p-1 active:opacity-80 active:bg-green-500" onClick={() => setViewYear((y) => y - 1)} aria-label={prevYearLabel}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
          </button>
          <span className="text-white py-5 text-5xl font-medium">{viewYear}</span>
          <button type="button" className="text-white p-1 active:opacity-80 active:bg-green-500" onClick={() => setViewYear((y) => y + 1)} aria-label={nextYearLabel}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" /></svg>
          </button>
        </div>
        <div className="p-4 grid grid-cols-4 gap-2">
          {MONTH_ABBREV.map((label, i) => {
            const isSelected = selectedMonth === i && selectedYear === viewYear;
            return (
              <button
                key={label}
                type="button"
                className={`py-16 px-3 rounded text-2xl font-medium transition-colors ${isSelected ? 'bg-[#1e3a5f] text-white' : 'text-gray-700 active:bg-green-500' }`}
                onClick={() => {
                  onChange(new Date(viewYear, i, 1));
                  onClose();
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function InPlanningModal({
  open,
  onClose,
  orders = [],
  onDeleteOrder,
  onLoadOrder,
  onFetchOrders,
  onMarkOrderPrinted
}) {
  const { t } = useLanguage();
  const tr = (key, fallback) => (t(key) === key ? fallback : t(key));
  const leftListRef = useRef(null);
  const rightListRef = useRef(null);
  /** When modal opens, widen date range once so in_planning orders from earlier days are visible (header count is not day-filtered). */
  const planningDateRangeInitRef = useRef(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const today = toDateOnly(new Date());
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [calendarFor, setCalendarFor] = useState(null);
  const [showPrintOptionsModal, setShowPrintOptionsModal] = useState(false);
  const [keyboardUppercase, setKeyboardUppercase] = useState(false);
  const [keyboardInputValue, setKeyboardInputValue] = useState('');
  const [historyMode, setHistoryMode] = useState(false);
  const [historyMonthDate, setHistoryMonthDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [showMonthPickerModal, setShowMonthPickerModal] = useState(false);
  const [dateViewActive, setDateViewActive] = useState(false); // true = show all orders history, white Date, hide date input
  const [showAddRecurringModal, setShowAddRecurringModal] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const TOAST_DURATION_MS = 4000;

  useEffect(() => {
    if (!open) setToast(null);
  }, [open]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!open) {
      planningDateRangeInitRef.current = false;
      return;
    }
    if (planningDateRangeInitRef.current) return;

    const relevant = orders.filter((o) => o.status === 'in_planning');
    if (relevant.length === 0 && orders.length === 0) return;

    if (relevant.length > 0) {
      let minMs = Infinity;
      let maxMs = -Infinity;
      for (const o of relevant) {
        const day = toDateOnly(o.createdAt).getTime();
        minMs = Math.min(minMs, day);
        maxMs = Math.max(maxMs, day);
      }
      const todayMs = toDateOnly(new Date()).getTime();
      maxMs = Math.max(maxMs, todayMs);
      setFromDate(new Date(minMs));
      setToDate(new Date(maxMs));
    } else {
      const t = toDateOnly(new Date());
      setFromDate(t);
      setToDate(t);
    }
    planningDateRangeInitRef.current = true;
  }, [open, orders]);

  const showPrintToast = (text, variant = 'error') => {
    setToast({ text, variant });
  };

  const keyDisplay = (k) => (/^[a-z]$/.test(k) ? (keyboardUppercase ? k.toUpperCase() : k) : k);

  const sendKey = (char) => {
    if (char === 'Backspace') setKeyboardInputValue((prev) => prev.slice(0, -1));
    else setKeyboardInputValue((prev) => prev + char);
  };

  const sendLetterOrSymbol = (k) => {
    if (/^[a-z]$/.test(k)) sendKey(keyboardUppercase ? k.toUpperCase() : k);
    else sendKey(k);
  };

  const formatDate = (d) => {
    try {
      const date = new Date(d);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
    } catch {
      return '–';
    }
  };
  const formatTime = (d) => {
    try {
      return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '–';
    }
  };
  const formatDateTime = (d) => {
    try {
      const date = new Date(d);
      const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
      const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${dateStr} ${timeStr}`;
    } catch {
      return '–';
    }
  };
  const formatAmount = (total) => (total != null ? `€${Number(total).toFixed(2)}` : '€0.00');
  const customerName = (o) => (o?.customer ? (o.customer.companyName || o.customer.name) : '–');
  const orderNo = (id) => (id ? id.slice(-6) : '–');

  const getItemLabel = (item) => item?.product?.name ?? '–';
  const parseNoteToken = (token) => {
    const raw = String(token || '').trim();
    if (!raw) return null;
    const [labelPart, pricePart] = raw.split('::');
    const label = String(labelPart || '').trim();
    if (!label) return null;
    if (pricePart == null) return { label, price: 0 };
    const parsed = Number(pricePart);
    return { label, price: Number.isFinite(parsed) ? parsed : 0 };
  };
  const getItemNotes = (item) =>
    String(item?.notes || '')
      .split(/[;,]/)
      .map((n) => parseNoteToken(n))
      .filter(Boolean);
  const getItemQuantity = (item) => Math.max(1, Number(item?.quantity) || 1);
  const getItemBaseLinePrice = (item) => {
    const qty = getItemQuantity(item);
    const baseUnit = Number(item?.product?.price) ?? Number(item?.price) ?? 0;
    const noteTotal = getItemNotes(item).reduce((s, n) => s + (Number(n?.price) || 0), 0);
    return (baseUnit + noteTotal) * qty;
  };

  // In history mode: fromDate/toDate = first/last day of selected month; when dateViewActive show all orders (no date filter)
  const effectiveFrom = dateViewActive
    ? new Date(1970, 0, 1)
    : historyMode
      ? new Date(historyMonthDate.getFullYear(), historyMonthDate.getMonth(), 1)
      : fromDate;
  const effectiveTo = dateViewActive
    ? new Date(2100, 11, 31)
    : historyMode
      ? new Date(historyMonthDate.getFullYear(), historyMonthDate.getMonth() + 1, 0)
      : toDate;
  const formatMonthYear = (d) => {
    try {
      const date = new Date(d);
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${m}/${y}`;
    } catch {
      return '–';
    }
  };

  // Only in_planning orders in range (or all when dateViewActive)
  const ordersInDateRange = orders.filter((o) => {
    if (o.status !== 'in_planning') return false;
    if (dateViewActive) return true;
    const orderDay = toDateOnly(o.createdAt);
    const from = effectiveFrom.getTime();
    const to = effectiveTo.getTime();
    const t = orderDay.getTime();
    return t >= from && t <= to;
  });

  const orderHasPrintableItems = (o) => Array.isArray(o.items) && o.items.length > 0;
  const canBulkPrintAllProduction = ordersInDateRange.some(orderHasPrintableItems);
  const canBulkPrintNewProduction = ordersInDateRange.some((o) => !o.printed && orderHasPrintableItems(o));

  // Search filter: match query in order no, name, time, type, amount, origin
  const searchQuery = keyboardInputValue.trim().toLowerCase();
  const displayedOrders =
    searchQuery === ''
      ? ordersInDateRange
      : ordersInDateRange.filter((o) => {
        const no = orderNo(o.id).toLowerCase();
        const name = customerName(o).toLowerCase();
        const time = formatDateTime(o.createdAt).toLowerCase();
        const type = t('webordersCollection').toLowerCase();
        const amount = formatAmount(o.total).toLowerCase();
        const origin = (o.source || 'pos').toLowerCase();
        const q = searchQuery;
        return no.includes(q) || name.includes(q) || time.includes(q) || type.includes(q) || amount.includes(q) || origin.includes(q);
      });

  const selectedOrder = selectedOrderId ? displayedOrders.find((o) => o.id === selectedOrderId) : null;
  const selectedOrderItems = selectedOrder?.items ?? [];

  const runProductionPrint = async (orderId) => {
    const prodRes = await fetch(`${API}/printers/production`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    const data = await prodRes.json().catch(() => ({}));
    if (!prodRes.ok) throw new Error(data?.error || tr('inPlanningPrintFailed', 'Print failed'));
    const jobs = data?.data?.printJobs || [];
    if (!Array.isArray(jobs) || jobs.length === 0) {
      throw new Error(
        tr(
          'inPlanningProductionNoPrinters',
          'Nothing was sent to a printer. Check product production printers in Control.'
        )
      );
    }
  };

  const runPlanningTotalsPrint = async (orderId) => {
    const res = await fetch(`${API}/printers/planning-totals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || tr('inPlanningPrintFailed', 'Print failed'));
    const jobs = data?.data?.printJobs || [];
    if (!Array.isArray(jobs) || jobs.length === 0) {
      throw new Error(tr('inPlanningTotalsNoPrinter', 'Could not print totals. Check printers in Control.'));
    }
  };

  const handleProductionPrintClick = async () => {
    if (!selectedOrderId || printBusy) return;
    setPrintBusy(true);
    try {
      await runProductionPrint(selectedOrderId);
      await onMarkOrderPrinted?.(selectedOrderId);
      onFetchOrders?.();
      showPrintToast(tr('inPlanningPrintSuccess', 'Printed successfully.'), 'success');
    } catch (e) {
      showPrintToast(e?.message || tr('inPlanningPrintFailed', 'Print failed.'), 'error');
    } finally {
      setPrintBusy(false);
    }
  };

  const handlePlanningTotalsClick = async () => {
    if (!selectedOrderId || printBusy) return;
    setPrintBusy(true);
    try {
      await runPlanningTotalsPrint(selectedOrderId);
      await onMarkOrderPrinted?.(selectedOrderId);
      onFetchOrders?.();
      showPrintToast(tr('inPlanningPrintSuccess', 'Printed successfully.'), 'success');
    } catch (e) {
      showPrintToast(e?.message || tr('inPlanningPrintFailed', 'Print failed.'), 'error');
    } finally {
      setPrintBusy(false);
    }
  };

  const handlePrintAllProduction = async (onlyUnprinted) => {
    if (printBusy || historyMode) return;
    const list = onlyUnprinted ? ordersInDateRange.filter((o) => !o.printed) : [...ordersInDateRange];
    const withItems = list.filter(orderHasPrintableItems);
    if (!withItems.length) {
      showPrintToast(tr('inPlanningPrintNone', 'No orders to print.'), 'error');
      setShowPrintOptionsModal(false);
      return;
    }
    setPrintBusy(true);
    let failures = 0;
    try {
      for (const o of withItems) {
        try {
          await runProductionPrint(o.id);
          await onMarkOrderPrinted?.(o.id);
        } catch {
          failures += 1;
        }
      }
      onFetchOrders?.();
      if (failures === 0) {
        showPrintToast(tr('inPlanningPrintAllOk', 'Production printed for all orders.'), 'success');
      } else {
        showPrintToast(tr('inPlanningPrintSomeFailed', `${failures} order(s) could not be printed.`), 'error');
      }
    } finally {
      setPrintBusy(false);
      setShowPrintOptionsModal(false);
    }
  };

  if (!open) return null;

  const scroll = (ref, dir) => {
    const el = ref?.current;
    if (el) el.scrollTop += dir * 60;
  };

  const qwertyTop = 'a z e r t y u i o p'.split(' ');
  const qwertyMid = 'q s d f g h j k l m'.split(' ');
  const qwertyBot = 'w x c v b n , €'.split(' ');
  const numPad = [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3'], ['-', '0', '.']];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div
        className="bg-pos-panel rounded-lg shadow-xl flex flex-col h-[90vh] overflow-hidden"
        onClick={(e) => {
          e.stopPropagation();
          if (showMonthPickerModal) setShowMonthPickerModal(false);
          if (calendarFor !== null) setCalendarFor(null);
        }}
      >
        <div className="flex w-full overflow-hidden">
          {/* Left panel: table */}
          <div className="flex flex-col w-full h-full overflow-hidden">
            {/* Header: Date, Full list or mm/yyyy, Search, History / Full list */}
            <div className="flex items-center justify-around w-full px-4 py-2 min-h-[64px] max-h-[64px]">
              <button
                type="button"
                className="text-left active:bg-green-500"
                onClick={() => setDateViewActive((prev) => !prev)}
              >
                <div className={`font-semibold text-xl ${dateViewActive ? 'text-white' : 'text-green-400'}`}>{t('inPlanningDate')}</div>
                {!historyMode && <div className={`text-md ${dateViewActive ? 'text-green-400' : 'text-white'}`}>{t('inPlanningFullList')}</div>}
              </button>
              {!dateViewActive ? (
                <>
                  {historyMode ? (
                    <input
                      type="text"
                      readOnly
                      value={formatMonthYear(historyMonthDate)}
                      className="w-48 px-3 py-2 text-md font-medium text-white bg-pos-panel border border-white/30 rounded cursor-pointer active:border-white/50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-500"
                      onClick={() => setShowMonthPickerModal(true)}
                      aria-label={t('selectMonthYear')}
                    />
                  ) : (
                    <input
                      type="text"
                      readOnly
                      value={formatDate(fromDate)}
                      className="w-48 px-3 py-2 text-md font-medium text-white bg-pos-panel border border-white/30 rounded cursor-pointer active:border-white/50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-green-500"
                      onClick={() => setCalendarFor('from')}
                      aria-label={t('fromDate')}
                    />
                  )}
                </>
              ) : (
                <div className='w-48 h-5'>
                </div>
              )}
              <input
                type="text"
                value={keyboardInputValue}
                onChange={(e) => setKeyboardInputValue(e.target.value)}
                className="max-w-[200px] flex-1 px-3 py-2 text-md font-medium text-white bg-pos-panel border border-gray-400 rounded placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-green-400"
                placeholder={t('searchOrders')}
                aria-label={t('searchOrders')}
              />
              <button
                type="button"
                className={`px-3 py-1.5 rounded text-md font-medium ${historyMode ? 'text-green-400' : 'text-white'} active:bg-green-500`}
                onClick={() => {
                  if (historyMode) {
                    setHistoryMode(false);
                    setKeyboardInputValue('');
                  } else {
                    setHistoryMode(true);
                  }
                }}
              >
                {t('history')}
              </button>
            </div>

            <div className="flex w-full gap-1 px-2 py-2 text-md justify-around font-medium text-white">
              <span>{t('inPlanningNo')}</span>
              <span>{t('inPlanningDeliveryTime')}</span>
              <span>{t('name')}</span>
              <span>{t('inPlanningType')}</span>
              <span>{t('inPlanningAmount')}</span>
              <span>{t('inPlanningPrinted')}</span>
              <span>{t('inPlanningPaid')}</span>
              <span>{t('inPlanningOrigin')}</span>
            </div>
            <div
              ref={leftListRef}
              className="overflow-auto min-h-[320px] max-h-[320px] border border-white rounded-lg mx-2"
            >
              {displayedOrders.length > 0 ? (
                <table className="text-left text-sm text-white">
                  <tbody>
                    {displayedOrders.map((order) => (
                      <tr
                        key={order.id}
                        className={`border-b border-gray-100 cursor-pointer ${selectedOrderId === order.id ? 'bg-green-500' : 'active:bg-green-500'
                          }`}
                        onClick={() => setSelectedOrderId((prev) => (prev === order.id ? null : order.id))}
                      >
                        <td className="p-3 min-w-[50px] max-w-[50px] whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            {orderNo(order.id)}
                          </div>
                        </td>
                        <td className="p-3 min-w-[120px] max-w-[120px] whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            {formatDateTime(order.createdAt)}
                          </div>
                        </td>
                        <td className="p-3 min-w-[75px] max-w-[75px] truncate">
                          <div className="flex items-center justify-center">
                            {customerName(order)}
                          </div>
                        </td>
                        <td className="p-3 min-w-[60px] max-w-[60px] whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            {t('webordersCollection')}
                          </div>
                        </td>
                        <td className="p-3 min-w-[90px] max-w-[90px] whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            {formatAmount(order.total)}
                          </div>
                        </td>
                        <td className="p-3 min-w-[80px] max-w-[80px] whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {order.printed ? (
                              <>
                                <svg
                                  className={`w-5 h-5 shrink-0 ${selectedOrderId === order.id ? 'text-white' : 'text-green-500'}`}
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  aria-hidden
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span className={`font-medium ${selectedOrderId === order.id ? 'text-white' : 'text-green-400'}`}>{t('yes')}</span>
                              </>
                            ) : (
                              t('no')
                            )}
                          </div>
                        </td>
                        <td className="p-3 min-w-[60px] max-w-[60px] whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            {(order.status === 'paid' || (order.payments && order.payments.length > 0)) ? t('yes') : t('no')}
                          </div>
                        </td>
                        <td className="p-3 min-w-[60px] max-w-[60px] whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            {order.source || t('originPos')}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center text-gray-500 flex flex-col justify-center h-full items-center gap-2">
                  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  {searchQuery ? (
                    <span className="text-lg">{t('inPlanningNoOrdersMatch')} &quot;{keyboardInputValue.trim()}&quot;</span>
                  ) : (
                    <span className="text-lg">{historyMode ? t('inPlanningNoOrdersForMonth') : t('inPlanningNoOrdersForDate')}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-around w-full gap-2 py-2">
              <button type="button" className="p-1 bg-pos-panel text-gray-500 active:text-gray-700 active:opacity-70 active:scale-95 transition-transform active:bg-green-500" onClick={() => scroll(leftListRef, -1)} aria-label={t('scrollUp')}>
                <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M11 17V5.414l3.293 3.293a.999.999 0 101.414-1.414l-5-5a.999.999 0 00-1.414 0l-5 5a.997.997 0 000 1.414.999.999 0 001.414 0L9 5.414V17a1 1 0 102 0z" fill="#ffffff" /></svg>
              </button>
              <button type="button" className="p-1 text-gray-500 active:text-gray-700 active:opacity-70 active:scale-95 transition-transform active:bg-green-500" onClick={() => scroll(leftListRef, 1)} aria-label={t('scrollDown')}>
                <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10.707 17.707l5-5a.999.999 0 10-1.414-1.414L11 14.586V3a1 1 0 10-2 0v11.586l-3.293-3.293a.999.999 0 10-1.414 1.414l5 5a.999.999 0 001.414 0z" fill="#ffffff" /></svg>
              </button>
            </div>
          </div>

          {/* Right panel: print buttons + content */}
          <div className="flex flex-col w-[340px] shrink-0">
            <div className="flex flex-wrap gap-2 py-2 w-full justify-center items-center">
              <button
                type="button"
                disabled={!selectedOrderId || printBusy}
                className={`px-1.5 py-1.5 w-[100px] min-h-[57px] max-h-[57px] rounded text-md ${selectedOrderId && !printBusy ? 'bg-gray-200 text-gray-800 active:bg-green-500' : 'bg-gray-400 text-gray-500 cursor-not-allowed opacity-70'}`}
                onClick={() => void handleProductionPrintClick()}
              >
                {t('inPlanningProductionPrint')}
              </button>
              <button
                type="button"
                disabled={historyMode || printBusy || !canBulkPrintAllProduction}
                className={`px-1.5 py-1.5 w-[100px] min-h-[57px] max-h-[57px] rounded text-md ${historyMode || printBusy || !canBulkPrintAllProduction ? 'bg-gray-400 text-gray-500 cursor-not-allowed opacity-70' : 'bg-gray-200 text-gray-800 active:bg-green-500'}`}
                onClick={() =>
                  !historyMode && !printBusy && canBulkPrintAllProduction && setShowPrintOptionsModal(true)
                }
              >
                {t('inPlanningPrintAllProduction')}
              </button>
              <button
                type="button"
                disabled={!selectedOrderId || printBusy}
                className={`px-1.5 py-1.5 w-[100px] min-h-[57px] max-h-[57px] rounded text-md ${selectedOrderId && !printBusy ? 'bg-gray-200 text-gray-800 active:bg-green-500' : 'bg-gray-400 text-gray-500 cursor-not-allowed opacity-70'}`}
                onClick={() => void handlePlanningTotalsClick()}
              >
                {t('inPlanningPrintTotals')}
              </button>
            </div>
            <div ref={rightListRef} className="h-[400px] overflow-auto border rounded-lg mx-2 border-white p-2">
              {selectedOrder ? (
                selectedOrderItems.length > 0 ? (
                  <div className="flex flex-col gap-2 text-sm text-white">
                    {selectedOrderItems.map((item) => (
                      <div key={item.id} className="p-2 rounded bg-pos-panel/80 border border-white/20">
                        <div className="flex justify-between items-baseline">
                          <span className="font-medium">{getItemQuantity(item)}x {getItemLabel(item)}</span>
                          <span className="font-medium">{formatAmount(getItemBaseLinePrice(item))}</span>
                        </div>
                        {getItemNotes(item).length > 0 && (
                          <div className="mt-1 pl-3 space-y-0.5 text-white/90">
                            {getItemNotes(item).map((note, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>▪ {note.label}</span>
                                <span>€{((Number(note?.price) || 0) * getItemQuantity(item)).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    {tr('inPlanningNoItems', 'No items in this order')}
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  {tr('inPlanningSelectOrder', 'Select an order to view items')}
                </div>
              )}
            </div>
            <div className="flex justify-around w-full gap-2 py-2">
              <button type="button" className="p-1 text-gray-500 active:text-gray-700 active:opacity-70 active:scale-95 transition-transform active:bg-green-500" onClick={() => scroll(rightListRef, -1)} aria-label={t('scrollUp')}>
                <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M11 17V5.414l3.293 3.293a.999.999 0 101.414-1.414l-5-5a.999.999 0 00-1.414 0l-5 5a.997.997 0 000 1.414.999.999 0 001.414 0L9 5.414V17a1 1 0 102 0z" fill="#ffffff" /></svg>
              </button>
              <button type="button" className="p-1 text-gray-500 active:text-gray-700 active:opacity-70 active:scale-95 transition-transform active:bg-green-500" onClick={() => scroll(rightListRef, 1)} aria-label={t('scrollDown')}>
                <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10.707 17.707l5-5a.999.999 0 10-1.414-1.414L11 14.586V3a1 1 0 10-2 0v11.586l-3.293-3.293a.999.999 0 10-1.414 1.414l5 5a.999.999 0 001.414 0z" fill="#ffffff" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom: keyboard + keypad + buttons */}
        <div className="flex gap-2 p-2 shrink-0">
          <div className="flex gap-2">
            <div className="flex gap-2">
              {/* QWERTY */}
              <div className="flex flex-col gap-1 text-3xl">
                <div className="flex gap-1 justify-center">
                  {qwertyTop.map((k) => (
                    <button key={k} type="button" className="w-[50px] h-[50px] border rounded bg-pos-panel text-pos-text active:bg-green-500" onClick={() => sendLetterOrSymbol(k)}>{keyDisplay(k)}</button>
                  ))}
                </div>
                <div className="flex gap-1 justify-center">
                  {qwertyMid.map((k) => (
                    <button key={k} type="button" className="w-[50px] h-[50px] border rounded bg-pos-panel text-pos-text active:bg-green-500" onClick={() => sendLetterOrSymbol(k)}>{keyDisplay(k)}</button>
                  ))}
                </div>
                <div className="flex gap-1 justify-center">
                  {qwertyBot.map((k) => (
                    <button key={k} type="button" className="w-[50px] h-[50px] border rounded bg-pos-panel text-pos-text active:bg-green-500" onClick={() => sendLetterOrSymbol(k)}>{keyDisplay(k)}</button>
                  ))}
                  <button type="button" className="w-[104px] h-[50px] border rounded bg-pos-panel text-pos-text active:bg-green-500" onClick={() => sendKey('Backspace')}>←</button>
                </div>
                <div className="flex gap-1 justify-center">
                  <button
                    type="button"
                    className={`w-[50px] h-[50px] border rounded text-pos-text active:bg-green-500 ${keyboardUppercase ? 'bg-pos-rowHover ring-2 ring-green-400' : 'bg-pos-panel'}`}
                    onClick={() => setKeyboardUppercase((prev) => !prev)}
                    title="Toggle uppercase"
                  >
                    ↑
                  </button>
                  <button type="button" className="w-[50px] h-[50px] border rounded bg-pos-panel text-pos-text active:bg-green-500" onClick={() => sendKey('@')}>@</button>
                  <button type="button" className="w-[50px] h-[50px] border rounded bg-pos-panel text-pos-text active:bg-green-500" onClick={() => sendKey('/')}>/</button>
                  <button type="button" className="w-[212px] h-[50px] border rounded bg-pos-panel active:bg-green-500" aria-label={t('space')} onClick={() => sendKey(' ')} />
                  <button type="button" className="w-[50px] h-[50px] border rounded bg-pos-panel text-pos-text active:bg-green-500" onClick={() => sendKey('_')}>_</button>
                  <button type="button" className="w-[50px] h-[50px] border rounded bg-pos-panel text-pos-text active:bg-green-500" onClick={() => sendKey('Backspace')}>←</button>
                  <button type="button" className="w-[50px] h-[50px] border rounded bg-pos-panel text-pos-text active:bg-green-500">→</button>
                </div>
              </div>
              {/* Numeric keypad */}
              <div className="flex flex-col gap-1 text-3xl ml-3">
                {numPad.map((row, i) => (
                  <div key={i} className="flex gap-1">
                    {row.map((k) => (
                      <button key={k} type="button" className="w-[50px] h-[50px] border rounded bg-pos-panel text-pos-text active:bg-green-500" onClick={() => sendKey(k)}>{k}</button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex flex-col gap-2 text-md min-w-[220px] justify-center items-center">
              <button
                type="button"
                className={`w-48 h-[40px] px-3 rounded font-medium ${selectedOrderId ? 'bg-gray-200 text-gray-800 active:bg-green-500' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                disabled={!selectedOrderId}
                onClick={() => {
                  if (selectedOrderId && onLoadOrder) {
                    onLoadOrder(selectedOrderId);
                    onClose();
                  }
                }}
              >
                {t('inPlanningLoad')}
              </button>
              <button
                type="button"
                className={`w-48 h-[40px] px-3 rounded font-medium ${selectedOrderId ? 'bg-gray-200 text-gray-800 active:bg-green-500' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                disabled={!selectedOrderId}
                onClick={() => selectedOrderId && setShowAddRecurringModal(true)}
              >
                {t('inPlanningAddRecurringOrder')}
              </button>
              <button
                type="button"
                className={`w-48 h-[40px] px-3 rounded font-medium ${selectedOrder?.status === 'in_planning' ? 'bg-gray-200 text-gray-800 active:bg-green-500' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                disabled={!selectedOrder || selectedOrder.status !== 'in_planning'}
                onClick={async () => {
                  const id = selectedOrder?.id;
                  if (!id || selectedOrder.status !== 'in_planning' || !onDeleteOrder) return;
                  await onDeleteOrder(id);
                  setSelectedOrderId(null);
                  onFetchOrders?.();
                }}
              >
                {t('webordersCancelOrder')}
              </button>
              <button type="button" className="w-48 h-[40px] px-3 rounded bg-gray-400 text-gray-800 font-medium active:bg-green-500" onClick={onClose}>{t('webordersClose')}</button>
            </div>
          </div>
        </div>
      </div>

      <CalendarModal
        open={calendarFor !== null}
        onClose={() => setCalendarFor(null)}
        value={calendarFor === 'from' ? fromDate : toDate}
        onChange={(date) => {
          const d = toDateOnly(date);
          if (calendarFor === 'from') setFromDate(d);
          else if (calendarFor === 'to') setToDate(d);
          setCalendarFor(null);
        }}
      />

      <MonthPickerModal
        open={showMonthPickerModal}
        onClose={() => setShowMonthPickerModal(false)}
        value={historyMonthDate}
        onChange={(firstDayOfMonth) => setHistoryMonthDate(firstDayOfMonth)}
        prevYearLabel={t('previousYear')}
        nextYearLabel={t('nextYear')}
      />

      <AddRecurringOrderModal
        open={showAddRecurringModal}
        onClose={() => setShowAddRecurringModal(false)}
        initialDate={selectedOrder?.createdAt}
        onAdd={() => {
          setShowAddRecurringModal(false);
          onFetchOrders?.();
        }}
      />

      {/* Print options modal */}
      {showPrintOptionsModal && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40"
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-gray-300 p-6 grid grid-rows-2 gap-6 min-w-[600px] h-[300px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-4 justify-center items-center">
              <button
                type="button"
                disabled={printBusy || !canBulkPrintAllProduction}
                className={`h-[80px] w-[200px] rounded-lg text-lg font-medium text-center ${printBusy || !canBulkPrintAllProduction ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-800 active:bg-green-500'}`}
                onClick={() => void handlePrintAllProduction(false)}
              >
                {t('inPlanningPrintAll')}
              </button>
              <button
                type="button"
                disabled={printBusy || !canBulkPrintNewProduction}
                className={`h-[80px] w-[200px] rounded-lg text-lg font-medium text-center ${printBusy || !canBulkPrintNewProduction ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-800 active:bg-green-500'}`}
                onClick={() => void handlePrintAllProduction(true)}
              >
                {t('inPlanningPrintNewOrders')}
              </button>
            </div>
            <div className="flex justify-center items-center">
              <button
                type="button"
                className="h-[80px] w-[200px] rounded-lg bg-gray-200 text-gray-800 text-lg font-medium active:bg-green-500"
                onClick={() => setShowPrintOptionsModal(false)}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className="fixed top-8 right-8 z-[200] flex items-stretch rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-2xl shadow-black/40 border border-white/10 overflow-hidden min-w-[280px] max-w-md"
          role="alert"
          aria-live="polite"
        >
          <div
            className={`flex-shrink-0 w-1 ${toast.variant === 'success' ? 'bg-emerald-400/90' : 'bg-amber-400/90'}`}
            aria-hidden
          />
          <div className="flex items-center gap-3 py-4 pr-6 pl-2">
            {toast.variant === 'success' ? (
              <span className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center" aria-hidden>
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            ) : (
              <span className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center" aria-hidden>
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
            )}
            <p className="text-lg font-medium tracking-tight text-white/95">{toast.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
