const router = require('express').Router();
const ctrl = require('./expense.controller');
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
router.get('/', ctrl.getAll);
router.get('/summary', ctrl.getSummary);
router.post('/', allowRoles('super_admin', 'owner', 'manager'), ctrl.create);
// Bulk route first: '/classify-bulk' must not be captured by '/:id/...'.
router.patch('/classify-bulk', allowRoles('super_admin', 'owner', 'manager'), ctrl.classifyBulk);
router.patch('/:id/classify',  allowRoles('super_admin', 'owner', 'manager'), ctrl.classify);
router.put('/:id', allowRoles('super_admin', 'owner', 'manager'), ctrl.update);
router.delete('/:id', allowRoles('super_admin', 'owner'), ctrl.remove);

module.exports = router;
