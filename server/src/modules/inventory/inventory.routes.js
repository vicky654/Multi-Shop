const router       = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { success }  = require('../../utils/response');
const { protect }  = require('../../middlewares/auth.middleware');
const { allowRoles, shopAccess } = require('../../middlewares/role.middleware');
const stockService = require('./stock.service');

router.use(protect);

/**
 * GET /api/inventory/stock?productId=&shopId=
 * Returns the materialized snapshot for a single product.
 */
router.get('/stock', shopAccess, asyncHandler(async (req, res) => {
  const { productId, shopId } = req.query;
  if (!productId || !shopId)
    return res.status(400).json({ success: false, message: 'productId and shopId are required' });

  const summary = await stockService.getStockSummary({ productId, shopId });
  success(res, { stock: summary }, 'Stock fetched');
}));

/**
 * GET /api/inventory/low-stock?shopId=&threshold=
 * Returns products whose available stock is at or below threshold.
 */
router.get('/low-stock', shopAccess, asyncHandler(async (req, res) => {
  const { shopId, threshold = 10 } = req.query;
  if (!shopId)
    return res.status(400).json({ success: false, message: 'shopId is required' });

  const products = await stockService.getLowStockProducts({
    shopId,
    threshold: Number(threshold),
  });
  success(res, { products, count: products.length }, 'Low stock fetched');
}));

module.exports = router;
