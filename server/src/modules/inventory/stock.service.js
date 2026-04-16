const StockSnapshot = require('./stockSnapshot.model');

/**
 * updateStockSnapshot — atomic increment/decrement on the snapshot.
 *
 * @param {object} opts
 * @param {string|ObjectId} opts.productId
 * @param {string|ObjectId} opts.shopId
 * @param {number}          opts.qtyChange  — always positive
 * @param {'IN'|'OUT'}      opts.type       — IN = sale return / GRN; OUT = sale
 * @param {object}          [opts.session]  — Mongoose session (for transactions)
 *
 * Returns the updated snapshot document.
 */
async function updateStockSnapshot({ productId, shopId, qtyChange, type, session }) {
  if (!productId || !shopId) throw new Error('productId and shopId are required');
  if (qtyChange <= 0)        throw new Error('qtyChange must be > 0');

  const delta = type === 'IN' ? qtyChange : -qtyChange;

  const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
  if (session) opts.session = session;

  const snapshot = await StockSnapshot.findOneAndUpdate(
    { productId, shopId, locationId: null },
    {
      $inc: { physical: delta, available: delta, version: 1 },
      $set: { updatedAt: new Date() },
    },
    opts
  );

  return snapshot;
}

/**
 * reserveStock — called when a SalesOrder is confirmed.
 * Moves qty from available → reserved (physical unchanged).
 * Throws if available stock is insufficient.
 */
async function reserveStock({ productId, shopId, qty, session }) {
  const opts = { new: true };
  if (session) opts.session = session;

  const snapshot = await StockSnapshot.findOneAndUpdate(
    { productId, shopId, locationId: null, available: { $gte: qty } },
    {
      $inc: { reserved: qty, available: -qty, version: 1 },
    },
    opts
  );

  if (!snapshot) {
    const current = await StockSnapshot.findOne({ productId, shopId }).lean();
    const avail   = current?.available ?? 0;
    throw Object.assign(
      new Error(`Insufficient stock — available: ${avail}, requested: ${qty}`),
      { status: 409 }
    );
  }

  return snapshot;
}

/**
 * releaseReservation — called when SalesOrder is cancelled.
 * Moves qty from reserved → available.
 */
async function releaseReservation({ productId, shopId, qty, session }) {
  const opts = { new: true };
  if (session) opts.session = session;

  return StockSnapshot.findOneAndUpdate(
    { productId, shopId, locationId: null },
    { $inc: { reserved: -Math.abs(qty), available: Math.abs(qty), version: 1 } },
    opts
  );
}

/**
 * getStockSummary — fast O(1) read for a single product.
 * Falls back to { physical:0, reserved:0, available:0, incoming:0 } if not found.
 */
async function getStockSummary({ productId, shopId }) {
  const snap = await StockSnapshot.findOne({ productId, shopId, locationId: null }).lean();
  return snap || { physical: 0, reserved: 0, available: 0, incoming: 0 };
}

/**
 * getLowStockProducts — returns all productIds where available <= threshold.
 * Used by alert cron and dashboard badge.
 */
async function getLowStockProducts({ shopId, threshold = 10 }) {
  return StockSnapshot.find({ shopId, available: { $lte: threshold } })
    .populate('productId', 'name sku unit lowStockThreshold')
    .lean();
}

/**
 * bulkUpdateFromSale — called after a sale is created.
 * Decrements available for every item in the sale.
 * Runs OUTSIDE the Mongoose transaction (snapshot is best-effort, product.stock
 * is the authoritative guard inside the transaction).
 */
async function bulkUpdateFromSale({ items, shopId }) {
  const ops = items.map((item) => ({
    updateOne: {
      filter: { productId: item.product || item.productId, shopId, locationId: null },
      update: {
        $inc: { physical: -item.quantity, available: -item.quantity, version: 1 },
        $set: { updatedAt: new Date() },
      },
      upsert: true,
    },
  }));

  if (ops.length) await StockSnapshot.bulkWrite(ops, { ordered: false });
}

/**
 * bulkUpdateFromRefund — called after a sale is refunded.
 * Increments available for every item in the refund.
 */
async function bulkUpdateFromRefund({ items, shopId }) {
  const ops = items.map((item) => ({
    updateOne: {
      filter: { productId: item.product || item.productId, shopId, locationId: null },
      update: {
        $inc: { physical: item.quantity, available: item.quantity, version: 1 },
        $set: { updatedAt: new Date() },
      },
      upsert: true,
    },
  }));

  if (ops.length) await StockSnapshot.bulkWrite(ops, { ordered: false });
}

module.exports = {
  updateStockSnapshot,
  reserveStock,
  releaseReservation,
  getStockSummary,
  getLowStockProducts,
  bulkUpdateFromSale,
  bulkUpdateFromRefund,
};
