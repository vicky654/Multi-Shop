const mongoose = require('mongoose');

/**
 * Expense categories.
 *
 * The original six ('rent', 'electricity', 'salary', 'maintenance', 'supplies',
 * 'other') are kept FIRST and unchanged so every existing row stays valid — this
 * is an enum, and dropping a value would make historical expenses unreadable.
 * The rest are the categories a shop actually needs for an accurate expense
 * ledger.
 */
const EXPENSE_TYPES = [
  // ── Original values — do not remove or reorder ──
  'rent', 'electricity', 'salary', 'maintenance', 'supplies', 'other',
  // ── Added for tax/accounting completeness ──
  'internet_phone',
  'packaging',
  'transport_freight',
  'advertising',
  'software_subscription',
  'professional_fees',
  'bank_charges',
  'insurance',
  'utilities_other',
];

/**
 * Input tax credit eligibility.
 *
 * Deliberately three-valued and defaulting to 'review'. The software must never
 * decide that a purchase's GST is claimable — ITC has conditions (a valid tax
 * invoice, a registered supplier, business use, blocked-credit rules) that only a
 * human can confirm. 'review' is EXCLUDED from every credit total, so an
 * unreviewed expense can never quietly inflate a claim.
 */
const ITC_STATUS = ['eligible', 'not_eligible', 'review'];

/** Whether the expense is deductible against business profit. Same reasoning. */
const DEDUCTION_STATUS = ['deductible', 'not_deductible', 'review'];

const expenseSchema = new mongoose.Schema(
  {
    type: { type: String, enum: EXPENSE_TYPES, required: true },

    // Amount EXCLUSIVE of GST — the deductible business cost.
    amount:      { type: Number, required: true, min: 0 },
    // GST paid on this purchase, tracked separately because it is a potential
    // credit rather than a cost. Never folded into `amount`.
    gstAmount:   { type: Number, default: 0, min: 0 },
    gstRate:     { type: Number, default: null, min: 0, max: 100 },

    date:        { type: Date, required: true, default: Date.now },
    description: { type: String },

    // ── Documentation. ITC and deductibility both depend on evidence existing,
    //    so the fields are here to be checked rather than assumed. ──
    vendorName:    { type: String, trim: true, default: '' },
    vendorGstin:   { type: String, trim: true, default: '' },
    invoiceNumber: { type: String, trim: true, default: '' },
    invoiceDate:   { type: Date, default: null },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'upi', 'card', 'cheque', 'other'],
      default: 'cash',
    },
    // Why this is a business cost. Required reading for any later audit.
    businessPurpose: { type: String, trim: true, default: '' },
    // Receipt image/PDF as a data URL, matching how product images are stored.
    attachment:      { type: String, default: '' },

    // ── Human-confirmed treatment. Defaults are the cautious ones. ──
    itcStatus:       { type: String, enum: ITC_STATUS, default: 'review' },
    deductionStatus: { type: String, enum: DEDUCTION_STATUS, default: 'review' },
    // Audit trail for the confirmation itself, so a claim can always be traced
    // to the person who approved it.
    reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt:      { type: Date, default: null },
    reviewNote:      { type: String, trim: true, default: '' },

    // Capital purchases are depreciated, not expensed, so they are excluded from
    // the expense deduction and linked to their asset record instead.
    isCapitalAsset:  { type: Boolean, default: false },
    assetId:         { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessAsset', default: null },

    shopId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    ownerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    addedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDemo:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

/** Total cash out — cost plus the GST paid on it. */
expenseSchema.virtual('totalPaid').get(function () {
  return +((this.amount || 0) + (this.gstAmount || 0)).toFixed(2);
});

/**
 * Whether this row carries the documentation an ITC claim needs. Reported to the
 * owner as a compliance warning; it does NOT auto-set eligibility.
 */
expenseSchema.virtual('hasItcDocumentation').get(function () {
  return !!(this.vendorGstin && this.invoiceNumber && (this.gstAmount || 0) > 0);
});

expenseSchema.set('toJSON',   { virtuals: true });
expenseSchema.set('toObject', { virtuals: true });

expenseSchema.index({ shopId: 1, date: -1 });
// Tax reporting slices by treatment within a period.
expenseSchema.index({ shopId: 1, itcStatus: 1, date: -1 });
expenseSchema.index({ shopId: 1, deductionStatus: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
module.exports.EXPENSE_TYPES    = EXPENSE_TYPES;
module.exports.ITC_STATUS       = ITC_STATUS;
module.exports.DEDUCTION_STATUS = DEDUCTION_STATUS;
