const User = require('../auth/auth.model');
const Shop = require('../shops/shop.model');

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

module.exports = { createOwner, getAllOwners, getAllShops, getOverview, toggleUserActive };
