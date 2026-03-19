const shopService = require('./shop.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

const create = asyncHandler(async (req, res) => {
  const shop = await shopService.createShop(req.user._id, req.body);
  success(res, { shop }, 'Shop created', 201);
});

const getAll = asyncHandler(async (req, res) => {
  const shops = await shopService.getShops(req.user);
  success(res, { shops }, 'Shops fetched');
});

const getOne = asyncHandler(async (req, res) => {
  const shop = await shopService.getShopById(req.params.id, req.user);
  success(res, { shop }, 'Shop fetched');
});

const update = asyncHandler(async (req, res) => {
  const shop = await shopService.updateShop(req.params.id, req.user._id, req.user.role, req.body);
  success(res, { shop }, 'Shop updated');
});

const remove = asyncHandler(async (req, res) => {
  await shopService.deleteShop(req.params.id, req.user._id, req.user.role);
  success(res, {}, 'Shop deleted');
});

const addStaff = asyncHandler(async (req, res) => {
  const shop = await shopService.addStaffToShop(req.params.id, req.body.staffId, req.user._id);
  success(res, { shop }, 'Staff added to shop');
});

module.exports = { create, getAll, getOne, update, remove, addStaff };
