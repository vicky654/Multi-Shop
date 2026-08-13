const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
  {
    product:       { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name:          { type: String, required: true },
    price:         { type: Number, required: true },
    costPrice:     { type: Number, required: true, default: 0 },
    quantity:      { type: Number, required: true, min: 0.001 },  // fractional support
    discount:      { type: Number, default: 0 },   // % discount on item
    subtotal:      { type: Number, required: true },
    profit:        { type: Number, default: 0 },
    selectedSize:  { type: String, default: '' },  // e.g. 'L'
    selectedColor: { type: String, default: '' },  // e.g. 'Red'
    refundedQty:   { type: Number, default: 0 },   // partial refund tracking
    // Snapshotted product identifiers so the invoice stays accurate even if
    // the product is later renamed, re-SKU'd or deleted.
    sku:           { type: String, default: '' },
    hsnCode:       { type: String, default: '' },
    unit:          { type: String, default: 'pcs' },
  },
  { _id: false }
);

// ── Audit trail — one entry per modification of a completed bill ──────────────
const saleEditSchema = new mongoose.Schema(
  {
    editedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    editedByName: { type: String, default: '' },   // denormalised so history survives user deletion
    editedByRole: { type: String, default: '' },
    editedAt:     { type: Date, default: Date.now },
    reason:       { type: String, required: true, maxlength: 300 },
    before: {
      totalAmount:   Number,
      taxAmount:     Number,
      taxRate:       Number,
      totalDiscount: Number,
      itemCount:     Number,
      paymentMethod: String,
    },
    after: {
      totalAmount:   Number,
      taxAmount:     Number,
      taxRate:       Number,
      totalDiscount: Number,
      itemCount:     Number,
      paymentMethod: String,
    },
    // Human-readable diff, e.g. ['Pepsi 1L: qty 4 → 2', 'Removed Lays']
    changes:      [{ type: String }],
  },
  { _id: false }
);

// ── UPI QR transaction record ─────────────────────────────────────────────────
const upiTxnSchema = new mongoose.Schema(
  {
    refId:         { type: String, default: '' },  // our reference, embedded in the QR as `tr`
    transactionId: { type: String, default: '' },  // UTR / reference the cashier confirms
    vpa:           { type: String, default: '' },  // payee VPA the QR was generated for
    amount:        { type: Number, default: 0 },   // amount encoded in the QR
    qrGeneratedAt: { type: Date },
    verifiedAt:    { type: Date },
    verifiedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    failureReason: { type: String, default: '' },
  },
  { _id: false }
);

