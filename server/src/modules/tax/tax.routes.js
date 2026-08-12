const router = require('express').Router();
const ctrl = require('./tax.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { allowRoles, shopAccess } = require('../../middlewares/role.middleware');

router.use(protect);
// Tenant isolation, exactly as the products module does it — a caller must not be
// able to read another shop's financial position by passing its shopId.
router.use(shopAccess);

/**
 * Financial data is owner/accountant territory. Billing and inventory staff have
 * no business seeing the shop's tax position, so this is deliberately narrower
 * than the reports module.
 */
const FINANCE_ROLES = ['super_admin', 'owner', 'manager'];

router.get('/summary', allowRoles(...FINANCE_ROLES), ctrl.summary);
router.get('/review',  allowRoles(...FINANCE_ROLES), ctrl.reviewQueue);
router.get('/config',  allowRoles(...FINANCE_ROLES), ctrl.getConfig);
// Only the owner may change how tax is computed.
router.put('/config',  allowRoles('super_admin', 'owner'), ctrl.saveConfig);

module.exports = router;
