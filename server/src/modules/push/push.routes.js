const router     = require('express').Router();
const ctrl       = require('./push.controller');
const { protect }    = require('../../middlewares/auth.middleware');
const { allowRoles } = require('../../middlewares/role.middleware');

router.use(protect);

router.post('/register',   ctrl.register);
router.post('/unregister', ctrl.unregister);

// Super admin can send test pushes to any user
router.post('/send-test',  allowRoles('super_admin'), ctrl.sendTest);

module.exports = router;
