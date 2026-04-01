const adminService                = require('./admin.service');
const asyncHandler                = require('../../utils/asyncHandler');
const { success }                 = require('../../utils/response');
const { logAction, LOG_ACTIONS }  = require('../../utils/logger');

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
  logAction(req, LOG_ACTIONS.ADMIN_TOGGLE_USER, 'admin',
    `${req.user.name} toggled user ${user.email} → isActive=${user.isActive}`,
    { targetUserId: user._id, newStatus: user.isActive });
  success(res, { user }, 'User status toggled');
});

const getAnalytics = asyncHandler(async (req, res) => {
  const { period = 7 } = req.query;
  logAction(req, LOG_ACTIONS.ADMIN_VIEW_ANALYTICS, 'admin',
    `Super admin ${req.user.email} viewed analytics (period: ${period}d)`);
  const data = await adminService.getAnalytics(period);
  success(res, data, 'Analytics fetched');
});

const getConsoleLogs = asyncHandler(async (req, res) => {
  const { page, limit, action, module: mod, status, period } = req.query;
  logAction(req, LOG_ACTIONS.ADMIN_VIEW_CONSOLE, 'admin',
    `Super admin ${req.user.email} viewed console logs`);
  const data = await adminService.getConsoleLogs({ page, limit, action, module: mod, status, period });
  success(res, data, 'Console logs fetched');
});

module.exports = { getOverview, getOwners, getShops, createOwner, toggleUser, getAnalytics, getConsoleLogs };
