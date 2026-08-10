const mongoose = require('mongoose');

/**
 * InvoiceCounter — atomic per-shop, per-financial-year invoice sequence.
 *
 * REPLACES a real concurrency bug. sale.model.js previously did:
 *
 *     const count = await this.constructor.countDocuments({ shopId });
 *     this.invoiceNumber = `INV-${pad(count + 1)}-${Date.now().toString().slice(-4)}`;
 *
 * Two sales created in the same moment both read the same `count`, so both build
 * the same sequence number. The unique index on `invoiceNumber` then rejects one
 * of them — a *failed sale at the counter*, not just a cosmetic duplicate. The
 * 4-digit time suffix reduced the odds but never removed them, and it also made
 * invoice numbers non-sequential, which GST audits dislike.
 *
 * findOneAndUpdate with $inc and upsert is a single atomic MongoDB operation, so
 * every caller receives a distinct, gap-free sequence even under load.
 *
 * Scoped per shop AND per financial year: Indian invoice series conventionally
 * restart each FY, and tenants must never share a series.
 */
const invoiceCounterSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    // Indian financial year label, e.g. "2026-27"
    fy:     { type: String, required: true },
    seq:    { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

// One counter document per shop+FY; the unique index makes the upsert safe.
invoiceCounterSchema.index({ shopId: 1, fy: 1 }, { unique: true });

const InvoiceCounter = mongoose.model('InvoiceCounter', invoiceCounterSchema);

/** Indian FY runs 1 April → 31 March. April 2026 → "2026-27". */
function financialYear(date = new Date()) {
  const y = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/**
 * Reserve the next invoice number for a shop.
 *
 * @param {ObjectId} shopId
 * @param {object}   [opts]
 * @param {string}   [opts.prefix='INV'] shop-configurable series prefix
 * @param {ClientSession} [opts.session]  pass the sale's transaction session
 * @returns {Promise<{invoiceNumber: string, seq: number, fy: string}>}
 */
async function nextInvoiceNumber(shopId, { prefix = 'INV', session } = {}) {
  const fy = financialYear();

  const counter = await InvoiceCounter.findOneAndUpdate(
    { shopId, fy },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );

  const seq = counter.seq;
  return {
    seq,
    fy,
    // e.g. INV/2026-27/000123 — sequential, per-shop, per-FY, audit-friendly
    invoiceNumber: `${prefix}/${fy}/${String(seq).padStart(6, '0')}`,
  };
}

module.exports = { InvoiceCounter, nextInvoiceNumber, financialYear };
