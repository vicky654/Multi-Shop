const router = require('express').Router();
const ctrl   = require('./creditLedger.controller');
const { protect }              = require('../../middlewares/auth.middleware');
const { allowRoles }           = require('../../middlewares/role.middleware');
const { validate, rules }      = require('../../middlewares/validate');

router.use(protect);
router.use(allowRoles('super_admin', 'owner', 'manager', 'billing_staff'));

router.get('/summary',                    ctrl.summary);
router.get('/:customerId',                ctrl.getLedger);
router.post('/:customerId/repay', validate(rules.repayCredit), ctrl.repay);

module.exports = router;
