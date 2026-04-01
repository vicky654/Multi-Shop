const mongoose = require('mongoose');
const Product = require('../products/product.model');
const Sale    = require('../sales/sale.model');

const toObjectId = (id) => {
  try { return new mongoose.Types.ObjectId(id.toString()); } catch { return null; }
};

// aggregate() does NOT auto-cast strings → ObjectId the way .find() does.
const shopFilter = (user, shopId) => {
  if (shopId) return { shopId: toObjectId(shopId) };
  if (user.role === 'super_admin') return {};
  return { shopId: { $in: (user.shops || []).map(toObjectId).filter(Boolean) } };
};

// ── 1. Restock Suggestions ────────────────────────────────────────────────────
// Low-stock products enriched with 7-day sales velocity
const getRestockSuggestions = async (user, shopId) => {
  const sf      = shopFilter(user, shopId);
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const [lowStockProducts, fastSelling] = await Promise.all([
    Product.find({
      ...sf,
      isActive: true,
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    })
      .select('name category stock lowStockThreshold costPrice price')
      .lean(),

    Sale.aggregate([
      { $match: { ...sf, status: 'completed', createdAt: { $gte: weekAgo } } },
      { $unwind: '$items' },
      {
        $group: {
          _id:     '$items.product',
          soldQty: { $sum: '$items.quantity' },
          name:    { $first: '$items.name' },
        },
      },
    ]),
  ]);

  const velocityMap = {};
  for (const s of fastSelling) velocityMap[String(s._id)] = s.soldQty;

  const result = lowStockProducts.map((p) => {
    const soldLast7Days  = velocityMap[String(p._id)] || 0;
    const daysOfStock    = soldLast7Days > 0 ? Math.floor((p.stock / (soldLast7Days / 7))) : null;
    const suggestedQty   = Math.max(soldLast7Days * 2, p.lowStockThreshold * 3, 20);
    const urgency        = p.stock === 0 ? 'critical' : daysOfStock !== null && daysOfStock <= 3 ? 'high' : 'medium';

    return {
      _id:          p._id,
      name:         p.name,
      category:     p.category,
      stock:        p.stock,
      threshold:    p.lowStockThreshold,
      soldLast7Days,
      daysOfStock,
      suggestedQty,
      urgency,
      costPrice:    p.costPrice || 0,
    };
  });

  // Sort: critical first, then high, then medium
  const order = { critical: 0, high: 1, medium: 2 };
  return result.sort((a, b) => order[a.urgency] - order[b.urgency]);
};

