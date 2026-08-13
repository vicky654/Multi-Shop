/**
 * Sample invoice generator.
 *
 * WHAT MAKES THIS A *REAL* SAMPLE
 *   The numbers are not typed in. The line items are run through `computeInvoice`
 *   — the same GST engine that prices every real bill — using the shop's own
 *   gstMode, state code and round-off setting. So the CGST/SGST split, the
 *   discount handling, the inclusive/exclusive treatment and the statutory
 *   round-off all behave exactly as they will on the owner's first real invoice.
 *   If the GST engine changes, this sample changes with it.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   It never writes to the database. A sample bill must not appear in sales,
 *   reports, GST returns or stock movements — that would corrupt the very figures
 *   the owner is learning to read. It also does not consume an invoice number
 *   from the shop's real sequence; it is labelled SAMPLE instead, so it can never
 *   be mistaken for, or reconciled against, a genuine invoice.
 */
const { computeInvoice } = require('../../utils/gst');

/**
 * Realistic line items for a footwear/general shop.
 * Chosen to demonstrate the things owners ask about: a normal line, a line with
 * a per-item discount, a different GST rate, and a variant (size/colour) line.
 */
const SAMPLE_LINES = [
  { name: 'Running Shoe — Blue / 9', price: 2499, quantity: 1, taxRate: 12, discountPct: 0,  size: '9', color: 'Blue' },
  { name: 'Canvas Sneaker — 8',      price: 1299, quantity: 2, taxRate: 12, discountPct: 10, size: '8', color: '' },
  { name: 'Cotton Socks (3 pack)',   price: 249,  quantity: 3, taxRate: 5,  discountPct: 0 },
  { name: 'Shoe Care Kit',           price: 399,  quantity: 1, taxRate: 0,  discountPct: 0 },
];

/**
 * Build a sample sale object shaped exactly like a persisted Sale.
 *
 * The client renders it with the very same <InvoiceReceipt> component used for
 * real bills, so what the owner sees here is what their invoice will look like.
 *
 * @param {object} shop  the owner's real shop doc (name, gst config, address)
 * @returns {{sale: object, shop: object}}
 */
function buildSampleInvoice(shop = {}) {
  const gstMode = shop.gstMode || 'exclusive';
  const sellerStateCode = shop.stateCode || null;
  const scheme = shop.gstScheme || 'regular';
  // Composition and unregistered shops must not show GST on an invoice — the
  // sample has to teach the correct behaviour for THIS shop, not a generic one.
  const collectsGst = scheme === 'regular';

  const lines = SAMPLE_LINES.map((l) => ({
    ...l,
    taxRate: collectsGst ? l.taxRate : 0,
  }));

  const invoice = computeInvoice({
    lines,
    gstMode,
    sellerStateCode,
    placeOfSupplyCode: sellerStateCode,   // walk-in customer: same state
    roundOff: shop.invoiceRoundOff !== false,
  });

  const items = lines.map((l, i) => {
    const d = invoice.lines?.[i] || {};
    return {
      name:      l.name,
      price:     l.price,
      quantity:  l.quantity,
      size:      l.size || '',
      color:     l.color || '',
      taxRate:   l.taxRate,
      discount:  l.discountPct || 0,
      subtotal:  d.lineTotal ?? l.price * l.quantity,
      costPrice: undefined,   // not shown on a customer invoice
    };
  });

  const total = invoice.grandTotal;

  return {
    shop,
    sale: {
      // Clearly marked so it can never be mistaken for a real invoice, and so it
      // does not collide with the shop's real invoice series.
      invoiceNumber: 'SAMPLE-0001',
      isSample:      true,
      createdAt:     new Date(),
      items,
      // <InvoiceReceipt> reads customerId?.name || customerName, so use the
      // field a real walk-in sale actually carries.
      customerName:  'Walk-in Customer',
      customerPhone: '',
      // Split payment, because that is the part owners most often want to see.
      paymentMethod: 'split',
      payments: [
        { method: 'cash', amount: Math.round(total / 2) },
        { method: 'upi',  amount: total - Math.round(total / 2) },
      ],
      subtotal:    invoice.grossAmount,
      discount:    invoice.discountAmount,
      taxAmount:   invoice.totalTax,
      roundOff:    invoice.roundOff,
      totalAmount: total,
      // Field names match what a persisted Sale carries, so <InvoiceReceipt>
      // reads this sample through exactly the same paths as a real bill.
      gst: {
        taxableAmount: invoice.taxableAmount,
        cgstAmount:    invoice.cgstAmount,
        sgstAmount:    invoice.sgstAmount,
        igstAmount:    invoice.igstAmount,
        totalTax:      invoice.totalTax,
        // The receipt reads round-off from gst, not from the sale root.
        roundOff:      invoice.roundOff,
        interState:    invoice.interState,
        stateKnown:    invoice.stateKnown,
        placeOfSupply: invoice.placeOfSupply,
        mode:          gstMode,
        scheme,
      },
      // Surfaced in the UI so a composition-scheme owner understands why their
      // sample shows no tax lines, instead of assuming the sample is broken.
      gstNote: collectsGst
        ? null
        : `This shop is registered as "${scheme}", so GST is not charged on invoices.`,
    },
  };
}

module.exports = { buildSampleInvoice, SAMPLE_LINES };
