const Shop = require('./shop.model');
const User = require('../auth/auth.model');
const { isValidVpa } = require('../../utils/upi');

const createShop = async (ownerId, data) => {
  const shop = await Shop.create({ ...data, owner: ownerId });

  // Add shop to owner's shops array
  await User.findByIdAndUpdate(ownerId, { $addToSet: { shops: shop._id } });
  return shop;
};

const getShops = async (user) => {
  if (user.role === 'super_admin') return Shop.find().populate('owner', 'name email');
  return Shop.find({ _id: { $in: user.shops } });
};

const getShopById = async (shopId, user) => {
  const shop = await Shop.findById(shopId).populate('owner', 'name email');
  if (!shop) throw Object.assign(new Error('Shop not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === shopId)) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }
  return shop;
};

const updateShop = async (shopId, ownerId, role, data) => {
  // `pre('validate')` hooks don't fire on findOneAndUpdate, so the UPI guard
  // is enforced here — this is the path Settings → Payments actually uses.
  if (data.upiSettings) {
    const { enabled, vpa, merchantName } = data.upiSettings;
    if (vpa && !isValidVpa(vpa)) {
      throw Object.assign(
        new Error('Invalid UPI ID — expected a format like shopname@bank'),
        { status: 400 }
      );
    }
    if (enabled && !isValidVpa(vpa)) {
      throw Object.assign(
        new Error('A valid UPI ID is required before enabling UPI QR payments'),
        { status: 400 }
      );
    }
    if (enabled && !merchantName?.trim()) {
      throw Object.assign(
        new Error('Merchant / store name is required before enabling UPI QR payments'),
        { status: 400 }
      );
    }
  }

  const filter = role === 'super_admin' ? { _id: shopId } : { _id: shopId, owner: ownerId };
  const shop = await Shop.findOneAndUpdate(filter, data, { new: true, runValidators: true });
  if (!shop) throw Object.assign(new Error('Shop not found or access denied'), { status: 404 });
  return shop;
};

const deleteShop = async (shopId, ownerId, role) => {
  const filter = role === 'super_admin' ? { _id: shopId } : { _id: shopId, owner: ownerId };
  const shop = await Shop.findOneAndDelete(filter);
  if (!shop) throw Object.assign(new Error('Shop not found or access denied'), { status: 404 });
  // Remove shop from owner's list
  await User.findByIdAndUpdate(ownerId, { $pull: { shops: shopId } });
  return shop;
};

// Add staff to a shop
const addStaffToShop = async (shopId, staffId, ownerId) => {
  const shop = await Shop.findOne({ _id: shopId, owner: ownerId });
  if (!shop) throw Object.assign(new Error('Shop not found'), { status: 404 });
  await User.findOneAndUpdate(
    { _id: staffId, ownerId },
    { $addToSet: { shops: shopId } }
  );
  return shop;
};

module.exports = { createShop, getShops, getShopById, updateShop, deleteShop, addStaffToShop };
