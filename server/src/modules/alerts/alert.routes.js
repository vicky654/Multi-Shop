const express = require('express');
const { getAlerts } = require('./alert.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authMiddleware.protect, getAlerts);

module.exports = router;

