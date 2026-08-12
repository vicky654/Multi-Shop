const mongoose = require('mongoose');

/**
 * Opening stock valuation for a financial year.
 *
 * The last missing term in Opening + Purchases − Closing. It cannot be
 * reconstructed retroactively — inventory holds only current state — so it must be
 * SNAPSHOTTED, and from then on the periodic COGS figure becomes auditable.
 *
 * Recording a snapshot never touches sales, purchases or stock. It only writes
 * down what inventory was worth at the moment it was taken.
 */
const openingStockSchema = new mongoose.Schema(
  {
    shopId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    financialYear: { type: String, required: true },   // '2026-27'

    units: { type: Number, required: true, min: 0 },
    value: { type: Number, required: true, min: 0 },   // at cost

    takenAt:   { type: Date, default: Date.now },
    takenBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    takenByName: { type: String, default: '' },
    note:      { type: String, trim: true, default: '' },

    /**
     * True when the snapshot was taken after the year had already started, so it
     * is an approximation of the opening position rather than the position on
     * 1 April. Surfaced so a report can say so instead of implying precision.
     */
    takenLate: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One opening snapshot per shop per year.
openingStockSchema.index({ shopId: 1, financialYear: 1 }, { unique: true });

module.exports = mongoose.model('OpeningStock', openingStockSchema);
