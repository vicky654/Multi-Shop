const User    = require('../auth/auth.model');
const Shop    = require('../shops/shop.model');
const Sale    = require('../sales/sale.model');
const Product = require('../products/product.model');
const Log     = require('../../models/Log');

// ── Create a new shop owner + their first shop in one transaction ─────────────
const createOwner = async ({ name, email, password, phone, shopName, shopType, currency }) => {
  const existing = await User.findOne({ email });
  if (existing) throw Object.assign(new Error('Email already registered'), { status: 409 });

  const user = await User.create({ name, email, password, role: 'owner', phone });

  const shop = await Shop.create({
    name:     shopName || `${name}'s Shop`,
    type:     shopType || 'other',
    currency: currency || 'INR',
    owner:    user._id,
  });

  await User.findByIdAndUpdate(user._id, { $addToSet: { shops: shop._id } });
  return { user, shop };
};

// ── List all owners with their shops ─────────────────────────────────────────
const getAllOwners = async () => {
  return User.find({ role: 'owner' })
    .select('-password')
    .populate('shops', 'name type isActive currency')
    .sort({ createdAt: -1 })
    .lean();
};

// ── List all shops with owner info ────────────────────────────────────────────
const getAllShops = async () => {
  return Shop.find()
    .populate('owner', 'name email role isActive')
    .sort({ createdAt: -1 })
    .lean();
};

// ── Platform overview counts ──────────────────────────────────────────────────
const getOverview = async () => {
  const [totalOwners, totalShops, totalStaff, totalActiveShops] = await Promise.all([
    User.countDocuments({ role: 'owner' }),
    Shop.countDocuments(),
    User.countDocuments({ role: { $in: ['manager', 'billing_staff', 'inventory_staff'] } }),
    Shop.countDocuments({ isActive: true }),
  ]);
  return { totalOwners, totalShops, totalStaff, totalActiveShops };
};

// ── Toggle a user's isActive status ──────────────────────────────────────────
const toggleUserActive = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (user.role === 'super_admin')
    throw Object.assign(new Error('Cannot deactivate super admin'), { status: 403 });
  user.isActive = !user.isActive;
  await user.save();
  return user;
};

// ── Full platform analytics ───────────────────────────────────────────────────
const getAnalytics = async (period = 7) => {
  const days  = Math.min(Math.max(parseInt(period) || 7, 1), 90);
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalOwners,
    totalStaff,
    totalShops,
    activeShops,
    totalOrders,
    revenueAgg,
    totalProducts,
    activeUsersTodayIds,
    loginsToday,
    newUsersThisPeriod,
    dailyOrdersAgg,
    topShopsAgg,
    featureUsageAgg,
    dailyLoginsAgg,
    errorCountToday,
  ] = await Promise.all([
    User.countDocuments({ role: { $ne: 'super_admin' } }),
    User.countDocuments({ role: 'owner' }),
    User.countDocuments({ role: { $in: ['manager', 'billing_staff', 'inventory_staff'] } }),
    Shop.countDocuments(),
    Shop.countDocuments({ isActive: true }),
    Sale.countDocuments(),
    Sale.aggregate([{ $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Product.countDocuments(),
    // Active users today = distinct userIds that have logs today
    Log.distinct('userId', { createdAt: { $gte: today }, userId: { $ne: null } }),
    Log.countDocuments({ action: { $in: ['LOGIN_SUCCESS', 'SUPER_ADMIN_LOGIN'] }, createdAt: { $gte: today } }),
    User.countDocuments({ createdAt: { $gte: since }, role: { $ne: 'super_admin' } }),
    // Daily orders + revenue for the period
    Sale.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id:     { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders:  { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    // Top 5 shops by order count this period
    Sale.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$shopId', orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { orders: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'shops', localField: '_id', foreignField: '_id', as: 'shop' } },
      { $unwind: { path: '$shop', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          shopName: '$shop.name',
          shopType: '$shop.type',
          orders:   1,
          revenue:  1,
        },
      },
    ]),
    // Feature usage by module
    Log.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$module', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    // Daily logins for the period
    Log.aggregate([
      { $match: { action: { $in: ['LOGIN_SUCCESS', 'SUPER_ADMIN_LOGIN'] }, createdAt: { $gte: since } } },
      {
        $group: {
          _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Log.countDocuments({ status: 'error', createdAt: { $gte: today } }),
  ]);

  return {
    overview: {
      totalUsers,
      totalOwners,
      totalStaff,
      totalShops,
      activeShops,
      totalOrders,
      totalRevenue:     revenueAgg[0]?.total || 0,
      totalProducts,
      activeUsersToday: activeUsersTodayIds.length,
      loginsToday,
      newUsersThisPeriod,
      errorCountToday,
    },
    charts: {
      dailyOrders:  dailyOrdersAgg,
      dailyLogins:  dailyLoginsAgg,
      topShops:     topShopsAgg,
      featureUsage: featureUsageAgg,
    },
    period: days,
  };
};

// ── Console logs — admin-only full visibility ─────────────────────────────────
const getConsoleLogs = async ({ page = 1, limit = 50, action, module: mod, status, period = 1 }) => {
  const days = Math.min(parseInt(period) || 1, 30);
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const filter = { createdAt: { $gte: since } };
  if (action) filter.action = action;
  if (mod)    filter.module = mod;
  if (status) filter.status = status;

  const skip  = (Math.max(1, parseInt(page)) - 1) * Math.min(parseInt(limit), 100);
  const lim   = Math.min(parseInt(limit) || 50, 100);

  const [logs, total] = await Promise.all([
    Log.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .populate('userId',   'name email role')
      .populate('actorId',  'name email role')
      .populate('actingAs', 'name email role')
      .lean(),
    Log.countDocuments(filter),
  ]);

  return { logs, total, page: parseInt(page), limit: lim };
};

module.exports = { createOwner, getAllOwners, getAllShops, getOverview, toggleUserActive, getAnalytics, getConsoleLogs };
