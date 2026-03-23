const mongoose = require('mongoose');

const colorSchema = new mongoose.Schema(
  { name: { type: String, required: true }, hex: { type: String, required: true } },
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
    stock:        { type: Number, default: 0, min: 0 },
    barcode:      { type: String, trim: true },
    sku:          { type: String, trim: true },
    unit:         { type: String, default: 'pcs' },
    description:  { type: String },
    image:        { type: String },                     // backward compat (first image)
    images:       [{ type: String }],                   // multiple images (base64 or URL)
    sizes:        [{ type: String }],                   // e.g. ['S','M','L','XL','XXL']
    colors:       [colorSchema],                        // [{name,hex}]
    lowStockThreshold: { type: Number, default: 10 },
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
productSchema.index({ name: 'text', category: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
