import useAuthStore from '../store/authStore';

// ── Fallback role-based permissions (used when no dynamic role is assigned) ───
const ROLE_PERMS = {
  super_admin:     ['all'],
  owner:           ['dashboard', 'inventory', 'billing', 'customers', 'expenses', 'reports', 'settings', 'staff', 'ai', 'roles'],
  manager:         ['dashboard', 'inventory', 'billing', 'customers', 'expenses', 'reports', 'ai'],
  billing_staff:   ['billing', 'customers', 'dashboard'],
  inventory_staff: ['inventory', 'dashboard'],
};

// Map UI sections to granular API permissions
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

export const usePermissions = () => {
  const user = useAuthStore((s) => s.user);
  const role = user?.role || '';

  // Dynamic permissions from the server (populated on login/getMe)
  const dynamicPerms = user?.permissions || [];

  // Check a UI section (e.g., 'billing', 'inventory')
  const can = (section) => {
    if (!user) return false;
    if (role === 'super_admin') return true;

    // If user has dynamic permissions from server, use them
    if (dynamicPerms.length > 0) {
      const required = SECTION_TO_PERMS[section];
      if (!required) return dynamicPerms.length > 0; // unknown section, allow if has any perms
      return required.some((p) => dynamicPerms.includes(p));
    }

    // Fallback to built-in role mapping
    const perms = ROLE_PERMS[role] || [];
    return perms.includes('all') || perms.includes(section);
  };

  // Check a granular API permission (e.g., 'create_product')
  const hasPermission = (perm) => {
    if (!user) return false;
    if (role === 'super_admin') return true;
    return dynamicPerms.includes(perm);
  };

  const canAny = (...sections) => sections.some(can);
  const hasAny = (...perms) => perms.some(hasPermission);

  return { can, canAny, hasPermission, hasAny, role, user, permissions: dynamicPerms };
};
