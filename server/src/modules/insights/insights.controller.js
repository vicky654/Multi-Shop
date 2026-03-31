const insightsService = require('./insights.service');
const asyncHandler    = require('../../utils/asyncHandler');
const { success }     = require('../../utils/response');

const restockSuggestions = asyncHandler(async (req, res) => {
  const data = await insightsService.getRestockSuggestions(req.user, req.query.shopId);
  success(res, { suggestions: data }, 'Restock suggestions');
});

const deadStock = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 15;
  const data  = await insightsService.getDeadStock(req.user, req.query.shopId, days);
  success(res, { products: data, days }, 'Dead stock');
});

const profitPerProduct = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const data   = await insightsService.getProfitPerProduct(req.user, req.query.shopId, limit);
  success(res, { products: data }, 'Profit per product');
});

const discountSuggestions = asyncHandler(async (req, res) => {
  const data = await insightsService.getDiscountSuggestions(req.user, req.query.shopId);
  success(res, { suggestions: data }, 'Discount suggestions');
});

const creditSummary = asyncHandler(async (req, res) => {
  const data = await insightsService.getCreditSummary(req.user, req.query.shopId);
  success(res, data, 'Credit summary');
});

const bulkRestock = asyncHandler(async (req, res) => {
  const { shopId, items } = req.body;
  if (!shopId || !Array.isArray(items)) {
    return res.status(400).json({ success: false, message: 'shopId and items[] are required' });
  }
  const data = await insightsService.bulkRestockProducts(shopId, items);
  success(res, data, `${data.updated} product(s) restocked`);
});

module.exports = { restockSuggestions, deadStock, profitPerProduct, discountSuggestions, creditSummary, bulkRestock };
