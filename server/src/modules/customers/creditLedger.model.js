const mongoose = require('mongoose');

/**
 * CreditLedger — tracks credit sales and repayments per customer per shop.
 *
 * Each entry is one transaction:
 *   type='credit'  → customer owes money (sale on credit)
 *   type='repay'   → customer paid back
 *
 * `balance` is a running total stored denormalized for O(1) lookup.
 * A positive balance means the customer still owes money.
 */
const creditLedgerSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    shopId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Shop',     required: true },
    saleId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Sale',     default: null },
    type:       { type: String, enum: ['credit', 'repay'], required: true },
    amount:     { type: Number, required: true, min: 0 },   // always positive
    balance:    { type: Number, required: true, min: 0 },   // running balance after this entry
    notes:      { type: String, maxlength: 300 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

creditLedgerSchema.index({ customerId: 1, shopId: 1, createdAt: -1 });
creditLedgerSchema.index({ shopId: 1, createdAt: -1 });

module.exports = mongoose.model('CreditLedger', creditLedgerSchema);
