const router = require('express').Router();
const ctrl = require('./report.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { allowRoles, shopAccess } = require('../../middlewares/role.middleware');

router.use(protect);

// P0 tenant isolation: apply shopAccess to EVERY route in this module.
// Without it, a caller could pass ?shopId=<another tenant> and the service
// filters would honour it — the list filters do
//     filter.shopId = { $in: user.shops };  if (shopId) filter.shopId = shopId;
// where the second line OVERWRITES the membership restriction, and
// reports shopFilter() returned { shopId } with no check at all.
// shopAccess validates query/body/param shopId against req.user.shops
// (super_admin bypasses, absent shopId falls through to the default filter).
router.use(shopAccess);
router.use(allowRoles('super_admin', 'owner', 'manager'));

router.get('/summary',           ctrl.summary);
router.get('/dashboard',         ctrl.dashboard);
router.get('/sales-trend',       ctrl.salesTrend);
router.get('/best-sellers',      ctrl.bestSellers);
router.get('/profit-loss',       ctrl.profitLoss);
router.get('/payment-breakdown', ctrl.paymentBreakdown);
router.get('/daily-closing',     ctrl.dailyClosing);     // ← end-of-day report
router.get('/simple',            ctrl.simpleReport);     // ← today/week/month quick view
router.get('/category',          ctrl.categoryReport);   // ← revenue/profit by product category
router.get('/multi-shop',        ctrl.multiShopSummary); // ← consolidated multi-shop overview

module.exports = router;
