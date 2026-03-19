const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
  {
    product:       { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name:          { type: String, required: true },
    price:         { type: Number, required: true },
    costPrice:     { type: Number, required: true, default: 0 },
    quantity:      { type: Number, required: true, min: 1 },
    discount:      { type: Number, default: 0 },   // % discount on item
    subtotal:      { type: Number, required: true },
    profit:        { type: Number, default: 0 },
    selectedSize:  { type: String, default: '' },  // e.g. 'L'
    selectedColor: { type: String, default: '' },  // e.g. 'Red'
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

module.exports = mongoose.model('Sale', saleSchema);
