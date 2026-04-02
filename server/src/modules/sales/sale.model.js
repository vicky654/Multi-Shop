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
    status:     { type: String, enum: ['completed', 'refunded', 'pending'], default: 'completed' },
    // For customer-placed orders (online shop)
    customerName:  { type: String },
    customerPhone: { type: String },
    isOnlineOrder: { type: Boolean, default: false },
    isDemo:        { type: Boolean, default: false },
    // ── Private Mode — hide from analytics & exports ───────────────────────
    isPrivate:     { type: Boolean, default: false },
    // ── Credit sales — amount still owed by customer ───────────────────────
    dueAmount:     { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-generate invoice number before save
saleSchema.pre('save', async function (next) {
  if (!this.invoiceNumber) {
    const count = await this.constructor.countDocuments({ shopId: this.shopId });
    const pad   = String(count + 1).padStart(5, '0');
    this.invoiceNumber = `INV-${pad}-${Date.now().toString().slice(-4)}`;
  }
  next();
});

saleSchema.index({ shopId: 1, createdAt: -1 });
saleSchema.index({ customerId: 1 });
saleSchema.index({ status: 1, shopId: 1 });
// Compound index for report queries: filter by shop+status, sort by date
saleSchema.index({ shopId: 1, status: 1, createdAt: -1 });
// For online order listing filtered by shop
saleSchema.index({ shopId: 1, isOnlineOrder: 1, createdAt: -1 });

module.exports = mongoose.model('Sale', saleSchema);
