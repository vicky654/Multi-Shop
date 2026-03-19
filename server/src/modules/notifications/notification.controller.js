const notifService = require('./notification.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success }  = require('../../utils/response');

const getAll = asyncHandler(async (req, res) => {
  const data = await notifService.getNotifications(req.user._id, req.query);
  success(res, data, 'Notifications fetched');
});

const markRead = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  await notifService.markRead(req.user._id, ids);
  success(res, {}, 'Marked as read');
});

const markAllRead = asyncHandler(async (req, res) => {
  await notifService.markAllRead(req.user._id);
  success(res, {}, 'All marked as read');
});

const remove = asyncHandler(async (req, res) => {
  await notifService.deleteNotification(req.user._id, req.params.id);
  success(res, {}, 'Notification deleted');
});

const clearAll = asyncHandler(async (req, res) => {
  await notifService.clearAll(req.user._id);
  success(res, {}, 'All notifications cleared');
});

const triggerLowStock = asyncHandler(async (req, res) => {
  const notifications = await notifService.generateLowStockNotifications(req.user);
  success(res, { count: notifications.length }, `Generated ${notifications.length} low-stock notifications`);
});

module.exports = { getAll, markRead, markAllRead, remove, clearAll, triggerLowStock };
