const mongoose = require('mongoose');
const Purchase = require('./purchase.model');
const Product  = require('../products/product.model');

/**
 * Purchase / GRN service.
 *
 * THE INVARIANT THIS MUST NOT BREAK
 *   product.stock === sum(product.variantStock[].stock)
 *
 *   sale.service.js moves a variant cell and root stock in one atomic update so
 *   root never drifts. Three other paths violated that and were fixed
 *   (adjustStock, bulkAuditAdjust, bulkRestockProducts). Posting a GRN is the
 *   FOURTH path that moves stock, so it moves the cell and root together, in a
 *   transaction, or not at all.
 *
 * WHY POSTING IS A SEPARATE STEP FROM SAVING
 *   A half-typed purchase must not inflate inventory. A draft touches nothing; only
 *   `post` moves stock. That also makes the reverse well-defined: cancelling
 *   applies the exact negative of what was posted, read from the recorded movement
 *   rather than recomputed from lines that might have been edited.
 */

const oid = (v) => new mongoose.Types.ObjectId(String(v));
const r2  = (n) => Math.round((Number(n) || 0) * 100) / 100;

const shopScope = (user, shopId) => {
  if (shopId) return { shopId: oid(shopId) };
  if (user.role === 'super_admin') return {};
  return { shopId: { $in: (user.shops || []).map(oid) } };
};

const assertShopAccess = (user, shopId) => {
  if (user.role === 'super_admin') return;
  if (!(user.shops || []).some((s) => String(s) === String(shopId))) {
    throw Object.assign(new Error('No access to this shop'), { status: 403 });
  }
};

/** Recompute every stored total from the lines. Never trusted from the client. */
function computeTotals(doc) {
  let subTotal = 0, totalGst = 0, totalUnits = 0;

  for (const l of doc.lines || []) {
    const qty  = Math.max(0, Number(l.quantity) || 0);
    const cost = Math.max(0, Number(l.costPrice) || 0);
    const gross = qty * cost;
    const afterDiscount = Math.max(0, gross - (Number(l.discount) || 0));

    // A line's GST may be given explicitly (matching the supplier's invoice to the
    // paisa) or derived from its rate. The explicit figure wins, because the
    // invoice is the document of record.
    const gst = Number(l.gstAmount) > 0
      ? Number(l.gstAmount)
      : afterDiscount * ((Number(l.gstRate) || 0) / 100);

    subTotal   += afterDiscount;
    totalGst   += gst;
    totalUnits += qty;
  }

  const charges = (Number(doc.freightCharges) || 0) + (Number(doc.otherCharges) || 0);
  const netTotal = subTotal + totalGst + charges - (Number(doc.invoiceDiscount) || 0);

  return {
    subTotal:   r2(subTotal),
    totalGst:   r2(totalGst),
    netTotal:   r2(Math.max(0, netTotal)),
    totalUnits,
  };
}

/**
 * Validate lines against the products they reference.
 *
 * Catches the mistakes that would corrupt inventory: a negative quantity, a
 * variant product without a size/colour, a size/colour on a product that does not
 * track variants, and a product belonging to another shop.
 */
