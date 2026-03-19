const customerService = require('./customer.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const getAll = asyncHandler(async (req, res) => {
  const { customers, total, page, limit } = await customerService.getCustomers(req.user, req.query);
  paginated(res, customers, total, page, limit, 'Customers fetched');
});

const getOne = asyncHandler(async (req, res) => {
  const customer = await customerService.getCustomerById(req.params.id, req.user);
  success(res, { customer }, 'Customer fetched');
});

const create = asyncHandler(async (req, res) => {
  const customer = await customerService.createCustomer(req.user, req.body);
  success(res, { customer }, 'Customer created', 201);
});

const update = asyncHandler(async (req, res) => {
  const customer = await customerService.updateCustomer(req.params.id, req.user, req.body);
  success(res, { customer }, 'Customer updated');
});

const remove = asyncHandler(async (req, res) => {
  await customerService.deleteCustomer(req.params.id, req.user);
  success(res, {}, 'Customer deleted');
});

module.exports = { getAll, getOne, create, update, remove };
