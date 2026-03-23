const router       = require('express').Router();
const { protect }  = require('../../middlewares/auth.middleware');
const ctrl         = require('./notify.controller');

// All notify routes require authentication
router.use(protect);

router.post('/send',           ctrl.send);
router.post('/due-reminders',  ctrl.dueReminders);
router.post('/receipt',        ctrl.receipt);

module.exports = router;
