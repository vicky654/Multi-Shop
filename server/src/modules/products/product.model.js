const mongoose = require('mongoose');

const colorSchema = new mongoose.Schema(
  { name: { type: String, required: true }, hex: { type: String, required: true } },
  { _id: false }
);

// Per-variant stock entry: keyed by size+color combination
const variantStockSchema = new mongoose.Schema(
  {
    size:  { type: String, default: '' },   // '' means "no size"
    color: { type: String, default: '' },   // color name, '' means "no color"
    stock: { type: Number, default: 0, min: 0 },

    // ── Optional per-variant pricing ──────────────────────────────────────────
    // null means "inherit the product-level value". These MUST NOT default to 0:
    // a 0 `price` would sell the variant for free and a 0 `costPrice` would
    // report fake profit on every sale. sale.service.js reads them as
    //     variant?.price ?? product.price
    // so null is what makes the fallback work. Only populated when
    // hasVariantPricing is true; product.normalize.js strips them otherwise.
    costPrice:     { type: Number, default: null, min: 0 },
    price:         { type: Number, default: null, min: 0 },
    discount:      { type: Number, default: null, min: 0, max: 100 }, // canonical %
    // Kept only so the wizard reopens showing "₹200 off" rather than "15.384%".
    discountType:  { type: String, enum: ['none', 'percent', 'fixed', null], default: null },
    discountValue: { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    category:     { type: String, required: true, trim: true },
    subCategory:  { type: String, trim: true },          // Mens / Womens / Kids
    price:        { type: Number, required: true, min: 0 },   // selling price
    costPrice:    { type: Number, required: true, min: 0 },   // purchase/cost price
    discount:     { type: Number, default: 0, min: 0, max: 100 }, // % discount
    stock:        { type: Number, default: 0, min: 0 },   // total / fallback stock
    barcode:      { type: String, trim: true },
    sku:          { type: String, trim: true },
    unit:         { type: String, default: 'pcs' },
    description:  { type: String },
    image:        { type: String },                     // backward compat (first image)
    images:       [{ type: String }],                   // multiple images (base64 or URL)
    sizes:        [{ type: String }],                   // e.g. ['S','M','L','XL','XXL']
    colors:       [colorSchema],                        // [{name,hex}]
    // ── Per-variant stock ──────────────────────────────────────────────────────
    trackVariantStock: { type: Boolean, default: false },
    variantStock:      [variantStockSchema],             // populated when trackVariantStock=true
    // ── Batch / expiry tracking ────────────────────────────────────────────────
    batchNumber:  { type: String, trim: true },
    expiryDate:   { type: Date },
    lowStockThreshold: { type: Number, default: 10 },

    // ── ERP phase fields ───────────────────────────────────────────────────────
    hsnCode:       { type: String, trim: true },               // GST compliance
    taxType:       { type: String, enum: ['taxable', 'exempt', 'nil_rated', 'zero_rated'], default: 'taxable' },
    trackBatch:    { type: Boolean, default: false },          // enable batch tracking
    trackExpiry:   { type: Boolean, default: false },          // enable expiry tracking
    reorderPoint:  { type: Number, default: 0 },               // auto-reorder trigger
    minStock:      { type: Number, default: 0 },
    maxStock:      { type: Number, default: 0 },

    // ── Wizard pricing fields ──────────────────────────────────────────────────
    brand:         { type: String, trim: true, default: '' },
    // The markup the user actually typed, retained so the wizard reopens showing
    // "30%" instead of re-deriving it from price/cost. `price` stays authoritative.
    profitPercent: { type: Number, default: null, min: 0 },
    // `discount` above remains the CANONICAL percent that billing reads. These
    // two exist only so a rupee discount reopens as "₹200 off" rather than
    // "15.384%" — product.normalize.js keeps `discount` in sync with them.
    discountType:  { type: String, enum: ['none', 'percent', 'fixed'], default: 'none' },
    discountValue: { type: Number, default: 0, min: 0 },
    // null = no product-level rate, so billing falls back to the invoice taxRate.
    // Defaulting this to 0 would silently zero the tax on every product that
    // existed before this field did — hence null, and `== null` checks in billing.
    gstRate:       { type: Number, default: null, min: 0, max: 100 },
    hasVariantPricing: { type: Boolean, default: false },

    shopId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    ownerId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isActive:     { type: Boolean, default: true },
    isFeatured:   { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isTrending:   { type: Boolean, default: false },
    isDemo:       { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────
productSchema.virtual('finalPrice').get(function () {
  return +(this.price * (1 - this.discount / 100)).toFixed(2);
});

productSchema.virtual('isLowStock').get(function () {
  return this.stock <= this.lowStockThreshold;
});

productSchema.virtual('profitMargin').get(function () {
  const fp = this.price * (1 - this.discount / 100);
  return fp > 0 ? Math.round(((fp - this.costPrice) / fp) * 100) : 0;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// ── Auto-generate SKU before first save ───────────────────────────────────────
productSchema.pre('save', function (next) {
  if (!this.sku) {
    const prefix = (this.category || 'PRD').substring(0, 3).toUpperCase();
    const rand   = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.sku     = `${prefix}-${rand}-${Date.now().toString().slice(-4)}`;
  }
  // Keep backward-compat `image` in sync with first element of `images`
  if (this.images && this.images.length > 0) this.image = this.images[0];
  next();
});

// ── Indexes ───────────────────────────────────────────────────────────────────
productSchema.index({ shopId: 1, isActive: 1 });
productSchema.index({ barcode: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ subCategory: 1, shopId: 1 });
productSchema.index({ isFeatured: 1, shopId: 1 });
productSchema.index({ isTrending: 1, shopId: 1 });
productSchema.index({ isNewArrival: 1, shopId: 1 });
productSchema.index({ name: 'text', category: 'text', description: 'text', sku: 'text', barcode: 'text', brand: 'text' });
productSchema.index({ shopId: 1, brand: 1 });
// Low-stock queries: { isActive:1, stock:1, shopId:1 } — used by alerts & insights
productSchema.index({ shopId: 1, isActive: 1, stock: 1 });
// ERP phase: sorting by most-recently modified, fast pagination
productSchema.index({ shopId: 1, updatedAt: -1 });
productSchema.index({ shopId: 1, createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
