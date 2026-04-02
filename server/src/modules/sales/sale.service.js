const mongoose      = require('mongoose');
const Sale          = require('./sale.model');
const Product       = require('../products/product.model');
const Customer      = require('../customers/customer.model');
const Shop          = require('../shops/shop.model');
const cache         = require('../../utils/cache');
const ledgerService = require('../customers/creditLedger.service');

// ── Build enriched items from raw cart items ──────────────────────────────────
const enrichItems = async (items) => {
  let totalAmount = 0, totalDiscount = 0, totalProfit = 0;
  const enrichedItems = [];

  // Batch-fetch all products in one query instead of one per item
  const ids = [...new Set(items.map((i) => i.productId).filter(Boolean))];
  const products = await Product.find({ _id: { $in: ids }, isActive: true }).lean();
  const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

  for (const item of items) {
    const product = productMap[item.productId?.toString()];
    if (!product)
      throw Object.assign(new Error(`Product "${item.name || item.productId}" not found`), { status: 400 });

    const size  = item.selectedSize  || item.size  || '';
    const color = item.selectedColor || item.color || '';
    const qty   = Number(item.quantity);

    // ── Variant-level stock check ──────────────────────────────────────────────
    if (product.trackVariantStock && (size || color)) {
      const variant = (product.variantStock || []).find(
        (v) => v.size === size && v.color === color
      );
      if (!variant)
        throw Object.assign(new Error(`Variant (${size}/${color}) not found for "${product.name}"`), { status: 400 });
      if (variant.stock < qty)
        throw Object.assign(new Error(`Insufficient stock for "${product.name}" [${size}/${color}]`), { status: 400 });
    } else {
      if (product.stock < qty)
        throw Object.assign(new Error(`Insufficient stock for "${product.name}"`), { status: 400 });
    }

    const discount        = item.discount || 0;
    const productDiscount = product.discount || 0;
    const effectiveDisc   = Math.max(discount, productDiscount);
    const discountedPrice = product.price * (1 - effectiveDisc / 100);
    const subtotal        = +(discountedPrice * qty).toFixed(2);
    const profit          = +((discountedPrice - product.costPrice) * qty).toFixed(2);

    enrichedItems.push({
      product:       product._id,
      name:          product.name,
      price:         product.price,
      costPrice:     product.costPrice,
      quantity:      qty,
      discount:      effectiveDisc,
      subtotal,
      profit,
      selectedSize:  size,
      selectedColor: color,
      // Carry variant tracking flag for deductStock
      _trackVariant: product.trackVariantStock && !!(size || color),
    });

    totalAmount   += subtotal;
    totalDiscount += +((product.price - discountedPrice) * qty).toFixed(2);
    totalProfit   += profit;
  }

  return { enrichedItems, totalAmount, totalDiscount, totalProfit };
};

// ── Atomic stock deduction (runs inside a transaction session) ─────────────────
const deductStock = async (enrichedItems, session) => {
  const ops = enrichedItems.map((item) => {
    if (item._trackVariant) {
      // Decrement the matching variantStock entry atomically
      return {
        updateOne: {
          filter: {
            _id: item.product,
            variantStock: {
              $elemMatch: {
                size:  item.selectedSize,
                color: item.selectedColor,
                stock: { $gte: item.quantity },
              },
            },
          },
          update: { $inc: { 'variantStock.$.stock': -item.quantity } },
        },
      };
    }
    // Standard root-level stock deduction
    return {
      updateOne: {
        filter: { _id: item.product, stock: { $gte: item.quantity } },
        update: { $inc: { stock: -item.quantity } },
      },
    };
  });

  const result = await Product.bulkWrite(ops, { session, ordered: false });

  if (result.modifiedCount < enrichedItems.length) {
    throw Object.assign(
      new Error('One or more items ran out of stock — please refresh and retry'),
      { status: 409 }
    );
  }
};

