const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth.middleware');
const logController = require('./logs.controller');

router.use(protect);

router.get('/', logController.getLogs);
router.delete('/cleanup', logController.cleanupOldLogs);

module.exports = router;

