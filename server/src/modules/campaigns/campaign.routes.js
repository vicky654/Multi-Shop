const express    = require('express');
const { protect } = require('../../middlewares/auth.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const {
  send,
  history,
  receipt,
  getDailySummaryHandler,
  sendDailySummaryHandler,
  segments,
  suggestions,
  stats,
  segmentCustomers,
} = require('./campaign.controller');

const router = express.Router();

router.use(protect);

router.post('/',               asyncHandler(send));
router.get('/',                asyncHandler(history));
router.post('/receipt',        asyncHandler(receipt));
router.get('/daily-summary',   asyncHandler(getDailySummaryHandler));
router.post('/daily-summary',  asyncHandler(sendDailySummaryHandler));
router.get('/segments',          asyncHandler(segments));
router.get('/suggestions',       asyncHandler(suggestions));
router.get('/stats',             asyncHandler(stats));
router.get('/segment-customers', asyncHandler(segmentCustomers));

module.exports = router;
