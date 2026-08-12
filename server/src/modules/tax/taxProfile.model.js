const mongoose = require('mongoose');

/**
 * Per-shop tax configuration, and the home for accountant-confirmed rates.
 *
 * Rates live HERE rather than in code because they change by tax year and because
 * the person accountable for them is the shop's accountant, not this software.
 * `ruleSets` is keyed by financial year ('2026-27'), so a rate change is a data
 * edit against one year and never silently rewrites a prior year's numbers.
 *
 * Nothing here is defaulted to a real-world rate. An unconfirmed year yields no
 * tax estimate at all — see taxRules.js.
 */
const taxProfileSchema = new mongoose.Schema(
  {
    shopId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, unique: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // ── How this business is taxed ──────────────────────────────────────────
    entityType: {
      type: String,
      enum: ['individual', 'firm', 'company'],
      default: 'individual',
    },
    /**
     * 'normal'          — actual profit: income − expenses − depreciation
     * 'presumptive_44ad'— deemed profit as a % of turnover; expenses do NOT reduce it
     */
    incomeTaxBasis: {
      type: String,
      enum: ['normal', 'presumptive_44ad'],
      default: 'normal',
    },
    /**
     * GST scheme. Composition dealers cannot claim input tax credit, so this
     * decides whether the ITC tracker applies at all.
     */
    gstScheme: {
      type: String,
      enum: ['regular', 'composition', 'unregistered'],
      default: 'regular',
    },
    // Composition rates differ by dealer kind.
    dealerKind: {
      type: String,
      enum: ['trader', 'manufacturer', 'restaurant'],
      default: 'trader',
    },

    /**
     * Accountant-supplied rates, keyed by financial year. Shape mirrors
     * taxRules.emptyRuleSet(). Mixed because the shape is defined and validated in
     * that module rather than duplicated here.
     */
    ruleSets: { type: Map, of: mongoose.Schema.Types.Mixed, default: () => new Map() },

    // ── Professional oversight ──────────────────────────────────────────────
    accountantName:  { type: String, trim: true, default: '' },
    accountantEmail: { type: String, trim: true, default: '' },

    /**
     * Append-only audit of every configuration change. Tax settings alter the
     * numbers an owner may file against, so who changed what and when is not
     * optional.
     */
    auditLog: [{
      _id: false,
      at:        { type: Date, default: Date.now },
      by:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      byName:    { type: String, default: '' },
      action:    { type: String, default: '' },   // e.g. 'confirm_rates:2026-27'
      financialYear: { type: String, default: '' },
      // Human-readable diff, e.g. ['cessPct: null -> 4'].
      changes:   [{ type: String }],
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('TaxProfile', taxProfileSchema);
