const router = require('express').Router();
const ctrl   = require('./role.controller');
const { protect }    = require('../../middlewares/auth.middleware');
const { allowRoles } = require('../../middlewares/role.middleware');

router.use(protect);

router.get('/permissions',             ctrl.getPermissions);
router.get('/',                        ctrl.getAll);
router.get('/:id',                     ctrl.getOne);
router.post('/',   allowRoles('super_admin', 'owner'), ctrl.create);
router.put('/:id', allowRoles('super_admin', 'owner'), ctrl.update);
router.delete('/:id', allowRoles('super_admin', 'owner'), ctrl.remove);

module.exports = router;
