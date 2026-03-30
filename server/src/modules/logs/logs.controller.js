const Log = require('../../models/Log');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

// Get logs — super_admin sees all, owner sees own shop, else own user
const getLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, action, module, status, search, startDate, endDate } = req.query;
  const role = req.user.role;

  const filter = {};

  if (role === 'super_admin') {
    // no base filter — sees everything
    if (req.query.shopId) filter.shopId = req.query.shopId;
    if (req.query.userId) filter.userId = req.query.userId;
  } else if (role === 'owner') {
    // owner sees all logs for their shop(s)
    const shopId = req.query.shopId || req.user.shops?.[0]?._id;
    if (shopId) filter.shopId = shopId;
    else filter.userId = req.user._id; // fallback if no shop yet
  } else {
    // staff see only their own actions
    filter.userId = req.user._id;
  }

  if (action) filter.action = action;
  if (module) filter.module = module;
  if (status) filter.status = status;

  if (search) {
    filter.message = { $regex: search, $options: 'i' };
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  const [logs, total] = await Promise.all([
    Log.find(filter).sort({ createdAt: -1 }).limit(limitNum).skip((pageNum - 1) * limitNum).lean(),
    Log.countDocuments(filter),
  ]);

  // Quick stats (today's window, same base filter)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const lastHourStart = new Date(Date.now() - 60 * 60 * 1000);

  const [todayTotal, todayErrors, lastHour] = await Promise.all([
    Log.countDocuments({ ...filter, createdAt: { $gte: todayStart } }),
    Log.countDocuments({ ...filter, status: 'error', createdAt: { $gte: todayStart } }),
    Log.countDocuments({ ...filter, createdAt: { $gte: lastHourStart } }),
  ]);

  success(res, {
    logs,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
    total,
    stats: { todayTotal, todayErrors, lastHour },
  }, 'Logs fetched');
});

// Cleanup old logs (30 days) — super_admin only
const cleanupOldLogs = asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const deleted = await Log.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });

  success(res, { deletedCount: deleted.deletedCount }, `${deleted.deletedCount} old logs cleaned up`);
});

module.exports = { getLogs, cleanupOldLogs };
