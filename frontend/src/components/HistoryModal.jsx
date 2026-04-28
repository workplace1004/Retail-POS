import React, { useRef, useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { POS_API_PREFIX as API } from '../lib/apiOrigin.js';

const formatHistoryAmount = (n) => `€ ${Number(n).toFixed(2).replace('.', ',')}`;
const parseSubproductNotes = (rawNotes) => {
  const tokens = String(rawNotes || '')
    .split(/[;,]/)
    .map((n) => n.trim())
    .filter(Boolean);
  return tokens.map((token) => {
    const [rawName, rawPrice] = String(token).split('::');
    const name = String(rawName || '').trim();
    const extraPrice = Number(rawPrice);
    return {
      name,
      extraPrice: Number.isFinite(extraPrice) && extraPrice > 0 ? extraPrice : 0
    };
  }).filter((entry) => entry.name);
};

const formatHistoryDate = (d) => {
  try {
    const date = new Date(d);
    const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${dateStr} ${timeStr}`;
  } catch {
    return '–';
  }
};

export function HistoryModal({ open, onClose, historyOrders = [], onFetchHistory }) {
  const { t } = useLanguage();
  const tr = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const listRef = useRef(null);
  const detailListRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showViewDetail, setShowViewDetail] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paymentMethodNames, setPaymentMethodNames] = useState({});
  const [reprintLoading, setReprintLoading] = useState(false);
  const [reprintError, setReprintError] = useState('');
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [canDetailScrollUp, setCanDetailScrollUp] = useState(false);
  const [canDetailScrollDown, setCanDetailScrollDown] = useState(false);

  useEffect(() => {
    if (open && onFetchHistory) onFetchHistory();
  }, [open, onFetchHistory]);
  useEffect(() => {
    if (!open) {
      setShowViewDetail(false);
      setSelectedId(null);
      setDetailOrder(null);
      setDetailLoading(false);
      setReprintError('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`${API}/payment-methods`);
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const list = Array.isArray(data?.data) ? data.data : [];
        if (cancelled) return;
        const byId = {};
        list.forEach((method) => {
          const id = String(method?.id || '').trim();
          if (!id) return;
          byId[id] = String(method?.name || id);
        });
        setPaymentMethodNames(byId);
      } catch {
        // Ignore: payment names are optional, fallback labels are used.
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !showViewDetail || !selectedId) return undefined;
    let cancelled = false;
    const selectedFromHistory = historyOrders.find((o) => String(o?.id) === String(selectedId)) || null;
    if (selectedFromHistory) {
      setDetailOrder(selectedFromHistory);
    }
    const run = async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`${API}/orders/${selectedId}`);
        if (!res.ok) {
          if (!cancelled) setDetailOrder(selectedFromHistory);
          return;
        }
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (data && typeof data === 'object') setDetailOrder(data);
        else setDetailOrder(selectedFromHistory);
      } catch {
        if (!cancelled) setDetailOrder(selectedFromHistory);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [open, showViewDetail, selectedId, historyOrders]);

  useEffect(() => {
    if (!open) return undefined;
    const el = listRef.current;
    if (!el) return undefined;
    const updateScrollButtons = () => {
      const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
      setCanScrollUp(el.scrollTop > 0);
      setCanScrollDown(el.scrollTop < maxScrollTop - 1);
    };
    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [open, historyOrders]);

  useEffect(() => {
    if (!open || !showViewDetail) return undefined;
    const el = detailListRef.current;
    if (!el) return undefined;
    const updateDetailScrollButtons = () => {
      const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
      setCanDetailScrollUp(el.scrollTop > 0);
      setCanDetailScrollDown(el.scrollTop < maxScrollTop - 1);
    };
    updateDetailScrollButtons();
    el.addEventListener('scroll', updateDetailScrollButtons);
    window.addEventListener('resize', updateDetailScrollButtons);
    return () => {
      el.removeEventListener('scroll', updateDetailScrollButtons);
      window.removeEventListener('resize', updateDetailScrollButtons);
    };
  }, [open, showViewDetail, selectedId]);

  const scroll = (dir, detailMode = false) => {
    const el = detailMode ? detailListRef?.current : listRef?.current;
    if (!el) return;
    el.scrollBy({ top: dir * 120, behavior: 'smooth' });
  };

  const handleReprintTicket = async () => {
    const orderId = String(selectedOrderSummary?.id || '').trim();
    if (!orderId || reprintLoading) return;
    setReprintError('');
    setReprintLoading(true);
    try {
      const res = await fetch(`${API}/printers/receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success !== true || data?.data?.printed !== true) {
        throw new Error(data?.error || tr('historyReprintFailed', 'Reprint failed.'));
      }
    } catch (err) {
      const msg = err?.message || tr('historyReprintFailed', 'Reprint failed.');
      setReprintError(msg);
    } finally {
      setReprintLoading(false);
    }
  };

  if (!open) return null;

  const baseReceipt = 60;
  const total = historyOrders.length;
  const selectedOrderSummary = historyOrders.find((o) => String(o?.id) === String(selectedId)) || null;
  const selectedOrder = detailOrder && String(detailOrder?.id) === String(selectedId) ? detailOrder : selectedOrderSummary;
  const selectedOrderItems = Array.isArray(selectedOrder?.items) ? selectedOrder.items : [];
  const selectedOrderDate = selectedOrder?.updatedAt || selectedOrder?.createdAt || null;
  const selectedOrderUser = selectedOrder?.user?.username || selectedOrder?.user?.name || selectedOrder?.userName || 'admin';
  const paymentSummary = (() => {
    const fromPaymentMethods = selectedOrder?.paymentMethods && typeof selectedOrder.paymentMethods === 'object'
      ? Object.values(selectedOrder.paymentMethods)
        .map((entry) => [String(entry?.name || '').trim(), Number(entry?.amount) || 0])
        .filter(([name, amount]) => name && amount > 0)
      : [];
    if (fromPaymentMethods.length > 0) return fromPaymentMethods;

    const amounts =
      selectedOrder?.paymentBreakdown?.amounts && typeof selectedOrder.paymentBreakdown.amounts === 'object'
        ? selectedOrder.paymentBreakdown.amounts
        : selectedOrder?.paymentBreakdown && typeof selectedOrder.paymentBreakdown === 'object'
          ? selectedOrder.paymentBreakdown
          : null;
    if (amounts) {
      return Object.entries(amounts)
        .map(([methodId, amount]) => [paymentMethodNames[String(methodId)] || String(methodId), Number(amount) || 0])
        .filter(([, amount]) => amount > 0);
    }

    if (Array.isArray(selectedOrder?.payments) && selectedOrder.payments.length > 0) {
      const totals = {};
      selectedOrder.payments.forEach((payment) => {
        const methodId = String(payment?.paymentMethodId || '').trim();
        if (!methodId) return;
        const amount = Number(payment?.amount) || 0;
        totals[methodId] = (totals[methodId] || 0) + amount;
      });
      return Object.entries(totals)
        .map(([methodId, amount]) => [paymentMethodNames[methodId] || methodId, amount])
        .filter(([, amount]) => amount > 0);
    }

    return [];
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div
        className={`bg-pos-bg min-h-[700px] p-5 rounded-lg shadow-xl flex flex-col border border-gray-400 w-full max-w-5xl max-h-[90vh] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {reprintError ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg rounded-lg border border-gray-300 bg-pos-panel text-white shadow-xl p-6">
              <div className="text-lg font-semibold mb-3">{tr('error', 'Error')}</div>
              <div className="text-base mb-5 break-words">{reprintError}</div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="px-5 py-2 rounded bg-pos-bg text-white font-medium active:bg-green-500"
                  onClick={() => setReprintError('')}
                >
                  {tr('ok', 'OK')}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!showViewDetail ? (
          <div className="p-4 py-2 border-b border-pos-border">
            <h2 className="text-xl font-semibold text-pos-text">{t('historyOrderTitle')}</h2>
          </div>
        ) : null}

        {!showViewDetail ? (
          <div
            ref={listRef}
            className="flex-1 overflow-auto min-h-[280px] border-b border-pos-border"
          >
            <table className="w-full text-left text-pos-text">
              <thead className="bg-pos-bg sticky top-0">
                <tr className="text-md font-semibold">
                  <th className="p-2">{t('historyReceiptNo')}:</th>
                  <th className="p-2">{t('historyTime')}:</th>
                  <th className="p-2 border-l border-dotted border-gray-500">{t('historyAmount')}:</th>
                  <th className="p-2 border-l border-dotted border-gray-500">{t('table')}:</th>
                </tr>
              </thead>
              <tbody>
                {historyOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-500">
                      {t('historyNoOrders')}
                    </td>
                  </tr>
                ) : (
                  historyOrders.map((order, index) => (
                    <tr
                      key={order.id}
                      className={`border-t text-md border-pos-border ${selectedId === String(order.id)
                        ? 'bg-green-500 text-white'
                        : 'bg-pos-bg active:bg-green-500'
                        }`}
                      onClick={() => setSelectedId((prev) => (prev === String(order.id) ? null : String(order.id)))}
                    >
                      <td className="p-2 font-medium">
                        NS {baseReceipt + total - 1 - index}
                      </td>
                      <td className="p-2">{formatHistoryDate(order.updatedAt || order.createdAt)}</td>
                      <td className="p-2 border-l border-dotted border-gray-500">
                        {formatHistoryAmount(order.total)}
                      </td>
                      <td className="p-2 border-l border-dotted border-gray-500">
                        {order.table?.name ?? '–'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 min-h-[280px]">
            <div className="h-full grid grid-cols-[1fr_auto]">
              <div className="border min-h-[590px] max-h-[590px] border-[#7f8ea6] bg-pos-panel min-h-0 flex flex-col mr-10">
                <div
                  ref={detailListRef}
                  className="flex-1 overflow-auto p-2 px-10 text-pos-text text-[20px] leading-tight [&::-webkit-scrollbar]:hidden"
                  style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
                >
                  {detailLoading ? (
                    <div className="text-pos-muted">{tr('loading', 'Loading...')}</div>
                  ) : selectedOrderItems.length > 0 ? (
                    selectedOrderItems.map((item) => {
                      const qty = Number(item?.quantity) || 0;
                      const name = item?.product?.name || item?.name || item?.productName || '-';
                      const unitPrice = Number(item?.price) || 0;
                      const linePrice = unitPrice * Math.max(1, qty);
                      const subproducts = parseSubproductNotes(item?.notes);
                      return (
                        <div key={item?.id || `${name}-${qty}`} className="leading-tight mb-1">
                          <div className="flex items-start justify-between gap-4">
                            <div>{`${qty}x ${name}`}</div>
                            <div className="shrink-0">{formatHistoryAmount(linePrice)}</div>
                          </div>
                          {subproducts.map((sub, idx) => (
                            <div key={`${item?.id || name}-sub-${idx}`} className="pl-6 text-[18px] text-white flex items-start justify-between gap-4">
                              <div>{`• ${sub.name}`}</div>
                              <div className="shrink-0">{formatHistoryAmount(sub.extraPrice)}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-pos-muted">-</div>
                  )}
                </div>
              </div>
              <div className="min-w-[300px] text-white text-[30px] leading-tight whitespace-pre-line">
                {`${tr('total', 'Total')}: ${formatHistoryAmount(selectedOrder?.total || 0)}
${tr('inWaitingModal.user', 'User')}: ${selectedOrderUser}
${tr('date', 'Date')}: ${selectedOrderDate ? new Date(selectedOrderDate).toLocaleDateString('nl-NL') : '-'}
${tr('historyTime', 'Time')}: ${selectedOrderDate ? new Date(selectedOrderDate).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}

${paymentSummary.length > 0
                    ? paymentSummary.map(([method, amount]) => `${String(method)}: ${formatHistoryAmount(amount)}`).join('\n')
                    : ''}`}
              </div>
              {showViewDetail ? (
                <div className="grid grid-cols-[1fr_auto] py-4 items-center">
                  <div className="flex items-center justify-around px-20 text-2xl">
                    <button
                      type="button"
                      className={`w-10 h-10 bg-pos-panel text-pos-text rounded ${canDetailScrollUp ? 'active:bg-green-500' : 'opacity-40 cursor-not-allowed'}`}
                      onClick={() => scroll(-1, true)}
                      disabled={!canDetailScrollUp}
                      aria-label={t('scrollUp')}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={`w-10 h-10 bg-pos-panel text-pos-text rounded ${canDetailScrollDown ? 'active:bg-green-500' : 'opacity-40 cursor-not-allowed'}`}
                      onClick={() => scroll(1, true)}
                      disabled={!canDetailScrollDown}
                      aria-label={t('scrollDown')}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="flex justify-center items-center h-full">
                <div className="flex h-[40px] justify-center">
                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-pos-panel text-pos-text font-medium active:bg-green-500"
                    onClick={() => setShowViewDetail(false)}
                  >
                    {tr('closeWindow', 'Close window')}
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}

        {!showViewDetail ? (
          <div className="flex justify-around text-2xl gap-2 py-1 border-b border-pos-border bg-pos-bg">
            <button
              type="button"
              className={`p-2 text-pos-text rounded ${canScrollUp ? 'active:bg-green-500' : 'opacity-40 cursor-not-allowed'}`}
              onClick={() => scroll(-1)}
              aria-label={t('scrollUp')}
              disabled={!canScrollUp}
            >
              <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11 17V5.414l3.293 3.293a.999.999 0 101.414-1.414l-5-5a.999.999 0 00-1.414 0l-5 5a.997.997 0 000 1.414.999.999 0 001.414 0L9 5.414V17a1 1 0 102 0z" />
              </svg>
            </button>
            <button
              type="button"
              className={`p-2 text-pos-text rounded ${canScrollDown ? 'active:bg-green-500' : 'opacity-40 cursor-not-allowed'}`}
              onClick={() => scroll(1)}
              aria-label={t('scrollDown')}
              disabled={!canScrollDown}
            >
              <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 17.707l5-5a.999.999 0 10-1.414-1.414L11 14.586V3a1 1 0 10-2 0v11.586l-3.293-3.293a.999.999 0 10-1.414 1.414l5 5a.999.999 0 001.414 0z" />
              </svg>
            </button>
          </div>
        ) : null}


        {!showViewDetail ? (
          <div className="flex flex-wrap gap-2 p-4 text-md py-1 justify-around bg-pos-bg">
            <button
              type="button"
              className="px-4 py-2 rounded bg-pos-panel text-pos-text font-medium active:bg-green-500"
              onClick={onClose}
            >
              {t('backName')}
            </button>
            <button
              type="button"
              disabled={!selectedOrderSummary}
              className={`px-4 py-2 rounded font-medium ${selectedOrderSummary ? 'bg-pos-panel text-pos-text active:bg-green-500' : 'bg-pos-panel text-pos-text opacity-40 cursor-not-allowed'}`}
              onClick={() => {
                if (!selectedOrderSummary) return;
                setDetailOrder(null);
                setShowViewDetail(true);
              }}
            >
              {t('historyView')}
            </button>
            <button
              type="button"
              disabled={!selectedOrderSummary}
              className={`px-4 py-2 rounded font-medium ${selectedOrderSummary ? 'bg-pos-panel text-pos-text active:bg-green-500' : 'bg-pos-panel text-pos-text opacity-40 cursor-not-allowed'}`}
              onClick={() => { }}
            >
              {t('historyTakeBack')}
            </button>
            <button
              type="button"
              disabled={!selectedOrderSummary}
              className={`px-4 py-2 rounded font-medium ${selectedOrderSummary ? 'bg-pos-panel text-pos-text active:bg-green-500' : 'bg-pos-panel text-pos-text opacity-40 cursor-not-allowed'}`}
              onClick={() => { }}
            >
              {t('historyTakeBackAgain')}
            </button>
            <button
              type="button"
              disabled={!selectedOrderSummary || reprintLoading}
              className={`px-4 py-2 rounded font-medium ${(selectedOrderSummary && !reprintLoading) ? 'bg-pos-panel text-pos-text active:bg-green-500' : 'bg-pos-panel text-pos-text opacity-40 cursor-not-allowed'}`}
              onClick={handleReprintTicket}
            >
              {reprintLoading ? tr('loading', 'Loading...') : t('historyReprintTicket')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
