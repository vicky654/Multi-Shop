const reportService = require('./report.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

// includePrivate is only honoured for super_admin / owner — other roles always see filtered data
const resolvePrivate = (req) =>
  (req.query.includePrivate === 'true') &&
  (req.user.role === 'super_admin' || req.user.role === 'owner');

const dashboard = asyncHandler(async (req, res) => {
  const data = await reportService.getDashboardSummary(req.user, req.query.shopId, { includePrivate: resolvePrivate(req) });
  success(res, data, 'Dashboard summary');
});

const salesTrend = asyncHandler(async (req, res) => {
  const { shopId, groupBy, startDate, endDate } = req.query;
  const data = await reportService.getSalesTrend(req.user, shopId, groupBy, startDate, endDate, { includePrivate: resolvePrivate(req) });
  success(res, { trend: data }, 'Sales trend');
});

const bestSellers = asyncHandler(async (req, res) => {
  const { shopId, startDate, endDate, limit } = req.query;
  const data = await reportService.getBestSellers(req.user, shopId, startDate, endDate, limit, { includePrivate: resolvePrivate(req) });
  success(res, { products: data }, 'Best sellers');
});

const profitLoss = asyncHandler(async (req, res) => {
  const { shopId, startDate, endDate } = req.query;
  const data = await reportService.getProfitLoss(req.user, shopId, startDate, endDate, { includePrivate: resolvePrivate(req) });
  success(res, data, 'Profit & Loss');
});

const paymentBreakdown = asyncHandler(async (req, res) => {
  const { shopId, startDate, endDate } = req.query;
  const data = await reportService.getPaymentBreakdown(req.user, shopId, startDate, endDate, { includePrivate: resolvePrivate(req) });
  success(res, { breakdown: data }, 'Payment breakdown');
});

// GET /reports/summary — quick overview alias (used by System Test + external consumers)
const summary = asyncHandler(async (req, res) => {
  const data = await reportService.getDashboardSummary(req.user, req.query.shopId, { includePrivate: resolvePrivate(req) });
  success(res, data, 'Summary');
});

// GET /reports/daily-closing — end-of-day summary for shop owners
const dailyClosing = asyncHandler(async (req, res) => {
  const { shopId, date } = req.query;
  const data = await reportService.getDailyClosing(req.user, shopId, date);
  success(res, data, 'Daily closing summary');
});

// GET /reports/simple?period=today|week|month&shopId=...
const simpleReport = asyncHandler(async (req, res) => {
  const { shopId, period = 'today' } = req.query;
  const data = await reportService.getSimpleReport(req.user, shopId, period);
  success(res, data, `Simple report — ${period}`);
});

module.exports = { dashboard, salesTrend, bestSellers, profitLoss, paymentBreakdown, summary, dailyClosing, simpleReport };
