const router = require('express').Router();
const ctrl   = require('./sale.controller');
const { protect }    = require('../../middlewares/auth.middleware');
const { allowRoles } = require('../../middlewares/role.middleware');

// ── Public (customer shop checkout) ──────────────────────────────────────────
router.post('/public/checkout', ctrl.publicCheckout);

// ── Protected routes ──────────────────────────────────────────────────────────
router.use(protect);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', allowRoles('super_admin', 'owner', 'manager', 'billing_staff'), ctrl.create);
router.patch('/:id/refund', allowRoles('super_admin', 'owner', 'manager'), ctrl.refund);

module.exports = router;
