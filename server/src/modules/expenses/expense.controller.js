const expenseService = require('./expense.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');
const { logAction, LOG_ACTIONS } = require('../../utils/logger');

const getAll = asyncHandler(async (req, res) => {
  const { expenses, total, page, limit } = await expenseService.getExpenses(req.user, req.query);
  paginated(res, expenses, total, page, limit, 'Expenses fetched');
});

const getSummary = asyncHandler(async (req, res) => {
  const { shopId, month, year } = req.query;
  const summary = await expenseService.getTotalExpenses(req.user, shopId, month, year);
  success(res, { summary }, 'Expense summary fetched');
});

const create = asyncHandler(async (req, res) => {
  const expense = await expenseService.createExpense(req.user, req.body);
  success(res, { expense }, 'Expense created', 201);
});

const update = asyncHandler(async (req, res) => {
  const expense = await expenseService.updateExpense(req.params.id, req.user, req.body);
  success(res, { expense }, 'Expense updated');
});

const remove = asyncHandler(async (req, res) => {
  await expenseService.deleteExpense(req.params.id, req.user);
  success(res, {}, 'Expense deleted');
});


// ── Tax classification ────────────────────────────────────────────────────────
// Separate from update() because these two fields decide what the tax estimate
// deducts and claims, so the change is stamped with the reviewer and logged.
const classify = asyncHandler(async (req, res) => {
  const { itcStatus, deductionStatus, reviewNote } = req.body;
  const expense = await expenseService.classifyExpense(req.params.id, req.user, {
    itcStatus, deductionStatus, reviewNote,
  });
  logAction(req, LOG_ACTIONS.EXPENSE_UPDATE || LOG_ACTIONS.PRODUCT_UPDATE, 'expenses',
    `Expense ${req.params.id} classified: itc=${itcStatus ?? '—'}, deduction=${deductionStatus ?? '—'}`);
  success(res, { expense }, 'Expense classified');
});

const classifyBulk = asyncHandler(async (req, res) => {
  const { ids, itcStatus, deductionStatus, reviewNote } = req.body;
  const result = await expenseService.classifyExpensesBulk(req.user, {
    ids, itcStatus, deductionStatus, reviewNote,
  });
  logAction(req, LOG_ACTIONS.EXPENSE_UPDATE || LOG_ACTIONS.PRODUCT_UPDATE, 'expenses',
    `Bulk classify: ${result.updated} updated, ${result.failed.length} failed`);
  success(res, result, `${result.updated} expense(s) classified`);
});

module.exports = {
  classify, classifyBulk, getAll, getSummary, create, update, remove };
