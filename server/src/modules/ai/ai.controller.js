const aiService    = require('./ai.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success }  = require('../../utils/response');

const summary = asyncHandler(async (req, res) => {
  const data = await aiService.getAiSummary(req.user, req.query.shopId);
  success(res, data, 'AI insights generated');
});

const fastMoving = asyncHandler(async (req, res) => {
  const data = await aiService.getFastMovingProducts(req.user, req.query.shopId);
  success(res, { products: data }, 'Fast moving products');
});

const restock = asyncHandler(async (req, res) => {
  const data = await aiService.getRestockSuggestions(req.user, req.query.shopId);
  success(res, { suggestions: data }, 'Restock suggestions');
});

const discounts = asyncHandler(async (req, res) => {
  const data = await aiService.getDiscountRecommendations(req.user, req.query.shopId);
  success(res, { recommendations: data }, 'Discount recommendations');
});

const trend = asyncHandler(async (req, res) => {
  const data = await aiService.getSalesTrendPrediction(req.user, req.query.shopId);
  success(res, data, 'Sales trend prediction');
});

module.exports = { summary, fastMoving, restock, discounts, trend };
