const User = require('./auth.model');
const { signToken } = require('../../utils/jwt');
const { resolvePermissions } = require('../roles/role.service');

// ── Helper: build user response with permissions ──────────────────────────────
const withPermissions = async (user) => {
  const populated = await User.findById(user._id)
    .select('-password')
    .populate('shops', 'name type isActive logo currency taxRate')
    .populate('customRoleId');
  const permissions = resolvePermissions(populated.role, populated.customRoleId);
  const obj = populated.toJSON();
  return { ...obj, permissions };
};

const register = async ({ name, email, password, role = 'owner', phone }) => {
  const existing = await User.findOne({ email });
  if (existing) throw Object.assign(new Error('Email already registered'), { status: 409 });

  const user  = await User.create({ name, email, password, role, phone });
  const token = signToken({ id: user._id, role: user.role });
  const userWithPerms = await withPermissions(user);
  return { user: userWithPerms, token };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user || !user.isActive)
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const ok = await user.comparePassword(password);
  if (!ok) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const token = signToken({ id: user._id, role: user.role });
  const userWithPerms = await withPermissions(user);
  return { user: userWithPerms, token };
};

const getMe = async (userId) => {
  const user = await User.findById(userId)
    .select('-password')
    .populate('shops', 'name type isActive logo currency taxRate')
    .populate('customRoleId');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  const permissions = resolvePermissions(user.role, user.customRoleId);
  return { ...user.toJSON(), permissions };
};

const completeOnboarding = async (userId) => {
  return User.findByIdAndUpdate(userId, { onboardingComplete: true }, { new: true });
};

// ── Staff management ──────────────────────────────────────────────────────────
const createStaff = async (ownerId, ownerShops, { name, email, password, role, phone, shopIds, customRoleId }) => {
  const STAFF_ROLES = ['manager', 'billing_staff', 'inventory_staff'];
  if (!STAFF_ROLES.includes(role))
    throw Object.assign(new Error('Invalid staff role'), { status: 400 });

  const validShops = (shopIds || []).filter((id) =>
    ownerShops.some((s) => s.toString() === id.toString())
  );

  const user = await User.create({
    name, email, password, role, phone,
    ownerId,
    shops: validShops,
    customRoleId: customRoleId || null,
  });

  const token = signToken({ id: user._id, role: user.role });
  return { user, token };
};

const getStaff = async (ownerId) => {
  return User.find({ ownerId })
    .select('-password')
    .populate('shops', 'name type')
    .populate('customRoleId', 'name permissions color');
};

const updateStaff = async (staffId, ownerId, updates) => {
  const staff = await User.findOne({ _id: staffId, ownerId });
  if (!staff) throw Object.assign(new Error('Staff member not found'), { status: 404 });
  Object.assign(staff, updates);
  await staff.save();
  return staff;
};

const deleteStaff = async (staffId, ownerId) => {
  const staff = await User.findOneAndDelete({ _id: staffId, ownerId });
  if (!staff) throw Object.assign(new Error('Staff member not found'), { status: 404 });
  return staff;
};

module.exports = { register, login, getMe, completeOnboarding, createStaff, getStaff, updateStaff, deleteStaff };