// Split payment entry: one row per tender
const paymentEntrySchema = new mongoose.Schema(
  {
    method: { type: String, enum: ['cash', 'card', 'upi', 'credit'], required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true },
    items:         [saleItemSchema],
    totalAmount:   { type: Number, required: true },
    totalDiscount: { type: Number, default: 0 },
    totalProfit:   { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'credit'],
      default: 'cash',
    },
    // Split payment — populated when more than one tender is used
    payments:      [paymentEntrySchema],
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    shopId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    ownerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    staffId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes:      { type: String },
    taxAmount:  { type: Number, default: 0 },
    taxRate:    { type: Number, default: 0 },       // tax % applied at time of sale

    // ── GST breakdown (computed server-side by utils/gst.computeInvoice) ───────
    // Snapshotted at sale time so a later change to shop config can never
    // retroactively alter an issued invoice.
    gst: {
      mode:            { type: String, enum: ['exclusive', 'inclusive'], default: 'exclusive' },
      interState:      { type: Boolean, default: false },
      sellerGstin:     { type: String, default: '' },
      customerGstin:   { type: String, default: '' },
      sellerStateCode: { type: String, default: '' },
      placeOfSupplyCode: { type: String, default: '' },
      placeOfSupply:   { type: String, default: '' },
      taxableAmount:   { type: Number, default: 0 },
      cgstAmount:      { type: Number, default: 0 },
      sgstAmount:      { type: Number, default: 0 },
      igstAmount:      { type: Number, default: 0 },
      roundOff:        { type: Number, default: 0 },
      // Set when the shop had no state/GSTIN configured, so the intra-state
      // fallback was used. Surfaced on the invoice rather than hidden.
      configWarning:   { type: String, default: '' },
    },
    invoiceSeq: { type: Number },
    invoiceFy:  { type: String, default: '' },
    // 'pending'   — awaiting payment verification (UPI QR) or an online order
    // 'accepted'  — accepted by shop owner (stock deducted)
    // 'rejected'  — rejected by shop owner (stock untouched)
    // 'cancelled' — payment failed/cancelled before verification or cancelled by owner/customer; stock restored
    // 'draft'     — draft bill (stock untouched)
    status:     {
      type: String,
      enum: ['completed', 'accepted', 'refunded', 'pending', 'cancelled', 'rejected', 'draft'],
      default: 'completed',
    },

    // ── Payment lifecycle ──────────────────────────────────────────────────────
    // Cash/card/credit settle at the counter, so they are 'paid' on creation.
    // UPI QR starts 'pending' and only becomes 'paid' once a transaction
    // reference is recorded — a click alone never marks money as received.
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cancelled'],
      default: 'paid',
    },
    isUpiQr: { type: Boolean, default: false },  // settled via scan-to-pay QR
    upiTxn:  { type: upiTxnSchema, default: undefined },

    // ── Order Acceptance tracking ──────────────────────────────────────────────
    acceptedAt:      { type: Date, default: null },
    acceptedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedAt:      { type: Date, default: null },
    rejectedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, default: '' },

    // ── Modification audit trail ───────────────────────────────────────────────
    editHistory:  [saleEditSchema],
    editCount:    { type: Number, default: 0 },
    lastEditedAt: { type: Date },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // For customer-placed orders (online shop)
    customerName:  { type: String },
    customerPhone: { type: String },
    isOnlineOrder: { type: Boolean, default: false },
    isDemo:        { type: Boolean, default: false },
    // ── Private Mode — hide from analytics & exports ───────────────────────
    isPrivate:     { type: Boolean, default: false },
    // ── Credit sales — amount still owed by customer ───────────────────────
    dueAmount:     { type: Number, default: 0 },

    // ── Offline sync — UUID generated on the client when billing offline ────
    // NO `default: null`. A default would write an explicit null on every
    // online sale, and a `sparse` unique index does NOT skip nulls (it only
    // skips ABSENT fields) — so the second online sale ever would collide with
    // E11000 on { offlineId: null }. The field stays absent unless a real
    // offline UUID is supplied, and the index below is partial to match.
    offlineId: { type: String },
  },
  { timestamps: true }
);

// NOTE: invoice numbers are NOT generated here any more.
//
// This hook used to do  then pad the result, which two
// concurrent sales resolve identically — the unique index then failed one of the
// sales outright. Numbers are now reserved atomically by
// invoiceCounter.nextInvoiceNumber() inside the sale transaction.

saleSchema.index({ shopId: 1, createdAt: -1 });
saleSchema.index({ customerId: 1 });
saleSchema.index({ status: 1, shopId: 1 });
// Compound index for report queries: filter by shop+status, sort by date
saleSchema.index({ shopId: 1, status: 1, createdAt: -1 });
// For online order listing filtered by shop
saleSchema.index({ shopId: 1, isOnlineOrder: 1, createdAt: -1 });
// Partial unique index — enforces "no duplicate offline sync" ONLY over
// documents where offlineId is actually a string. A plain sparse index would
// still index (and therefore collide on) explicit nulls.
// Requires the legacy `offlineId_1` sparse index to be dropped first:
//   node src/scripts/fixOfflineIdIndex.js
saleSchema.index(
  { offlineId: 1 },
  { unique: true, partialFilterExpression: { offlineId: { $type: 'string' } } }
);
// Unsettled UPI QR bills — used to surface "awaiting payment" at the counter
saleSchema.index({ shopId: 1, paymentStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Sale', saleSchema);
