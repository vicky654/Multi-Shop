/**
 * Invoice → PDF.
 *
 * Takes the SAME `{ sale, shop }` pair that the client's <InvoiceReceipt>
 * renders, so the PDF and the on-screen receipt are two renderings of one data
 * structure rather than two independent implementations that drift apart. It
 * therefore works for a real persisted sale exactly as it does for the sample.
 *
 * The money figures are read straight off the sale; nothing is recomputed here.
 * Recomputing would risk a PDF that disagrees with the invoice the customer was
 * shown, which is the one thing a tax document must never do.
 */
const { PdfDoc, PAGE, MARGIN } = require('../../utils/pdf');

const money = (n) => {
  const v = Number(n) || 0;
  // Indian grouping (1,23,456.78) — what every other total in the app uses.
  const [int, dec] = Math.abs(v).toFixed(2).split('.');
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${v < 0 ? '-' : ''}${grouped}.${dec}`;
};

const dateStr = (d) => {
  const dt = d ? new Date(d) : new Date();
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * @param {{sale: object, shop: object}} input
 * @returns {Buffer}
 */
function renderInvoicePdf({ sale = {}, shop = {} }) {
  const doc = new PdfDoc();
  const right = PAGE.width - MARGIN;
  const items = Array.isArray(sale.items) ? sale.items : [];

  // ── Header band ─────────────────────────────────────────────────────────────
  doc.box(MARGIN, MARGIN, doc.contentWidth, 58, 0.96);
  doc.text(shop.name || 'Shop', { x: MARGIN + 12, y: MARGIN + 22, size: 16, bold: true });
  const addr = [shop.address, shop.phone].filter(Boolean).join('  •  ');
  if (addr) doc.text(addr, { x: MARGIN + 12, y: MARGIN + 38, size: 8.5, gray: 0.35 });
  if (shop.gstNumber) {
    doc.text(`GSTIN: ${shop.gstNumber}`, { x: MARGIN + 12, y: MARGIN + 50, size: 8.5, gray: 0.35 });
  }

  doc.text('TAX INVOICE', { x: right - 12, y: MARGIN + 22, size: 13, bold: true, align: 'right' });
  if (sale.isSample) {
    // Unmistakable, so a sample can never be filed as a real invoice.
    doc.text('SAMPLE — NOT A REAL SALE', {
      x: right - 12, y: MARGIN + 38, size: 8.5, bold: true, align: 'right', gray: 0.45,
    });
  }

  doc.y = MARGIN + 78;

  // ── Meta ────────────────────────────────────────────────────────────────────
  doc.text(`Invoice: ${sale.invoiceNumber || '-'}`, { y: doc.y, size: 9.5, bold: true });
  doc.text(`Date: ${dateStr(sale.createdAt)}`, { y: doc.y, size: 9.5, align: 'right', x: right });
  doc.move(14);
  doc.text(`Customer: ${sale.customerId?.name || sale.customerName || 'Walk-in Customer'}`,
    { y: doc.y, size: 9.5 });
  const method = String(sale.paymentMethod || '').toUpperCase();
  if (method) doc.text(`Payment: ${method}`, { y: doc.y, size: 9.5, align: 'right', x: right });
  doc.move(13);
  if (sale.gst?.placeOfSupply) {
    doc.text(
      `Place of supply: ${sale.gst.placeOfSupply}${sale.gst.interState ? ' (inter-state)' : ''}`,
      { y: doc.y, size: 8.5, gray: 0.4 }
    );
    doc.move(13);
  }

  doc.move(4);

  // ── Items table ─────────────────────────────────────────────────────────────
  // Column x positions: name is left-aligned, everything numeric right-aligned
  // to its column edge so the decimal points line up.
  const COL = {
    name: MARGIN + 4,
    qty:  MARGIN + 268,
    rate: MARGIN + 340,
    gst:  MARGIN + 400,
    amt:  right - 4,
  };

  doc.box(MARGIN, doc.y, doc.contentWidth, 20, 0.92);
  const headY = doc.y + 14;
  doc.text('Item', { x: COL.name, y: headY, size: 9, bold: true });
  doc.text('Qty',  { x: COL.qty,  y: headY, size: 9, bold: true, align: 'right' });
  doc.text('Rate', { x: COL.rate, y: headY, size: 9, bold: true, align: 'right' });
  doc.text('GST',  { x: COL.gst,  y: headY, size: 9, bold: true, align: 'right' });
  doc.text('Amount', { x: COL.amt, y: headY, size: 9, bold: true, align: 'right' });
  doc.y += 20;

  // One row = a fixed 18pt band, plus an optional 11pt discount sub-line. Every
  // cell in a row is drawn at the SAME baseline, and the cursor advances exactly
  // once at the end. The earlier version nudged `doc.y` back and forth around the
  // discount line, which left names and quantities on a different baseline from
  // their own amounts — visible as misaligned columns in the extracted text.
  const ROW_H = 18;
  const SUB_H = 11;

  items.forEach((it, idx) => {
    const hasDiscount = (it.discount || 0) > 0;
    const bandH = ROW_H + (hasDiscount ? SUB_H : 0);
    if (idx % 2 === 1) doc.box(MARGIN, doc.y, doc.contentWidth, bandH, 0.975);

    const baseline = doc.y + 13;

    // Variant label belongs with the name — a bare "Running Shoe" on an invoice
    // is not enough to identify which pair left the shop.
    const variant = [it.color, it.size].filter(Boolean).join(' / ');
    let label = it.name || '';
    if (variant && !label.includes(variant)) label += ` (${variant})`;
    // Truncate rather than overlap the Qty column.
    const maxChars = 44;
    if (label.length > maxChars) label = `${label.slice(0, maxChars - 1)}...`;

    doc.text(label, { x: COL.name, y: baseline, size: 9 });
    doc.text(String(it.quantity ?? ''), { x: COL.qty, y: baseline, size: 9, align: 'right' });
    doc.text(money(it.price), { x: COL.rate, y: baseline, size: 9, align: 'right' });
    doc.text(it.taxRate ? `${it.taxRate}%` : '-', { x: COL.gst, y: baseline, size: 9, align: 'right' });
    doc.text(money(it.subtotal ?? (it.price || 0) * (it.quantity || 0)),
      { x: COL.amt, y: baseline, size: 9, align: 'right' });

    if (hasDiscount) {
      doc.text(`discount ${it.discount}% applied`,
        { x: COL.name + 8, y: baseline + SUB_H, size: 7.5, gray: 0.45 });
    }

    doc.y += bandH;
  });

  doc.rule({ y: doc.y, gray: 0.6 });
  doc.move(16);

  // ── Totals ──────────────────────────────────────────────────────────────────
  const labelX = right - 150;
  const row = (label, value, opt = {}) => {
    doc.text(label, { x: labelX, y: doc.y, size: opt.size ?? 9.5, bold: opt.bold, gray: opt.gray ?? 0.25 });
    doc.text(value, { x: right, y: doc.y, size: opt.size ?? 9.5, bold: opt.bold, align: 'right' });
    doc.move(opt.gap ?? 14);
  };

  const g = sale.gst || {};
  row('Subtotal', money(sale.subtotal ?? 0));
  if ((sale.discount ?? 0) > 0) row('Discount', `- ${money(sale.discount)}`);
  if (g.taxableAmount != null) row('Taxable value', money(g.taxableAmount));
  if ((g.cgstAmount ?? 0) > 0) row('CGST', `+ ${money(g.cgstAmount)}`);
  if ((g.sgstAmount ?? 0) > 0) row('SGST', `+ ${money(g.sgstAmount)}`);
  if ((g.igstAmount ?? 0) > 0) row('IGST', `+ ${money(g.igstAmount)}`);
  // Round-off is shown even when negative, because the invoice must reconcile:
  // taxable + tax + roundOff = total.
  if (g.roundOff) row('Round off', `${g.roundOff < 0 ? '-' : '+'} ${money(Math.abs(g.roundOff))}`);

  doc.rule({ y: doc.y - 4, x1: labelX, gray: 0.6 });
  doc.move(6);
  row('TOTAL', money(sale.totalAmount ?? 0), { size: 12, bold: true, gray: 0, gap: 18 });

  // ── Split payments ──────────────────────────────────────────────────────────
  if (Array.isArray(sale.payments) && sale.payments.length > 1) {
    doc.move(2);
    doc.text('Payment split', { y: doc.y, size: 9, bold: true, gray: 0.3 });
    doc.move(13);
    sale.payments.forEach((p) => {
      doc.text(`  ${String(p.method || '').toUpperCase()}`, { y: doc.y, size: 9, gray: 0.3 });
      doc.text(money(p.amount), { x: right, y: doc.y, size: 9, align: 'right' });
      doc.move(12);
    });
  }

  // ── Notes / footer ──────────────────────────────────────────────────────────
  if (sale.gstNote) {
    doc.move(8);
    doc.text(sale.gstNote, { y: doc.y, size: 8, gray: 0.4 });
    doc.move(12);
  }

  const footY = PAGE.height - MARGIN - 14;
  doc.rule({ y: footY - 12, gray: 0.85 });
  doc.text(
    sale.isSample
      ? 'Sample invoice generated by MultiShop using your shop\'s real GST settings.'
      : 'Thank you for your business.',
    { y: footY, size: 8, gray: 0.45, align: 'center', x: PAGE.width / 2 }
  );

  return doc.build();
}

module.exports = { renderInvoicePdf, money };
