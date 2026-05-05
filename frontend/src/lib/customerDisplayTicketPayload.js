import { roundCurrency } from './payDifferentlyUtils.js';

const WEIGHT_NOTE_LABEL_RE = /^\d+\s*g$/i;

function isWeegschaalWeightNoteToken(note) {
  return (Number(note?.price) || 0) === 0 && WEIGHT_NOTE_LABEL_RE.test(String(note?.label || '').trim());
}

function parseNoteToken(token) {
  const raw = String(token || '').trim();
  if (!raw) return null;
  const [labelPart, pricePart] = raw.split('::');
  const label = String(labelPart || '').trim();
  if (!label) return null;
  if (pricePart == null) return { label, price: 0 };
  const parsed = Number(pricePart);
  if (!Number.isFinite(parsed)) return { label, price: 0 };
  return { label, price: parsed };
}

function getItemNotes(item) {
  return String(item?.notes || '')
    .split(/[;,]/)
    .map((n) => parseNoteToken(n))
    .filter(Boolean);
}

function getItemQuantity(item) {
  return Math.max(1, Number(item?.quantity) || 1);
}

function getItemLabel(item) {
  return item?.product?.name ?? '—';
}

function getItemNoteUnitTotal(item) {
  return roundCurrency(getItemNotes(item).reduce((sum, note) => sum + (Number(note?.price) || 0), 0));
}

function getItemBaseUnitPrice(item) {
  if (item?.product?.weegschaal) {
    const orderUnitPrice = Number(item?.price) || 0;
    return roundCurrency(Math.max(0, orderUnitPrice - getItemNoteUnitTotal(item)));
  }
  const productBase = Number(item?.product?.price);
  if (Number.isFinite(productBase)) return roundCurrency(productBase);
  const orderUnitPrice = Number(item?.price) || 0;
  return roundCurrency(Math.max(0, orderUnitPrice - getItemNoteUnitTotal(item)));
}

function getItemBaseLinePrice(item) {
  return roundCurrency(getItemBaseUnitPrice(item) * getItemQuantity(item));
}

function getItemNoteLinePrice(item, note) {
  return roundCurrency((Number(note?.price) || 0) * getItemQuantity(item));
}

function weegschaalWeightTitleSuffix(item) {
  if (!item?.product?.weegschaal) return '';
  const w = getItemNotes(item).filter(isWeegschaalWeightNoteToken);
  return w.length ? ` (${w.map((n) => String(n.label).trim()).join(', ')})` : '';
}

function computeLineTotal(item) {
  const qty = getItemQuantity(item);
  const full = roundCurrency((Number(item?.price) || 0) * qty);
  return full;
}

function customerNameFromOrder(order) {
  const c = order?.customer;
  if (!c) return null;
  return c.companyName || c.name || null;
}

/**
 * Serializable ticket snapshot for the customer display (mirrors sales ticket lines, read-only).
 * @param {object|null} order
 * @returns {{ orderId: string|null, customerName: string|null, lines: object[], total: number, currency: string }}
 */
export function buildCustomerDisplayTicketPayload(order) {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    return {
      orderId: order?.id != null ? String(order.id) : null,
      customerName: customerNameFromOrder(order),
      lines: [],
      total: 0,
      currency: 'EUR',
    };
  }

  const lines = [];
  for (const item of order.items) {
    if (item?.id == null) continue;
    const notes = getItemNotes(item);
    const onlyWeightNotes = !!item?.product?.weegschaal && notes.length > 0 && notes.every(isWeegschaalWeightNoteToken);
    const mainText = `${getItemQuantity(item)}x ${getItemLabel(item)}${onlyWeightNotes ? weegschaalWeightTitleSuffix(item) : ''}`;
    const sublines = [];

    if (notes.length > 0 && !onlyWeightNotes) {
      for (const note of notes) {
        if (isWeegschaalWeightNoteToken(note)) continue;
        sublines.push({
          text: `▪ ${note.label}`,
          amount: getItemNoteLinePrice(item, note),
        });
      }
    }

    const mainAmount = onlyWeightNotes ? computeLineTotal(item) : getItemBaseLinePrice(item);

    lines.push({
      id: String(item.id),
      mainText,
      mainAmount,
      sublines,
    });
  }

  const summed = roundCurrency(lines.reduce((s, row) => {
    let line = row.mainAmount;
    for (const sl of row.sublines) line = roundCurrency(line + (Number(sl.amount) || 0));
    return s + line;
  }, 0));

  const totalFromOrder = Number(order.total);
  const total =
    Number.isFinite(totalFromOrder) && totalFromOrder > 0
      ? roundCurrency(totalFromOrder)
      : summed;

  return {
    orderId: order.id != null ? String(order.id) : null,
    customerName: customerNameFromOrder(order),
    lines,
    total,
    currency: 'EUR',
  };
}
