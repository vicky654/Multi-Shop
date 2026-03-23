const adminService = require('./admin.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success }  = require('../../utils/response');

const getOverview = asyncHandler(async (req, res) => {
  const data = await adminService.getOverview();
  success(res, data, 'Overview fetched');
});

const getOwners = asyncHandler(async (req, res) => {
  const owners = await adminService.getAllOwners();
  success(res, { owners }, 'Owners fetched');
});

const getShops = asyncHandler(async (req, res) => {
  const shops = await adminService.getAllShops();
  success(res, { shops }, 'Shops fetched');
});

const createOwner = asyncHandler(async (req, res) => {
  const result = await adminService.createOwner(req.body);
  success(res, result, 'Owner created', 201);
});

const toggleUser = asyncHandler(async (req, res) => {
  const user = await adminService.toggleUserActive(req.params.id);
  success(res, { user }, 'User status toggled');
});

module.exports = { getOverview, getOwners, getShops, createOwner, toggleUser };
