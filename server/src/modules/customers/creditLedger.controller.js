const ledgerService = require('./creditLedger.service');
const asyncHandler  = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

// GET /credit-ledger/:customerId?shopId=...
const getLedger = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const data = await ledgerService.getLedger(
    req.params.customerId,
    req.query.shopId,
    { page, limit }
  );
  paginated(res, data.entries, data.total, data.page, data.limit, 'Ledger fetched', { customer: data.customer });
});

// POST /credit-ledger/:customerId/repay
const repay = asyncHandler(async (req, res) => {
  const result = await ledgerService.recordRepayment(
    req.params.customerId,
    req.user,
    { shopId: req.body.shopId, amount: req.body.amount, notes: req.body.notes }
  );
  success(res, result, 'Repayment recorded');
});

// GET /credit-ledger/summary?shopId=...
const summary = asyncHandler(async (req, res) => {
  const customers = await ledgerService.getShopCreditSummary(req.user, req.query.shopId);
  success(res, { customers }, 'Credit summary');
});

module.exports = { getLedger, repay, summary };
