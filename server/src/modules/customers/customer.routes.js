const router = require('express').Router();
const ctrl = require('./customer.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { allowRoles } = require('../../middlewares/role.middleware');

router.use(protect);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', allowRoles('super_admin', 'owner', 'manager', 'billing_staff'), ctrl.create);
router.put('/:id', allowRoles('super_admin', 'owner', 'manager', 'billing_staff'), ctrl.update);
router.delete('/:id', allowRoles('super_admin', 'owner', 'manager'), ctrl.remove);

module.exports = router;
