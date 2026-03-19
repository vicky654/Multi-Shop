const router = require('express').Router();
const ctrl = require('./shop.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { allowRoles } = require('../../middlewares/role.middleware');
const Shop = require('./shop.model');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

// ── Public shop info (for customer shop page) ─────────────────────────────────
router.get('/public', asyncHandler(async (req, res) => {
  const shops = await Shop.find({ isActive: true }).select('name type address phone email logo currency');
  success(res, { shops }, 'Shops fetched');
}));
router.get('/public/:id', asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ _id: req.params.id, isActive: true })
    .select('name type address phone email logo currency taxRate description');
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
