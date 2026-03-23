import useAuthStore from '../store/authStore';

// ── Fallback role-based permissions ───────────────────────────────────────────
const ROLE_PERMS = {
  super_admin:     ['all'],
  owner:           ['dashboard', 'inventory', 'billing', 'customers', 'expenses', 'reports', 'settings', 'staff', 'ai', 'roles'],
  manager:         ['dashboard', 'inventory', 'billing', 'customers', 'expenses', 'reports', 'ai'],
  billing_staff:   ['billing', 'customers', 'dashboard'],
  inventory_staff: ['inventory', 'dashboard'],
};

// ── Section → flat perm keys (for section-level can(section) checks) ──────────
const SECTION_TO_PERMS = {
  dashboard:  ['view_dashboard'],
  inventory:  ['view_products'],
  billing:    ['create_sale'],
  customers:  ['view_customers'],
  expenses:   ['view_expenses'],
  reports:    ['view_reports'],
  settings:   ['manage_settings'],
  staff:      ['manage_users'],
  ai:         ['view_ai_insights'],
  roles:      ['manage_users'],
};

// ── Module + action → exact flat perm key ─────────────────────────────────────
// Maps can('inventory', 'create') → 'create_product'
// All keys must match server/src/modules/roles/role.model.js ALL_PERMISSIONS
const MODULE_ACTION_MAP = {
  dashboard:  { view: 'view_dashboard' },
  inventory:  {
    view:   'view_products',
    create: 'create_product',
    update: 'edit_product',
    delete: 'delete_product',
  },
  billing:    {
    view:   'view_sales',
    create: 'create_sale',
    refund: 'refund_sale',
  },
  customers:  {
    view:   'view_customers',
    create: 'manage_customers',
    update: 'manage_customers',
    delete: 'manage_customers',
  },
  expenses:   {
    view:   'view_expenses',
    create: 'manage_expenses',
    update: 'manage_expenses',
    delete: 'manage_expenses',
  },
  reports:    { view: 'view_reports'     },
  settings:   { view: 'manage_settings', update: 'manage_settings' },
  staff:      {
    view:   'manage_users',
    create: 'manage_users',
    update: 'manage_users',
    delete: 'manage_users',
  },
  ai:         { view: 'view_ai_insights' },
  roles:      {
    view:   'manage_users',
    create: 'manage_users',
    update: 'manage_users',
    delete: 'manage_users',
  },
};

export const usePermissions = () => {
  const user = useAuthStore((s) => s.user);
  const role = user?.role || '';
  const dynamicPerms = user?.permissions || [];

  /**
   * can(section)           — section-level access check (used in sidebar nav filter)
   * can(module, action)    — granular action check (used on buttons / forms)
   *
   * Examples:
   *   can('billing')              → true if user can access the Billing page
   *   can('billing', 'create')    → true if user can create a sale
   *   can('inventory', 'delete')  → true if user can delete products
   */
  const can = (section, action = null) => {
    if (!user) return false;
    if (role === 'super_admin') return true;

    // ── Granular action check ─────────────────────────────────────────────────
    if (action !== null) {
      const permKey = MODULE_ACTION_MAP[section]?.[action];
      if (!permKey) return false; // unknown action → deny

      // Dynamic perms from server take priority
      if (dynamicPerms.length > 0) return dynamicPerms.includes(permKey);

      // Fallback: owner gets all, check role has section
      const rolePerms = ROLE_PERMS[role] || [];
      return rolePerms.includes('all') || rolePerms.includes(section);
    }

    // ── Section-level check (existing behaviour) ──────────────────────────────
    if (dynamicPerms.length > 0) {
      const required = SECTION_TO_PERMS[section];
      if (!required) return true; // unknown section, allow if user has any perms
      return required.some((p) => dynamicPerms.includes(p));
    }

    const rolePerms = ROLE_PERMS[role] || [];
    return rolePerms.includes('all') || rolePerms.includes(section);
  };

  // Granular flat-perm check (e.g. hasPermission('create_sale'))
  const hasPermission = (perm) => {
    if (!user) return false;
    if (role === 'super_admin') return true;
    return dynamicPerms.includes(perm);
  };

  const canAny = (...sections) => sections.some((s) => can(s));
  const hasAny = (...perms)    => perms.some(hasPermission);

  return { can, canAny, hasPermission, hasAny, role, user, permissions: dynamicPerms };
};

/**
 * Standalone helper (outside React components / Zustand actions).
 * canAccess(user, 'CREATE_PRODUCT') or canAccess(user, 'create_product')
 */
export const canAccess = (user, permission) => {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  const perms      = user.permissions || [];
  const normalized = permission.toLowerCase();
  return perms.includes(normalized) || perms.includes(permission);
};
