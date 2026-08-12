const mongoose = require('mongoose');

/**
 * Purchase / Goods Received Note.
 *
 * The single record of stock coming IN, and the source of the `Purchases` term in
 * Opening + Purchases − Closing. Before this existed, stock arrived by editing a
 * product or nudging adjustStock, so there was no auditable answer to "where did
 * these 100 pairs come from and what did they cost".
 *
 * STATUS IS THE WHOLE DESIGN
 *   draft     — being typed. Touches NOTHING. Editable freely.
 *   posted    — goods received. Inventory has been increased. Immutable in place.
 *   cancelled — the posting was reversed. Inventory has been decreased again.
 *
 *   A posted GRN is never silently rewritten: correcting one means cancelling it
 *   (which reverses the movement) and posting a replacement, so the stock ledger
 *   always explains itself. `postedAt`/`cancelledAt` plus the movement log are the
 *   audit trail.
 */

const purchaseLineSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Snapshotted so the GRN still reads correctly if the product is later renamed.
    name:    { type: String, default: '' },
    sku:     { type: String, default: '' },

    /**
     * Variant identity. '' means "this axis does not apply", matching the
     * convention sale.service.js matches on — a size-only product stores color:''.
     * For a variant-tracked product at least one of these must be set.
     */
    size:  { type: String, default: '' },
    color: { type: String, default: '' },

    quantity:  { type: Number, required: true, min: 0 },
    // Cost per unit, exclusive of GST. Snapshotted for accounting: this is what
    // the goods cost on this date, regardless of later price changes.
    costPrice: { type: Number, required: true, min: 0 },

    gstRate:   { type: Number, default: 0, min: 0, max: 100 },
    gstAmount: { type: Number, default: 0, min: 0 },

    // Per-line trade discount, before tax.
    discount:  { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/** One inventory movement caused by this GRN. Append-only. */
const movementSchema = new mongoose.Schema(
  {
    _id: false,
    at:     { type: Date, default: Date.now },
    by:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // 'post' increased stock; 'cancel' reversed it.
    action: { type: String, enum: ['post', 'cancel'], required: true },
    // Every stock change records where it came from, so a discrepancy can be traced.
    source: { type: String, default: 'PURCHASE_GRN' },
    // [{ product, size, color, delta }] exactly as applied.
    lines:  [{
      _id: false,
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      size:    { type: String, default: '' },
      color:   { type: String, default: '' },
      delta:   { type: Number, required: true },
    }],
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    // ── Supplier & document ──────────────────────────────────────────────────
    supplierName:  { type: String, required: true, trim: true },
    supplierGstin: { type: String, trim: true, default: '' },
    invoiceNumber: { type: String, required: true, trim: true },
    invoiceDate:   { type: Date, required: true },

    lines: {
      type: [purchaseLineSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'A purchase needs at least one line',
      },
    },

    // ── Charges outside the line items ───────────────────────────────────────
    freightCharges: { type: Number, default: 0, min: 0 },
    otherCharges:   { type: Number, default: 0, min: 0 },
    // Invoice-level discount, applied after line discounts.
    invoiceDiscount: { type: Number, default: 0, min: 0 },

    // ── Computed totals, stored so a historical GRN never re-derives from
    //    today's rates. Set by the service, not the client. ──
    subTotal:   { type: Number, default: 0 },   // sum(qty × cost) − line discounts
    totalGst:   { type: Number, default: 0 },
    netTotal:   { type: Number, default: 0 },   // subTotal + GST + charges − discount
    totalUnits: { type: Number, default: 0 },

    // ── Payment ──────────────────────────────────────────────────────────────
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },
    paidAmount:    { type: Number, default: 0, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'upi', 'card', 'cheque', 'credit', 'other'],
      default: 'credit',
    },

    // ── Tax treatment. Same three-valued caution as expenses: the software never
    //    decides that purchase GST is claimable. ──
    itcStatus: { type: String, enum: ['eligible', 'not_eligible', 'review'], default: 'review' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },

    notes:      { type: String, trim: true, default: '' },
    attachment: { type: String, default: '' },   // invoice scan, data URL

    // ── Lifecycle ────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['draft', 'posted', 'cancelled'],
      default: 'draft',
    },
    postedAt:    { type: Date, default: null },
    postedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelReason: { type: String, trim: true, default: '' },

    // Points at the GRN this one corrects, when a posted GRN was replaced.
    replacesPurchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', default: null },

    movements: [movementSchema],

    shopId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

/** Total cash the supplier is owed, or was paid. */
purchaseSchema.virtual('balanceDue').get(function () {
  return +Math.max(0, (this.netTotal || 0) - (this.paidAmount || 0)).toFixed(2);
});

purchaseSchema.set('toJSON',   { virtuals: true });
purchaseSchema.set('toObject', { virtuals: true });

purchaseSchema.index({ shopId: 1, invoiceDate: -1 });
purchaseSchema.index({ shopId: 1, status: 1, invoiceDate: -1 });
/**
 * Duplicate-invoice detection: the same supplier invoice must not be entered
 * twice for a shop. Partial so cancelled documents do not block re-entry of a
 * corrected one, and so drafts can be duplicated while being typed.
 */
purchaseSchema.index(
  { shopId: 1, supplierName: 1, invoiceNumber: 1 },
  { unique: true, partialFilterExpression: { status: 'posted' } }
);

module.exports = mongoose.model('Purchase', purchaseSchema);