async function validateLines(lines, shopId) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw Object.assign(new Error('A purchase needs at least one line'), { status: 400 });
  }

  const ids = [...new Set(lines.map((l) => String(l.product)))];
  const products = await Product.find({ _id: { $in: ids } })
    .select('name sku stock trackVariantStock variantStock shopId isActive')
    .lean();
  const byId = Object.fromEntries(products.map((p) => [String(p._id), p]));

  const seen = new Set();
  const clean = [];

  for (const [i, l] of lines.entries()) {
    const at = `Line ${i + 1}`;
    const p = byId[String(l.product)];
    if (!p) throw Object.assign(new Error(`${at}: product not found`), { status: 400 });
    if (String(p.shopId) !== String(shopId)) {
      // Tenant isolation at the line level, not just the document.
      throw Object.assign(new Error(`${at}: product belongs to a different shop`), { status: 403 });
    }

    const qty = Number(l.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw Object.assign(new Error(`${at}: quantity must be greater than 0`), { status: 400 });
    }
    const cost = Number(l.costPrice);
    if (!Number.isFinite(cost) || cost < 0) {
      throw Object.assign(new Error(`${at}: cost price cannot be negative`), { status: 400 });
    }

    const size  = String(l.size  ?? '').trim();
    const color = String(l.color ?? '').trim();

    if (p.trackVariantStock) {
      if (!size && !color) {
        throw Object.assign(
          new Error(`${at}: "${p.name}" tracks stock per variant — specify a size and/or colour`),
          { status: 400 }
        );
      }
    } else if (size || color) {
      throw Object.assign(
        new Error(`${at}: "${p.name}" does not track variants — remove the size/colour`),
        { status: 400 }
      );
    }

    // Two lines for the same cell would each be applied; merging is the caller's
    // job so the GRN mirrors the supplier's invoice exactly.
    const key = `${String(l.product)}|${color}|${size}`;
    if (seen.has(key)) {
      throw Object.assign(
        new Error(`${at}: duplicate line for the same product/variant — combine them`),
        { status: 400 }
      );
    }
    seen.add(key);

    clean.push({
      product: oid(l.product),
      name: p.name,
      sku:  p.sku || '',
      size, color,
      quantity: Math.floor(qty),
      costPrice: cost,
      gstRate:   Math.min(100, Math.max(0, Number(l.gstRate) || 0)),
      gstAmount: Math.max(0, Number(l.gstAmount) || 0),
      discount:  Math.max(0, Number(l.discount)  || 0),
    });
  }

  return clean;
}

/**
 * Build the bulkWrite ops that move stock.
 *
 * `sign` +1 receives goods, −1 reverses a posting. A variant line moves the
 * matching cell AND root together in one update — that lockstep is what keeps
 * root from drifting from the breakdown.
 *
 * On a reversal the guards refuse to take either the cell or root below zero:
 * goods may already have been sold, and silently going negative would corrupt
 * inventory rather than surface the conflict.
 */
function buildStockOps(lines, sign) {
  return lines.map((l) => {
    const delta = sign * l.quantity;
    const isVariant = !!(l.size || l.color);

    if (isVariant) {
      const filter = {
        _id: l.product,
        variantStock: { $elemMatch: { size: l.size, color: l.color } },
      };
      if (sign < 0) {
        // Reversal: both the cell and the total must be able to absorb it.
        filter.variantStock = { $elemMatch: { size: l.size, color: l.color, stock: { $gte: l.quantity } } };
        filter.stock = { $gte: l.quantity };
      }
      return {
        updateOne: {
          filter,
          update: { $inc: { 'variantStock.$.stock': delta, stock: delta } },
        },
      };
    }

    const filter = { _id: l.product };
    if (sign < 0) filter.stock = { $gte: l.quantity };
    return { updateOne: { filter, update: { $inc: { stock: delta } } } };
  });
}

/**
 * Cells a receiving line refers to that do not exist yet.
 * A genuinely new size arriving from the supplier is normal, so posting creates
 * the cell at zero first and then increments it — rather than failing, or worse,
 * incrementing root without a matching cell and breaking the invariant.
 */
