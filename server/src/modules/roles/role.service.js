const { Role, ALL_PERMISSIONS } = require('./role.model');

// ── Default permissions for built-in roles ────────────────────────────────────
const DEFAULT_ROLE_PERMISSIONS = {
  super_admin:     ALL_PERMISSIONS,
  owner:           ALL_PERMISSIONS,
  manager:         ['view_products','create_product','edit_product','view_sales','create_sale','view_customers','manage_customers','view_expenses','manage_expenses','view_reports','view_dashboard','view_ai_insights'],
  billing_staff:   ['view_products','view_sales','create_sale','view_customers','manage_customers','view_dashboard'],
  inventory_staff: ['view_products','create_product','edit_product','view_dashboard'],
};

const getRoles = async (ownerId) => {
  return Role.find({ ownerId }).sort({ createdAt: -1 });
};

const getRoleById = async (id, ownerId) => {
  const role = await Role.findOne({ _id: id, ownerId });
  if (!role) throw Object.assign(new Error('Role not found'), { status: 404 });
  return role;
};

const createRole = async (ownerId, data) => {
  const { name, description, permissions = [], color } = data;
  const role = await Role.create({ name, description, permissions, ownerId, color });
  return role;
};

const updateRole = async (id, ownerId, data) => {
  const role = await Role.findOne({ _id: id, ownerId });
  if (!role) throw Object.assign(new Error('Role not found'), { status: 404 });
  if (role.isSystem) throw Object.assign(new Error('Cannot modify system role'), { status: 403 });
  Object.assign(role, data);
  await role.save();
  return role;
};

const deleteRole = async (id, ownerId) => {
  const role = await Role.findOne({ _id: id, ownerId });
  if (!role) throw Object.assign(new Error('Role not found'), { status: 404 });
  if (role.isSystem) throw Object.assign(new Error('Cannot delete system role'), { status: 403 });
  await role.deleteOne();
  return role;
};

const getPermissionsList = () => ALL_PERMISSIONS;

const resolvePermissions = (builtInRole, customRole) => {
  if (builtInRole === 'super_admin') return ALL_PERMISSIONS;
  if (customRole) return customRole.permissions || [];
  return DEFAULT_ROLE_PERMISSIONS[builtInRole] || [];
};

module.exports = {
  getRoles, getRoleById, createRole, updateRole, deleteRole,
  getPermissionsList, resolvePermissions, DEFAULT_ROLE_PERMISSIONS,
};
