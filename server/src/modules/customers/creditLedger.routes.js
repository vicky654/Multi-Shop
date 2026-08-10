const router = require('express').Router();
const ctrl   = require('./creditLedger.controller');
const { protect }              = require('../../middlewares/auth.middleware');
const { allowRoles, shopAccess } = require('../../middlewares/role.middleware');
const { validate, rules }      = require('../../middlewares/validate');

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
router.use(allowRoles('super_admin', 'owner', 'manager', 'billing_staff'));

router.get('/summary',                    ctrl.summary);
router.get('/:customerId',                ctrl.getLedger);
router.post('/:customerId/repay', validate(rules.repayCredit), ctrl.repay);

module.exports = router;
