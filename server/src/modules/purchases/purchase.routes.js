const router = require('express').Router();
const ctrl = require('./purchase.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { allowRoles, shopAccess } = require('../../middlewares/role.middleware');

router.use(protect);
// Tenant isolation on every purchase and inventory operation, as the products
// module does. Line-level shop checks also run inside the service.
router.use(shopAccess);

const STOCK_ROLES = ['super_admin', 'owner', 'manager', 'inventory_staff'];

router.get('/',          allowRoles(...STOCK_ROLES), ctrl.getAll);
router.get('/valuation', allowRoles('super_admin', 'owner', 'manager'), ctrl.valuation);
// Owner/admin only: this figure feeds the COGS calculation.
router.post('/opening-snapshot', allowRoles('super_admin', 'owner'), ctrl.openingSnapshot);
router.post('/',         allowRoles(...STOCK_ROLES), ctrl.create);
router.put('/:id',       allowRoles(...STOCK_ROLES), ctrl.update);
// Posting and cancelling MOVE INVENTORY, so they are narrower than editing a draft.
router.patch('/:id/post',   allowRoles('super_admin', 'owner', 'manager'), ctrl.post);
router.patch('/:id/cancel', allowRoles('super_admin', 'owner', 'manager'), ctrl.cancel);

module.exports = router;
