const router = require('express').Router();
const ctrl   = require('./notification.controller');
const { protect } = require('../../middlewares/auth.middleware');

router.use(protect);

router.get('/',                  ctrl.getAll);
router.put('/read',              ctrl.markRead);
router.put('/read-all',          ctrl.markAllRead);
router.delete('/clear-all',      ctrl.clearAll);
router.delete('/:id',            ctrl.remove);
router.post('/trigger-low-stock',ctrl.triggerLowStock);

module.exports = router;
