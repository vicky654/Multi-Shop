const roleService = require('./role.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

const getAll = asyncHandler(async (req, res) => {
  const roles = await roleService.getRoles(req.user._id);
  success(res, { roles }, 'Roles fetched');
});

const getOne = asyncHandler(async (req, res) => {
  const role = await roleService.getRoleById(req.params.id, req.user._id);
  success(res, { role }, 'Role fetched');
});

const create = asyncHandler(async (req, res) => {
  const role = await roleService.createRole(req.user._id, req.body);
  success(res, { role }, 'Role created', 201);
});

const update = asyncHandler(async (req, res) => {
  const role = await roleService.updateRole(req.params.id, req.user._id, req.body);
  success(res, { role }, 'Role updated');
});

const remove = asyncHandler(async (req, res) => {
  await roleService.deleteRole(req.params.id, req.user._id);
  success(res, {}, 'Role deleted');
});

const getPermissions = asyncHandler(async (_req, res) => {
  const permissions = roleService.getPermissionsList();
  success(res, { permissions }, 'Permissions list');
});

module.exports = { getAll, getOne, create, update, remove, getPermissions };
