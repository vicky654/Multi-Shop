const mongoose = require('mongoose');

const purchaseHistorySchema = new mongoose.Schema(
  {
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    amount: Number,
    date:   Date,
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String },
    shopId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalPurchases: { type: Number, default: 0 },
    totalSpent:     { type: Number, default: 0 },
    purchaseHistory: [purchaseHistorySchema],
    notes:   { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.index({ shopId: 1, phone: 1 });
customerSchema.index({ name: 'text', phone: 'text' });

module.exports = mongoose.model('Customer', customerSchema);
