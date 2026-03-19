const router = require('express').Router();
const ctrl = require('./expense.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { allowRoles } = require('../../middlewares/role.middleware');

router.use(protect);
router.get('/', ctrl.getAll);
router.get('/summary', ctrl.getSummary);
router.post('/', allowRoles('super_admin', 'owner', 'manager'), ctrl.create);
router.put('/:id', allowRoles('super_admin', 'owner', 'manager'), ctrl.update);
router.delete('/:id', allowRoles('super_admin', 'owner'), ctrl.remove);

module.exports = router;
