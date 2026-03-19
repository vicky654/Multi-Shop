/**
 * Rule-based AI Insights Engine
 * Analyzes sales & inventory data to generate actionable business insights.
 * No external API — pure MongoDB aggregations.
 */
const Sale    = require('../sales/sale.model');
const Product = require('../products/product.model');

const shopFilter = (user, shopId) => {
  if (shopId) return { shopId };
  if (user.role === 'super_admin') return {};
  return { shopId: { $in: user.shops } };
};

// ── 1. Fast-moving products (high sales velocity last 7 days) ─────────────────
const getFastMovingProducts = async (user, shopId) => {
  const since  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const filter = { status: 'completed', createdAt: { $gte: since }, ...shopFilter(user, shopId) };

  const results = await Sale.aggregate([
    { $match: filter },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', name: { $first: '$items.name' }, totalQty: { $sum: '$items.quantity' }, totalRevenue: { $sum: '$items.subtotal' } } },
    { $sort: { totalQty: -1 } },
    { $limit: 10 },
  ]);

  // Cross-reference with current stock
  const enriched = await Promise.all(results.map(async (r) => {
    const product = r._id ? await Product.findById(r._id).select('stock lowStockThreshold price discount') : null;
    return {
      ...r,
      currentStock: product?.stock ?? 0,
      isLowStock:   product ? product.stock <= product.lowStockThreshold : false,
      priority:     product && product.stock <= product.lowStockThreshold ? 'urgent' : 'normal',
    };
  }));

  return enriched;
};

// ── 2. Restock suggestions (low stock + recently sold) ────────────────────────
const getRestockSuggestions = async (user, shopId) => {
  const pFilter = { isActive: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] }, ...shopFilter(user, shopId) };
  const products = await Product.find(pFilter).sort({ stock: 1 }).limit(20);

  return products.map((p) => ({
    _id:       p._id,
    name:      p.name,
    category:  p.category,
    sku:       p.sku,
    currentStock: p.stock,
    threshold: p.lowStockThreshold,
    deficit:   p.lowStockThreshold - p.stock,
    suggestedOrder: Math.max(p.lowStockThreshold * 3, 10),  // reorder 3x threshold
    priority:  p.stock === 0 ? 'critical' : p.stock <= p.lowStockThreshold / 2 ? 'high' : 'medium',
    insight:   p.stock === 0
      ? `🚨 ${p.name} is OUT OF STOCK — immediate reorder needed`
      : `⚡ ${p.name} has only ${p.stock} left — order ${Math.max(p.lowStockThreshold * 3, 10)} more`,
  }));
};

// ── 3. Discount recommendations (slow-moving + high margin) ───────────────────
const getDiscountRecommendations = async (user, shopId) => {
  const since  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const pFilter = { isActive: true, stock: { $gt: 0 }, ...shopFilter(user, shopId) };

  // Get products with sales in last 30 days
  const salesFilter = { status: 'completed', createdAt: { $gte: since }, ...shopFilter(user, shopId) };
  const soldProductIds = await Sale.aggregate([
    { $match: salesFilter },
    { $unwind: '$items' },
    { $group: { _id: '$items.product' } },
  ]).then((r) => r.map((x) => x._id?.toString()).filter(Boolean));

  // Find products that are NOT selling (in stock but no recent sales)
  const allProducts = await Product.find(pFilter).limit(50);
  const slowMoving  = allProducts.filter((p) => !soldProductIds.includes(p._id.toString()));

  return slowMoving.slice(0, 10).map((p) => {
    const margin = p.price > 0 ? Math.round(((p.price - p.costPrice) / p.price) * 100) : 0;
    const suggestedDiscount = margin > 40 ? 20 : margin > 25 ? 15 : margin > 15 ? 10 : 5;
    const finalPrice = p.price * (1 - suggestedDiscount / 100);
    return {
      _id:               p._id,
      name:              p.name,
      category:          p.category,
      currentPrice:      p.price,
      currentDiscount:   p.discount || 0,
      margin,
      suggestedDiscount,
      projectedPrice:    +finalPrice.toFixed(2),
      stock:             p.stock,
      insight: `💡 ${p.name} hasn't sold in 30 days — try a ${suggestedDiscount}% discount to clear stock`,
    };
  });
};

// ── 4. Sales trend prediction (simple moving average) ────────────────────────
const getSalesTrendPrediction = async (user, shopId) => {
  const since  = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const filter = { status: 'completed', createdAt: { $gte: since }, ...shopFilter(user, shopId) };

  const dailySales = await Sale.aggregate([
    { $match: filter },
    { $group: {
      _id:     { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      revenue: { $sum: '$totalAmount' },
      count:   { $sum: 1 },
    }},
    { $sort: { _id: 1 } },
  ]);

  if (dailySales.length < 3) {
    return { trend: 'insufficient_data', prediction: null, insight: '📊 Need more sales data to generate predictions' };
  }

  const values = dailySales.map((d) => d.revenue);
  const avg    = values.reduce((a, b) => a + b, 0) / values.length;
  const recent = values.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const older  = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const changePercent = older > 0 ? Math.round(((recent - older) / older) * 100) : 0;

  let trend = 'stable', emoji = '➡️';
  if (changePercent > 10)  { trend = 'growing';  emoji = '📈'; }
  if (changePercent < -10) { trend = 'declining'; emoji = '📉'; }

  const predictedTomorrow = recent * (1 + changePercent / 200);

  return {
    trend,
    changePercent,
    avgDailyRevenue:  Math.round(avg),
    predictedRevenue: Math.round(predictedTomorrow),
    data: dailySales,
    insight: `${emoji} Sales are ${trend} — avg ₹${Math.round(avg)}/day. Tomorrow forecast: ~₹${Math.round(predictedTomorrow)}`,
  };
};

// ── 5. Overall AI summary ─────────────────────────────────────────────────────
const getAiSummary = async (user, shopId) => {
  const [fastMoving, restock, discounts, trend] = await Promise.all([
    getFastMovingProducts(user, shopId),
    getRestockSuggestions(user, shopId),
    getDiscountRecommendations(user, shopId),
    getSalesTrendPrediction(user, shopId),
  ]);

  const alerts = [];
  if (restock.some((r) => r.priority === 'critical')) alerts.push({ type: 'critical', message: '🚨 Some products are OUT OF STOCK' });
  if (restock.filter((r) => r.priority === 'high').length > 2) alerts.push({ type: 'high', message: `⚡ ${restock.filter(r => r.priority === 'high').length} products critically low on stock` });
  if (trend.trend === 'declining') alerts.push({ type: 'warning', message: '📉 Sales are trending down — consider promotions' });
  if (discounts.length > 3) alerts.push({ type: 'info', message: `💡 ${discounts.length} products haven't sold in 30 days` });

  return {
    alerts,
    fastMoving:  fastMoving.slice(0, 5),
    restock:     restock.slice(0, 5),
    discounts:   discounts.slice(0, 5),
    trend,
    generatedAt: new Date(),
  };
};

module.exports = { getFastMovingProducts, getRestockSuggestions, getDiscountRecommendations, getSalesTrendPrediction, getAiSummary };
