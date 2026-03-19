const router = require('express').Router();
const ctrl = require('./auth.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { allowRoles } = require('../../middlewares/role.middleware');

// Public
router.post('/register', ctrl.register);
router.post('/login', ctrl.login);

// Protected
router.get('/me',              protect, ctrl.getMe);
router.post('/onboarding/complete', protect, ctrl.completeOnboarding);

// Owner manages staff
router.post('/staff', protect, allowRoles('owner', 'super_admin'), ctrl.createStaff);
router.get('/staff', protect, allowRoles('owner', 'super_admin'), ctrl.getStaff);
router.put('/staff/:id', protect, allowRoles('owner', 'super_admin'), ctrl.updateStaff);
router.delete('/staff/:id', protect, allowRoles('owner', 'super_admin'), ctrl.deleteStaff);

module.exports = router;
