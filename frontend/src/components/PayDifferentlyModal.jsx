import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  invoice: '/invoice.jpg',
  generic: '/card.png',
};

const CARD_INTEGRATIONS = ['payworld', 'ccv', 'viva', 'viva-wallet', 'worldline', 'bancontactpro'];
const TERMINAL_CARD_INTEGRATIONS = new Set([
  'card',
  'payworld',
  'ccv',
  'viva',
  'viva-wallet',
  'worldline',
  'multisafepay',
  'bancontactpro',
]);
const MANUAL_CARD_INTEGRATIONS = new Set(['generic', 'manual_card']);
const INVOICE_METHOD_ID = '__invoice__';
function InvoiceDirectUserIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M21,20a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2,6,6,0,0,1,6-6h6A6,6,0,0,1,21,20Zm-9-8A5,5,0,1,0,7,7,5,5,0,0,0,12,12Z"
      />
    </svg>
  );
}

function InvoiceWebpanelGlobeIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M3.51211712,15 L8.17190229,15 C8.05949197,14.0523506 8,13.0444554 8,12 C8,10.9555446 8.05949197,9.94764942 8.17190229,9 L3.51211712,9 C3.18046266,9.93833678 3,10.9480937 3,12 C3,13.0519063 3.18046266,14.0616632 3.51211712,15 L3.51211712,15 Z M3.93551965,16 C5.12590433,18.3953444 7.35207678,20.1851177 10.0280093,20.783292 C9.24889451,19.7227751 8.65216136,18.0371362 8.31375067,16 L3.93551965,16 L3.93551965,16 Z M20.4878829,15 C20.8195373,14.0616632 21,13.0519063 21,12 C21,10.9480937 20.8195373,9.93833678 20.4878829,9 L15.8280977,9 C15.940508,9.94764942 16,10.9555446 16,12 C16,13.0444554 15.940508,14.0523506 15.8280977,15 L20.4878829,15 L20.4878829,15 Z M20.0644804,16 L15.6862493,16 C15.3478386,18.0371362 14.7511055,19.7227751 13.9719907,20.783292 C16.6479232,20.1851177 18.8740957,18.3953444 20.0644804,16 L20.0644804,16 Z M9.18440269,15 L14.8155973,15 C14.9340177,14.0623882 15,13.0528256 15,12 C15,10.9471744 14.9340177,9.93761183 14.8155973,9 L9.18440269,9 C9.06598229,9.93761183 9,10.9471744 9,12 C9,13.0528256 9.06598229,14.0623882 9.18440269,15 L9.18440269,15 Z M9.3349823,16 C9.85717082,18.9678295 10.9180729,21 12,21 C13.0819271,21 14.1428292,18.9678295 14.6650177,16 L9.3349823,16 L9.3349823,16 Z M3.93551965,8 L8.31375067,8 C8.65216136,5.96286383 9.24889451,4.27722486 10.0280093,3.21670804 C7.35207678,3.81488234 5.12590433,5.60465556 3.93551965,8 L3.93551965,8 Z M20.0644804,8 C18.8740957,5.60465556 16.6479232,3.81488234 13.9719907,3.21670804 C14.7511055,4.27722486 15.3478386,5.96286383 15.6862493,8 L20.0644804,8 L20.0644804,8 Z M9.3349823,8 L14.6650177,8 C14.1428292,5.03217048 13.0819271,3 12,3 C10.9180729,3 9.85717082,5.03217048 9.3349823,8 L9.3349823,8 Z M12,22 C6.4771525,22 2,17.5228475 2,12 C2,6.4771525 6.4771525,2 12,2 C17.5228475,2 22,6.4771525 22,12 C22,17.5228475 17.5228475,22 12,22 Z"
      />
    </svg>
  );
}

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
 * Optional 4th argument: `{ invoiceDelivery: 'direct' | 'webpanel' }` when checkout is invoice-only.
 */
