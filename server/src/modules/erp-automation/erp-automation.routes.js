const router      = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { protect } = require('../../middlewares/auth.middleware');
const { allowRoles, shopAccess } = require('../../middlewares/role.middleware');
const ctrl = require('./erp-automation.controller');

router.use(protect);

// GET  /api/erp-automations?shopId=           — list all automations + state
router.get('/',             shopAccess, asyncHandler(ctrl.list));

// GET  /api/erp-automations/logs?shopId=      — fetch run logs
router.get('/logs',         shopAccess, asyncHandler(ctrl.logs));

// PATCH /api/erp-automations/:type/toggle     — enable/disable one automation
router.patch('/:type/toggle',
  shopAccess,
  allowRoles('owner', 'manager', 'super_admin'),
  asyncHandler(ctrl.toggle)
);

// POST /api/erp-automations/:type/run         — run immediately ("Run Now")
router.post('/:type/run',
  shopAccess,
  allowRoles('owner', 'manager', 'super_admin'),
  asyncHandler(ctrl.runNow)
);

module.exports = router;