async function ensureVariantCells(lines, session) {
  const variantLines = lines.filter((l) => l.size || l.color);
  if (variantLines.length === 0) return;

  const ids = [...new Set(variantLines.map((l) => String(l.product)))];
  const products = await Product.find({ _id: { $in: ids } }, null, { session })
    .select('variantStock trackVariantStock')
    .lean();
  const byId = Object.fromEntries(products.map((p) => [String(p._id), p]));

  const ops = [];
  for (const l of variantLines) {
    const p = byId[String(l.product)];
    const exists = (p?.variantStock || []).some((v) => v.size === l.size && v.color === l.color);
    if (!exists) {
      ops.push({
        updateOne: {
          filter: { _id: l.product },
          update: { $push: { variantStock: { size: l.size, color: l.color, stock: 0 } } },
        },
      });
    }
  }
  if (ops.length) await Product.bulkWrite(ops, { session, ordered: true });
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

async function createPurchase(user, data) {
  assertShopAccess(user, data.shopId);
  const lines = await validateLines(data.lines, data.shopId);

  const doc = new Purchase({
    ...data,
    lines,
    status: 'draft',          // never posted on create — posting is explicit
    ownerId: user.ownerId || user._id,
    addedBy: user._id,
  });
  Object.assign(doc, computeTotals(doc));
  await doc.save();
  return doc;
}

/** Only a draft may be edited in place. */
async function updatePurchase(id, user, data) {
  const doc = await Purchase.findById(id);
  if (!doc) throw Object.assign(new Error('Purchase not found'), { status: 404 });
  assertShopAccess(user, doc.shopId);

  if (doc.status !== 'draft') {
    throw Object.assign(
      new Error(`A ${doc.status} purchase cannot be edited. Cancel it and post a corrected one, `
              + 'so the stock ledger keeps explaining itself.'),
      { status: 409 }
    );
  }

  const { status, movements, postedAt, postedBy, cancelledAt, cancelledBy,
          ownerId, addedBy, ...safe } = data;   // lifecycle is service-controlled
  Object.assign(doc, safe);
  if (data.lines) doc.lines = await validateLines(data.lines, doc.shopId);
  Object.assign(doc, computeTotals(doc));
  await doc.save();
  return doc;
}

/**
 * Post the GRN: goods received, inventory increased.
 *
 * Transactional so a partial application is impossible — either every line lands
 * or none does, and the document's status matches reality.
 */
async function postPurchase(id, user) {
  const doc = await Purchase.findById(id);
  if (!doc) throw Object.assign(new Error('Purchase not found'), { status: 404 });
  assertShopAccess(user, doc.shopId);

  if (doc.status === 'posted')    throw Object.assign(new Error('Already posted'), { status: 409 });
  if (doc.status === 'cancelled') throw Object.assign(new Error('A cancelled purchase cannot be posted'), { status: 409 });

  // Re-validate at post time: a product may have changed since the draft was typed.
  doc.lines = await validateLines(doc.lines, doc.shopId);
  Object.assign(doc, computeTotals(doc));

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await ensureVariantCells(doc.lines, session);

      const ops = buildStockOps(doc.lines, +1);
      const result = await Product.bulkWrite(ops, { session, ordered: false });
      if (result.modifiedCount < doc.lines.length) {
        throw Object.assign(
          new Error('Could not apply every line to inventory — refresh and retry'),
          { status: 409 }
        );
      }

      doc.status   = 'posted';
      doc.postedAt = new Date();
      doc.postedBy = user._id;
      doc.movements.push({
        by: user._id,
        action: 'post',
        source: 'PURCHASE_GRN',
        lines: doc.lines.map((l) => ({
          product: l.product, size: l.size, color: l.color, delta: l.quantity,
        })),
      });
      await doc.save({ session });
    });
  } finally {
    await session.endSession();
  }

  return doc;
}

/**
 * Cancel a posted GRN: reverse exactly what was applied.
 *
 * The reversal is read from the recorded movement, not recomputed from the lines,
 * so it undoes what actually happened even if the document has drifted.
 */
async function cancelPurchase(id, user, { reason } = {}) {
  const doc = await Purchase.findById(id);
  if (!doc) throw Object.assign(new Error('Purchase not found'), { status: 404 });
  assertShopAccess(user, doc.shopId);

  if (doc.status === 'cancelled') throw Object.assign(new Error('Already cancelled'), { status: 409 });

  // A draft never moved stock, so cancelling it is just a status change.
  if (doc.status === 'draft') {
    doc.status = 'cancelled';
    doc.cancelledAt = new Date();
    doc.cancelledBy = user._id;
    doc.cancelReason = reason || '';
    await doc.save();
    return doc;
  }

  const postMovement = [...doc.movements].reverse().find((m) => m.action === 'post');
  if (!postMovement) {
    throw Object.assign(new Error('No posting movement recorded — cannot reverse safely'), { status: 409 });
  }

  const reverseLines = postMovement.lines.map((l) => ({
    product: l.product, size: l.size || '', color: l.color || '', quantity: Math.abs(l.delta),
  }));

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const ops = buildStockOps(reverseLines, -1);
      const result = await Product.bulkWrite(ops, { session, ordered: false });
      if (result.modifiedCount < reverseLines.length) {
        // The usual cause: the goods have already been sold. Refusing is correct —
        // the alternative is negative stock, i.e. corrupt inventory.
        throw Object.assign(
          new Error('Cannot reverse — some of these goods have already been sold. '
                  + 'Record a purchase return instead.'),
          { status: 409 }
        );
      }

      doc.status = 'cancelled';
      doc.cancelledAt = new Date();
      doc.cancelledBy = user._id;
      doc.cancelReason = reason || '';
      doc.movements.push({
        by: user._id,
        action: 'cancel',
        source: 'PURCHASE_GRN',
        lines: reverseLines.map((l) => ({
          product: l.product, size: l.size, color: l.color, delta: -l.quantity,
        })),
      });
      await doc.save({ session });
    });
  } finally {
    await session.endSession();
  }

  return doc;
}

