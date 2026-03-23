const Notification  = require('./notification.model');
const Product       = require('../products/product.model');
const pushService   = require('../push/push.service');

// ── CRUD ──────────────────────────────────────────────────────────────────────
const getNotifications = async (userId, { limit = 30, unreadOnly = false }) => {
  const filter = { userId };
  if (unreadOnly === 'true' || unreadOnly === true) filter.read = false;

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit)),
    Notification.countDocuments({ userId, read: false }),
  ]);

  return { notifications, unreadCount };
};

const markRead = async (userId, ids) => {
  const filter = { userId };
  if (ids && ids.length) filter._id = { $in: ids };
  await Notification.updateMany(filter, { read: true });
};

const markAllRead = async (userId) => {
  await Notification.updateMany({ userId }, { read: true });
};

const deleteNotification = async (userId, id) => {
  return Notification.findOneAndDelete({ _id: id, userId });
};

const clearAll = async (userId) => {
  return Notification.deleteMany({ userId });
};

// ── Create a notification + fire FCM push ────────────────────────────────────
const createNotification = async (data) => {
  const notification = await Notification.create(data);

  // Fire-and-forget FCM push — never block the caller
  if (data.userId) {
    pushService.sendToUser(data.userId, {
      title: data.title,
      body:  data.message,
      data:  {
        type:           data.type  || 'info',
        link:           data.link  || '',
        notificationId: String(notification._id),
      },
    }).catch(() => {}); // swallow — push failure must not break the request
  }

  return notification;
};

// ── Auto-generate low stock notifications ─────────────────────────────────────
const generateLowStockNotifications = async (user) => {
  const shopFilter = user.role !== 'super_admin'
    ? { shopId: { $in: user.shops } }
    : {};

  const lowStock = await Product.find({
    isActive: true,
    ...shopFilter,
    $expr: { $lte: ['$stock', '$lowStockThreshold'] },
  }).limit(20);

  if (!lowStock.length) return [];

  const notifications = await Promise.all(
    lowStock.map((p) =>
      Notification.create({
        userId:  user._id,
        ownerId: user.ownerId || user._id,
        shopId:  p.shopId,
        type:    'low_stock',
        title:   'Low Stock Alert',
        message: `${p.name} has only ${p.stock} ${p.unit || 'pcs'} left`,
        link:    '/inventory',
        icon:    '⚠️',
      })
    )
  );

  return notifications;
};

// ── Notify all staff + owner when a new product is added ─────────────────────
const notifyShopStaff = async (product, owner) => {
  const User = require('../auth/auth.model');
  const staff = await User.find({ ownerId: owner._id, isActive: true }).select('_id').lean();
  const targets = [owner._id, ...staff.map((u) => u._id)];

  const notifications = await Promise.all(
    targets.map((userId) =>
      Notification.create({
        userId,
        ownerId: owner._id,
        shopId:  product.shopId,
        type:    'new_product',
        title:   'New Product Added',
        message: `${product.name} (${product.category}) is now in inventory — Stock: ${product.stock} ${product.unit || 'pcs'}`,
        link:    '/inventory',
        icon:    '📦',
      })
    )
  );

  return notifications;
};

module.exports = {
  getNotifications, markRead, markAllRead, deleteNotification, clearAll,
  createNotification, generateLowStockNotifications, notifyShopStaff,
};
