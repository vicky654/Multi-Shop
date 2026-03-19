const router = require('express').Router();
const ctrl = require('./report.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { allowRoles } = require('../../middlewares/role.middleware');

router.use(protect);
router.use(allowRoles('super_admin', 'owner', 'manager'));

router.get('/summary',           ctrl.summary);          // quick overview alias
router.get('/dashboard',         ctrl.dashboard);
router.get('/sales-trend',       ctrl.salesTrend);
router.get('/best-sellers',      ctrl.bestSellers);
router.get('/profit-loss',       ctrl.profitLoss);
router.get('/payment-breakdown', ctrl.paymentBreakdown);

module.exports = router;
