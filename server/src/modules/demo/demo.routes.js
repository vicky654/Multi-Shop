const router     = require('express').Router();
const ctrl       = require('./demo.controller');
const { protect }    = require('../../middlewares/auth.middleware');
const { allowRoles } = require('../../middlewares/role.middleware');

router.use(protect, allowRoles('super_admin', 'owner'));

router.post('/seed',  ctrl.seed);
router.delete('/clear', ctrl.clear);

module.exports = router;
