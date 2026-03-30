const Sale    = require('../sales/sale.model');
const Product = require('../products/product.model');
const Expense = require('../expenses/expense.model');
const Customer= require('../customers/customer.model');

// ── Helpers ───────────────────────────────────────────────────────────────────
const dateRange = (startDate, endDate) => {
  const range = {};
  if (startDate) range.$gte = new Date(startDate);
  if (endDate)   range.$lte = new Date(new Date(endDate).setHours(23, 59, 59));
  return Object.keys(range).length ? range : undefined;
};

const shopFilter = (user, shopId) => {
  if (shopId) return { shopId };
  if (user.role === 'super_admin') return {};
  return { shopId: { $in: user.shops } };
};

// Exclude private sales unless caller explicitly opts in
const privateFilter = (includePrivate) =>
  includePrivate ? {} : { isPrivate: { $ne: true } };

// ── Overview Dashboard ────────────────────────────────────────────────────────
const getDashboardSummary = async (user, shopId, { includePrivate = false } = {}) => {
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

  return {
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

module.exports = {
  getDashboardSummary, getSalesTrend, getBestSellers,
  getProfitLoss, getPaymentBreakdown, getDailyClosing,
};
