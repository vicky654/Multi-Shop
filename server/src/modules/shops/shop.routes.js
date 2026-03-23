const router = require('express').Router();
const ctrl = require('./shop.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { allowRoles } = require('../../middlewares/role.middleware');
const Shop = require('./shop.model');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

// ── Public shop info (for customer shop page) ─────────────────────────────────
router.get('/public', asyncHandler(async (req, res) => {
  const shops = await Shop.find({ isActive: true }).select('name type address phone email logo banner currency slug');
  success(res, { shops }, 'Shops fetched');
}));

// Slug lookup — MUST be before /public/:id to avoid 'slug' matching as an ObjectId
router.get('/public/slug/:slug', asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ slug: req.params.slug, isActive: true })
    .select('name type address phone email logo banner currency taxRate description slug');
  if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
  success(res, { shop }, 'Shop fetched');
}));

router.get('/public/:id', asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ _id: req.params.id, isActive: true })
    .select('name type address phone email logo banner currency taxRate description slug');
  if (!shop) return res.status(404).json({ message: 'Shop not found' });
  success(res, { shop }, 'Shop fetched');
}));

router.use(protect);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', allowRoles('owner', 'super_admin'), ctrl.create);
router.put('/:id', allowRoles('owner', 'super_admin'), ctrl.update);
router.delete('/:id', allowRoles('owner', 'super_admin'), ctrl.remove);
router.post('/:id/staff', allowRoles('owner', 'super_admin'), ctrl.addStaff);

module.exports = router;
