const mongoose = require('mongoose');

/**
 * StockSnapshot — materialized current stock per product+shop+location.
 *
 * Never read stock by aggregating StockLedger entries in a hot path.
 * Always read from here (O(1) lookup). Rebuilt atomically on every
 * stock-moving event: sale, refund, GRN post, adjustment.
 */
const stockSnapshotSchema = new mongoose.Schema(
  {
    productId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    shopId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Shop',    required: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, default: null }, // null = default/untracked

    // Physical units currently in warehouse (confirmed receipts minus confirmed sales)
    physical:  { type: Number, default: 0 },

    // Units locked by confirmed Sales Orders (not yet invoiced)
    reserved:  { type: Number, default: 0 },

    // physical - reserved — the only field billing should read
    available: { type: Number, default: 0 },

    // Units on the way (approved POs not yet received) — informational
    incoming:  { type: Number, default: 0 },

    // Optimistic concurrency — bump on every write
    version:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Fast lookup — the hot read path
stockSnapshotSchema.index({ productId: 1, shopId: 1, locationId: 1 }, { unique: true });

// Low-stock dashboard query: all products below threshold for a shop
stockSnapshotSchema.index({ shopId: 1, available: 1 });

module.exports = mongoose.model('StockSnapshot', stockSnapshotSchema);
