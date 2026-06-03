import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { POS_API_PREFIX as API } from '../lib/apiOrigin.js';
import { printInWaitingHoldTicket } from '../lib/inWaitingHoldTicketPrint.js';
import { publicAssetUrl } from '../lib/publicAssetUrl.js';
import { buildPaymentBreakdown, formatPaymentAmount, roundCurrency, sumAmountsByIntegration } from '../lib/payDifferentlyUtils.js';
import { InWaitingNameModal } from './InWaitingNameModal';
import { InPlanningDateTimeModal } from './InPlanningDateTimeModal';
import { PayDifferentlyModal } from './PayDifferentlyModal.jsx';

const KEYPAD = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['C', '0', '.']
];

const formatSubtotalPrice = (n) => `€ ${Number(n).toFixed(2).replace('.', ',')}`;

/** Scale line notes like "350g" (zero extra price) — show inline as (350g), not as a sub-line. */
const WEIGHT_NOTE_LABEL_RE = /^\d+\s*g$/i;

function isWeegschaalWeightNoteToken(note) {
  return (Number(note?.price) || 0) === 0 && WEIGHT_NOTE_LABEL_RE.test(String(note?.label || '').trim());
}

/** Unique key for a line on the ticket (may span several open orders when merged for display). */
function ticketLineKey(orderId, itemId) {
  return `${String(orderId)}:${String(itemId)}`;
}

/** Modifier / sub-product row under a ticket line (note index matches getItemNotes order). */
function ticketSubLineKey(orderId, itemId, noteIndex) {
  return `${ticketLineKey(orderId, itemId)}#n${noteIndex}`;
}

function ticketKeyOrderId(key) {
  const s = String(key);
  const c = s.indexOf(':');
  return c >= 0 ? s.slice(0, c) : '';
}

function ticketKeyItemId(key) {
  const s = String(key);
  const c = s.indexOf(':');
  if (c < 0) return null;
  const rest = s.slice(c + 1);
  const h = rest.indexOf('#');
  return (h >= 0 ? rest.slice(0, h) : rest) || null;
}

function parseItemNotesTokensForStrike(item) {
  const parseNoteToken = (token) => {
    const raw = String(token || '').trim();
    if (!raw) return null;
    const [labelPart, pricePart] = raw.split('::');
    const label = String(labelPart || '').trim();
    if (!label) return null;
    if (pricePart == null) return { label, price: 0 };
    const parsed = Number(pricePart);
    if (!Number.isFinite(parsed)) return { label, price: 0 };
    return { label, price: parsed };
  };
  return String(item?.notes || '')
    .split(/[;,]/)
    .map((n) => parseNoteToken(n))
    .filter(Boolean);
}

function normalizeTicketStrikePayload(raw) {
  try {
    if (raw == null || raw === '') return { parent: false, noteIndexes: [] };
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!o || typeof o !== 'object') return { parent: false, noteIndexes: [] };
    const noteIndexes = Array.isArray(o.noteIndexes)
      ? o.noteIndexes.map((x) => Math.floor(Number(x))).filter((n) => n >= 0 && n < 500)
      : [];
    return { parent: Boolean(o.parent), noteIndexes };
  } catch {
    return { parent: false, noteIndexes: [] };
  }
}

function ticketStrikeStateToDeleteKeys(orderId, item) {
  const notes = parseItemNotesTokensForStrike(item);
  const { parent, noteIndexes } = normalizeTicketStrikePayload(item?.ticketStrikeJson);
  const lineK = ticketLineKey(orderId, item.id);
  const set = new Set();
  if (notes.length === 0) {
    if (parent) set.add(lineK);
    return set;
  }
  if (parent) set.add(lineK);
  const idxSet = new Set(noteIndexes);
  for (let i = 0; i < notes.length; i++) {
    if (idxSet.has(i)) set.add(ticketSubLineKey(orderId, item.id, i));
  }
  return set;
}

function deleteMarkSetToStrikeJson(orderId, item, markSet) {
  const notes = parseItemNotesTokensForStrike(item);
  const lineK = ticketLineKey(orderId, item.id);
  if (notes.length === 0) {
    return markSet.has(lineK) ? JSON.stringify({ parent: true, noteIndexes: [] }) : null;
  }
  const parent = markSet.has(lineK);
  const idxs = [];
  for (let i = 0; i < notes.length; i++) {
    if (markSet.has(ticketSubLineKey(orderId, item.id, i))) idxs.push(i);
  }
  if (!parent && idxs.length === 0) return null;
  return JSON.stringify({ parent, noteIndexes: idxs.sort((a, b) => a - b) });
}

function canonicalTicketStrikeJson(raw) {
  if (raw == null || raw === '') return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return null;
    const parent = Boolean(o.parent);
    const noteIndexes = Array.isArray(o.noteIndexes)
      ? [...new Set(o.noteIndexes.map((x) => Math.floor(Number(x))).filter((n) => n >= 0 && n < 500))].sort((a, b) => a - b)
      : [];
    return JSON.stringify({ parent, noteIndexes });
  } catch {
    return String(raw);
  }
}

/** Same rules as ticket UI `ticketLineMarked` / `ticketSubLineMarked`, using a mark set (e.g. ticketDeleteMarkIds). */
function ticketLineMarkedWithSet(orderId, item, markSet) {
  if (item?.id == null || orderId == null) return false;
  if (markSet.has(ticketLineKey(orderId, item.id))) return true;
  const notes = parseItemNotesTokensForStrike(item);
  if (notes.length === 0) return false;
  return notes.every((_, idx) => markSet.has(ticketSubLineKey(orderId, item.id, idx)));
}

function ticketSubLineMarkedWithSet(orderId, itemId, noteIdx, markSet) {
  return markSet.has(ticketSubLineKey(orderId, itemId, noteIdx));
}

/**
 * Payable line total for an order item: excludes void/strike marks (matches ticket strikethrough).
 */
function computeItemPayableWithStrikeMarks(orderId, item, markSet) {
  const qty = Math.max(1, Number(item?.quantity) || 1);
  const full = roundCurrency((Number(item?.price) || 0) * qty);
  if (orderId == null || item?.id == null) return full;

  /** Weighed articles: `item.price` is the full line unit price (incl. weight); do not split using catalog €/kg. */
  if (item?.product?.weegschaal) {
    if (ticketLineMarkedWithSet(orderId, item, markSet)) return 0;
    return full;
  }

  const notes = parseItemNotesTokensForStrike(item);

  if (ticketLineMarkedWithSet(orderId, item, markSet)) return 0;

  if (notes.length === 0) return full;

  const productBase = Number(item?.product?.price);
  const noteUnitTotal = notes.reduce((sum, note) => sum + (Number(note?.price) || 0), 0);
  const baseUnit = Number.isFinite(productBase)
    ? roundCurrency(productBase)
    : roundCurrency(Math.max(0, (Number(item?.price) || 0) - noteUnitTotal));
  const base = roundCurrency(baseUnit * qty);
  let sub = 0;
  for (let i = 0; i < notes.length; i++) {
    if (!ticketSubLineMarkedWithSet(orderId, item.id, i, markSet)) {
      sub += roundCurrency((Number(notes[i]?.price) || 0) * qty);
    }
  }
  return roundCurrency(base + sub);
}

function computeOrderTotalWithStrikeMarks(sourceOrder, markSet) {
  const oid = sourceOrder?.id;
  return roundCurrency((sourceOrder?.items || []).reduce((sum, item) => sum + computeItemPayableWithStrikeMarks(oid, item, markSet), 0));
}

/** Solid product-palette color for toolbar SVG icons (mask). */
function toolbarIconMaskStyle(assetPath, hex) {
  const u = publicAssetUrl(assetPath);
  return {
    backgroundColor: hex,
    maskImage: `url("${u}")`,
    WebkitMaskImage: `url("${u}")`,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
  };
}

/** Allocate payment breakdown proportionally across orders. totalOfAllOrders = sum of order totals. */
function allocatePaymentBreakdown(paymentBreakdown, orderTotal, totalOfAllOrders) {
  if (!paymentBreakdown?.amounts || totalOfAllOrders <= 0) return paymentBreakdown;
  const ratio = orderTotal / totalOfAllOrders;
  const allocated = {};
  for (const [methodId, amt] of Object.entries(paymentBreakdown.amounts)) {
    const allocatedAmt = roundCurrency(amt * ratio);
    if (allocatedAmt > 0.0001) allocated[methodId] = allocatedAmt;
  }
  return Object.keys(allocated).length > 0 ? { amounts: allocated } : null;
}

