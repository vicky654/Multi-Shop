const router = require('express').Router();
const ctrl   = require('./ai.controller');
const { protect }    = require('../../middlewares/auth.middleware');
const { allowRoles } = require('../../middlewares/role.middleware');

router.use(protect);

router.get('/summary',    ctrl.summary);
router.get('/fast-moving',ctrl.fastMoving);
router.get('/restock',    ctrl.restock);
router.get('/discounts',  ctrl.discounts);
router.get('/trend',      ctrl.trend);

module.exports = router;
