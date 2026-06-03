import PDFDocument from 'pdfkit';

function parseJson(str, fallback) {
  try {
    return JSON.parse(String(str ?? ''));
  } catch {
    return fallback;
  }
}

/**
 * Simple A4 invoice PDF from an InvoicingDocument DB row (matches data stored by POS / webpanel).
 */
export function renderInvoiceDocPdfBuffer(row) {
  const customer = parseJson(row.customerJson, {});
  let items = parseJson(row.itemsJson, []);
  if (!Array.isArray(items)) items = [];

  const docDate = row.documentDate instanceof Date ? row.documentDate : new Date(row.documentDate);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).fillColor('#111111').text(`Invoice ${row.displayNumber}`, { underline: true });
    doc.moveDown(0.6);
    doc.fontSize(10).fillColor('#444444').text(`Date: ${docDate.toLocaleDateString('nl-BE')}`);
    doc.moveDown(1);

    doc.fontSize(11).fillColor('#111111').text('Bill to');
    doc.moveDown(0.3);
    doc.fontSize(10);
    [
      customer.name,
      customer.subName,
      customer.street,
      customer.postalCity,
      customer.country,
      customer.vatNumber ? `VAT: ${customer.vatNumber}` : '',
      customer.email ? customer.email : '',
    ]
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .forEach((line) => doc.fillColor('#333333').text(line));

    doc.moveDown(1);
    doc.fontSize(11).fillColor('#111111').text('Line items', { underline: true });
    doc.moveDown(0.6);

    doc.fontSize(10).fillColor('#222222');
    for (const it of items) {
      const qty = Number(it.qty) || 0;
      const desc = String(it.description ?? '').slice(0, 160);
      const amt = (Number(it.totalIncl) || 0).toFixed(2);
      doc.text(`Quantity: ${qty}`, { continued: false });
      doc.text(desc, { indent: 12 });
      doc.text(`Line total: EUR ${amt}`, { indent: 12 });
      doc.moveDown(0.4);
    }

    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#111111');
    doc.text(`Subtotal (excl. VAT): EUR ${(Number(row.subtotalExcl) || 0).toFixed(2)}`);
    doc.text(`VAT: EUR ${(Number(row.vatTotal) || 0).toFixed(2)}`);
    doc.fontSize(12).text(`Total (incl. VAT): EUR ${(Number(row.totalIncl) || 0).toFixed(2)}`);
    doc.moveDown(0.3);
    if ((Number(row.dueAmount) || 0) > 0.009) {
      doc.fontSize(10).fillColor('#991b1b').text(`Due: EUR ${(Number(row.dueAmount) || 0).toFixed(2)}`);
    }

    doc.end();
  });
}
