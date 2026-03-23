const demoService  = require('./demo.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success }  = require('../../utils/response');

const seed = asyncHandler(async (req, res) => {
  const shopId  = req.body.shopId || req.query.shopId;
  if (!shopId) throw Object.assign(new Error('shopId required'), { status: 400 });

  // Verify the shop belongs to the requesting user
  const hasAccess = req.user.role === 'super_admin' ||
    (req.user.shops || []).some((s) => s.toString() === shopId.toString());
  if (!hasAccess) throw Object.assign(new Error('Access denied'), { status: 403 });

  const result = await demoService.seedDemo(shopId, req.user._id);
  success(res, result, `Demo data seeded: ${result.products} products, ${result.customers} customers`, 201);
});

const clear = asyncHandler(async (req, res) => {
  const shopId = req.body.shopId || req.query.shopId;
  if (!shopId) throw Object.assign(new Error('shopId required'), { status: 400 });

  const hasAccess = req.user.role === 'super_admin' ||
    (req.user.shops || []).some((s) => s.toString() === shopId.toString());
  if (!hasAccess) throw Object.assign(new Error('Access denied'), { status: 403 });

  const result = await demoService.clearDemo(shopId);
  success(res, result, 'Demo data cleared');
});

module.exports = { seed, clear };
