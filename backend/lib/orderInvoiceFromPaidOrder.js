/**
 * Build POST body for normalizeInvoicingDocumentSavePayload from a paid POS order.
 */
export function buildPaidOrderInvoiceRequestBody(order) {
  if (!order?.customer) {
    throw new Error('Order has no customer.');
  }
  const c = order.customer;
  const email = String(c.email ?? '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Customer email is missing or invalid.');
  }

  const company = String(c.companyName ?? '').trim();
  const person = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  const fallbackName = String(c.name ?? '').trim();
  const displayName = company || person || fallbackName || 'Customer';
  const customerJson = {
    name: displayName,
    subName: company && person ? person : '',
    street: String(c.street ?? '').trim(),
    postalCity: [String(c.postalCode ?? '').trim(), String(c.city ?? '').trim()].filter(Boolean).join(' '),
    country: String(c.country ?? '').trim(),
    vatNumber: String(c.vatNumber ?? '').trim(),
    email,
  };

  const items = [];
  let subtotalExcl = 0;
  let totalIncl = 0;

  for (const oi of order.items || []) {
    const qty = Math.max(1, Math.floor(Number(oi.quantity) || 1));
    const priceIncl = Math.round(Math.max(0, Number(oi.price) || 0) * 100) / 100;
    const vatRate = Math.round(Math.max(0, Number(oi.product?.vat) || 0) * 100) / 100;
    const lineIncl = Math.round(priceIncl * qty * 100) / 100;
    const priceExcl =
      vatRate > 0 ? Math.round((priceIncl / (1 + vatRate / 100)) * 100) / 100 : priceIncl;
    const lineExcl = Math.round(priceExcl * qty * 100) / 100;

    const descParts = [oi.product?.name || 'Item'];
    const notes = String(oi.notes ?? '').trim();
    if (notes) descParts.push(notes);
    const description = descParts.join(' — ').slice(0, 2000);

    items.push({
      qty,
      description,
      totalIncl: lineIncl,
      perPieceIncl: priceIncl,
      perPieceExcl: priceExcl,
      discount: 0,
      vat: vatRate,
    });
    subtotalExcl += lineExcl;
    totalIncl += lineIncl;
  }

  if (items.length === 0) {
    throw new Error('Order has no line items.');
  }

  subtotalExcl = Math.round(subtotalExcl * 100) / 100;
  totalIncl = Math.round(totalIncl * 100) / 100;
  const vatTotal = Math.round((totalIncl - subtotalExcl) * 100) / 100;

  return {
    kind: 'invoice-tickets',
    layout: 'standard',
    docLang: 'nl',
    paymentTerm: '',
    paymentMethod: 'Invoice',
    documentDate: new Date().toISOString(),
    alreadyPaid: totalIncl,
    notes: `POS order ${order.id}`,
    attachmentPos: 'above',
    attachmentText: '',
    customerId: order.customerId,
    customerJson,
    items,
    subtotalExcl,
    vatTotal,
    totalIncl,
    dueAmount: 0,
  };
}