export function PayDifferentlyModal({
  open,
  targetTotal,
  onClose,
  onProceedAfterTerminals,
  onPaymentError,
  showInvoiceButton = false,
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
  const [showInvoiceChoiceModal, setShowInvoiceChoiceModal] = useState(false);
  /** Selected invoice delivery path; settlement runs only after OK. */
  const [invoiceDeliverySelection, setInvoiceDeliverySelection] = useState(null);
  const invoiceMethod = {
    id: INVOICE_METHOD_ID,
    name: tr('invoice', 'Invoice'),
    integration: 'invoice',
    sortOrder: Number.MAX_SAFE_INTEGER,
  };
  const visiblePaymentMethods = showInvoiceButton
    ? [...activePaymentMethods, invoiceMethod]
    : activePaymentMethods;

  const activeCashmaticSessionIdRef = useRef(null);
  const cancelCashmaticRequestedRef = useRef(false);
  const activePayworldSessionIdRef = useRef(null);
  const activePayworldProviderRef = useRef('payworld');
  const cancelPayworldRequestedRef = useRef(false);
  const [terminalChargeAmount, setTerminalChargeAmount] = useState(0);
  /** Latest flags for init effect: avoid full reset when `showInvoiceButton` flips after order paid (would flash Pay differently). */
  const showInvoiceChoiceModalRef = useRef(false);
  const payConfirmLoadingRef = useRef(false);
  showInvoiceChoiceModalRef.current = showInvoiceChoiceModal;
  payConfirmLoadingRef.current = payConfirmLoading;

  const reportError = useCallback(
    (message) => {
      if (onPaymentError) onPaymentError(message);
    },
    [onPaymentError],
  );

  useEffect(() => {
    if (!open) {
      setShowInvoiceChoiceModal(false);
      setInvoiceDeliverySelection(null);
      return undefined;
    }
    if (showInvoiceChoiceModalRef.current || payConfirmLoadingRef.current) {
      return undefined;
    }
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
    setTerminalChargeAmount(0);
    setShowInvoiceChoiceModal(false);
    setInvoiceDeliverySelection(null);
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
        const methodList = showInvoiceButton
          ? [...sorted, { id: INVOICE_METHOD_ID, name: 'Invoice', integration: 'invoice', sortOrder: Number.MAX_SAFE_INTEGER }]
          : sorted;
        setPaymentAmounts(Object.fromEntries(methodList.map((m) => [m.id, 0])));
      } catch {
        if (!cancelled) setActivePaymentMethods([]);
      } finally {
        if (!cancelled) setPaymentMethodsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, targetTotal, showInvoiceButton]);

  const payModalTotalAssigned = visiblePaymentMethods.reduce(
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

  const isInvoiceOnlyCheckout = useMemo(() => {
    if (!showInvoiceButton) return false;
    const modalTotal = roundCurrency(payModalTargetTotal);
    if (modalTotal <= 0.009) return false;
    const inv = Number(paymentAmounts[INVOICE_METHOD_ID]) || 0;
    if (Math.abs(inv - modalTotal) > 0.009) return false;
    for (const m of visiblePaymentMethods) {
      if (m.id === INVOICE_METHOD_ID) continue;
      if ((Number(paymentAmounts[m.id]) || 0) > 0.009) return false;
    }
    return true;
  }, [showInvoiceButton, paymentAmounts, visiblePaymentMethods, payModalTargetTotal]);

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
    if (!method?.id || payModalSplitComplete) return;

    const isInvoice = method.id === INVOICE_METHOD_ID || String(method.integration || '').toLowerCase() === 'invoice';
    if (isInvoice) {
      const full = roundCurrency(payModalTargetTotal);
      setPaymentAmounts(() =>
        Object.fromEntries(visiblePaymentMethods.map((m) => [m.id, m.id === INVOICE_METHOD_ID ? full : 0])),
      );
      setSelectedPayment(INVOICE_METHOD_ID);
      setPayModalKeypadInput('');
      return;
    }

    if (payModalWouldExceedTotal) return;
    const value = parseFloat(String(payModalKeypadInput || '').replace(',', '.')) || 0;
    if (value > 0) {
      setPaymentAmounts((prev) => {
        const next = { ...prev };
        next[INVOICE_METHOD_ID] = 0;
        next[method.id] = (Number(prev[method.id]) || 0) + value;
        return next;
      });
      setPayModalKeypadInput('');
    } else {
      setPaymentAmounts((prev) => {
        if ((Number(prev[INVOICE_METHOD_ID]) || 0) <= 0.009) return prev;
        return { ...prev, [INVOICE_METHOD_ID]: 0 };
      });
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
    setPaymentAmounts(Object.fromEntries(visiblePaymentMethods.map((m) => [m.id, 0])));
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

    setTerminalChargeAmount(amount);
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
    const initialQr = startData?.qrcodeUrl || null;
    setPayworldStatus({
      state: 'IN_PROGRESS',
      message: initialQr
        ? tr('orderPanel.bancontactScanQr', 'Scan the QR code with your Bancontact or banking app.')
        : `Payment in progress on ${providerLabel} terminal...`,
      details: initialQr ? { qrcodeUrl: initialQr } : null,
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
      const mergedDetails =
        details && typeof details === 'object'
          ? { ...details, qrcodeUrl: details.qrcodeUrl || initialQr || undefined }
          : initialQr
            ? { qrcodeUrl: initialQr }
            : null;
      setPayworldStatus({
        state: state || 'IN_PROGRESS',
        message: statusMessage || `Payment in progress on ${providerLabel} terminal...`,
        details: mergedDetails,
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
    setShowInvoiceChoiceModal(false);
    setInvoiceDeliverySelection(null);
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

  const runSettlementAfterTerminals = async (settlementOpts) => {
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
      const bancontactproTotal = sumAmountsByIntegration(activePaymentMethods, paymentAmounts, 'bancontactpro');
      if (bancontactproTotal > 0) {
        await runCardTerminalPayment('bancontactpro', bancontactproTotal);
      }
      const methodsForSettlement = visiblePaymentMethods.filter((m) => m.id !== INVOICE_METHOD_ID);
      await onProceedAfterTerminals(methodsForSettlement, paymentAmounts, payModalTargetTotal, settlementOpts);
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

  const handleConfirmPayment = async () => {
    if (payConfirmLoading) return;
    if (paymentMethodsLoading || visiblePaymentMethods.length === 0) {
      reportError(tr('orderPanel.noPaymentMethods', 'No active payment methods. Add them under Control → Payment types.'));
      return;
    }

    const assignedTotal = roundCurrency(
      visiblePaymentMethods.reduce((sum, m) => sum + (Number(paymentAmounts[m.id]) || 0), 0),
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
    if (!visiblePaymentMethods.length) {
      reportError(
        tr('orderPanel.noPaymentMethods', 'No active payment methods. Add them under Control → Payment types.'),
      );
      return;
    }

    if (isInvoiceOnlyCheckout) {
      setInvoiceDeliverySelection(null);
      setShowInvoiceChoiceModal(true);
      return;
    }

    await runSettlementAfterTerminals(undefined);
  };

  /** Leave invoice UI open until parent sets `open` false; closing here would flash Pay differently again. */
  const handleInvoiceDeliveryChoice = async (invoiceDelivery) => {
    await runSettlementAfterTerminals({ invoiceDelivery });
  };

  const handleInvoiceChoiceOk = async () => {
    if (!invoiceDeliverySelection || payConfirmLoading) return;
    await handleInvoiceDeliveryChoice(invoiceDeliverySelection);
  };

  if (!open) return null;

  return (
    <>
      {!showInvoiceChoiceModal ? (
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
                ) : visiblePaymentMethods.length === 0 ? (
                  <div className="col-span-full text-sm text-amber-900 py-6 text-center max-w-lg px-4">
                    {tr(
                      'orderPanel.noPaymentMethods',
                      'No active payment methods. Configure them under Control → Payment types.',
                    )}
                  </div>
                ) : (
                  visiblePaymentMethods.map((m) => {
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
                          integ === 'invoice' ||
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
                visiblePaymentMethods.length === 0
              }
              className={`w-[140px] py-2 px-4 rounded-lg text-sm font-medium ${
                Math.abs(payModalTotalAssigned - payModalTargetTotal) > 0.009 ||
                payConfirmLoading ||
                paymentMethodsLoading ||
                visiblePaymentMethods.length === 0
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
      ) : null}

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
                <span className="font-semibold">
                  € {(terminalChargeAmount > 0 ? terminalChargeAmount : payModalTargetTotal).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-2xl">
                <span>{tr('orderPanel.payworldStatusLabel', 'Status')}:</span>
                <span className="font-semibold">{payworldStatusTitle}</span>
              </div>
              {payworldStatus.message ? (
                <div className="rounded-md bg-pos-surface px-4 py-3 text-xl whitespace-pre-line">{payworldStatus.message}</div>
              ) : null}
              {payworldStatus.details?.qrcodeUrl ? (
                <div className="flex flex-col items-center gap-3 pt-2">
                  <img
                    src={payworldStatus.details.qrcodeUrl}
                    alt=""
                    className="w-[280px] h-[280px] max-w-full bg-white p-2 rounded-lg border border-pos-border"
                  />
                </div>
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

      {showInvoiceChoiceModal ? (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invoice-delivery-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl ring-1 ring-black/5">
            <div className="border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white px-6 py-4">
              <h2 id="invoice-delivery-title" className="text-lg font-semibold tracking-tight text-gray-900">
                {tr('orderPanel.invoiceChoiceTitle', 'Send invoice')}
              </h2>
            </div>

            <div className="px-6 pb-6 pt-5">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={payConfirmLoading}
                  className={`flex min-h-[112px] flex-col items-center justify-center gap-2.5 rounded-xl border-2 px-3 py-4 text-center transition-all disabled:opacity-50 ${
                    invoiceDeliverySelection === 'direct'
                      ? 'border-emerald-600 bg-emerald-50 shadow-md'
                      : 'border-gray-200 bg-white shadow-sm hover:border-gray-300 hover:bg-gray-50/80 active:scale-[0.98]'
                  }`}
                  onClick={() => setInvoiceDeliverySelection('direct')}
                >
                  <InvoiceDirectUserIcon
                    className={`h-11 w-11 shrink-0 ${
                      invoiceDeliverySelection === 'direct' ? 'text-emerald-700' : 'text-gray-600'
                    }`}
                  />
                  <span
                    className={`text-sm font-semibold leading-snug ${
                      invoiceDeliverySelection === 'direct' ? 'text-emerald-950' : 'text-gray-800'
                    }`}
                  >
                    {tr('orderPanel.invoiceSendDirectly', 'Send Invoice directly')}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={payConfirmLoading}
                  className={`flex min-h-[112px] flex-col items-center justify-center gap-2.5 rounded-xl border-2 px-3 py-4 text-center transition-all disabled:opacity-50 ${
                    invoiceDeliverySelection === 'webpanel'
                      ? 'border-emerald-600 bg-emerald-50 shadow-md'
                      : 'border-gray-200 bg-white shadow-sm hover:border-gray-300 hover:bg-gray-50/80 active:scale-[0.98]'
                  }`}
                  onClick={() => setInvoiceDeliverySelection('webpanel')}
                >
                  <InvoiceWebpanelGlobeIcon
                    className={`h-11 w-11 shrink-0 ${
                      invoiceDeliverySelection === 'webpanel' ? 'text-emerald-700' : 'text-gray-600'
                    }`}
                  />
                  <span
                    className={`text-sm font-semibold leading-snug ${
                      invoiceDeliverySelection === 'webpanel' ? 'text-emerald-950' : 'text-gray-800'
                    }`}
                  >
                    {tr('orderPanel.invoiceSendWebpanel', 'Send to webpanel')}
                  </span>
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-gray-100 pt-5">
                <button
                  type="button"
                  disabled={payConfirmLoading}
                  className="min-h-[52px] rounded-xl border-2 border-gray-200 bg-white py-3 text-base font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => {
                    setShowInvoiceChoiceModal(false);
                    setInvoiceDeliverySelection(null);
                  }}
                >
                  {tr('orderPanel.invoiceChoiceBack', 'Back')}
                </button>
                <button
                  type="button"
                  disabled={payConfirmLoading || !invoiceDeliverySelection}
                  className={`min-h-[52px] rounded-xl py-3 text-base font-semibold shadow-sm transition-colors ${
                    payConfirmLoading || !invoiceDeliverySelection
                      ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800'
                  }`}
                  onClick={() => void handleInvoiceChoiceOk()}
                >
                  {payConfirmLoading ? t('processing') : t('ok')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
