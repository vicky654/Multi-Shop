const router     = require('express').Router();
const ctrl       = require('./admin.controller');
const { protect }     = require('../../middlewares/auth.middleware');
const { allowRoles }  = require('../../middlewares/role.middleware');

router.use(protect, allowRoles('super_admin'));

router.get('/overview',       ctrl.getOverview);
router.get('/owners',         ctrl.getOwners);
router.get('/shops',          ctrl.getShops);
router.post('/owners',        ctrl.createOwner);
router.patch('/users/:id/toggle', ctrl.toggleUser);

module.exports = router;