export function OrderPanel({
  order,
  orders,
  onRemoveItem,
  onUpdateItemQuantity,
  onStatusChange,
  /** When true, first transition to “In waiting” prints a small barcode ticket on the main printer. */
  ordersPrintBarcodeAfterCreate = false,
  /** After a normal paid checkout: clear focus only. Do not POST a new empty order (next sale creates an order on first line). */
  onAfterPaidCheckout,
  onRemoveAllOrders,
  showSubtotalView = false,
  subtotalBreaks = [],
  onPaymentCompleted,
  currentUser = null,
  currentTime = '',
  quantityInput = '',
  setQuantityInput,
  showInWaitingButton = false,
  showInPlanningButton = true,
  onOpenInPlanning,
  onOpenInWaiting,
  onSaveInWaitingAndReset,
  onVariousRequested,
  /** When set, ticket shows this in_waiting order’s lines after the open `order` lines (hold-ticket scan while building a basket). */
  appendedInWaitingOrder = null,
  focusedOrderId = null,
  focusedOrderInitialItemCount = 0,
  /** When true, USB wedge barcode input is ignored (e.g. another surface modal is open). */
  barcodeScanPaused = false,
  /** Called immediately when a USB wedge scan completes (valid barcode + Enter/Tab). */
  onApplyScannedBarcode = null
}) {
  const { t } = useLanguage();
  const tr = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const [fallbackQuantity, setFallbackQuantity] = useState('');
  const displayQuantity = setQuantityInput ? (quantityInput ?? '') : fallbackQuantity;
  const setDisplayQuantity = setQuantityInput || setFallbackQuantity;
  const [selectedLineKeys, setSelectedLineKeys] = useState([]);
  /** Line ids shown with red strikethrough in the ticket only (does not remove from order). */
  const [ticketDeleteMarkIds, setTicketDeleteMarkIds] = useState(() => new Set());
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showInWaitingNameModal, setShowInWaitingNameModal] = useState(false);
  const [showPayNowOrLaterModal, setShowPayNowOrLaterModal] = useState(false);
  const [showInPlanningDateTimeModal, setShowInPlanningDateTimeModal] = useState(false);
  const [inPlanningCalendarAction, setInPlanningCalendarAction] = useState(null); // 'payNow' | 'inPlanning'
  const payNowFromInWaitingRef = useRef(false); // When Yes → calendar → Save → payment: after success, set status to in_planning
  const [showPayDifferentlyModal, setShowPayDifferentlyModal] = useState(false);
  const [showPayworldStatusModal, setShowPayworldStatusModal] = useState(false);
  const [payworldStatus, setPayworldStatus] = useState({ state: 'IDLE', message: '', details: null });
  const [terminalChargeAmount, setTerminalChargeAmount] = useState(0);
  const [payModalTargetTotal, setPayModalTargetTotal] = useState(0);
  const [payConfirmLoading, setPayConfirmLoading] = useState(false);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState('');
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState('');
  const [showFinalSettlementModal, setShowFinalSettlementModal] = useState(false);
  const [showSettlementSubtotalModal, setShowSettlementSubtotalModal] = useState(false);
  const [settlementModalType, setSettlementModalType] = useState('subtotal');
  const [pendingSplitCheckout, setPendingSplitCheckout] = useState(null);
  const [subtotalLineGroups, setSubtotalLineGroups] = useState([]);
  const [subtotalSelectedLeftIds, setSubtotalSelectedLeftIds] = useState([]);
  const [subtotalSelectedRightIds, setSubtotalSelectedRightIds] = useState([]);
  const splitRightPanelScrollRef = useRef(null);
  const orderListScrollRef = useRef(null);
  const activeCashmaticSessionIdRef = useRef(null);
  const cancelCashmaticRequestedRef = useRef(false);
  const activePayworldSessionIdRef = useRef(null);
  const activePayworldProviderRef = useRef('payworld');
  const cancelPayworldRequestedRef = useRef(false);
  /** When paying “open basket + scanned in-waiting”, snapshot ids at checkout start so settlement still merges if focus/wait props clear during terminal wait. */
  const mergePaySidecarSnapshotRef = useRef(null);

  const CARD_INTEGRATIONS = ['payworld', 'ccv', 'viva', 'viva-wallet', 'worldline', 'bancontactpro'];

  const usbScanBufferRef = useRef('');
  const usbScanLastTsRef = useRef(0);
  const onApplyScannedBarcodeRef = useRef(onApplyScannedBarcode);
  onApplyScannedBarcodeRef.current = onApplyScannedBarcode;

  const total = order?.total ?? 0;
  const items = order?.items ?? [];
  const waitAppend = appendedInWaitingOrder;
  const appendWaitItems = Array.isArray(waitAppend?.items) ? waitAppend.items : [];
  const isMergeAppendWaiting =
    Boolean(
      waitAppend?.id &&
        order?.id &&
        String(waitAppend.id) !== String(order.id) &&
        appendWaitItems.length > 0 &&
        String(order?.status ?? 'open') === 'open'
    );
  const waitingOrderForUi =
    isMergeAppendWaiting ? waitAppend : order?.status === 'in_waiting' ? order : null;

  const TICKET_DELETE_MARK_CLASS = 'line-through decoration-2 decoration-red-600 text-red-600';

  useEffect(() => {
    if (orderListScrollRef.current && (items.length > 0 || appendWaitItems.length > 0)) {
      orderListScrollRef.current.scrollTop = orderListScrollRef.current.scrollHeight;
    }
  }, [items.length, appendWaitItems.length, items, appendWaitItems]);

  useEffect(() => {
    if (!onApplyScannedBarcode) return undefined;

    const INTER_KEY_MS = 85;
    const MIN_LEN = 3;
    const isBarcodeChar = (ch) => /[A-Za-z0-9+\-./_*$]/.test(ch);
    const isCompleteBarcode = (s) => {
      const t = s.trim();
      return t.length >= MIN_LEN && [...t].every(isBarcodeChar);
    };

    const usbScanBlocked = () =>
      barcodeScanPaused ||
      showPayDifferentlyModal ||
      showDeleteAllModal ||
      showInWaitingNameModal ||
      showPayNowOrLaterModal ||
      showInPlanningDateTimeModal ||
      showPayworldStatusModal ||
      showFinalSettlementModal ||
      showSettlementSubtotalModal ||
      payConfirmLoading ||
      Boolean(paymentErrorMessage) ||
      Boolean(paymentSuccessMessage);

    const finishScan = (raw, event) => {
      const code = String(raw ?? '').trim();
      if (!isCompleteBarcode(code)) return false;
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const fn = onApplyScannedBarcodeRef.current;
      if (typeof fn === 'function') void Promise.resolve(fn(code)).catch(() => {});
      return true;
    };

    const onKeyDown = (event) => {
      if (usbScanBlocked()) return;

      const t = event.target;
      if (t instanceof HTMLElement && t.tagName === 'INPUT' && t.type === 'file') return;

      if (event.key === 'Escape') {
        usbScanBufferRef.current = '';
        usbScanLastTsRef.current = 0;
        return;
      }

      const now = Date.now();

      if (event.key === 'Enter' || event.key === 'Tab') {
        const buf = usbScanBufferRef.current;
        usbScanBufferRef.current = '';
        usbScanLastTsRef.current = 0;
        if (buf.length > 0) finishScan(buf, event);
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (!isBarcodeChar(event.key)) {
          usbScanBufferRef.current = '';
          usbScanLastTsRef.current = now;
          return;
        }
        if (now - usbScanLastTsRef.current > INTER_KEY_MS) {
          usbScanBufferRef.current = '';
        }
        usbScanLastTsRef.current = now;
        const prevLen = usbScanBufferRef.current.length;
        usbScanBufferRef.current += event.key;
        if (prevLen >= 1) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      usbScanBufferRef.current = '';
      usbScanLastTsRef.current = 0;
    };
  }, [
    onApplyScannedBarcode,
    barcodeScanPaused,
    showPayDifferentlyModal,
    showDeleteAllModal,
    showInWaitingNameModal,
    showPayNowOrLaterModal,
    showInPlanningDateTimeModal,
    showPayworldStatusModal,
    showFinalSettlementModal,
    showSettlementSubtotalModal,
    payConfirmLoading,
    paymentErrorMessage,
    paymentSuccessMessage
  ]);

  const hasOrderItems = items.length > 0 || appendWaitItems.length > 0;
  const cashierName = currentUser?.label || currentUser?.name || 'admin';
  /** Attach logged-in cashier to order PATCH (paid / in_planning) so DB `Order.userId` is set. */
  const withOrderActorUserId = (opts) => {
    const uid = currentUser?.id;
    if (!uid) return opts;
    return { ...opts, userId: uid };
  };
  const savedTableOrderIds = [];
  const savedOrderMetaById = new Map();
  const isSavedTableOrder = false;
  const savedOrdersForSelectedTable = [];
  const showSettlementActions = false;
  const settlementSubtotalLines = savedOrdersForSelectedTable.flatMap((savedOrder) =>
    (savedOrder?.items || []).map((item, itemIndex) => ({
      id: `${savedOrder.id}:${item?.id || itemIndex}`,
      label: `${Math.max(1, Number(item?.quantity) || 1)}x ${item?.product?.name ?? '—'}`,
      amount: computeItemPayableWithStrikeMarks(savedOrder.id, item, ticketDeleteMarkIds)
    }))
  );
  const settlementSubtotalLineById = new Map(settlementSubtotalLines.map((line) => [line.id, line]));
  const subtotalAssignedLineIds = new Set(subtotalLineGroups.flatMap((group) => group?.lineIds || []));
  const settlementSubtotalLeftLines = settlementSubtotalLines.filter((line) => !subtotalAssignedLineIds.has(line.id));
  const settlementSubtotalRightGroups = subtotalLineGroups
    .map((group, index) => {
      const lines = (group?.lineIds || []).map((id) => settlementSubtotalLineById.get(id)).filter(Boolean);
      return {
        id: group?.id || `group-${index + 1}`,
        label: `${t('group')} ${index + 1}`,
        lines,
        total: roundCurrency(lines.reduce((sum, line) => sum + (Number(line?.amount) || 0), 0))
      };
    })
    .filter((group) => group.lines.length > 0);
  const hasSplitBillSelection = settlementSubtotalRightGroups.some((group) => group.lines.length > 0);
  const splitSelectedLineIds = settlementSubtotalRightGroups.flatMap((group) => group.lines.map((line) => line.id));
  const splitSelectedTotal = roundCurrency(settlementSubtotalRightGroups.reduce((sum, group) => sum + (Number(group.total) || 0), 0));
  const scrollSplitRightPanel = (direction) => {
    const el = splitRightPanelScrollRef.current;
    if (!el) return;
    el.scrollTop += direction * 120;
  };
  const computeOrderTotal = (sourceOrder) => computeOrderTotalWithStrikeMarks(sourceOrder, ticketDeleteMarkIds);
  const appendBlockTotal =
    waitAppend && appendWaitItems.length > 0 ? computeOrderTotal(waitAppend) : 0;
  const openLinesTotal = items.length > 0 ? computeOrderTotal(order) : 0;
  const currentOrderTotal =
    items.length > 0 || appendWaitItems.length > 0
      ? roundCurrency(openLinesTotal + appendBlockTotal)
      : roundCurrency(total);
  const settlementOrdersTotal = roundCurrency(savedOrdersForSelectedTable.reduce((sum, sourceOrder) => sum + computeOrderTotal(sourceOrder), 0));
  const payableTotal = showSettlementActions ? settlementOrdersTotal : currentOrderTotal;
  const latestOpenNoTableOrder = (orders || [])
    .filter((o) => o?.status === 'open' && (o?.tableId == null || o?.tableId === ''))
    .reduce((latest, candidate) => {
      if (!latest) return candidate;
      const latestTime = new Date(latest?.createdAt || 0).getTime();
      const candidateTime = new Date(candidate?.createdAt || 0).getTime();
      return candidateTime >= latestTime ? candidate : latest;
    }, null);
  const fallbackNoTableTotal = latestOpenNoTableOrder
    ? (Array.isArray(latestOpenNoTableOrder.items) && latestOpenNoTableOrder.items.length > 0
      ? computeOrderTotal(latestOpenNoTableOrder)
      : roundCurrency(Number(latestOpenNoTableOrder?.total) || 0))
    : 0;
  const payableTotalForPaymentModal =
    payableTotal <= 0.009 && fallbackNoTableTotal > 0.009 ? fallbackNoTableTotal : payableTotal;
  const getItemLabel = (item) => item?.product?.name ?? '—';
  const parseNoteToken = (token) => {
    const raw = String(token || '').trim();
    if (!raw) return null;
    const [labelPart, pricePart] = raw.split('::');
    const label = String(labelPart || '').trim();
    if (!label) return null;
    if (pricePart == null) return { label, price: 0 };
    const parsed = Number(pricePart);
    if (!Number.isFinite(parsed)) return { label, price: 0 };
    return { label, price: parsed };
  };
  const getItemNotes = (item) =>
    String(item?.notes || '')
      .split(/[;,]/)
      .map((n) => parseNoteToken(n))
      .filter(Boolean);
  const weegschaalWeightTitleSuffix = (item) => {
    if (!item?.product?.weegschaal) return '';
    const w = getItemNotes(item).filter(isWeegschaalWeightNoteToken);
    return w.length ? ` (${w.map((n) => String(n.label).trim()).join(', ')})` : '';
  };
  const getItemQuantity = (item) => Math.max(1, Number(item?.quantity) || 1);
  const getItemNoteUnitTotal = (item) =>
    roundCurrency(getItemNotes(item).reduce((sum, note) => sum + (Number(note?.price) || 0), 0));
  const getItemBaseUnitPrice = (item) => {
    const orderUnitPrice = Number(item?.price);
    if (Number.isFinite(orderUnitPrice)) {
      // Use persisted order-item price first so custom-priced lines (e.g. Various) render correctly.
      return roundCurrency(Math.max(0, orderUnitPrice - getItemNoteUnitTotal(item)));
    }
    const productBase = Number(item?.product?.price);
    if (Number.isFinite(productBase)) return roundCurrency(productBase);
    return 0;
  };
  const getItemBaseLinePrice = (item) => roundCurrency(getItemBaseUnitPrice(item) * getItemQuantity(item));
  const getItemNoteLinePrice = (item, note) => roundCurrency((Number(note?.price) || 0) * getItemQuantity(item));
  const formatSavedOrderTime = (dateLike, fallbackDateLike = null) => {
    const d = new Date(dateLike || fallbackDateLike || Date.now());
    if (Number.isNaN(d.getTime())) return currentTime || '';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  };
  const formatOrderTimestamp = (dateLike) => {
    try {
      const d = new Date(dateLike);
      if (Number.isNaN(d.getTime())) return '–';
      const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
      const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      return `${dateStr} ${timeStr}`;
    } catch {
      return '–';
    }
  };
  const customerDisplayName = order?.customer ? (order.customer.companyName || order.customer.name) : null;
  const isViewedFromInWaitingSole = !!(
    order?.status === 'in_waiting' &&
    focusedOrderId &&
    order.id === focusedOrderId
  );
  const isViewedFromInPlanning = !!(order?.id && focusedOrderId && order.id === focusedOrderId && order?.status === 'in_planning');
  const isViewedFromInWaiting = !!(
    waitingOrderForUi &&
    focusedOrderId &&
    String(waitingOrderForUi.id) === String(focusedOrderId)
  );
  /** +/- quantity: disabled only when the whole ticket is a locked in_waiting / in_planning order (not merge-append). */
  const quantityToolbarDisabled = isViewedFromInPlanning || isViewedFromInWaitingSole;
  const payDifferentlyDisabled =
    payableTotalForPaymentModal <= 0.009 &&
    !((isViewedFromInWaitingSole || isViewedFromInPlanning) && hasOrderItems) &&
    !(hasOrderItems && order?.id);
  const parseBatchDataForOrder = (o) => {
    let boundaries = [];
    let meta = [];
    try {
      if (o?.itemBatchBoundariesJson) {
        boundaries = JSON.parse(o.itemBatchBoundariesJson);
        if (!Array.isArray(boundaries)) boundaries = [];
      }
      if (o?.itemBatchMetaJson) {
        meta = JSON.parse(o.itemBatchMetaJson);
        if (!Array.isArray(meta)) meta = [];
      }
    } catch {
      /* ignore parse errors */
    }
    if (
      boundaries.length === 0 &&
      (focusedOrderInitialItemCount ?? 0) > 0 &&
      o?.id &&
      String(o.id) === String(focusedOrderId)
    ) {
      boundaries = [focusedOrderInitialItemCount];
      meta = [{ userId: o?.userId, userName: o?.user?.name, createdAt: o?.createdAt }];
    }
    return { boundaries, meta };
  };
  const { boundaries: batchBoundaries, meta: batchMeta } =
    waitingOrderForUi && String(waitingOrderForUi.id) === String(focusedOrderId)
      ? parseBatchDataForOrder(waitingOrderForUi)
      : { boundaries: [], meta: [] };
  const lastSavedBoundary = batchBoundaries.length > 0 ? batchBoundaries[batchBoundaries.length - 1] : 0;
  const waitUiItems = Array.isArray(waitingOrderForUi?.items) ? waitingOrderForUi.items : [];
  const inWaitingButtonDisabled =
    isViewedFromInWaiting && waitUiItems.length > 0 && waitUiItems.length <= lastSavedBoundary;

  const isOrderIdSavedToTable = (_oid) => false;

  /** Strikethrough / ticketStrikeJson only for “Add to table” batches or in-waiting locked batches — not draft lines. */
  const itemRowOrderedForStrike = (lineOrderId, item) => {
    if (isOrderIdSavedToTable(lineOrderId)) return true;
    if (!waitingOrderForUi || String(waitingOrderForUi.id) !== String(lineOrderId)) return false;
    const list = waitingOrderForUi.items || [];
    const idx = list.findIndex((it) => String(it.id) === String(item.id));
    if (idx < 0) return false;
    return idx < lastSavedBoundary;
  };

  const ticketLineKeyIsOrderedForStrike = (key) => {
    const oid = ticketKeyOrderId(key);
    if (!oid) return false;
    if (isOrderIdSavedToTable(oid)) return true;
    const iid = ticketKeyItemId(key);
    if (!iid || !waitingOrderForUi || String(waitingOrderForUi.id) !== String(oid)) return false;
    const list = waitingOrderForUi.items || [];
    const idx = list.findIndex((it) => String(it.id) === String(iid));
    if (idx < 0) return false;
    return idx < lastSavedBoundary;
  };

  const toggleAllSubsForItem = (orderId, itemId, noteCount) => {
    const subs = Array.from({ length: noteCount }, (_, i) => ticketSubLineKey(orderId, itemId, i));
    setSelectedLineKeys((prev) => {
      const next = prev.filter((x) => x !== ticketLineKey(orderId, itemId));
      const allOn = subs.length > 0 && subs.every((sk) => next.includes(sk));
      if (allOn) return next.filter((x) => !subs.includes(x));
      return [...next.filter((x) => !subs.includes(x)), ...subs];
    });
  };

  const toggleSubLineSelection = (orderId, itemId, noteIdx) => {
    const subK = ticketSubLineKey(orderId, itemId, noteIdx);
    setSelectedLineKeys((prev) => {
      const next = prev.filter((x) => x !== ticketLineKey(orderId, itemId));
      return next.includes(subK) ? next.filter((x) => x !== subK) : [...next, subK];
    });
  };

  const toggleLineSelection = (orderId, itemId, noteCount) => {
    const lineK = ticketLineKey(orderId, itemId);
    if (noteCount === 0) {
      setSelectedLineKeys((prev) => (prev.includes(lineK) ? prev.filter((x) => x !== lineK) : [...prev, lineK]));
    } else {
      toggleAllSubsForItem(orderId, itemId, noteCount);
    }
  };

  const ticketLinesValidityKey = useMemo(
    () =>
      `${isSavedTableOrder ? 1 : 0}|${order?.id ?? ''}|${waitAppend?.id ?? ''}|${savedOrdersForSelectedTable
        .map((o) => `${o?.id}:${(o.items || []).map((it) => `${it?.id}:${String(it?.notes ?? '')}`).join('|')}`)
        .join(';')}|${!isSavedTableOrder && order?.id ? items.map((it) => `${it?.id}:${String(it?.notes ?? '')}`).join(',') : ''}|${waitAppend?.id ? appendWaitItems.map((it) => `${it?.id}:${String(it?.notes ?? '')}`).join(',') : ''}`,
    [savedOrdersForSelectedTable, isSavedTableOrder, order?.id, waitAppend?.id, items, appendWaitItems]
  );

  const ticketStrikeHydrateKey = useMemo(() => {
    const parts = [];
    for (const so of savedOrdersForSelectedTable) {
      for (const it of so.items || []) {
        parts.push(`${so.id}:${it?.id}:${String(it?.ticketStrikeJson ?? '')}`);
      }
    }
    if (order?.id) {
      for (const it of items) {
        parts.push(`${order.id}:${it?.id}:${String(it?.ticketStrikeJson ?? '')}`);
      }
    }
    if (waitAppend?.id) {
      for (const it of appendWaitItems) {
        parts.push(`${waitAppend.id}:${it?.id}:${String(it?.ticketStrikeJson ?? '')}`);
      }
    }
    return parts.join(';');
  }, [savedOrdersForSelectedTable, order?.id, waitAppend?.id, items, appendWaitItems]);

  const persistTicketStrikesForMarkSet = useCallback(
    async (nextMarkSet) => {
      const orderMap = new Map();
      if (order?.id) {
        orderMap.set(order.id, { ...order, items });
      }
      if (waitAppend?.id) {
        orderMap.set(waitAppend.id, { ...waitAppend, items: appendWaitItems });
      }
      const tasks = [];
      for (const [oid, o] of orderMap) {
        const arr = o.items || [];
        arr.forEach((it, itemIdx) => {
          if (!it?.id) return;
          const ordered =
            waitingOrderForUi?.id &&
            String(waitingOrderForUi.id) === String(oid) &&
            isViewedFromInWaiting &&
            itemIdx < lastSavedBoundary;
          const newJson = ordered ? deleteMarkSetToStrikeJson(oid, it, nextMarkSet) : null;
          const oldCanon = canonicalTicketStrikeJson(it.ticketStrikeJson);
          const newCanon = newJson == null ? null : canonicalTicketStrikeJson(newJson);
          if (oldCanon !== newCanon) {
            tasks.push(
              fetch(`${API}/orders/${oid}/items/${it.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketStrikeJson: newJson })
              })
            );
          }
        });
      }
      await Promise.all(tasks);
    },
    [order, items, waitAppend, appendWaitItems, isViewedFromInWaiting, waitingOrderForUi, lastSavedBoundary]
  );

  const wholeItemTicketSelected = (orderId, item) => {
    const notes = getItemNotes(item);
    if (notes.length === 0) return selectedLineKeys.includes(ticketLineKey(orderId, item.id));
    return notes.every((_, idx) => selectedLineKeys.includes(ticketSubLineKey(orderId, item.id, idx)));
  };

  const subLineTicketSelected = (orderId, itemId, noteIdx) =>
    selectedLineKeys.includes(ticketSubLineKey(orderId, itemId, noteIdx));

  const ticketLineMarked = (orderId, item) => {
    if (ticketDeleteMarkIds.has(ticketLineKey(orderId, item.id))) return true;
    const notes = getItemNotes(item);
    if (notes.length === 0) return false;
    return notes.every((_, idx) => ticketDeleteMarkIds.has(ticketSubLineKey(orderId, item.id, idx)));
  };

  const ticketSubLineMarked = (orderId, itemId, noteIdx) =>
    ticketDeleteMarkIds.has(ticketSubLineKey(orderId, itemId, noteIdx));

  const selectionOrderIds = new Set(selectedLineKeys.map((k) => ticketKeyOrderId(k)).filter(Boolean));
  const orderIdPrefix = order?.id != null ? `${String(order.id)}:` : '';

  const { quantitySelectionValid, selectedItems } = (() => {
    const oid = order?.id;
    if (oid == null || selectedLineKeys.length === 0) {
      return { quantitySelectionValid: false, selectedItems: [] };
    }
    const prefix = `${String(oid)}:`;
    const keys = selectedLineKeys.filter((k) => String(k).startsWith(prefix));
    if (keys.length === 0 || keys.length !== selectedLineKeys.length) {
      return { quantitySelectionValid: false, selectedItems: [] };
    }
    if (!selectionOrderIds.has(String(oid)) || selectionOrderIds.size !== 1) {
      return { quantitySelectionValid: false, selectedItems: [] };
    }
    let partial = false;
    const eligibleIds = new Set();
    const knownKeys = new Set();
    for (const it of items) {
      if (it?.id == null) continue;
      const iid = String(it.id);
      const lineK = ticketLineKey(oid, iid);
      const notes = getItemNotes(it);
      const subKs = notes.map((_, idx) => ticketSubLineKey(oid, iid, idx));
      subKs.forEach((sk) => knownKeys.add(sk));
      knownKeys.add(lineK);
      const hitLine = keys.includes(lineK);
      const hitSubs = subKs.filter((sk) => keys.includes(sk));
      if (notes.length === 0) {
        if (hitLine) eligibleIds.add(iid);
        continue;
      }
      if (hitLine && hitSubs.length > 0) partial = true;
      else if (hitLine) eligibleIds.add(iid);
      else if (hitSubs.length > 0) {
        if (hitSubs.length === notes.length) eligibleIds.add(iid);
        else partial = true;
      }
    }
    const orphan = keys.some((k) => !knownKeys.has(k));
    if (partial || orphan) return { quantitySelectionValid: false, selectedItems: [] };
    return {
      quantitySelectionValid: true,
      selectedItems: items.filter((it) => it?.id != null && eligibleIds.has(String(it.id)))
    };
  })();

  const hasSelection = selectedLineKeys.length > 0;
  const canDecreaseAll = selectedItems.length > 0 && selectedItems.every((i) => (i.quantity ?? 0) > 1);

  const renderTicketOrderLine = (orderId, item, keyPrefix, orderedForStrike = true) => {
    if (item?.id == null) return null;
    const notes = getItemNotes(item);
    const lineKey = `${keyPrefix}-${item.id}`;
    const whole = wholeItemTicketSelected(orderId, item);
    const parentMarked = orderedForStrike && ticketLineMarked(orderId, item);
    const weegschaal = !!item?.product?.weegschaal;
    const weightNotes = weegschaal ? notes.filter(isWeegschaalWeightNoteToken) : [];
    const titleWeightSuffix =
      weightNotes.length > 0 ? ` (${weightNotes.map((n) => String(n.label).trim()).join(', ')})` : '';
    const onlyWeightNotes = weegschaal && notes.length > 0 && notes.every(isWeegschaalWeightNoteToken);

    const renderMainLine = (suffix) => (
      <>
        <span className="flex-1 font-semibold">
          {item.quantity}x {getItemLabel(item)}
          {suffix}
        </span>
        <span className="font-semibold">€{getItemBaseLinePrice(item).toFixed(2)}</span>
      </>
    );

    if (notes.length === 0 || onlyWeightNotes) {
      return (
        <button
          key={lineKey}
          type="button"
          className={`flex flex-wrap items-center gap-1 p-2 py-1 text-sm rounded w-full text-left border-0 font-inherit cursor-pointer active:brightness-95 ${
            whole ? 'bg-[#1F8E41] text-white' : 'bg-transparent text-pos-bg'
          }`}
          onClick={() => toggleLineSelection(orderId, item.id, notes.length === 0 ? 0 : notes.length)}
        >
          <div className="w-full">
            <div className={`flex items-baseline justify-between ${parentMarked ? TICKET_DELETE_MARK_CLASS : ''}`}>
              {renderMainLine(onlyWeightNotes ? titleWeightSuffix : '')}
            </div>
          </div>
        </button>
      );
    }

    if (weegschaal && weightNotes.length > 0) {
      return (
        <div
          key={lineKey}
          className={`flex flex-col gap-0.5 rounded p-2 py-1 text-sm ${whole ? 'bg-[#1F8E41] text-white' : 'text-pos-bg'}`}
        >
          <div className={`flex items-baseline justify-between w-full px-0 ${parentMarked ? TICKET_DELETE_MARK_CLASS : ''}`}>
            {renderMainLine(titleWeightSuffix)}
          </div>
          {notes.map((note, noteIdx) => {
            if (isWeegschaalWeightNoteToken(note)) return null;
            const subSel = subLineTicketSelected(orderId, item.id, noteIdx);
            const subMrk = orderedForStrike && ticketSubLineMarked(orderId, item.id, noteIdx);
            const rowGreen = subSel && !whole;
            return (
              <button
                key={`${lineKey}-n-${noteIdx}`}
                type="button"
                className={`w-full text-left border-0 font-inherit rounded px-2 py-0.5 pl-6 text-sm cursor-pointer active:brightness-95 ${
                  rowGreen ? 'bg-[#1F8E41] text-white' : whole ? 'bg-transparent text-white' : 'bg-transparent text-pos-bg'
                } ${subMrk ? TICKET_DELETE_MARK_CLASS : ''}`}
                onClick={() => toggleSubLineSelection(orderId, item.id, noteIdx)}
              >
                <div className="flex items-baseline justify-between w-full opacity-90">
                  <span>▪ {note.label}</span>
                  <span>€{getItemNoteLinePrice(item, note).toFixed(2)}</span>
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div
        key={lineKey}
        className={`flex flex-col gap-0.5 rounded p-2 py-1 text-sm ${whole ? 'bg-[#1F8E41] text-white' : 'text-pos-bg'}`}
      >
        <div className={`flex items-baseline justify-between w-full px-0 ${parentMarked ? TICKET_DELETE_MARK_CLASS : ''}`}>
          {renderMainLine('')}
        </div>
        {notes.map((note, noteIdx) => {
          const subSel = subLineTicketSelected(orderId, item.id, noteIdx);
          const subMrk = orderedForStrike && ticketSubLineMarked(orderId, item.id, noteIdx);
          const rowGreen = subSel && !whole;
          return (
            <button
              key={`${lineKey}-n-${noteIdx}`}
              type="button"
              className={`w-full text-left border-0 font-inherit rounded px-2 py-0.5 pl-6 text-sm cursor-pointer active:brightness-95 ${
                rowGreen ? 'bg-[#1F8E41] text-white' : whole ? 'bg-transparent text-white' : 'bg-transparent text-pos-bg'
              } ${subMrk ? TICKET_DELETE_MARK_CLASS : ''}`}
              onClick={() => toggleSubLineSelection(orderId, item.id, noteIdx)}
            >
              <div className="flex items-baseline justify-between w-full opacity-90">
                <span>▪ {note.label}</span>
                <span>€{getItemNoteLinePrice(item, note).toFixed(2)}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    setSelectedLineKeys([]);
  }, [order?.id, waitAppend?.id]);

  useEffect(() => {
    const validKeys = new Set();
    const addTicketKeysForItem = (orderId, it) => {
      if (it?.id == null) return;
      validKeys.add(ticketLineKey(orderId, it.id));
      getItemNotes(it).forEach((_, idx) => validKeys.add(ticketSubLineKey(orderId, it.id, idx)));
    };
    for (const so of savedOrdersForSelectedTable) {
      for (const it of so.items || []) addTicketKeysForItem(so.id, it);
    }
    if (order?.id) {
      for (const it of items) addTicketKeysForItem(order.id, it);
    }
    if (waitAppend?.id) {
      for (const it of appendWaitItems) addTicketKeysForItem(waitAppend.id, it);
    }

    const fromServer = new Set();
    for (const so of savedOrdersForSelectedTable) {
      for (const it of so.items || []) {
        if (!it?.id) continue;
        ticketStrikeStateToDeleteKeys(so.id, it).forEach((k) => {
          if (validKeys.has(k)) fromServer.add(k);
        });
      }
    }
    if (order?.id) {
      for (const it of items) {
        if (!it?.id) continue;
        if (!itemRowOrderedForStrike(order.id, it)) continue;
        ticketStrikeStateToDeleteKeys(order.id, it).forEach((k) => {
          if (validKeys.has(k)) fromServer.add(k);
        });
      }
    }
    if (waitAppend?.id) {
      for (const it of appendWaitItems) {
        if (!it?.id) continue;
        if (!itemRowOrderedForStrike(waitAppend.id, it)) continue;
        ticketStrikeStateToDeleteKeys(waitAppend.id, it).forEach((k) => {
          if (validKeys.has(k)) fromServer.add(k);
        });
      }
    }

    setTicketDeleteMarkIds(fromServer);
    setSelectedLineKeys((prev) => {
      const next = prev.filter((k) => validKeys.has(k));
      return next.length === prev.length && prev.every((k, idx) => k === next[idx]) ? prev : next;
    });
  }, [ticketLinesValidityKey, ticketStrikeHydrateKey]);

  const handleKeypad = (key) => {
    if (key === 'C') {
      setDisplayQuantity('');
      return;
    }
    setDisplayQuantity((prev) => String(prev || '') + key);
  };

  const captureMergePaySidecarSnapshotForCheckout = () => {
    if (
      isMergeAppendWaiting &&
      order?.id != null &&
      waitAppend?.id != null &&
      String(order.id) !== String(waitAppend.id)
    ) {
      mergePaySidecarSnapshotRef.current = {
        openId: String(order.id),
        waitId: String(waitAppend.id),
      };
    } else {
      mergePaySidecarSnapshotRef.current = null;
    }
  };

  const openPayDifferentlyModal = (overrideTotal = null) => {
    const targetTotal = Math.max(0, roundCurrency(overrideTotal ?? payableTotalForPaymentModal));
    captureMergePaySidecarSnapshotForCheckout();
    setPayModalTargetTotal(targetTotal);
    setShowPayDifferentlyModal(true);
  };

  const handlePayDifferentlyClose = () => {
    payNowFromInWaitingRef.current = false;
    mergePaySidecarSnapshotRef.current = null;
    setPendingSplitCheckout(null);
    setShowPayDifferentlyModal(false);
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const runCashmaticPayment = async (amountEuro) => {
    const cents = Math.round((Number(amountEuro) || 0) * 100);
    if (cents <= 0) return;

    const startRes = await fetch(`${API}/cashmatic/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: cents })
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
        await fetch(`${API}/cashmatic/cancel/${encodeURIComponent(sessionId)}`, { method: 'POST' }).catch(() => { });
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

    await fetch(`${API}/cashmatic/cancel/${encodeURIComponent(sessionId)}`, { method: 'POST' }).catch(() => { });
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
      body: JSON.stringify({ amount })
    });
    const startData = await startRes.json().catch(() => ({}));
    if (!startRes.ok || startData?.ok === false) {
      throw new Error(startData?.error || `Unable to start ${providerLabel} payment.`);
    }

    const sessionId = startData?.sessionId || startData?.data?.sessionId;
    if (!sessionId) throw new Error(`${providerLabel} session did not start.`);

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
        await fetch(`${API}/${providerApi}/cancel/${encodeURIComponent(sessionId)}`, { method: 'POST' }).catch(() => { });
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

    await fetch(`${API}/${providerApi}/cancel/${encodeURIComponent(sessionId)}`, { method: 'POST' }).catch(() => { });
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

  const handleAbortPayworld = async () => {
    const activeSessionId = activePayworldSessionIdRef.current;
    const activeProvider = activePayworldProviderRef.current || 'payworld';
    const activeTerminalProviderLabel = String(activeProvider || 'payworld').toUpperCase();
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

    await fetch(`${API}/${activeProvider}/cancel/${encodeURIComponent(activeSessionId)}`, { method: 'POST' }).catch(() => { });
  };

  const payworldStatusTitle = (() => {
    switch (String(payworldStatus.state || '').toUpperCase()) {
      case 'IN_PROGRESS':
        return tr('orderPanel.payworldStatusInProgress', 'Payment in progress on terminal...');
      case 'APPROVED':
        return tr('orderPanel.payworldStatusApproved', 'Payment approved.');
      case 'DECLINED':
        return tr('orderPanel.payworldStatusDeclined', 'Payment declined.');
      case 'CANCELLED':
        return tr('orderPanel.payworldStatusCancelled', 'Payment cancelled.');
      case 'ERROR':
        return tr('orderPanel.payworldStatusError', 'Error during payment.');
      default:
        return tr('orderPanel.payworldStatusReady', 'Ready.');
    }
  })();
  const activeTerminalProviderLabel = String(activePayworldProviderRef.current || 'payworld').toUpperCase();

  const printTicketAutomatically = async (targetOrderId, paymentBreakdown = null) => {
    if (!targetOrderId) throw new Error('No order selected for printing.');
    const body = { orderId: targetOrderId };
    if (paymentBreakdown && typeof paymentBreakdown === 'object') body.paymentBreakdown = paymentBreakdown;
    const printRes = await fetch(`${API}/printers/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const printData = await printRes.json().catch(() => ({}));
    if (!printRes.ok) {
      throw new Error(printData?.error || 'Automatic ticket print failed.');
    }
    if (printData?.success !== true || printData?.data?.printed !== true) {
      throw new Error(printData?.error || 'Printer did not confirm successful print.');
    }
    return printData?.data || {};
  };
  const printCombinedReceiptsAutomatically = async (targetOrderIds, paymentBreakdown = null) => {
    if (!Array.isArray(targetOrderIds) || targetOrderIds.length < 2) {
      throw new Error('Combined receipt requires at least two orders.');
    }
    const body = { orderIds: targetOrderIds };
    if (paymentBreakdown && typeof paymentBreakdown === 'object') body.paymentBreakdown = paymentBreakdown;
    const printRes = await fetch(`${API}/printers/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const printData = await printRes.json().catch(() => ({}));
    if (!printRes.ok) {
      throw new Error(printData?.error || 'Automatic combined ticket print failed.');
    }
    if (printData?.success !== true || printData?.data?.printed !== true) {
      throw new Error(printData?.error || 'Printer did not confirm successful print.');
    }
    return printData?.data || {};
  };

  const toApiOrderItem = (item) => {
    const productId = String(item?.productId || item?.product?.id || '').trim();
    if (!productId) throw new Error('Split bill contains an item without product id.');
    return {
      productId,
      quantity: Math.max(1, Number(item?.quantity) || 1),
      price: Number(item?.price) || 0,
      notes: item?.notes || null
    };
  };

  const patchOrderItems = async (orderId, nextItems) => {
    const res = await fetch(`${API}/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: nextItems.map(toApiOrderItem) })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Failed to update split order items.');
    return data;
  };

  const createPaidSplitOrder = async (sourceItems, paymentBreakdown = null) => {
    const res = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: sourceItems.map(toApiOrderItem)
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id) {
      throw new Error(data?.error || 'Failed to create split checkout order.');
    }
    await onStatusChange?.(data.id, 'paid', withOrderActorUserId(paymentBreakdown ? { paymentBreakdown } : {}));
    return data.id;
  };

  const settleSplitBillSelection = async (selectedLineIds, paymentBreakdown = null) => {
    const selectedByOrderId = new Map();
    for (const lineId of selectedLineIds) {
      const [orderId, itemId] = String(lineId || '').split(':');
      if (!orderId || !itemId) continue;
      if (!selectedByOrderId.has(orderId)) selectedByOrderId.set(orderId, new Set());
      selectedByOrderId.get(orderId).add(itemId);
    }
    if (selectedByOrderId.size === 0) throw new Error('No split bill items selected.');

    const paidOrderIds = [];
    const fullySettledSourceOrderIds = [];

    const ordersToPay = [];
    for (const sourceOrder of savedOrdersForSelectedTable) {
      const selectedItemIdsForOrder = selectedByOrderId.get(sourceOrder?.id);
      if (!selectedItemIdsForOrder || selectedItemIdsForOrder.size === 0) continue;

      const sourceItems = Array.isArray(sourceOrder?.items) ? sourceOrder.items : [];
      const selectedItems = sourceItems.filter((item) => selectedItemIdsForOrder.has(item?.id));
      const remainingItems = sourceItems.filter((item) => !selectedItemIdsForOrder.has(item?.id));
      if (selectedItems.length === 0) continue;

      const orderTotal = roundCurrency(
        selectedItems.reduce(
          (sum, item) => sum + computeItemPayableWithStrikeMarks(sourceOrder.id, item, ticketDeleteMarkIds),
          0
        )
      );
      ordersToPay.push({ sourceOrder, selectedItems, remainingItems, orderTotal });
    }

    const totalPaid = roundCurrency(ordersToPay.reduce((sum, o) => sum + o.orderTotal, 0));

    for (const { sourceOrder, selectedItems, remainingItems, orderTotal } of ordersToPay) {
      const orderPaymentBreakdown = paymentBreakdown && totalPaid > 0
        ? allocatePaymentBreakdown(paymentBreakdown, orderTotal, totalPaid)
        : null;

      if (remainingItems.length === 0) {
        await onStatusChange?.(
          sourceOrder.id,
          'paid',
          withOrderActorUserId(orderPaymentBreakdown ? { paymentBreakdown: orderPaymentBreakdown } : {})
        );
        paidOrderIds.push(sourceOrder.id);
        fullySettledSourceOrderIds.push(sourceOrder.id);
      } else {
        const paidSplitOrderId = await createPaidSplitOrder(selectedItems, orderPaymentBreakdown);
        await patchOrderItems(sourceOrder.id, remainingItems);
        paidOrderIds.push(paidSplitOrderId);
      }
    }

    return paidOrderIds;
  };

  const resetAfterSuccessfulPayment = () => {
    payNowFromInWaitingRef.current = false;
    mergePaySidecarSnapshotRef.current = null;
    setShowPayDifferentlyModal(false);
    setPayModalTargetTotal(0);
    setSelectedLineKeys([]);
    setDisplayQuantity('');
    setShowDeleteAllModal(false);
    setShowSettlementSubtotalModal(false);
    setSettlementModalType('subtotal');
    setPendingSplitCheckout(null);
    setSubtotalLineGroups([]);
    setSubtotalSelectedLeftIds([]);
    setSubtotalSelectedRightIds([]);
    setShowPayworldStatusModal(false);
    setPayworldStatus({ state: 'IDLE', message: '', details: null });
  };

  /** After Cashmatic/Payworld (or when skipped): settle orders, print, reset. Used by PayDifferentlyModal and executePayModalConfirmation. */
  const settleOrdersAfterTerminalPayment = async (methods, amounts, modalTargetTotal, opts = {}) => {
    const modalTotal = roundCurrency(modalTargetTotal);
    const skipAutoReceiptPrint =
      opts?.invoiceDelivery === 'direct' || opts?.invoiceDelivery === 'webpanel';
    if (pendingSplitCheckout?.type === 'splitBill') {
        const paymentBreakdown = buildPaymentBreakdown(methods, amounts);
        const paidOrderIds = await settleSplitBillSelection(pendingSplitCheckout.lineIds || [], paymentBreakdown);
        if (paidOrderIds.length === 0) {
          throw new Error('No split bill order available for checkout.');
        }

        let printedSuccessfully = true;
        let printResult = null;
        if (!skipAutoReceiptPrint) {
          try {
            if (paidOrderIds.length === 1) {
              const printAmounts = {};
              for (const m of methods) {
                const v = Number(amounts[m.id]) || 0;
                if (v > 0.0001) printAmounts[m.id] = v;
              }
              printResult = await printTicketAutomatically(paidOrderIds[0], { amounts: printAmounts });
            } else {
              printResult = await printCombinedReceiptsAutomatically(paidOrderIds, paymentBreakdown);
            }
          } catch (printErr) {
            printedSuccessfully = false;
            setPaymentErrorMessage(printErr?.message || 'Automatic ticket print failed.');
          }
        }

        await onPaymentCompleted?.(paidOrderIds);
        if (skipAutoReceiptPrint) {
          setPaymentSuccessMessage(`Payment successful (${formatPaymentAmount(modalTotal)}).`);
        } else if (printedSuccessfully) {
          setPaymentSuccessMessage(
            `Payment successful (${formatPaymentAmount(modalTotal)}). Receipt printed successfully${printResult?.printerName ? ` on ${printResult.printerName}` : ''}.`
          );
        }

        const nextAction = pendingSplitCheckout.action;
        resetAfterSuccessfulPayment();
        if (nextAction === 'continue') {
          setSettlementModalType('splitBill');
          setShowSettlementSubtotalModal(true);
        }
        return;
      }

      /** Counter sale + scanned in-waiting: settle/print both orders. Resolve from `orders` + focus so we never miss the pair if props lag. */
      const resolveOpenPlusWaitingSettlementSources = () => {
        if (showSettlementActions) return null;
        const openOrder = order;
        const curId = openOrder?.id != null ? String(openOrder.id) : '';
        if (!curId) return null;
        const openStatus = String(openOrder?.status ?? 'open');
        if (openStatus !== 'open') return null;
        if ((openOrder?.items?.length ?? 0) < 1) return null;

        const fid = focusedOrderId != null ? String(focusedOrderId) : '';
        let waitingFromList = null;
        if (fid && fid !== curId) {
          waitingFromList = (orders || []).find((o) => String(o?.id) === fid && o?.status === 'in_waiting') || null;
        }
        const waitId = waitAppend?.id != null ? String(waitAppend.id) : '';
        if (!waitingFromList?.id && waitId && waitId !== curId) {
          waitingFromList =
            (orders || []).find((o) => String(o?.id) === waitId && o?.status === 'in_waiting') || waitAppend;
        }
        if (!waitingFromList?.id || String(waitingFromList.id) === curId) return null;
        if ((waitingFromList?.items?.length ?? 0) < 1) return null;
        return [openOrder, waitingFromList];
      };

      const resolveOpenPlusWaitingFromCheckoutSnapshot = () => {
        if (showSettlementActions) return null;
        const snap = mergePaySidecarSnapshotRef.current;
        if (!snap?.openId || !snap?.waitId || snap.openId === snap.waitId) return null;
        const openOrder = order;
        if (!openOrder?.id || String(openOrder.id) !== snap.openId) return null;
        if (String(openOrder?.status ?? 'open') !== 'open') return null;
        if ((openOrder?.items?.length ?? 0) < 1) return null;
        let waiting =
          (orders || []).find((o) => String(o?.id) === snap.waitId && o?.status === 'in_waiting') || null;
        if (!waiting?.id && String(waitAppend?.id) === snap.waitId) waiting = waitAppend;
        if (!waiting?.id || String(waiting.id) === snap.openId) return null;
        if ((waiting?.items?.length ?? 0) < 1) return null;
        return [openOrder, waiting];
      };

      const settlementOrderSources = showSettlementActions
        ? savedOrdersForSelectedTable
        : resolveOpenPlusWaitingSettlementSources() ||
          resolveOpenPlusWaitingFromCheckoutSnapshot() ||
          (order ? [order] : []);
      const targetOrderIds = [...new Set(
        (showSettlementActions
          ? savedOrdersForSelectedTable.map((o) => o.id)
          : settlementOrderSources.map((o) => o?.id)
        ).filter(Boolean).map((id) => String(id)),
      )];
      if (targetOrderIds.length === 0) {
        throw new Error('No order available for settlement.');
      }
      const paymentBreakdown = buildPaymentBreakdown(methods, amounts);
      const settlementTotal = roundCurrency(
        settlementOrderSources.reduce((sum, o) => sum + (o ? computeOrderTotal(o) : 0), 0)
      );

      const useInPlanningForPayNow = payNowFromInWaitingRef.current;
      for (const paidOrderId of targetOrderIds) {
        const paidOrder = showSettlementActions
          ? savedOrdersForSelectedTable.find((o) => String(o?.id) === String(paidOrderId))
          : settlementOrderSources.find((o) => String(o?.id) === String(paidOrderId)) || null;
        const perOrderTotal = paidOrder ? computeOrderTotal(paidOrder) : 0;
        const orderPaymentBreakdown = paymentBreakdown && settlementTotal > 0
          ? allocatePaymentBreakdown(paymentBreakdown, perOrderTotal, settlementTotal)
          : paymentBreakdown;
        const targetStatus = useInPlanningForPayNow && paidOrder?.status === 'in_waiting' ? 'in_planning' : 'paid';
        await onStatusChange?.(
          paidOrderId,
          targetStatus,
          withOrderActorUserId({
            ...(orderPaymentBreakdown ? { paymentBreakdown: orderPaymentBreakdown } : {}),
            ...(opts?.invoiceDelivery === 'direct' || opts?.invoiceDelivery === 'webpanel'
              ? { invoiceDelivery: opts.invoiceDelivery }
              : {}),
          }),
        );
      }

      let invoiceSentToEmails = [];
      let webpanelInvoiceRegisteredCount = 0;
      if (opts?.invoiceDelivery === 'direct' && !useInPlanningForPayNow) {
        for (const oid of targetOrderIds) {
          try {
            const r = await fetch(`${API}/orders/${encodeURIComponent(oid)}/send-invoice-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) {
              throw new Error(d?.error || tr('orderPanel.invoiceEmailFailed', 'Failed to send invoice email.'));
            }
            if (d?.to) invoiceSentToEmails.push(String(d.to));
          } catch (e) {
            setPaymentErrorMessage(e?.message || tr('orderPanel.invoiceEmailFailed', 'Failed to send invoice email.'));
          }
        }
        invoiceSentToEmails = [...new Set(invoiceSentToEmails)];
      }
      if (opts?.invoiceDelivery === 'webpanel' && !useInPlanningForPayNow) {
        for (const oid of targetOrderIds) {
          try {
            const r = await fetch(`${API}/orders/${encodeURIComponent(oid)}/register-invoice-webpanel`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) {
              throw new Error(
                d?.error || tr('orderPanel.invoiceWebpanelRegisterFailed', 'Could not add invoice to webpanel.'),
              );
            }
            webpanelInvoiceRegisteredCount += 1;
          } catch (e) {
            setPaymentErrorMessage(
              e?.message || tr('orderPanel.invoiceWebpanelRegisterFailed', 'Could not add invoice to webpanel.'),
            );
          }
        }
      }

      await onPaymentCompleted?.(targetOrderIds);
      let printedSuccessfully = true;
      let printResult = null;
      if (!skipAutoReceiptPrint) {
        try {
          if (targetOrderIds.length === 1) {
            const printAmounts = {};
            for (const m of methods) {
              const v = Number(amounts[m.id]) || 0;
              if (v > 0.0001) printAmounts[m.id] = v;
            }
            printResult = await printTicketAutomatically(targetOrderIds[0], { amounts: printAmounts });
          } else {
            printResult = await printCombinedReceiptsAutomatically(targetOrderIds, paymentBreakdown);
          }
        } catch (printErr) {
          printedSuccessfully = false;
          setPaymentErrorMessage(printErr?.message || 'Automatic ticket print failed.');
        }
      }
      if (
        opts?.invoiceDelivery === 'direct' &&
        !useInPlanningForPayNow &&
        invoiceSentToEmails.length > 0
      ) {
        const emailDisplay = invoiceSentToEmails.join(', ');
        setPaymentSuccessMessage(
          tr('orderPanel.invoiceSentToEmailSuccess', 'Sent invoice to {{email}} successfully').replace(
            /\{\{email\}\}/g,
            emailDisplay,
          ),
        );
      } else if (
        opts?.invoiceDelivery === 'webpanel' &&
        !useInPlanningForPayNow &&
        webpanelInvoiceRegisteredCount > 0
      ) {
        setPaymentSuccessMessage(
          tr('orderPanel.invoiceRegisteredWebpanelSuccess', 'Invoice added to the webpanel list.'),
        );
      } else if (skipAutoReceiptPrint) {
        const methodLines = methods
          .map((m) => {
            const v = Number(amounts[m.id]) || 0;
            return v > 0.0001 ? `${m.name}: ${formatPaymentAmount(v)}` : null;
          })
          .filter(Boolean);
        setPaymentSuccessMessage(
          [`Payment successful (${formatPaymentAmount(modalTotal)}).`, methodLines.length ? methodLines.join(' | ') : '']
            .filter(Boolean)
            .join(' '),
        );
      } else if (printedSuccessfully) {
        const methodLines = methods
          .map((m) => {
            const v = Number(amounts[m.id]) || 0;
            return v > 0.0001 ? `${m.name}: ${formatPaymentAmount(v)}` : null;
          })
          .filter(Boolean);
        setPaymentSuccessMessage([
          `Payment successful (${formatPaymentAmount(modalTotal)}).`,
          methodLines.length ? methodLines.join(' | ') : '',
          `Receipt printed successfully${printResult?.printerName ? ` on ${printResult.printerName}` : ''}.`,
        ].filter(Boolean).join(' '));
      }
      /** Close pay modal before checkout side-effects so child props (e.g. customer) do not retrigger PayDifferentlyModal init mid-frame. */
      resetAfterSuccessfulPayment();
      if (useInPlanningForPayNow) {
        onOpenInPlanning?.();
      } else {
        await onAfterPaidCheckout?.();
      }
  };

  /** Shared by PayDifferentlyModal confirm and footer € (full Cash + confirm, no modal). */
  const executePayModalConfirmation = async (methods, amounts, modalTargetTotal) => {
    if (payConfirmLoading) return;

    const assignedTotal = roundCurrency(
      methods.reduce((sum, m) => sum + (Number(amounts[m.id]) || 0), 0),
    );
    const modalTotal = roundCurrency(modalTargetTotal);

    if (modalTotal > 0.009 && assignedTotal <= 0) {
      setPaymentErrorMessage(tr('orderPanel.assignedAmountGreaterThanZero', 'Assigned amount must be greater than 0.'));
      return;
    }
    if (Math.abs(assignedTotal - modalTotal) > 0.009) {
      setPaymentErrorMessage(`Assigned amount (€${assignedTotal.toFixed(2)}) must match total (€${modalTotal.toFixed(2)}).`);
      return;
    }
    if (!methods.length) {
      setPaymentErrorMessage(
        tr('orderPanel.noPaymentMethods', 'No active payment methods. Add them under Control → Payment types.'),
      );
      return;
    }

    try {
      setPayConfirmLoading(true);
      const cashmaticTotal = sumAmountsByIntegration(methods, amounts, 'cashmatic');
      if (cashmaticTotal > 0) {
        await runCashmaticPayment(cashmaticTotal);
      }
      const payworldTotal = sumAmountsByIntegration(methods, amounts, 'payworld');
      if (payworldTotal > 0) {
        await runCardTerminalPayment('payworld', payworldTotal);
      }
      const ccvTotal = sumAmountsByIntegration(methods, amounts, 'ccv');
      if (ccvTotal > 0) {
        await runCardTerminalPayment('ccv', ccvTotal);
      }
      const vivaTotal = ['viva', 'viva-wallet']
        .reduce((sum, integration) => sum + sumAmountsByIntegration(methods, amounts, integration), 0);
      if (vivaTotal > 0) {
        await runCardTerminalPayment('viva', vivaTotal);
      }
      const worldlineTotal = sumAmountsByIntegration(methods, amounts, 'worldline');
      if (worldlineTotal > 0) {
        await runCardTerminalPayment('worldline', worldlineTotal);
      }
      const bancontactProTotal = sumAmountsByIntegration(methods, amounts, 'bancontactpro');
      if (bancontactProTotal > 0) {
        await runCardTerminalPayment('bancontactpro', bancontactProTotal);
      }
      await settleOrdersAfterTerminalPayment(methods, amounts, modalTargetTotal);
    } catch (err) {
      mergePaySidecarSnapshotRef.current = null;
      setPaymentErrorMessage(err?.message || tr('orderPanel.paymentFailed', 'Payment failed.'));
    } finally {
      setPayConfirmLoading(false);
      activeCashmaticSessionIdRef.current = null;
      activePayworldSessionIdRef.current = null;
      activePayworldProviderRef.current = 'payworld';
      cancelCashmaticRequestedRef.current = false;
      cancelPayworldRequestedRef.current = false;
      setTerminalChargeAmount(0);
    }
  };

  /** Footer €: same as Pay modal — assign full total to Cash (manual_cash) then run confirm (no modal). */
  const handleEuroQuickCashPayment = async () => {
    if (payConfirmLoading || payDifferentlyDisabled) return;
    captureMergePaySidecarSnapshotForCheckout();
    const targetTotal = roundCurrency(payableTotalForPaymentModal);
    try {
      const res = await fetch(`${API}/payment-methods?active=1`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        mergePaySidecarSnapshotRef.current = null;
        setPaymentErrorMessage(
          data?.error || tr('orderPanel.paymentMethodsLoadFailed', 'Could not load payment methods.'),
        );
        return;
      }
      const list = Array.isArray(data?.data) ? data.data : [];
      const sorted = [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const cashMethod = sorted.find((m) => String(m.integration || '') === 'manual_cash');
      if (!cashMethod) {
        mergePaySidecarSnapshotRef.current = null;
        setPaymentErrorMessage(
          tr(
            'orderPanel.noManualCashMethod',
            'No Cash payment method is configured. Add one under Control → Payment types.',
          ),
        );
        return;
      }
      const amounts = Object.fromEntries(sorted.map((m) => [m.id, 0]));
      amounts[cashMethod.id] = roundCurrency(targetTotal);
      await executePayModalConfirmation(sorted, amounts, targetTotal);
    } catch (err) {
      mergePaySidecarSnapshotRef.current = null;
      setPaymentErrorMessage(err?.message || tr('orderPanel.paymentFailed', 'Payment failed.'));
    }
  };

  return (
    <aside className="relative w-1/4 shrink-0 flex flex-col px-2 py-1 bg-pos-bg border-l border-pos-border">
      <div className="flex flex-col bg-white rounded-lg overflow-hidden min-h-[50%]">
        {customerDisplayName ? (
          <div className="px-2 py-2 text-center border-b border-pos-border">
            <span className="text-pos-bg font-medium truncate block">{customerDisplayName}</span>
          </div>
        ) : null}
        {showSubtotalView ? (
          <div ref={orderListScrollRef} className="flex-1 overflow-auto scrollbar-hide p-4 py-2 text-pos-bg text-sm">
            {(() => {
              let start = 0;
              const result = [];
              for (let i = 0; i < subtotalBreaks.length; i++) {
                const end = subtotalBreaks[i];
                const group = items.slice(start, end);
                const groupTotal = group.reduce((s, it) => s + it.price * it.quantity, 0);
                group.forEach((item) => (
                  result.push(
                    <div key={item.id} className="py-1">
                      <div className="flex justify-between items-baseline">
                        <span className="font-medium">
                          {item.quantity}x {getItemLabel(item)}
                          {weegschaalWeightTitleSuffix(item)}
                        </span>
                        <span className="font-medium">{formatSubtotalPrice(getItemBaseLinePrice(item))}</span>
                      </div>
                      {getItemNotes(item).map((note, noteIdx) =>
                        isWeegschaalWeightNoteToken(note) ? null : (
                          <div
                            key={`${item.id}-note-${noteIdx}`}
                            className="flex justify-between items-baseline pl-6 text-pos-bg/80"
                          >
                            <span>{note.label}</span>
                            <span>{formatSubtotalPrice(getItemNoteLinePrice(item, note))}</span>
                          </div>
                        )
                      )}
                    </div>
                  )
                ));
                result.push(
                  <div key={`sub-${i}`} className="border-b border-gray-800 mb-2">
                    <div className="flex justify-around items-baseline text-md font-medium relative">
                      <span className='font-bold'>{t('subtotal')}:</span>
                      <span className='flex font-bold'>{formatSubtotalPrice(groupTotal)}</span>
                    </div>
                  </div>
                );
                start = end;
              }
              const remaining = items.slice(start);
              remaining.forEach((item) =>
                result.push(
                  <div key={item.id} className="py-1 text-sm">
                    <div className="flex justify-between items-baseline">
                      <span className="font-medium">
                        {item.quantity}x {getItemLabel(item)}
                        {weegschaalWeightTitleSuffix(item)}
                      </span>
                      <span className="font-medium">{formatSubtotalPrice(getItemBaseLinePrice(item))}</span>
                    </div>
                    {getItemNotes(item).map((note, noteIdx) =>
                      isWeegschaalWeightNoteToken(note) ? null : (
                        <div
                          key={`${item.id}-note-rem-${noteIdx}`}
                          className="flex justify-between items-baseline pl-6 text-sm text-pos-bg/80"
                        >
                          <span>{note.label}</span>
                          <span>{formatSubtotalPrice(getItemNoteLinePrice(item, note))}</span>
                        </div>
                      )
                    )}
                  </div>
                )
              );
              return result;
            })()}
          </div>
        ) : (
          <div ref={orderListScrollRef} className="flex-1 overflow-auto scrollbar-hide p-2">
            {savedOrdersForSelectedTable.map((savedOrder) => (
              <div key={`saved-order-${savedOrder.id}`}>
                {(savedOrder.items || []).map((item, itemIdx) =>
                  renderTicketOrderLine(savedOrder.id, item, `saved-${savedOrder.id}-${itemIdx}`, true)
                )}
                <div className="pt-1 px-2 text-pos-bg/90">
                  {(() => {
                    const savedMeta = savedOrderMetaById.get(String(savedOrder.id));
                    const savedCashierName = savedMeta?.cashierName || cashierName;
                    const savedTime = formatSavedOrderTime(savedMeta?.savedAt, savedOrder?.createdAt);
                    return (
                      <div className="flex items-center justify-around text-md font-semibold py-1 pt-0">
                        <span>{savedCashierName}</span>
                        <span>{savedTime}</span>
                      </div>
                    );
                  })()}
                  <div className="w-full h-px bg-pos-bg/40" />
                </div>
              </div>
            ))}
            {isSavedTableOrder ? null : isMergeAppendWaiting ? (
              <>
                {batchBoundaries.length > 0 ? (
                  <>
                    {batchBoundaries.map((endIdx, batchIdx) => {
                      const startIdx = batchIdx === 0 ? 0 : batchBoundaries[batchIdx - 1];
                      const batchItems = appendWaitItems.slice(startIdx, endIdx);
                      const metaEntry = batchMeta[batchIdx] || {};
                      const metaUserName = metaEntry.userName ?? waitAppend?.user?.name ?? cashierName;
                      const metaTime = metaEntry.createdAt
                        ? formatOrderTimestamp(metaEntry.createdAt)
                        : formatOrderTimestamp(waitAppend?.createdAt);
                      const wid = waitAppend.id;
                      return (
                        <React.Fragment key={`wbatch-${batchIdx}`}>
                          {batchItems.map((item, batchItemIdx) =>
                            renderTicketOrderLine(
                              wid,
                              item,
                              `wb-${batchIdx}-${batchItemIdx}`,
                              itemRowOrderedForStrike(wid, item)
                            )
                          )}
                          <div className="pt-1 px-2 text-pos-bg/90">
                            <div className="flex items-center justify-around text-md font-semibold py-1 pt-0">
                              <span>{metaUserName}</span>
                              <span>{metaTime}</span>
                            </div>
                            <div className="w-full h-px bg-pos-bg/40" />
                          </div>
                        </React.Fragment>
                      );
                    })}
                    {appendWaitItems.slice(lastSavedBoundary).map((item, tailIdx) =>
                      renderTicketOrderLine(
                        waitAppend.id,
                        item,
                        `wtail-${tailIdx}`,
                        itemRowOrderedForStrike(waitAppend.id, item)
                      )
                    )}
                  </>
                ) : (
                  appendWaitItems.map((item, itemIdx) =>
                    renderTicketOrderLine(
                      waitAppend.id,
                      item,
                      `wa-${itemIdx}`,
                      itemRowOrderedForStrike(waitAppend.id, item)
                    )
                  )
                )}
                {items.map((item, itemIdx) =>
                  renderTicketOrderLine(
                    order.id,
                    item,
                    `open-${itemIdx}`,
                    itemRowOrderedForStrike(order.id, item)
                  )
                )}
              </>
            ) : isViewedFromInWaitingSole && batchBoundaries.length > 0 ? (
              <>
                {batchBoundaries.map((endIdx, batchIdx) => {
                  const startIdx = batchIdx === 0 ? 0 : batchBoundaries[batchIdx - 1];
                  const batchItems = items.slice(startIdx, endIdx);
                  const metaEntry = batchMeta[batchIdx] || {};
                  const metaUserName = metaEntry.userName ?? order?.user?.name ?? cashierName;
                  const metaTime = metaEntry.createdAt ? formatOrderTimestamp(metaEntry.createdAt) : formatOrderTimestamp(order?.createdAt);
                  return (
                    <React.Fragment key={`batch-${batchIdx}`}>
                      {batchItems.map((item, batchItemIdx) =>
                        renderTicketOrderLine(order.id, item, `b-${batchIdx}-${batchItemIdx}`, itemRowOrderedForStrike(order.id, item))
                      )}
                      <div className="pt-1 px-2 text-pos-bg/90">
                        <div className="flex items-center justify-around text-md font-semibold py-1 pt-0">
                          <span>{metaUserName}</span>
                          <span>{metaTime}</span>
                        </div>
                        <div className="w-full h-px bg-pos-bg/40" />
                      </div>
                    </React.Fragment>
                  );
                })}
                {items.slice(lastSavedBoundary).map((item, tailIdx) =>
                  renderTicketOrderLine(order.id, item, `tail-${tailIdx}`, itemRowOrderedForStrike(order.id, item))
                )}
              </>
            ) : (
              <>
                {items.map((item, itemIdx) =>
                  renderTicketOrderLine(order.id, item, `main-${itemIdx}`, itemRowOrderedForStrike(order.id, item))
                )}
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 py-1 px-2 border-t border-black/10 text-xl">
        <button
          type="button"
          disabled={!quantitySelectionValid || quantityToolbarDisabled}
          className={`w-12 h-12 p-0 flex items-center justify-center border-none rounded text-xl ${
            !quantitySelectionValid || quantityToolbarDisabled
              ? 'bg-black/10 opacity-50 cursor-not-allowed'
              : 'bg-black/10 active:bg-green-500'
          }`}
          onClick={() => {
            if (quantityToolbarDisabled || !quantitySelectionValid) return;
            if (order && selectedItems.length > 0) {
              selectedItems.forEach((item) => {
                onUpdateItemQuantity?.(order.id, item.id, item.quantity + 1);
              });
            }
          }}
        >
          <svg width="25px" height="25px" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path fill="#ffffff" d="M9 4h2v5h5v2h-5v5H9v-5H4V9h5V4z" />
          </svg>
        </button>
        <button
          type="button"
          disabled={!quantitySelectionValid || !canDecreaseAll || quantityToolbarDisabled}
          className={`w-12 h-12 p-0 flex items-center justify-center border-none rounded text-3xl ${
            !quantitySelectionValid || !canDecreaseAll || quantityToolbarDisabled
              ? 'bg-black/10 opacity-50 cursor-not-allowed'
              : 'bg-black/10 active:bg-rose-500'
          }`}
          onClick={() => {
            if (quantityToolbarDisabled || !quantitySelectionValid) return;
            if (order && canDecreaseAll) {
              selectedItems.forEach((item) => {
                if (item.quantity > 1) {
                  onUpdateItemQuantity?.(order.id, item.id, item.quantity - 1);
                }
              });
            }
          }}
        >
          <svg width="30" height="30" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path fill="#ffffff" d="M4 9h12v2H4V9z" />
          </svg>
        </button>
        <button
          type="button"
          className={`flex-1 py-2 flex items-center justify-center border-none rounded ${!hasSelection
            ? 'opacity-50 cursor-not-allowed'
            : 'active:bg-green-500'
            }`}
          onClick={() => {
            if (selectedLineKeys.length === 0) return;
            const keys = [...selectedLineKeys];
            setSelectedLineKeys([]);

            const unorderedKeys = keys.filter((k) => !ticketLineKeyIsOrderedForStrike(k));
            const orderedKeys = keys.filter((k) => ticketLineKeyIsOrderedForStrike(k));

            const toRemoveByOrder = new Map();
            for (const k of unorderedKeys) {
              const oid = ticketKeyOrderId(k);
              const iid = ticketKeyItemId(k);
              if (!oid || !iid) continue;
              if (!toRemoveByOrder.has(oid)) toRemoveByOrder.set(oid, new Set());
              toRemoveByOrder.get(oid).add(iid);
            }
            for (const [oid, idSet] of toRemoveByOrder) {
              for (const iid of idSet) {
                void onRemoveItem?.(oid, iid);
              }
            }

            if (orderedKeys.length === 0) {
              setTicketDeleteMarkIds((prev) => {
                const n = new Set(prev);
                for (const k of unorderedKeys) n.delete(k);
                return n;
              });
              return;
            }

            setTicketDeleteMarkIds((prev) => {
              const n = new Set(prev);
              for (const k of unorderedKeys) n.delete(k);
              const allMarked = orderedKeys.length > 0 && orderedKeys.every((k) => n.has(k));
              for (const k of orderedKeys) {
                if (allMarked) n.delete(k);
                else n.add(k);
              }
              queueMicrotask(() => {
                void persistTicketStrikesForMarkSet(n);
              });
              return n;
            });
          }}
          disabled={!hasSelection}
          aria-label={t('remove')}
        >
          <span className="inline-block w-8 h-8 shrink-0" style={toolbarIconMaskStyle('/delete.svg', '#B91C1C')} aria-hidden />
        </button>
        <button
          type="button"
          disabled={isSavedTableOrder}
          className={`flex-1 py-2 flex items-center justify-center border-none rounded ${isSavedTableOrder ? 'opacity-50 cursor-not-allowed' : 'active:bg-green-500'
            }`}
          onClick={() => setShowDeleteAllModal(true)}
          aria-label={t('clear')}
        >
          <span className="inline-block w-8 h-8 shrink-0" style={toolbarIconMaskStyle('/clear.svg', '#CA8A04')} aria-hidden />
        </button>
      </div>

      <div className="flex items-center w-full px-2 justify-between text-xl font-semibold py-1">
        <span className='text-lg'>{t('total')}:&nbsp;€{payableTotal.toFixed(2)}</span>
        <div>
          <input
            id="order-quantity-input"
            readOnly
            tabIndex={0}
            className='w-[100px] h-full py-1.5 px-2 bg-white border-none rounded-md text-black text-md outline-none cursor-pointer focus:border-green-500 focus:outline-none'
            type='text'
            value={displayQuantity}
            aria-label={t('enterAmountKeypad')}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 text-md py-1">
          <div className="flex gap-2">
          {typeof onVariousRequested === 'function' ? (
            <button
              type="button"
              className="flex-1 py-1 border-none rounded-md bg-pos-surface text-pos-text active:bg-green-500 min-h-[53px] max-h-[53px]"
              onClick={() => {
                onVariousRequested(displayQuantity ?? '');
              }}
            >
              {tr('control.optionButton.various', 'Various')}
            </button>
          ) : null}
          {showInPlanningButton ? (
            <button
              type="button"
              disabled={!order?.id || !hasOrderItems}
              className={`flex-1 py-1 border-none rounded-md min-h-[53px] max-h-[53px] ${order?.id && hasOrderItems ? 'bg-pos-surface text-pos-text active:bg-green-500' : 'bg-pos-surface text-gray-400 cursor-not-allowed opacity-70'}`}
              onClick={() => {
                if (!order?.id || !hasOrderItems) return;
                if (isViewedFromInWaiting) {
                  setShowPayNowOrLaterModal(true);
                } else {
                  onStatusChange(order.id, 'in_planning', withOrderActorUserId({}));
                }
              }}
            >
              {t('inPlanning')}
            </button>
          ) : null}
          {showInWaitingButton ? (
            <button
              type="button"
              disabled={!order?.id || !hasOrderItems || inWaitingButtonDisabled}
              className={`flex-1 py-1 border-none rounded-md min-h-[53px] max-h-[53px] ${order?.id && hasOrderItems && !inWaitingButtonDisabled ? 'bg-pos-surface text-pos-text active:bg-green-500' : 'bg-pos-surface text-gray-400 cursor-not-allowed opacity-70'}`}
              onClick={async () => {
                if (!order?.id || !hasOrderItems || inWaitingButtonDisabled) return;
                if (isViewedFromInWaiting && waitingOrderForUi?.id) {
                  const existingName = waitingOrderForUi?.customer
                    ? (waitingOrderForUi.customer.companyName || waitingOrderForUi.customer.name)
                    : null;
                  const targetList = waitingOrderForUi.items || [];
                  const newBoundaries = [...batchBoundaries, targetList.length];
                  const newMeta = [
                    ...batchMeta,
                    { userId: currentUser?.id, userName: currentUser?.name || currentUser?.label || cashierName, createdAt: new Date().toISOString() }
                  ];
                  await onStatusChange?.(waitingOrderForUi.id, 'in_waiting', {
                    customerName: existingName || undefined,
                    userId: currentUser?.id,
                    itemBatchBoundaries: newBoundaries,
                    itemBatchMeta: newMeta
                  });
                  await onSaveInWaitingAndReset?.();
                } else {
                  setShowInWaitingNameModal(true);
                }
              }}
            >
              {tr('orderPanel.inWaiting', 'In waiting')}
            </button>
          ) : null}
          <button
            type="button"
            disabled={payDifferentlyDisabled}
            className={`flex-1 py-1 border-none rounded-md min-h-[53px] max-h-[53px] ${payDifferentlyDisabled
              ? 'bg-[#1F8E41]/50 text-gray-200 cursor-not-allowed opacity-70'
              : 'bg-[#1F8E41] text-white active:brightness-95'
              }`}
            onClick={() => openPayDifferentlyModal()}
          >
            {t('payDifferently')}
          </button>
          <button
            type="button"
            disabled={payDifferentlyDisabled || payConfirmLoading}
            className={`px-4 min-h-[53px] max-h-[53px] border-none rounded-md text-white text-2xl ${payDifferentlyDisabled || payConfirmLoading
              ? 'bg-[#B45309]/40 cursor-not-allowed opacity-70'
              : 'bg-[#B45309] active:brightness-95'
              }`}
            onClick={() => void handleEuroQuickCashPayment()}
            aria-label={tr('orderPanel.euroCashShortcut', 'Cash payment')}
          >
            €
          </button>
          </div>
      </div>

      <PayDifferentlyModal
        open={showPayDifferentlyModal}
        targetTotal={payModalTargetTotal}
        onClose={handlePayDifferentlyClose}
        onProceedAfterTerminals={settleOrdersAfterTerminalPayment}
        onPaymentError={setPaymentErrorMessage}
        showInvoiceButton={Boolean(order?.customer)}
      />

      {showPayworldStatusModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
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
              {payworldStatus.message && (
                <div className="rounded-md bg-pos-surface px-4 py-3 text-xl whitespace-pre-line">
                  {payworldStatus.message}
                </div>
              )}
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
                  onClick={handleAbortPayworld}
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
      )}

      {showFinalSettlementModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="final-settlement-options-title"
        >
          <div
            className="bg-gray-100 rounded-xl shadow-2xl max-w-3xl w-full px-8 py-10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="final-settlement-options-title" className="sr-only">
              {t('finalSettlementOptions')}
            </h2>
            <div className="grid grid-cols-3 gap-10 items-start">
              <button
                type="button"
                className="h-14 bg-gray-200 border-none rounded text-xl font-semibold text-gray-700 active:bg-green-500"
                onClick={() => {
                  setShowFinalSettlementModal(false);
                  openPayDifferentlyModal();
                }}
              >
                {t('finalPayment')}
              </button>
              <div className="flex flex-col gap-6">
                <button
                  type="button"
                  className="h-14 bg-gray-200 border-none rounded text-xl font-semibold text-gray-700 active:bg-green-500"
                  onClick={() => {
                    setShowFinalSettlementModal(false);
                    setShowSettlementSubtotalModal(true);
                    setSettlementModalType('subtotal');
                    setSubtotalLineGroups([]);
                    setSubtotalSelectedLeftIds([]);
                    setSubtotalSelectedRightIds([]);
                  }}
                >
                  {t('subtotal')}
                </button>
                <button
                  type="button"
                  className="h-14 bg-gray-200 border-none rounded text-xl font-semibold text-gray-700 active:bg-green-500"
                  onClick={() => setShowFinalSettlementModal(false)}
                >
                  {t('cancel')}
                </button>
              </div>
              <button
                type="button"
                className="h-14 bg-gray-200 border-none rounded text-xl font-semibold text-gray-700 active:bg-green-500"
                onClick={() => {
                  setShowFinalSettlementModal(false);
                  setShowSettlementSubtotalModal(true);
                  setSettlementModalType('splitBill');
                  setSubtotalLineGroups([]);
                  setSubtotalSelectedLeftIds([]);
                  setSubtotalSelectedRightIds([]);
                }}
              >
                {t('splitBill')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettlementSubtotalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settlement-subtotal-title"
        >
          <div
            className="bg-pos-panel rounded-xl shadow-2xl w-full max-w-[1400px] h-[86vh] p-4 border border-pos-border flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div id="settlement-subtotal-title" className="flex items-center justify-between text-xl font-semibold text-pos-text px-2 pb-1 border-b border-pos-border">
              <span>{t('order')}</span>
              <span>€ {payableTotal.toFixed(2)}</span>
            </div>

            <div className="flex-1 min-h-0 flex gap-5">
              <div className="flex flex-col h-full w-full">
                <div className="flex-1 border border-pos-border overflow-auto bg-pos-bg">
                  {settlementSubtotalLeftLines.map((line) => (
                    <button
                      key={line.id}
                      type="button"
                      className={`w-full text-left px-4 py-2 border-b border-pos-border/40 text-sm text-pos-text flex items-center justify-between ${subtotalSelectedLeftIds.includes(line.id) ? 'bg-pos-surface-hover' : 'active:bg-green-500'
                        }`}
                      onClick={() => {
                        setSubtotalSelectedLeftIds((prev) =>
                          prev.includes(line.id) ? prev.filter((id) => id !== line.id) : [...prev, line.id]
                        );
                        setSubtotalSelectedRightIds([]);
                      }}
                    >
                      <span>- {line.label}</span>
                      <span>€ {line.amount.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
                <div className="pt-4 flex items-center justify-center border-t border-pos-border/50">
                  <button
                    type="button"
                    disabled={settlementSubtotalLeftLines.length === 0}
                    className={`min-w-[100px] py-1 px-6 rounded text-pos-text text-md ${settlementSubtotalLeftLines.length === 0
                      ? 'bg-pos-surface opacity-50 cursor-not-allowed'
                      : 'bg-pos-surface active:bg-green-500'
                      }`}
                    onClick={() => {
                      setSubtotalSelectedLeftIds(settlementSubtotalLeftLines.map((line) => line.id));
                      setSubtotalSelectedRightIds([]);
                    }}
                  >
                    {t('all')}
                  </button>
                </div>
              </div>

              <div className="w-16 flex flex-col items-center justify-between py-16 text-pos-text mb-20">
                <button
                  type="button"
                  className="text-6xl leading-none active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed active:bg-green-500"
                  disabled={subtotalSelectedLeftIds.length === 0}
                  onClick={() => {
                    if (subtotalSelectedLeftIds.length === 0) return;
                    const idsToMove = subtotalSelectedLeftIds.filter((id) =>
                      settlementSubtotalLeftLines.some((line) => line.id === id)
                    );
                    if (idsToMove.length === 0) return;
                    setSubtotalLineGroups((prev) => [
                      ...prev,
                      { id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, lineIds: idsToMove }
                    ]);
                    setSubtotalSelectedLeftIds([]);
                    setSubtotalSelectedRightIds([]);
                  }}
                >
                  →
                </button>
                <button
                  type="button"
                  className="text-6xl leading-none active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed active:bg-green-500"
                  disabled={subtotalSelectedRightIds.length === 0}
                  onClick={() => {
                    if (subtotalSelectedRightIds.length === 0) return;
                    setSubtotalLineGroups((prev) =>
                      prev
                        .map((group) => ({
                          ...group,
                          lineIds: (group?.lineIds || []).filter((id) => !subtotalSelectedRightIds.includes(id))
                        }))
                        .filter((group) => (group?.lineIds || []).length > 0)
                    );
                    setSubtotalSelectedRightIds([]);
                    setSubtotalSelectedLeftIds([]);
                  }}
                >
                  ←
                </button>
              </div>

              <div className="flex flex-col h-full w-full">
                <div className="flex-1 border border-pos-border bg-pos-bg flex flex-col">
                  <div ref={splitRightPanelScrollRef} className="flex-1 overflow-auto">
                    {settlementSubtotalRightGroups.map((group) => (
                      <div
                        key={group.id}
                        className={`px-4 py-2 border-b ${group.lines.length > 0 && group.lines.every((line) => subtotalSelectedRightIds.includes(line.id))
                          ? 'border-2 border-rose-500 rounded-md'
                          : ''
                          }`}
                      >
                        <div className="text-center text-lg font-semibold text-pos-text">
                          {group.label}
                        </div>
                        {group.lines.map((line) => (
                          <button
                            key={line.id}
                            type="button"
                            className={`w-full text-left px-2 py-1 text-sm text-pos-text flex items-center justify-between ${subtotalSelectedRightIds.includes(line.id) ? 'bg-pos-surface-hover' : 'active:bg-green-500'
                              }`}
                            onClick={() => {
                              setSubtotalSelectedRightIds((prev) =>
                                prev.includes(line.id) ? prev.filter((id) => id !== line.id) : [...prev, line.id]
                              );
                              setSubtotalSelectedLeftIds([]);
                            }}
                          >
                            <span>- {line.label}</span>
                            <span>€ {line.amount.toFixed(2)}</span>
                          </button>
                        ))}
                        <div className="text-center text-md font-semibold text-pos-text">
                          € {group.total.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="py-1 flex items-center justify-around gap-5">
                    <button
                      type="button"
                      className="w-10 h-10 rounded bg-pos-surface text-pos-text text-xl leading-none active:bg-green-500"
                      onClick={() => scrollSplitRightPanel(-1)}
                      aria-label={t('scrollUp')}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="min-w-[100px] py-2 px-6 rounded bg-pos-surface text-pos-text text-md active:bg-green-500"
                      onClick={() => {
                        setSubtotalLineGroups([]);
                        setSubtotalSelectedLeftIds([]);
                        setSubtotalSelectedRightIds([]);
                      }}
                    >
                      {t('again')}
                    </button>
                    <button
                      type="button"
                      className="w-10 h-10 rounded bg-pos-surface text-pos-text text-xl leading-none active:bg-green-500"
                      onClick={() => scrollSplitRightPanel(1)}
                      aria-label={t('scrollDown')}
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <div className="pt-4 flex items-center justify-center gap-12">
                  <button
                    type="button"
                    className="min-w-[100px] py-1 px-6 rounded bg-pos-surface text-pos-text text-md active:bg-green-500"
                    onClick={() => {
                      setShowSettlementSubtotalModal(false);
                      setSettlementModalType('subtotal');
                      setSubtotalLineGroups([]);
                      setSubtotalSelectedLeftIds([]);
                      setSubtotalSelectedRightIds([]);
                    }}
                  >
                    {t('cancel')}
                  </button>
                  {settlementModalType === 'splitBill' ? (
                    <>
                      <button
                        type="button"
                        disabled={!hasSplitBillSelection}
                        className={`min-w-[150px] py-1 px-6 rounded text-md ${!hasSplitBillSelection
                          ? 'bg-pos-surface text-pos-text opacity-50 cursor-not-allowed'
                          : 'bg-pos-surface text-pos-text active:bg-green-500'
                          }`}
                        onClick={() => {
                          if (!hasSplitBillSelection) return;
                          setShowSettlementSubtotalModal(false);
                          setPendingSplitCheckout({
                            type: 'splitBill',
                            action: 'return',
                            lineIds: splitSelectedLineIds
                          });
                          openPayDifferentlyModal(splitSelectedTotal);
                        }}
                      >
                        {t('checkoutAndReturn')}
                      </button>
                      <button
                        type="button"
                        disabled={!hasSplitBillSelection}
                        className={`min-w-[170px] py-1 px-6 rounded text-md ${!hasSplitBillSelection
                          ? 'bg-pos-surface text-pos-text opacity-50 cursor-not-allowed'
                          : 'bg-pos-surface text-pos-text active:bg-green-500'
                          }`}
                        onClick={() => {
                          if (!hasSplitBillSelection) return;
                          setShowSettlementSubtotalModal(false);
                          setPendingSplitCheckout({
                            type: 'splitBill',
                            action: 'continue',
                            lineIds: splitSelectedLineIds
                          });
                          openPayDifferentlyModal(splitSelectedTotal);
                        }}
                      >
                        {t('checkoutAndContinueSplit')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={settlementSubtotalLeftLines.length > 0}
                      className={`min-w-[100px] py-1 px-6 rounded text-md ${settlementSubtotalLeftLines.length > 0
                        ? 'bg-pos-surface text-pos-text opacity-50 cursor-not-allowed'
                        : 'bg-pos-surface text-pos-text active:bg-green-500'
                        }`}
                      onClick={() => {
                        if (settlementSubtotalLeftLines.length > 0) return;
                        setShowSettlementSubtotalModal(false);
                        setPendingSplitCheckout(null);
                        openPayDifferentlyModal();
                      }}
                    >
                      {t('checkout')}
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {paymentSuccessMessage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-success-message"
        >
          <div
            className="bg-pos-panel rounded-lg shadow-xl px-10 py-8 max-w-3xl w-full mx-4 border border-pos-border"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="payment-success-message" className="text-2xl text-pos-text text-center mb-8">
              {paymentSuccessMessage}
            </p>
            <div className="flex justify-center">
              <button
                type="button"
                className="w-[200px] py-4 bg-green-600 text-white rounded text-2xl active:bg-green-500"
                onClick={() => setPaymentSuccessMessage('')}
              >
                {t('ok')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPayNowOrLaterModal && (
        <div
          className="fixed inset-0 z-[52] flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-now-or-later-title"
        >
          <div
            className="bg-pos-panel rounded-lg shadow-xl px-16 py-8 max-w-2xl w-full mx-4 border border-pos-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pay-now-or-later-title" className="text-2xl mb-10 font-semibold flex justify-center w-full text-pos-text">
              {t('payNowOrLater')}
            </h2>
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                className="flex-1 py-3 px-10 bg-pos-surface text-pos-text rounded text-xl active:bg-green-500"
                onClick={() => {
                  setShowPayNowOrLaterModal(false);
                  setInPlanningCalendarAction('payNow');
                  setShowInPlanningDateTimeModal(true);
                }}
              >
                {t('yes')}
              </button>
              <button
                type="button"
                className="flex-1 py-3 px-10 bg-pos-surface text-pos-text rounded text-xl active:bg-green-500"
                onClick={() => {
                  setShowPayNowOrLaterModal(false);
                  setInPlanningCalendarAction('inPlanning');
                  setShowInPlanningDateTimeModal(true);
                }}
              >
                {t('no')}
              </button>
            </div>
          </div>
        </div>
      )}

      <InPlanningDateTimeModal
        open={showInPlanningDateTimeModal}
        onClose={() => {
          setShowInPlanningDateTimeModal(false);
          setInPlanningCalendarAction(null);
        }}
        onSave={(scheduledDate) => {
          setShowInPlanningDateTimeModal(false);
          if (inPlanningCalendarAction === 'payNow') {
            payNowFromInWaitingRef.current = true; // After payment+print success → in_planning
            setInPlanningCalendarAction(null);
            openPayDifferentlyModal();
          } else if (inPlanningCalendarAction === 'inPlanning') {
            setInPlanningCalendarAction(null);
            order?.id && onStatusChange?.(order.id, 'in_planning', withOrderActorUserId({}));
            onOpenInPlanning?.();
          }
        }}
      />

      <InWaitingNameModal
        open={showInWaitingNameModal}
        onClose={() => setShowInWaitingNameModal(false)}
        onConfirm={async (name) => {
          if (order?.id) {
            const wasAlreadyInWaiting = order?.status === 'in_waiting';
            const itemCount = order?.items?.length ?? 0;
            const updated = await onStatusChange?.(order.id, 'in_waiting', {
              customerName: name || undefined,
              userId: currentUser?.id,
              itemBatchBoundaries: itemCount > 0 ? [itemCount] : undefined,
              itemBatchMeta: itemCount > 0 ? [{ userId: currentUser?.id, userName: currentUser?.name || currentUser?.label || cashierName, createdAt: new Date().toISOString() }] : undefined
            });
            if (
              ordersPrintBarcodeAfterCreate &&
              !wasAlreadyInWaiting &&
              updated?.inWaitingDisplayNumber != null
            ) {
              try {
                await printInWaitingHoldTicket({
                  displayNumber: Number(updated.inWaitingDisplayNumber),
                  header: 'Retail POS',
                  orderLine: tr('inWaitingTicket.orderLine', 'Order #{n}').replace(
                    '{n}',
                    String(Number(updated.inWaitingDisplayNumber)),
                  ),
                  API,
                });
              } catch (e) {
                console.error('In waiting barcode ticket print failed', e);
              }
            }
            await onSaveInWaitingAndReset?.();
          }
        }}
      />

      {showDeleteAllModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-all-title"
        >
          <div
            className="bg-pos-panel rounded-lg shadow-xl px-16 py-8 max-w-2xl w-full mx-4 border border-pos-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-all-title" className="text-2xl mb-10 font-semibold flex justify-center w-full text-pos-text">
              <div className='flex'>
                {t('clearListConfirm')}
              </div>
            </h2>
            <div className="flex gap-3 justify-between">
              <button
                type="button"
                className="py-3 px-10 bg-pos-surface text-pos-text rounded text-xl active:bg-green-500"
                onClick={() => setShowDeleteAllModal(false)}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="py-3 px-10 bg-pos-danger text-white rounded text-xl active:bg-green-500"
                onClick={async () => {
                  await onRemoveAllOrders?.();
                  setShowDeleteAllModal(false);
                  setSelectedLineKeys([]);
                }}
              >
                {t('ok')}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentErrorMessage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-error-title"
        >
          <div
            className="bg-pos-panel rounded-lg shadow-xl px-10 py-8 max-w-3xl w-full mx-4 border border-pos-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="payment-error-title" className="text-3xl mb-6 font-semibold text-pos-text text-center">
              {t('paymentErrorTitle')}
            </h2>
            <p className="text-2xl text-pos-text text-center mb-8">{paymentErrorMessage}</p>
            <div className="flex justify-center">
              <button
                type="button"
                className="w-[200px] py-4 bg-pos-surface text-pos-text rounded text-2xl active:bg-green-500"
                onClick={() => setPaymentErrorMessage('')}
              >
                {t('ok')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 h-[45%]">
        {KEYPAD.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-2">
            {row.map((key) => (
              <button
                key={key}
                type="button"
                className="py-3 bg-pos-panel border-none rounded-md text-pos-text text-xl active:bg-green-500"
                onClick={() => handleKeypad(key)}
              >
                {key}
              </button>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