// ── Admin (staff) sale ────────────────────────────────────────────────────────
const createSale = async (user, data) => {
  const { shopId, items, customerId, paymentMethod, payments, notes, taxRate = 0,
          isPrivate = false, dueAmount = 0 } = data;

  if (!items?.length) throw Object.assign(new Error('No items in sale'), { status: 400 });

  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === shopId)) {
    throw Object.assign(new Error('No access to this shop'), { status: 403 });
  }

  const { enrichedItems, totalAmount, totalDiscount, totalProfit } = await enrichItems(items);
  const taxAmount  = +(totalAmount * (taxRate / 100)).toFixed(2);
  const finalTotal = +(totalAmount + taxAmount).toFixed(2);
  const ownerId    = user.role === 'owner' ? user._id : (user.ownerId || user._id);

  // ── Resolve primary payment method (for backward compat) ─────────────────────
  // When payments[] is supplied, derive paymentMethod from largest tender.
  let resolvedMethod = paymentMethod || 'cash';
  let resolvedPayments = [];
  if (Array.isArray(payments) && payments.length > 0) {
    resolvedPayments = payments.filter((p) => p.amount > 0);
    const largest = resolvedPayments.reduce((a, b) => (b.amount > a.amount ? b : a), resolvedPayments[0]);
    resolvedMethod = largest?.method || 'cash';
  }

  // Strip internal _trackVariant flag before persisting
  const saleItems = enrichedItems.map(({ _trackVariant, ...rest }) => rest);

  const session = await mongoose.startSession();
  let sale;

  try {
    await session.withTransaction(async () => {
      // Deduct stock atomically — 409 if any item's stock is exhausted
      await deductStock(enrichedItems, session);

      // Create sale document inside the same transaction
      [sale] = await Sale.create([{
        items: saleItems,
        totalAmount: finalTotal,
        totalDiscount,
        totalProfit,
        taxAmount,
        taxRate,
        paymentMethod: resolvedMethod,
        payments:      resolvedPayments,
        customerId:    customerId || null,
        shopId,
        ownerId,
        staffId:    user._id,
        notes,
        status:     'completed',
        isPrivate:  !!isPrivate,
        dueAmount:  resolvedMethod === 'credit' ? Math.max(0, Number(dueAmount) || 0) : 0,
      }], { session });

      if (customerId) {
        await Customer.findByIdAndUpdate(
          customerId,
          {
            $inc:  { totalPurchases: 1, totalSpent: finalTotal },
            $push: { purchaseHistory: { saleId: sale._id, amount: finalTotal, date: sale.createdAt } },
          },
          { session }
        );
      }

      // ── Credit ledger entry ──────────────────────────────────────────────────
      if (resolvedMethod === 'credit' && customerId) {
        const creditAmt = resolvedPayments.find((p) => p.method === 'credit')?.amount ?? finalTotal;
        await ledgerService.recordCredit({
          customerId,
          shopId,
          saleId:     sale._id,
          amount:     creditAmt,
          notes:      notes || '',
          recordedBy: user._id,
        }, session);
      }
    });
  } finally {
    await session.endSession();
  }

  // Bust dashboard cache so next load sees fresh totals
  cache.del(`dashboard:${shopId}`);

  await sale.populate(['customerId', 'staffId', { path: 'shopId', select: 'name address phone currency taxRate logo' }]);
  return sale;
};

