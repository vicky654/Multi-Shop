const reportService = require('./report.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

const dashboard = asyncHandler(async (req, res) => {
  const data = await reportService.getDashboardSummary(req.user, req.query.shopId);
  success(res, data, 'Dashboard summary');
});

const salesTrend = asyncHandler(async (req, res) => {
  const { shopId, groupBy, startDate, endDate } = req.query;
  const data = await reportService.getSalesTrend(req.user, shopId, groupBy, startDate, endDate);
  success(res, { trend: data }, 'Sales trend');
});

const bestSellers = asyncHandler(async (req, res) => {
  const { shopId, startDate, endDate, limit } = req.query;
  const data = await reportService.getBestSellers(req.user, shopId, startDate, endDate, limit);
  success(res, { products: data }, 'Best sellers');
});

const profitLoss = asyncHandler(async (req, res) => {
  const { shopId, startDate, endDate } = req.query;
  const data = await reportService.getProfitLoss(req.user, shopId, startDate, endDate);
  success(res, data, 'Profit & Loss');
});

const paymentBreakdown = asyncHandler(async (req, res) => {
  const { shopId, startDate, endDate } = req.query;
  const data = await reportService.getPaymentBreakdown(req.user, shopId, startDate, endDate);
  success(res, { breakdown: data }, 'Payment breakdown');
});

// GET /reports/summary — quick overview alias (used by System Test + external consumers)
const summary = asyncHandler(async (req, res) => {
  const data = await reportService.getDashboardSummary(req.user, req.query.shopId);
  success(res, data, 'Summary');
});

module.exports = { dashboard, salesTrend, bestSellers, profitLoss, paymentBreakdown, summary };
