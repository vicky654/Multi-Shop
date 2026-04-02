const mongoose = require('mongoose');
const Sale    = require('../sales/sale.model');
const Product = require('../products/product.model');
const Expense = require('../expenses/expense.model');
const Customer= require('../customers/customer.model');
const cache   = require('../../utils/cache');

// ── Helpers ───────────────────────────────────────────────────────────────────
const toObjectId = (id) => {
  try { return new mongoose.Types.ObjectId(id.toString()); } catch { return null; }
};

const dateRange = (startDate, endDate) => {
  const range = {};
  if (startDate) range.$gte = new Date(startDate);
  if (endDate)   range.$lte = new Date(new Date(endDate).setHours(23, 59, 59));
  return Object.keys(range).length ? range : undefined;
};

// aggregate() does NOT auto-cast strings → ObjectId the way .find() does.
const shopFilter = (user, shopId) => {
  if (shopId) return { shopId: toObjectId(shopId) };
  if (user.role === 'super_admin') return {};
  return { shopId: { $in: (user.shops || []).map(toObjectId).filter(Boolean) } };
};

// Exclude private sales unless caller explicitly opts in
const privateFilter = (includePrivate) =>
  includePrivate ? {} : { isPrivate: { $ne: true } };

// ── Overview Dashboard ────────────────────────────────────────────────────────
const getDashboardSummary = async (user, shopId, { includePrivate = false } = {}) => {
  // Cache per shop (or per user for multi-shop owners), 2-minute TTL
  const cacheKey = `dashboard:${shopId || user._id.toString()}:${includePrivate}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const pf     = privateFilter(includePrivate);
  const sFilter = { status: 'completed', ...pf, ...shopFilter(user, shopId) };
  const pFilter = { isActive: true, ...shopFilter(user, shopId) };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayFilter = { ...sFilter, createdAt: { $gte: today } };

  const [
    totalSalesResult,
    todaySalesResult,
    totalProductsCount,
    lowStockCount,
    totalCustomers,
    totalExpensesResult,
  ] = await Promise.all([
    Sale.aggregate([
      { $match: sFilter },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, profit: { $sum: '$totalProfit' }, count: { $sum: 1 } } },
    ]),
    Sale.aggregate([
      { $match: todayFilter },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, profit: { $sum: '$totalProfit' }, count: { $sum: 1 } } },
    ]),
    Product.countDocuments(pFilter),
    Product.countDocuments({ ...pFilter, $expr: { $lte: ['$stock', '$lowStockThreshold'] } }),
    Customer.countDocuments({ isActive: true, ...shopFilter(user, shopId) }),
    Expense.aggregate([
      { $match: shopFilter(user, shopId) },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const result = {
    totalRevenue:    totalSalesResult[0]?.revenue || 0,
    totalProfit:     totalSalesResult[0]?.profit   || 0,
    totalSalesCount: totalSalesResult[0]?.count    || 0,
    todayRevenue:    todaySalesResult[0]?.revenue  || 0,
    todayProfit:     todaySalesResult[0]?.profit   || 0,
    todaySalesCount: todaySalesResult[0]?.count    || 0,
    totalProducts:   totalProductsCount,
    lowStockCount,
    totalCustomers,
    totalExpenses:   totalExpensesResult[0]?.total || 0,
  };

  cache.set(cacheKey, result, 120); // 2-minute TTL
  return result;
};

// ── Daily / Monthly Sales Chart ───────────────────────────────────────────────
const getSalesTrend = async (user, shopId, groupBy = 'day', startDate, endDate, { includePrivate = false } = {}) => {
  const matchFilter = { status: 'completed', ...privateFilter(includePrivate), ...shopFilter(user, shopId) };
  const range = dateRange(startDate, endDate);
  if (range) matchFilter.createdAt = range;

  const groupId = groupBy === 'month'
    ? { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }
    : { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } };

  return Sale.aggregate([
    { $match: matchFilter },
    { $group: { _id: groupId, revenue: { $sum: '$totalAmount' }, profit: { $sum: '$totalProfit' }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
  ]);
};

// ── Best-selling Products ─────────────────────────────────────────────────────
const getBestSellers = async (user, shopId, startDate, endDate, limit = 10, { includePrivate = false } = {}) => {
  const matchFilter = { status: 'completed', ...privateFilter(includePrivate), ...shopFilter(user, shopId) };
  const range = dateRange(startDate, endDate);
  if (range) matchFilter.createdAt = range;

  return Sale.aggregate([
    { $match: matchFilter },
    { $unwind: '$items' },
    {
      $group: {
        _id:          '$items.product',
        name:         { $first: '$items.name' },
        totalQty:     { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.subtotal' },
        totalProfit:  { $sum: '$items.profit' },
      },
    },
    { $sort: { totalQty: -1 } },
    { $limit: parseInt(limit) },
  ]);
};

// ── Profit & Loss ─────────────────────────────────────────────────────────────
const getProfitLoss = async (user, shopId, startDate, endDate, { includePrivate = false } = {}) => {
  const matchSale = { status: 'completed', ...privateFilter(includePrivate), ...shopFilter(user, shopId) };
  const matchExp  = { ...shopFilter(user, shopId) };
  const range = dateRange(startDate, endDate);
  if (range) { matchSale.createdAt = range; matchExp.date = range; }

  const [salesResult, expensesResult] = await Promise.all([
    Sale.aggregate([
      { $match: matchSale },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, profit: { $sum: '$totalProfit' } } },
    ]),
    Expense.aggregate([
      { $match: matchExp },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const revenue     = salesResult[0]?.revenue  || 0;
  const grossProfit = salesResult[0]?.profit   || 0;
  const expenses    = expensesResult[0]?.total || 0;

  return { revenue, grossProfit, expenses, netProfit: grossProfit - expenses };
};

// ── Payment Methods Breakdown ─────────────────────────────────────────────────
const getPaymentBreakdown = async (user, shopId, startDate, endDate, { includePrivate = false } = {}) => {
  const matchFilter = { status: 'completed', ...privateFilter(includePrivate), ...shopFilter(user, shopId) };
  const range = dateRange(startDate, endDate);
  if (range) matchFilter.createdAt = range;

  return Sale.aggregate([
    { $match: matchFilter },
    { $group: { _id: '$paymentMethod', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);
};

// ── Daily Closing Summary ─────────────────────────────────────────────────────
const getDailyClosing = async (user, shopId, date) => {
  const targetDate = date ? new Date(date) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const matchFilter = {
    status:    'completed',
    isPrivate: { $ne: true },
    createdAt: { $gte: targetDate, $lt: nextDay },
    ...shopFilter(user, shopId),
  };

  const [summary, topProducts, paymentBreakdown, hourlyBreakdown] = await Promise.all([
    Sale.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id:       null,
          revenue:   { $sum: '$totalAmount' },
          profit:    { $sum: '$totalProfit' },
          orders:    { $sum: 1 },
          discount:  { $sum: '$totalDiscount' },
          tax:       { $sum: '$taxAmount' },
        },
      },
    ]),
    Sale.aggregate([
      { $match: matchFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id:     '$items.product',
          name:    { $first: '$items.name' },
          qty:     { $sum: '$items.quantity' },
          revenue: { $sum: '$items.subtotal' },
          profit:  { $sum: '$items.profit' },
        },
      },
      { $sort: { qty: -1 } },
      { $limit: 5 },
    ]),
    Sale.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$paymentMethod', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Sale.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id:     { $hour: '$createdAt' },
          revenue: { $sum: '$totalAmount' },
          count:   { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const topProduct = topProducts[0] || null;

  return {
    date:             targetDate,
    revenue:          summary[0]?.revenue  || 0,
    profit:           summary[0]?.profit   || 0,
    orders:           summary[0]?.orders   || 0,
    discount:         summary[0]?.discount || 0,
    tax:              summary[0]?.tax      || 0,
    topProduct,
    topProducts,
    paymentBreakdown,
    hourlyBreakdown,
  };
};

// ── Simple Period Report (today / week / month) ───────────────────────────────
const getSimpleReport = async (user, shopId, period = 'today') => {
  const sf  = shopFilter(user, shopId);
  const now = new Date();
  let startDate;

  if (period === 'today') {
    startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    startDate = new Date(Date.now() - 7 * 86400000);
  } else {
    // month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const matchSale = { ...sf, status: 'completed', isPrivate: { $ne: true }, createdAt: { $gte: startDate } };
  const matchExp  = { ...sf, date: { $gte: startDate } };

  const [salesRes, expRes, topProductRes, paymentRes] = await Promise.all([
    Sale.aggregate([
      { $match: matchSale },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, profit: { $sum: '$totalProfit' }, count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: matchExp },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Sale.aggregate([
      { $match: matchSale },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', name: { $first: '$items.name' }, qty: { $sum: '$items.quantity' }, revenue: { $sum: '$items.subtotal' } } },
      { $sort: { qty: -1 } },
      { $limit: 1 },
    ]),
    Sale.aggregate([
      { $match: matchSale },
      { $group: { _id: '$paymentMethod', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  const revenue  = salesRes[0]?.revenue || 0;
  const profit   = salesRes[0]?.profit  || 0;
  const orders   = salesRes[0]?.count   || 0;
  const expenses = expRes[0]?.total     || 0;

  return {
    period,
    startDate,
    sales:          { revenue, profit, orders },
    expenses,
    netProfit:      profit - expenses,
    topProduct:     topProductRes[0] || null,
    paymentBreakdown: paymentRes,
  };
};

// ── Category-level Sales Report ───────────────────────────────────────────────
const getCategoryReport = async (user, shopId, startDate, endDate, { includePrivate = false } = {}) => {
  const matchFilter = { status: 'completed', ...privateFilter(includePrivate), ...shopFilter(user, shopId) };
  const range = dateRange(startDate, endDate);
  if (range) matchFilter.createdAt = range;

  return Sale.aggregate([
    { $match: matchFilter },
    { $unwind: '$items' },
    // Join with Product to get the category
    {
      $lookup: {
        from:         'products',
        localField:   'items.product',
        foreignField: '_id',
        as:           '_product',
      },
    },
    {
      $addFields: {
        category: { $ifNull: [{ $first: '$_product.category' }, 'Unknown'] },
      },
    },
    {
      $group: {
        _id:          '$category',
        totalQty:     { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.subtotal' },
        totalProfit:  { $sum: '$items.profit' },
        orderCount:   { $addToSet: '$_id' },
      },
    },
    {
      $project: {
        _id:          0,
        category:     '$_id',
        totalQty:     1,
        totalRevenue: { $round: ['$totalRevenue', 2] },
        totalProfit:  { $round: ['$totalProfit', 2] },
        orderCount:   { $size: '$orderCount' },
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);
};

// ── Multi-Shop Consolidated Dashboard (for owners with multiple shops) ────────
const getMultiShopSummary = async (user) => {
  if (user.role !== 'super_admin' && user.role !== 'owner')
    throw Object.assign(new Error('Access denied'), { status: 403 });

  const shopIds = user.role === 'super_admin'
    ? null
    : (user.shops || []).map(toObjectId).filter(Boolean);

  const matchBase = shopIds
    ? { shopId: { $in: shopIds }, status: 'completed', isPrivate: { $ne: true } }
    : { status: 'completed', isPrivate: { $ne: true } };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMatch = { ...matchBase, createdAt: { $gte: today } };

  const [allTime, todayData, byShop] = await Promise.all([
    Sale.aggregate([
      { $match: matchBase },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, profit: { $sum: '$totalProfit' }, count: { $sum: 1 } } },
    ]),
    Sale.aggregate([
      { $match: todayMatch },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, profit: { $sum: '$totalProfit' }, count: { $sum: 1 } } },
    ]),
    Sale.aggregate([
      { $match: matchBase },
      {
        $group: {
          _id:     '$shopId',
          revenue: { $sum: '$totalAmount' },
          profit:  { $sum: '$totalProfit' },
          count:   { $sum: 1 },
        },
      },
      {
        $lookup: {
          from:         'shops',
          localField:   '_id',
          foreignField: '_id',
          as:           '_shop',
        },
      },
      {
        $project: {
          shopId:   '$_id',
          name:     { $ifNull: [{ $first: '$_shop.name' }, 'Unknown'] },
          revenue:  { $round: ['$revenue', 2] },
          profit:   { $round: ['$profit', 2] },
          count:    1,
        },
      },
      { $sort: { revenue: -1 } },
    ]),
  ]);

  return {
    totalRevenue:    allTime[0]?.revenue || 0,
    totalProfit:     allTime[0]?.profit  || 0,
    totalSalesCount: allTime[0]?.count   || 0,
    todayRevenue:    todayData[0]?.revenue || 0,
    todayProfit:     todayData[0]?.profit  || 0,
    todaySalesCount: todayData[0]?.count   || 0,
    shops:           byShop,
  };
};

module.exports = {
  getDashboardSummary, getSalesTrend, getBestSellers,
  getProfitLoss, getPaymentBreakdown, getDailyClosing, getSimpleReport,
  getCategoryReport, getMultiShopSummary,
};
