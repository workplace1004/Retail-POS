import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { POS_API_PREFIX as API } from '../lib/apiOrigin.js';
import { publicAssetUrl } from '../lib/publicAssetUrl.js';
import { formatPaymentAmount, roundCurrency, sumAmountsByIntegration } from '../lib/payDifferentlyUtils.js';

const KEYPAD = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['C', '0', '.'],
];

const PAY_METHOD_ICON_PNG = {
  manual_cash: '/cash.png',
  cashmatic: '/cashmatic.png',
  payworld: '/payworld.png',
  generic: '/card.png',
};

const CARD_INTEGRATIONS = ['payworld', 'ccv', 'viva', 'viva-wallet', 'worldline'];
const TERMINAL_CARD_INTEGRATIONS = new Set([
  'card',
  'payworld',
  'ccv',
  'worldline',
  'viva',
  'viva-wallet',
  'multisafepay',
]);
const MANUAL_CARD_INTEGRATIONS = new Set(['generic', 'manual_card']);

function payMethodIconSrc(integ) {
  const normalized = String(integ || '').toLowerCase();
  if (TERMINAL_CARD_INTEGRATIONS.has(normalized)) return publicAssetUrl('/payworld.png');
  if (MANUAL_CARD_INTEGRATIONS.has(normalized)) return publicAssetUrl('/card.png');
  const key = PAY_METHOD_ICON_PNG[normalized] != null ? normalized : 'generic';
  return publicAssetUrl(PAY_METHOD_ICON_PNG[key] || PAY_METHOD_ICON_PNG.generic);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Same UI and terminal flow as OrderPanel “Pay differently”.
 * After Cashmatic/Payworld succeeds, calls onProceedAfterTerminals (order settlement / kiosk create order).
 */
export function PayDifferentlyModal({
  open,
  targetTotal,
  onClose,
  onProceedAfterTerminals,
  onPaymentError,
  overlayClassName = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4',
  payworldOverlayClassName = 'fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4',
}) {
  const { t } = useLanguage();
  const tr = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [activePaymentMethods, setActivePaymentMethods] = useState([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [payModalTargetTotal, setPayModalTargetTotal] = useState(0);
  const [payModalKeypadInput, setPayModalKeypadInput] = useState('');
  const [payConfirmLoading, setPayConfirmLoading] = useState(false);
  const [showPayworldStatusModal, setShowPayworldStatusModal] = useState(false);
  const [payworldStatus, setPayworldStatus] = useState({ state: 'IDLE', message: '', details: null });

  const activeCashmaticSessionIdRef = useRef(null);
  const cancelCashmaticRequestedRef = useRef(false);
  const activePayworldSessionIdRef = useRef(null);
  const activePayworldProviderRef = useRef('payworld');
  const cancelPayworldRequestedRef = useRef(false);

  const reportError = useCallback(
    (message) => {
      if (onPaymentError) onPaymentError(message);
    },
    [onPaymentError],
  );

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const tt = Math.max(0, roundCurrency(targetTotal));
    setPayModalTargetTotal(tt);
    setPayModalKeypadInput(tt.toFixed(2));
    setPaymentAmounts({});
    setSelectedPayment(null);
    setActivePaymentMethods([]);
    setPayConfirmLoading(false);
    setShowPayworldStatusModal(false);
    setPayworldStatus({ state: 'IDLE', message: '', details: null });
    activeCashmaticSessionIdRef.current = null;
    activePayworldSessionIdRef.current = null;
    cancelCashmaticRequestedRef.current = false;
    cancelPayworldRequestedRef.current = false;

    (async () => {
      setPaymentMethodsLoading(true);
      try {
        const res = await fetch(`${API}/payment-methods?active=1`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const list = Array.isArray(data?.data) ? data.data : [];
        const sorted = [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        if (cancelled) return;
        setActivePaymentMethods(sorted);
        setPaymentAmounts(Object.fromEntries(sorted.map((m) => [m.id, 0])));
      } catch {
        if (!cancelled) setActivePaymentMethods([]);
      } finally {
        if (!cancelled) setPaymentMethodsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, targetTotal]);

  const payModalTotalAssigned = activePaymentMethods.reduce(
    (sum, m) => sum + (Number(paymentAmounts[m.id]) || 0),
    0,
  );
  const payModalKeypadValue = parseFloat(String(payModalKeypadInput || '').replace(',', '.')) || 0;
  const payModalWouldExceedTotal =
    payModalKeypadValue > 0 &&
    roundCurrency(payModalTotalAssigned + payModalKeypadValue) - payModalTargetTotal > 0.009;
  const payModalSplitComplete =
    (payModalTargetTotal <= 0.009 && payModalTotalAssigned <= 0.009) ||
    (payModalTargetTotal > 0.009 && Math.abs(payModalTotalAssigned - payModalTargetTotal) <= 0.009);

  const handlePayModalKeypad = (key) => {
    if (payModalSplitComplete) return;
    if (key === 'C') {
      setPayModalKeypadInput('');
      return;
    }
    setPayModalKeypadInput((prev) => {
      if (prev === payModalTargetTotal.toFixed(2)) return key;
      return prev + key;
    });
  };

  const handlePaymentMethodClick = (method) => {
    if (!method?.id || payModalSplitComplete || payModalWouldExceedTotal) return;
    const value = parseFloat(String(payModalKeypadInput || '').replace(',', '.')) || 0;
    if (value > 0) {
      setPaymentAmounts((prev) => ({
        ...prev,
        [method.id]: (Number(prev[method.id]) || 0) + value,
      }));
      setPayModalKeypadInput('');
    } else {
      setSelectedPayment(method.id);
    }
  };

  const handlePayHalfAmount = () => {
    if (payModalSplitComplete) return;
    const half = roundCurrency(payModalTargetTotal / 2);
    setPayModalKeypadInput(half.toFixed(2));
  };

  const handlePayRemaining = () => {
    if (payModalSplitComplete) return;
    const remaining = roundCurrency(Math.max(0, payModalTargetTotal - payModalTotalAssigned));
    setPayModalKeypadInput(remaining.toFixed(2));
  };

  const handlePayReset = () => {
    setPaymentAmounts(Object.fromEntries(activePaymentMethods.map((m) => [m.id, 0])));
    setPayModalKeypadInput(payModalTargetTotal.toFixed(2));
    setSelectedPayment(null);
  };

  const runCashmaticPayment = async (amountEuro) => {
    const cents = Math.round((Number(amountEuro) || 0) * 100);
    if (cents <= 0) return;

    const startRes = await fetch(`${API}/cashmatic/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: cents }),
    });
    const startData = await startRes.json().catch(() => ({}));
    if (!startRes.ok) {
      throw new Error(startData?.error || 'Unable to start Cashmatic payment.');
    }

    const sessionId = startData?.data?.sessionId;
    if (!sessionId) throw new Error('Cashmatic session did not start.');
    activeCashmaticSessionIdRef.current = sessionId;
    cancelCashmaticRequestedRef.current = false;

    for (let i = 0; i < 90; i += 1) {
      if (cancelCashmaticRequestedRef.current) {
        await fetch(`${API}/cashmatic/cancel/${encodeURIComponent(sessionId)}`, { method: 'POST' }).catch(() => {});
        throw new Error('Cashmatic payment cancelled.');
      }
      await sleep(1000);
      const statusRes = await fetch(`${API}/cashmatic/status/${encodeURIComponent(sessionId)}`);
      const statusData = await statusRes.json().catch(() => ({}));
      if (!statusRes.ok) {
        throw new Error(statusData?.error || 'Unable to read Cashmatic payment status.');
      }

      const state = String(statusData?.data?.state || '').toUpperCase();
      if (state === 'PAID' || state === 'FINISHED' || state === 'FINISHED_MANUAL') {
        await fetch(`${API}/cashmatic/finish/${encodeURIComponent(sessionId)}`, { method: 'POST' });
        activeCashmaticSessionIdRef.current = null;
        return;
      }
      if (state === 'CANCELLED' || state === 'ERROR') {
        throw new Error(statusData?.error || `Cashmatic payment ${state.toLowerCase()}.`);
      }
    }

    await fetch(`${API}/cashmatic/cancel/${encodeURIComponent(sessionId)}`, { method: 'POST' }).catch(() => {});
    activeCashmaticSessionIdRef.current = null;
    throw new Error('Cashmatic payment timeout. Please try again.');
  };

  const runCardTerminalPayment = async (provider, amountEuro) => {
    const providerApi = provider;
    const providerLabel = String(providerApi || 'card').toUpperCase();
    const amount = roundCurrency(Number(amountEuro) || 0);
    if (amount <= 0) return;

    setShowPayworldStatusModal(true);
    setPayworldStatus({
      state: 'IN_PROGRESS',
      message: `Connecting to ${providerLabel} terminal...`,
      details: null,
    });

    const startRes = await fetch(`${API}/${providerApi}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    const startData = await startRes.json().catch(() => ({}));
    if (!startRes.ok || startData?.ok === false) {
      setShowPayworldStatusModal(false);
      throw new Error(startData?.error || `Unable to start ${providerLabel} payment.`);
    }

    const sessionId = startData?.sessionId || startData?.data?.sessionId;
    if (!sessionId) {
      setShowPayworldStatusModal(false);
      throw new Error(`${providerLabel} session did not start.`);
    }

    activePayworldSessionIdRef.current = sessionId;
    activePayworldProviderRef.current = providerApi;
    cancelPayworldRequestedRef.current = false;
    setPayworldStatus({
      state: 'IN_PROGRESS',
      message: `Payment in progress on ${providerLabel} terminal...`,
      details: null,
    });

    for (let i = 0; i < 150; i += 1) {
      if (cancelPayworldRequestedRef.current) {
        await fetch(`${API}/${providerApi}/cancel/${encodeURIComponent(sessionId)}`, { method: 'POST' }).catch(() => {});
        setPayworldStatus({
          state: 'CANCELLED',
          message: tr('orderPanel.paymentCancelled', 'Payment cancelled.'),
          details: null,
        });
        throw new Error(tr('orderPanel.paymentCancelled', 'Payment cancelled.'));
      }
      await sleep(1000);
      const statusRes = await fetch(`${API}/${providerApi}/status/${encodeURIComponent(sessionId)}`);
      const statusData = await statusRes.json().catch(() => ({}));
      if (!statusRes.ok || statusData?.ok === false) {
        setShowPayworldStatusModal(false);
        throw new Error(statusData?.error || `Unable to read ${providerLabel} payment status.`);
      }

      const state = String(statusData?.state || '').toUpperCase();
      const statusMessage = String(statusData?.message || '').trim();
      const details = statusData?.details || null;
      setPayworldStatus({
        state: state || 'IN_PROGRESS',
        message: statusMessage || `Payment in progress on ${providerLabel} terminal...`,
        details,
      });
      if (state === 'APPROVED') {
        setPayworldStatus({
          state: 'APPROVED',
          message: statusMessage || 'Payment approved.',
          details,
        });
        await sleep(800);
        setShowPayworldStatusModal(false);
        activePayworldSessionIdRef.current = null;
        activePayworldProviderRef.current = 'payworld';
        return;
      }
      if (state === 'DECLINED' || state === 'CANCELLED' || state === 'ERROR') {
        setShowPayworldStatusModal(false);
        throw new Error(statusMessage || `${providerLabel} payment ${state.toLowerCase()}.`);
      }
    }

    await fetch(`${API}/${providerApi}/cancel/${encodeURIComponent(sessionId)}`, { method: 'POST' }).catch(() => {});
    setPayworldStatus({
      state: 'ERROR',
      message: `${providerLabel} payment timeout. Please try again.`,
      details: null,
    });
    setShowPayworldStatusModal(false);
    activePayworldSessionIdRef.current = null;
    activePayworldProviderRef.current = 'payworld';
    throw new Error(`${providerLabel} payment timeout. Please try again.`);
  };

  const payworldStateUpper = String(payworldStatus.state || '').toUpperCase();
  const activeTerminalProviderLabel = String(activePayworldProviderRef.current || 'payworld').toUpperCase();
  let payworldStatusTitle = tr('orderPanel.payworldStatusReady', 'Ready.');
  if (payworldStateUpper === 'IN_PROGRESS') {
    payworldStatusTitle = tr('orderPanel.payworldStatusInProgress', 'Payment in progress on terminal...');
  } else if (payworldStateUpper === 'APPROVED') {
    payworldStatusTitle = tr('orderPanel.payworldStatusApproved', 'Payment approved.');
  } else if (payworldStateUpper === 'DECLINED') {
    payworldStatusTitle = tr('orderPanel.payworldStatusDeclined', 'Payment declined.');
  } else if (payworldStateUpper === 'CANCELLED') {
    payworldStatusTitle = tr('orderPanel.payworldStatusCancelled', 'Payment cancelled.');
  } else if (payworldStateUpper === 'ERROR') {
    payworldStatusTitle = tr('orderPanel.payworldStatusError', 'Error during payment.');
  }

  const handleAbortPayworld = async () => {
    const activeSessionId = activePayworldSessionIdRef.current;
    const activeProvider = activePayworldProviderRef.current || 'payworld';
    if (!activeSessionId) {
      setPayworldStatus({
        state: 'ERROR',
        message: tr('orderPanel.cardNoActiveSession', `No active ${activeTerminalProviderLabel} session to cancel.`),
        details: null,
      });
      return;
    }

    cancelPayworldRequestedRef.current = true;
    setPayworldStatus({
      state: 'IN_PROGRESS',
      message: tr('orderPanel.cardCancelling', `Cancelling ${activeTerminalProviderLabel} payment on terminal...`),
      details: null,
    });

    await fetch(`${API}/${activeProvider}/cancel/${encodeURIComponent(activeSessionId)}`, { method: 'POST' }).catch(() => {});
  };

  const handleCancel = async () => {
    if (payConfirmLoading) {
      cancelCashmaticRequestedRef.current = true;
      cancelPayworldRequestedRef.current = true;
      const activeSessionId = activeCashmaticSessionIdRef.current;
      if (activeSessionId) {
        await fetch(`${API}/cashmatic/cancel/${encodeURIComponent(activeSessionId)}`, { method: 'POST' }).catch(() => {});
      }
      const activePayworldSessionId = activePayworldSessionIdRef.current;
      if (activePayworldSessionId) {
        const activeProvider = activePayworldProviderRef.current || 'payworld';
        await fetch(`${API}/${activeProvider}/cancel/${encodeURIComponent(activePayworldSessionId)}`, { method: 'POST' }).catch(() => {});
      }
      setShowPayworldStatusModal(false);
      reportError(tr('orderPanel.paymentCancelled', 'Payment cancelled.'));
    }
    onClose?.();
  };

  const handleConfirmPayment = async () => {
    if (payConfirmLoading) return;
    if (paymentMethodsLoading || activePaymentMethods.length === 0) {
      reportError(tr('orderPanel.noPaymentMethods', 'No active payment methods. Add them under Control → Payment types.'));
      return;
    }

    const assignedTotal = roundCurrency(
      activePaymentMethods.reduce((sum, m) => sum + (Number(paymentAmounts[m.id]) || 0), 0),
    );
    const modalTotal = roundCurrency(payModalTargetTotal);

    if (modalTotal > 0.009 && assignedTotal <= 0) {
      reportError(tr('orderPanel.assignedAmountGreaterThanZero', 'Assigned amount must be greater than 0.'));
      return;
    }
    if (Math.abs(assignedTotal - modalTotal) > 0.009) {
      reportError(`Assigned amount (€${assignedTotal.toFixed(2)}) must match total (€${modalTotal.toFixed(2)}).`);
      return;
    }
    if (!activePaymentMethods.length) {
      reportError(
        tr('orderPanel.noPaymentMethods', 'No active payment methods. Add them under Control → Payment types.'),
      );
      return;
    }

    try {
      setPayConfirmLoading(true);
      const cashmaticTotal = sumAmountsByIntegration(activePaymentMethods, paymentAmounts, 'cashmatic');
      if (cashmaticTotal > 0) {
        await runCashmaticPayment(cashmaticTotal);
      }
      const payworldTotal = sumAmountsByIntegration(activePaymentMethods, paymentAmounts, 'payworld');
      if (payworldTotal > 0) {
        await runCardTerminalPayment('payworld', payworldTotal);
      }
      const ccvTotal = sumAmountsByIntegration(activePaymentMethods, paymentAmounts, 'ccv');
      if (ccvTotal > 0) {
        await runCardTerminalPayment('ccv', ccvTotal);
      }
      const vivaTotal = ['viva', 'viva-wallet']
        .reduce((sum, integration) => sum + sumAmountsByIntegration(activePaymentMethods, paymentAmounts, integration), 0);
      if (vivaTotal > 0) {
        await runCardTerminalPayment('viva', vivaTotal);
      }
      const worldlineTotal = sumAmountsByIntegration(activePaymentMethods, paymentAmounts, 'worldline');
      if (worldlineTotal > 0) {
        await runCardTerminalPayment('worldline', worldlineTotal);
      }
      await onProceedAfterTerminals(activePaymentMethods, paymentAmounts, payModalTargetTotal);
    } catch (err) {
      reportError(err?.message || tr('orderPanel.paymentFailed', 'Payment failed.'));
    } finally {
      setPayConfirmLoading(false);
      activeCashmaticSessionIdRef.current = null;
      activePayworldSessionIdRef.current = null;
      activePayworldProviderRef.current = 'payworld';
      cancelCashmaticRequestedRef.current = false;
      cancelPayworldRequestedRef.current = false;
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className={overlayClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-differently-title"
        onClick={handleCancel}
      >
        <div
          className="flex flex-col bg-gray-100 rounded-xl shadow-2xl max-w-[1800px] w-full overflow-auto text-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="pay-differently-title" className="sr-only">
            {t('payDifferently')}
          </h2>
          <div className="flex items-center justify-center">
            <div className="p-6 min-w-[56%] w-full h-full flex flex-col">
              <div className="text-lg font-semibold mb-3 flex w-full justify-center items-center">
                {t('total')}: €{payModalTargetTotal.toFixed(2)}
              </div>
              <div className="grid grid-cols-4 gap-4 w-full mb-4 h-full items-start justify-center">
                {paymentMethodsLoading ? (
                  <div className="col-span-full text-sm text-gray-600 py-6 text-center">
                    {tr('orderPanel.loadingPaymentMethods', 'Loading payment methods...')}
                  </div>
                ) : activePaymentMethods.length === 0 ? (
                  <div className="col-span-full text-sm text-amber-900 py-6 text-center max-w-lg px-4">
                    {tr(
                      'orderPanel.noPaymentMethods',
                      'No active payment methods. Configure them under Control → Payment types.',
                    )}
                  </div>
                ) : (
                  activePaymentMethods.map((m) => {
                    const amt = Number(paymentAmounts[m.id]) || 0;
                    const isHighlighted = selectedPayment === m.id || amt > 0;
                    const integ = m.integration || 'generic';
                    return (
                      <div key={m.id} className="flex flex-col items-center gap-1.5">
                        <button
                          type="button"
                          disabled={payModalSplitComplete || payModalWouldExceedTotal}
                          onClick={() => handlePaymentMethodClick(m)}
                          className={`rounded-lg border-2 p-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            isHighlighted ? 'bg-green-500 border-green-700' : 'bg-white border-gray-300'
                          }`}
                          aria-label={m.name}
                        >
                          {integ === 'manual_cash' ||
                          integ === 'cashmatic' ||
                          TERMINAL_CARD_INTEGRATIONS.has(String(integ || '').toLowerCase()) ||
                          MANUAL_CARD_INTEGRATIONS.has(String(integ || '').toLowerCase()) ? (
                            <img
                              src={payMethodIconSrc(integ)}
                              alt=""
                              className="max-h-[70px] min-w-[105px] w-[105px] h-[70px] object-contain"
                              onError={(e) => {
                                const el = e.currentTarget;
                                if (TERMINAL_CARD_INTEGRATIONS.has(String(integ || '').toLowerCase()) && el.dataset.svgFallback !== '1') {
                                  el.dataset.svgFallback = '1';
                                  el.src = publicAssetUrl('/payworld.svg');
                                }
                              }}
                            />
                          ) : (
                            <span className="flex items-center justify-center w-[105px] min-h-[70px] px-2 py-3 text-base font-semibold text-center text-blue-900 bg-blue-50/80 rounded leading-tight">
                              {m.name}
                            </span>
                          )}
                        </button>
                        <div className="text-sm font-semibold tabular-nums text-center max-w-[140px]" aria-live="polite">
                          <span className="block text-xs font-normal text-gray-600 mb-0.5 truncate">{m.name}</span>
                          {formatPaymentAmount(amt)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="min-w-[26%] p-6">
              <div className="text-lg font-semibold mb-2 flex justify-center">
                {t('assigned')}: €{payModalTotalAssigned.toFixed(2)}
              </div>
              <div className="flex justify-center mt-2">
                <input
                  readOnly
                  className="w-[160px] py-2 px-3 bg-gray-200 rounded-lg text-base mb-3 outline-none cursor-default focus:border-green-500 focus:outline-none"
                  value={payModalKeypadInput}
                  aria-label={t('amountKeypad')}
                />
              </div>
              <div className="flex gap-2 flex-1 min-h-0 mt-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  {KEYPAD.map((row, ri) => (
                    <div key={ri} className="grid grid-cols-3 gap-1.5">
                      {row.map((key) => (
                        <button
                          key={key}
                          type="button"
                          disabled={payModalSplitComplete}
                          className={`py-4 rounded-lg text-lg font-medium ${
                            payModalSplitComplete
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-300 text-gray-800 active:bg-green-500'
                          }`}
                          onClick={() => handlePayModalKeypad(key)}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="min-w-[18%] flex flex-col items-center justify-center gap-4 p-6">
              <button
                type="button"
                disabled={payModalSplitComplete}
                className={`py-2 px-4 w-full max-w-[200px] rounded-lg text-sm font-medium ${
                  payModalSplitComplete ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-800 active:bg-green-500'
                }`}
                onClick={handlePayHalfAmount}
              >
                {t('halfAmount')}
              </button>
              <button
                type="button"
                disabled={payModalSplitComplete}
                className={`py-2 px-4 w-full max-w-[200px] rounded-lg text-sm font-medium ${
                  payModalSplitComplete ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-800 active:bg-green-500'
                }`}
                onClick={handlePayRemaining}
              >
                {t('remainingAmount')}
              </button>
              <button
                type="button"
                className="py-2 px-4 bg-gray-300 w-full max-w-[200px] rounded-lg text-gray-800 text-sm font-medium active:bg-green-500"
                onClick={handlePayReset}
              >
                {t('reset')}
              </button>
            </div>
          </div>
          <div className="flex justify-around px-6 gap-4 w-full pt-6 pb-6">
            <button
              type="button"
              className="w-[140px] py-2 px-4 rounded-lg text-sm font-medium bg-gray-300 text-gray-800 active:bg-green-500"
              onClick={() => void handleCancel()}
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              disabled={
                Math.abs(payModalTotalAssigned - payModalTargetTotal) > 0.009 ||
                payConfirmLoading ||
                paymentMethodsLoading ||
                activePaymentMethods.length === 0
              }
              className={`w-[140px] py-2 px-4 rounded-lg text-sm font-medium ${
                Math.abs(payModalTotalAssigned - payModalTargetTotal) > 0.009 ||
                payConfirmLoading ||
                paymentMethodsLoading ||
                activePaymentMethods.length === 0
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-300 text-gray-800 active:bg-green-500'
              }`}
              onClick={() => void handleConfirmPayment()}
            >
              {payConfirmLoading ? t('processing') : t('toConfirm')}
            </button>
          </div>
        </div>
      </div>

      {showPayworldStatusModal ? (
        <div
          className={payworldOverlayClassName}
          role="dialog"
          aria-modal="true"
          aria-labelledby="payworld-status-title"
        >
          <div className="bg-pos-panel rounded-lg shadow-xl px-10 py-8 max-w-2xl w-full mx-4 border border-pos-border">
            <h2 id="payworld-status-title" className="text-3xl mb-6 font-semibold text-pos-text text-center">
              {tr('orderPanel.cardTerminalModalTitle', `${activeTerminalProviderLabel} Payment`)}
            </h2>
            <div className="space-y-4 text-pos-text">
              <div className="flex justify-between items-center text-2xl">
                <span>{tr('orderPanel.payworldAmount', 'Amount')}:</span>
                <span className="font-semibold">€ {payModalTargetTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-2xl">
                <span>{tr('orderPanel.payworldStatusLabel', 'Status')}:</span>
                <span className="font-semibold">{payworldStatusTitle}</span>
              </div>
              {payworldStatus.message ? (
                <div className="rounded-md bg-pos-surface px-4 py-3 text-xl whitespace-pre-line">{payworldStatus.message}</div>
              ) : null}
            </div>
            <div className="mt-8 flex justify-center gap-4">
              {String(payworldStatus.state || '').toUpperCase() === 'IN_PROGRESS' ? (
                <button
                  type="button"
                  className="min-w-[220px] py-4 bg-pos-surface text-pos-text rounded text-2xl active:bg-green-500"
                  onClick={() => void handleAbortPayworld()}
                >
                  {tr('orderPanel.cancelPayworld', 'Cancel Payment')}
                </button>
              ) : (
                <button
                  type="button"
                  className="min-w-[220px] py-4 bg-pos-surface text-pos-text rounded text-2xl active:bg-green-500"
                  onClick={() => setShowPayworldStatusModal(false)}
                >
                  {tr('orderPanel.closePayworldModal', 'Close')}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
