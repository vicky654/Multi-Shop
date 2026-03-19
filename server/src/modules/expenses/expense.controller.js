const expenseService = require('./expense.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

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

module.exports = { getAll, getSummary, create, update, remove };