// ── 2. Dead Stock Detection ───────────────────────────────────────────────────
// Products with stock > 0 not sold in the last X days
const getDeadStock = async (user, shopId, days = 15) => {
  const sf     = shopFilter(user, shopId);
  const cutoff = new Date(Date.now() - days * 86400000);

  // Product IDs sold after the cutoff
  const recentSales = await Sale.aggregate([
    { $match: { ...sf, status: 'completed', createdAt: { $gte: cutoff } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.product' } },
  ]);

  const activeSoldIds = recentSales.map((s) => s._id);

  const dead = await Product.find({
    ...sf,
    isActive:  true,
    stock:     { $gt: 0 },
    _id:       { $nin: activeSoldIds },
  })
    .select('name category stock price createdAt')
    .sort({ stock: -1 })
    .limit(20)
    .lean();

  return dead.map((p) => ({
    _id:          p._id,
    name:         p.name,
    category:     p.category,
    stock:        p.stock,
    price:        p.price,
    stockValue:   p.stock * p.price,
    daysSinceCreated: Math.floor((Date.now() - new Date(p.createdAt)) / 86400000),
  }));
};

// ── 3. Profit Per Product (last 30 days) ─────────────────────────────────────
const getProfitPerProduct = async (user, shopId, limit = 10) => {
  const sf       = shopFilter(user, shopId);
  const monthAgo = new Date(Date.now() - 30 * 86400000);

  const results = await Sale.aggregate([
    { $match: { ...sf, status: 'completed', createdAt: { $gte: monthAgo } } },
    { $unwind: '$items' },
    {
      $group: {
        _id:          '$items.product',
        name:         { $first: '$items.name' },
        totalProfit:  { $sum: '$items.profit' },
        totalRevenue: { $sum: '$items.subtotal' },
        totalQty:     { $sum: '$items.quantity' },
      },
    },
    { $sort: { totalProfit: -1 } },
    { $limit: parseInt(limit) },
  ]);

  return results.map((p) => ({
    ...p,
    profitMargin: p.totalRevenue > 0
      ? Math.round((p.totalProfit / p.totalRevenue) * 100)
      : 0,
  }));
};

// ── 4. Smart Discount Suggestions ────────────────────────────────────────────
// Products not sold in 10+ days with good stock → suggest discount
const getDiscountSuggestions = async (user, shopId) => {
  const sf      = shopFilter(user, shopId);
  const day10   = new Date(Date.now() - 10 * 86400000);
  const day20   = new Date(Date.now() - 20 * 86400000);

  // Products sold in last 10 days (exclude from suggestions)
  const recentSales = await Sale.aggregate([
    { $match: { ...sf, status: 'completed', createdAt: { $gte: day10 } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.product' } },
  ]);
  const recentIds = recentSales.map((s) => s._id);

  const slowProducts = await Product.find({
    ...sf,
    isActive: true,
    stock:    { $gte: 5 },
    _id:      { $nin: recentIds },
  })
    .select('name category stock price discount createdAt')
    .limit(15)
    .lean();

  return slowProducts.map((p) => {
    const daysSinceActivity = Math.floor((Date.now() - new Date(p.createdAt)) / 86400000);
    const suggestedDiscount = new Date(p.createdAt) < day20 ? 20 : 10;

    return {
      _id:                p._id,
      name:               p.name,
      category:           p.category,
      stock:              p.stock,
      price:              p.price,
      currentDiscount:    p.discount || 0,
      suggestedDiscount,
      reason:             `Not sold in ${Math.min(daysSinceActivity, 30)}+ days`,
    };
  });
};

// ── 5. Credit / Due Summary ───────────────────────────────────────────────────
// Sales with paymentMethod='credit' and dueAmount > 0
const getCreditSummary = async (user, shopId) => {
  const sf = shopFilter(user, shopId);

  const rows = await Sale.aggregate([
    {
      $match: {
        ...sf,
        paymentMethod: 'credit',
        dueAmount:     { $gt: 0 },
        status:        'completed',
      },
    },
    {
      $group: {
        _id:           '$customerId',
        customerName:  { $first: '$customerName' },
        customerPhone: { $first: '$customerPhone' },
        totalDue:      { $sum: '$dueAmount' },
        saleCount:     { $sum: 1 },
        lastSaleDate:  { $max: '$createdAt' },
      },
    },
    { $sort: { totalDue: -1 } },
    { $limit: 20 },
  ]);

  const grandTotal = rows.reduce((s, r) => s + r.totalDue, 0);

  return { grandTotal, customers: rows };
};

// ── 6. Bulk Restock ───────────────────────────────────────────────────────────
// items: [{productId, addQty}]
const bulkRestockProducts = async (shopId, items) => {
  if (!Array.isArray(items) || items.length === 0) return { updated: 0 };

  const ops = items
    .filter((i) => i.productId && Number(i.addQty) > 0)
    .map((i) =>
      Product.findOneAndUpdate(
        { _id: i.productId, shopId },
        { $inc: { stock: Number(i.addQty) } },
        { new: true }
      )
    );

  const results = await Promise.all(ops);
  return { updated: results.filter(Boolean).length };
};

module.exports = {
  getRestockSuggestions,
  getDeadStock,
  getProfitPerProduct,
  getDiscountSuggestions,
  getCreditSummary,
  bulkRestockProducts,
};
