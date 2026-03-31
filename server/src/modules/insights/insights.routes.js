const router     = require('express').Router();
const ctrl       = require('./insights.controller');
const { protect }    = require('../../middlewares/auth.middleware');
const { allowRoles } = require('../../middlewares/role.middleware');

router.use(protect);
router.use(allowRoles('super_admin', 'owner', 'manager'));

router.get('/restock',              ctrl.restockSuggestions);
router.get('/dead-stock',           ctrl.deadStock);
router.get('/profit-per-product',   ctrl.profitPerProduct);
router.get('/discount-suggestions', ctrl.discountSuggestions);
router.get('/credit-summary',       ctrl.creditSummary);
router.post('/restock-all',         ctrl.bulkRestock);

module.exports = router;
