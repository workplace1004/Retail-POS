import React, { useRef, useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { KeyboardWithNumpad } from './KeyboardWithNumpad';


/**
 * Modal for "In waiting" / waiting orders list.
 * Layout: list (Nummer, Gebruiker, Klant, Tijd, Bedrag, Geprint), action buttons, AZERTY + numpad keyboard.
 */
export function InWaitingModal({ open, onClose, orders = [], onViewOrder, onDeleteOrder, onPrintOrder, currentUser }) {
  const { t } = useLanguage();
  const tr = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const listRef = useRef(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedOrderId(null);
      setSearchValue('');
    }
  }, [open]);

  if (!open) return null;

  const formatTime = (d) => {
    try {
      return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '–';
    }
  };
  const formatAmount = (total) => (total != null ? `€${Number(total).toFixed(2)}` : '€0.00');
  const customerName = (o) => (o?.customer ? (o.customer.companyName || o.customer.name) : '–');
  const orderNo = (id) => (id ? id.slice(-6) : '–');
  const userName = (o) => (o?.user?.name ?? currentUser?.label ?? currentUser?.name ?? '–');

  const waitingOrders = orders.filter((o) => o?.status === 'in_waiting');

  const searchQuery = searchValue.trim().toLowerCase();
  const displayedOrders =
    searchQuery === ''
      ? waitingOrders
      : waitingOrders.filter((o) => {
        const no = orderNo(o.id).toLowerCase();
        const cust = customerName(o).toLowerCase();
        const time = formatTime(o.createdAt).toLowerCase();
        const amount = formatAmount(o.total).toLowerCase();
        return no.includes(searchQuery) || cust.includes(searchQuery) || time.includes(searchQuery) || amount.includes(searchQuery);
      });

  const scroll = (dir) => {
    const el = listRef?.current;
    if (el) el.scrollTop += dir * 60;
  };

  const handleView = () => {
    if (selectedOrderId && onViewOrder) {
      onViewOrder(selectedOrderId);
    }
  };

  const handleDelete = async () => {
    if (selectedOrderId && onDeleteOrder) {
      await onDeleteOrder(selectedOrderId);
      setSelectedOrderId(null);
    }
  };

  const handlePrint = async () => {
    if (selectedOrderId && onPrintOrder) {
      await onPrintOrder(selectedOrderId);
    }
  };

  return (
    <div className="fixed inset-0 z-[52] flex items-center justify-center bg-black/40">
      <div
        className="flex flex-col bg-pos-bg rounded-xl shadow-2xl max-w-[900px] w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: list area */}
          <div className="flex flex-col flex-1 min-w-0 p-4">
            {/* Column headers */}
            <div className="flex justify-around gap-2 px-2 py-1 text-sm font-semibold text-pos-text border-b border-pos-border">
              <span>{tr('inWaitingModal.number', 'Number')}</span>
              <span>{tr('inWaitingModal.user', 'User')}</span>
              <span>{tr('inWaitingModal.customer', 'Customer')}</span>
              <span>{tr('inWaitingModal.time', 'Time')}</span>
              <span>{tr('inWaitingModal.amount', 'Amount')}</span>
              <span>{tr('inWaitingModal.printed', 'Printed')}</span>
            </div>
            {/* List */}
            <div
              ref={listRef}
              className="flex-1 overflow-auto min-h-[320px] max-h-[320px] border border-pos-border rounded-lg bg-pos-panel"
            >
              {displayedOrders.length > 0 ? (
                <table className="w-full text-left text-sm text-pos-text">
                  <tbody>
                    {displayedOrders.map((order) => (
                      <tr
                        key={order.id}
                        className={`border-b flex w-full border-pos-border cursor-pointer ${selectedOrderId === order.id ? 'bg-green-500' : 'active:bg-green-500'}`}
                        onClick={() => setSelectedOrderId((prev) => (prev === order.id ? null : order.id))}
                      >
                        <td className="p-2 flex items-center justify-center min-w-[130px] max-w-[130px]">
                          {orderNo(order.id)}
                        </td>
                        <td className="p-2 flex items-center justify-center min-w-[100px] max-w-[100px]">{userName(order)}</td>
                        <td className="p-2 flex items-center justify-center min-w-[120px] max-w-[120px]">{customerName(order)}</td>
                        <td className="p-2 flex items-center justify-center min-w-[100px] max-w-[100px]">{formatTime(order.createdAt)}</td>
                        <td className="p-2 flex items-center justify-center min-w-[130px] max-w-[130px]">{formatAmount(order.total)}</td>
                        <td className="p-2 flex items-center justify-center min-w-[100px] max-w-[100px]">
                          {order?.printed ? (
                            <svg
                              className={`w-6 h-6 shrink-0 ${selectedOrderId === order.id ? 'text-white' : 'text-green-500'}`}
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden
                            >
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            t('no')
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  {searchQuery ? tr('inWaitingModal.noOrdersMatch', 'No orders match') : tr('inWaitingModal.noOrders', 'No waiting orders')}
                </div>
              )}
            </div>
            {/* Scroll arrows */}
            <div className="flex gap-2 py-2 justify-center">
              <button type="button" className="p-1 text-pos-muted active:text-pos-text active:bg-green-500" onClick={() => scroll(-1)} aria-label={t('scrollUp')}>
                <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 17V5.414l3.293 3.293a.999.999 0 101.414-1.414l-5-5a.999.999 0 00-1.414 0l-5 5a.997.997 0 000 1.414.999.999 0 001.414 0L9 5.414V17a1 1 0 102 0z" fill="currentColor" />
                </svg>
              </button>
              <button type="button" className="p-1 text-pos-muted active:text-pos-text active:bg-green-500" onClick={() => scroll(1)} aria-label={t('scrollDown')}>
                <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10.707 17.707l5-5a.999.999 0 10-1.414-1.414L11 14.586V3a1 1 0 10-2 0v11.586l-3.293-3.293a.999.999 0 10-1.414 1.414l5 5a.999.999 0 001.414 0z" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex flex-col gap-2 p-4 w-[180px] shrink-0 justify-around py-10">
            {/* Search input */}
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={tr('inWaitingModal.searchPlaceholder', 'Search...')}
              className="w-full px-3 py-2 text-pos-text bg-pos-panel border border-pos-border rounded-md placeholder-pos-muted focus:outline-none focus:ring-2 focus:ring-pos-accent"
            />
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-3 bg-pos-panel border border-pos-border rounded-md font-medium text-sm text-pos-text active:bg-green-500"
            >
              {tr('inWaitingModal.backToCounterSale', 'Back to counter sale')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-3 bg-pos-panel border border-pos-border rounded-md font-medium text-sm text-pos-text active:bg-green-500"
            >
              {tr('inWaitingModal.back', 'Back')}
            </button>
            <button
              type="button"
              disabled={!selectedOrderId}
              onClick={handleView}
              className={`w-full py-2.5 px-3 rounded-md font-medium text-sm ${selectedOrderId ? 'bg-pos-panel border border-pos-border active:bg-green-500 text-pos-text' : 'bg-pos-panel border border-pos-border text-pos-muted cursor-not-allowed'}`}
            >
              {tr('inWaitingModal.view', 'View')}
            </button>
            <button
              type="button"
              disabled={!selectedOrderId}
              onClick={handlePrint}
              className={`w-full py-2.5 px-3 rounded-md font-medium text-sm ${selectedOrderId ? 'bg-pos-panel border border-pos-border active:bg-green-500 text-pos-text' : 'bg-pos-panel border border-pos-border text-pos-muted cursor-not-allowed'}`}
            >
              {tr('inWaitingModal.print', 'Print')}
            </button>
            <button
              type="button"
              disabled={!selectedOrderId}
              onClick={handleDelete}
              className={`w-full py-2.5 px-3 rounded-md font-medium text-sm ${selectedOrderId ? 'bg-pos-panel border border-pos-border active:bg-green-500 text-pos-text' : 'bg-pos-panel border border-pos-border text-pos-muted cursor-not-allowed'}`}
            >
              {tr('inWaitingModal.delete', 'Delete')}
            </button>
          </div>
        </div>

        {/* Keyboard */}
        <div className="overflow-auto border-t border-pos-border">
          <KeyboardWithNumpad value={searchValue} onChange={setSearchValue} />
        </div>
      </div>
    </div >
  );
}