// ── Public (online customer) checkout ─────────────────────────────────────────
const createPublicSale = async (data) => {
  const { shopId, items, customerName, customerPhone, customerEmail, paymentMethod, notes } = data;

  if (!shopId)        throw Object.assign(new Error('shopId is required'), { status: 400 });
  if (!items?.length) throw Object.assign(new Error('No items in sale'), { status: 400 });
  if (!customerName || !customerPhone)
    throw Object.assign(new Error('Customer name and phone are required'), { status: 400 });

  const shop = await Shop.findById(shopId);
  if (!shop || !shop.isActive)
    throw Object.assign(new Error('Shop not found'), { status: 404 });

  const { enrichedItems, totalAmount, totalDiscount, totalProfit } = await enrichItems(items);
  const taxRate    = shop.taxRate || 0;
  const taxAmount  = totalAmount * (taxRate / 100);
  const finalTotal = totalAmount + taxAmount;

  const session = await mongoose.startSession();
  let sale;

  try {
    await session.withTransaction(async () => {
      await deductStock(enrichedItems, session);

      // Find-or-create customer within the transaction for consistency
      let customer = await Customer.findOne({ shopId, phone: customerPhone }, null, { session });
      if (!customer) {
        [customer] = await Customer.create([{
          name:    customerName,
          phone:   customerPhone,
          email:   customerEmail || '',
          shopId,
          ownerId: shop.owner,
        }], { session });
      }

      [sale] = await Sale.create([{
        items: enrichedItems,
        totalAmount:   finalTotal,
        totalDiscount,
        totalProfit,
        taxAmount,
        taxRate,
        paymentMethod: paymentMethod || 'cash',
        customerId:    customer._id,
        shopId,
        ownerId:       shop.owner,
        customerName,
        customerPhone,
        notes,
        status:        'pending',
        isOnlineOrder: true,
      }], { session });

      await Customer.findByIdAndUpdate(
        customer._id,
        {
          $inc:  { totalPurchases: 1, totalSpent: finalTotal },
          $push: { purchaseHistory: { saleId: sale._id, amount: finalTotal, date: sale.createdAt } },
        },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  cache.del(`dashboard:${shopId}`);

  await sale.populate([{ path: 'shopId', select: 'name address phone currency logo' }]);
  return sale;
};

// ── List sales ────────────────────────────────────────────────────────────────
const getSales = async (user, query) => {
  const { shopId, startDate, endDate, paymentMethod, status, page = 1, limit = 20 } = query;
  const filter = {};

  if (user.role !== 'super_admin') filter.shopId = { $in: user.shops };
  if (shopId)        filter.shopId        = shopId;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (status)        filter.status        = status;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate)   filter.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59));
  }

  const skip = (page - 1) * limit;
  const [sales, total] = await Promise.all([
    Sale.find(filter)
      .populate('customerId', 'name phone')
      .populate('staffId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Sale.countDocuments(filter),
  ]);

  return { sales, total, page: parseInt(page), limit: parseInt(limit) };
};

const getSaleById = async (id, user) => {
  const sale = await Sale.findById(id)
    .populate('customerId', 'name phone email')
    .populate('staffId', 'name')
    .populate('shopId', 'name address phone currency logo gstNumber')
    .populate('items.product', 'name barcode sku');

  if (!sale) throw Object.assign(new Error('Sale not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === sale.shopId._id.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });
  return sale;
};

const refundSale = async (id, user) => {
  const sale = await Sale.findById(id);
  if (!sale)                      throw Object.assign(new Error('Sale not found'), { status: 404 });
  if (sale.status === 'refunded') throw Object.assign(new Error('Already refunded'), { status: 400 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === sale.shopId.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });

  const session = await mongoose.startSession();
  let refunded;

  try {
    await session.withTransaction(async () => {
      // Restore stock and mark refunded in one atomic transaction
      await Product.bulkWrite(
        sale.items.map((item) => ({
          updateOne: { filter: { _id: item.product }, update: { $inc: { stock: item.quantity } } },
        })),
        { session, ordered: false }
      );

      refunded = await Sale.findByIdAndUpdate(
        id,
        { status: 'refunded' },
        { new: true, session }
      );
    });
  } finally {
    await session.endSession();
  }

  cache.del(`dashboard:${sale.shopId.toString()}`);
  return refunded;
};

// ── Partial Refund — refund specific line-items (fractional quantities allowed) ─
const partialRefund = async (id, user, refundItems) => {
  if (!Array.isArray(refundItems) || refundItems.length === 0)
    throw Object.assign(new Error('refundItems must be a non-empty array'), { status: 400 });

  const sale = await Sale.findById(id);
  if (!sale)                      throw Object.assign(new Error('Sale not found'), { status: 404 });
  if (sale.status === 'refunded') throw Object.assign(new Error('Sale already fully refunded'), { status: 400 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === sale.shopId.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });

  // Validate refund quantities against remaining quantities
  const refundMap = Object.fromEntries(
    refundItems.map((r) => [r.productId?.toString(), Number(r.quantity)])
  );

  const stockOps = [];
  let refundAmount = 0;

  for (const item of sale.items) {
    const pid = item.product?.toString();
    const refundQty = refundMap[pid] || 0;
    if (!refundQty) continue;

    const remaining = item.quantity - (item.refundedQty || 0);
    if (refundQty > remaining)
      throw Object.assign(
        new Error(`Cannot refund ${refundQty} of "${item.name}" — only ${remaining} remaining`),
        { status: 400 }
      );

    stockOps.push({
      updateOne: { filter: { _id: item.product }, update: { $inc: { stock: refundQty } } },
    });

    refundAmount += (item.subtotal / item.quantity) * refundQty;
    item.refundedQty = (item.refundedQty || 0) + refundQty;
  }

  if (stockOps.length === 0)
    throw Object.assign(new Error('No matching items found to refund'), { status: 400 });

  // Check if all quantities are now fully refunded → mark as refunded
  const allRefunded = sale.items.every(
    (item) => (item.refundedQty || 0) >= item.quantity
  );

  const session = await mongoose.startSession();
  let updated;

  try {
    await session.withTransaction(async () => {
      await Product.bulkWrite(stockOps, { session, ordered: false });

      updated = await Sale.findByIdAndUpdate(
        id,
        {
          items:  sale.items,
          status: allRefunded ? 'refunded' : 'completed',
        },
        { new: true, session }
      );
    });
  } finally {
    await session.endSession();
  }

  cache.del(`dashboard:${sale.shopId.toString()}`);
  return { sale: updated, refundAmount: +refundAmount.toFixed(2), fullyRefunded: allRefunded };
};

module.exports = { createSale, createPublicSale, getSales, getSaleById, refundSale, partialRefund };
