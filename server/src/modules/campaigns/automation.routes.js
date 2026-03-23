const express      = require('express');
const { protect }  = require('../../middlewares/auth.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const { create, list, update, remove, toggle } = require('./automation.controller');

const router = express.Router();

router.use(protect);

router.post('/',             asyncHandler(create));
router.get('/',              asyncHandler(list));
router.patch('/:id',         asyncHandler(update));
router.delete('/:id',        asyncHandler(remove));
router.patch('/:id/toggle',  asyncHandler(toggle));

module.exports = router;