// ── Reads ─────────────────────────────────────────────────────────────────────

async function getPurchases(user, query = {}) {
  const { shopId, status, supplier, startDate, endDate, page = 1, limit = 20 } = query;
  const filter = { ...shopScope(user, shopId) };
  if (status)   filter.status = status;
  if (supplier) filter.supplierName = new RegExp(String(supplier).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (startDate || endDate) {
    filter.invoiceDate = {};
    if (startDate) filter.invoiceDate.$gte = new Date(startDate);
    if (endDate)   filter.invoiceDate.$lte = new Date(new Date(endDate).setHours(23, 59, 59));
  }

  const lim  = Math.min(Number(limit) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * lim;

  const [purchases, total] = await Promise.all([
    Purchase.find(filter).sort({ invoiceDate: -1 }).skip(skip).limit(lim)
      .populate('postedBy', 'name').populate('addedBy', 'name').lean(),
    Purchase.countDocuments(filter),
  ]);
  return { purchases, total, page: Number(page), limit: lim };
}

/**
 * Purchases in a period — the `Purchases` term of Opening + Purchases − Closing.
 * Only POSTED documents count: a draft has not received goods.
 */
async function getPurchaseTotals(user, shopId, start, end) {
  const rows = await Purchase.aggregate([
    {
      $match: {
        ...shopScope(user, shopId),
        status: 'posted',
        invoiceDate: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$itcStatus',
        goodsValue: { $sum: '$subTotal' },
        gst:        { $sum: '$totalGst' },
        units:      { $sum: '$totalUnits' },
        count:      { $sum: 1 },
      },
    },
  ]);

  const acc = { purchasesValue: 0, purchaseGstEligible: 0, purchaseGstReview: 0,
                purchaseGstNotEligible: 0, units: 0, count: 0 };
  for (const r of rows) {
    acc.purchasesValue += r.goodsValue;
    acc.units += r.units;
    acc.count += r.count;
    if (r._id === 'eligible')          acc.purchaseGstEligible += r.gst;
    else if (r._id === 'not_eligible') acc.purchaseGstNotEligible += r.gst;
    else                               acc.purchaseGstReview += r.gst;
  }
  for (const k of Object.keys(acc)) acc[k] = k === 'units' || k === 'count' ? acc[k] : r2(acc[k]);
  return acc;
}

/** Closing stock valuation at cost, from current inventory. */
async function getStockValuation(user, shopId) {
  const rows = await Product.aggregate([
    { $match: { ...shopScope(user, shopId), isActive: true } },
    {
      $group: {
        _id: null,
        value: { $sum: { $multiply: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$costPrice', 0] }] } },
        units: { $sum: { $ifNull: ['$stock', 0] } },
        skus:  { $sum: 1 },
      },
    },
  ]);
  return {
    closingStockValue: r2(rows[0]?.value || 0),
    closingUnits: rows[0]?.units || 0,
    skuCount: rows[0]?.skus || 0,
    // Valuation is as of NOW, not as of the period end — there is no historical
    // snapshot to value against yet. Stated so the tax module cannot imply otherwise.
    asOf: new Date(),
    isPointInTime: true,
  };
}

module.exports = {
  createPurchase, updatePurchase, postPurchase, cancelPurchase,
  getPurchases, getPurchaseTotals, getStockValuation,
  // Exported for tests.
  computeTotals, validateLines, buildStockOps,
};
