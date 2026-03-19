const router = require('express').Router();
const ctrl   = require('./product.controller');
const { protect }    = require('../../middlewares/auth.middleware');
const { allowRoles } = require('../../middlewares/role.middleware');

// ── Public routes (no auth required — customer shop) ─────────────────────────
router.get('/public',             ctrl.getPublic);
router.get('/public/categories',  ctrl.getPublicCategories);
router.get('/public/:id',         ctrl.getPublicOne);

// ── Protected routes ──────────────────────────────────────────────────────────
router.use(protect);

router.get('/',           ctrl.getAll);
router.get('/low-stock',  ctrl.lowStock);
router.get('/categories', ctrl.categories);
router.get('/:id',        ctrl.getOne);

router.post(
  '/',
  allowRoles('super_admin', 'owner', 'manager', 'inventory_staff'),
  ctrl.create
);
router.put(
  '/:id',
  allowRoles('super_admin', 'owner', 'manager', 'inventory_staff'),
  ctrl.update
);
router.delete(
  '/:id',
  allowRoles('super_admin', 'owner', 'manager'),
  ctrl.remove
);

module.exports = router;
