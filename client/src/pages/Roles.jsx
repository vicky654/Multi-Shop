import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCog, Plus, Edit2, Trash2, Save, X,
  Shield, ShoppingCart, Users, BarChart2,
  Settings, Package, Zap, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { rolesApi } from '../api/roles.api';
import { usePermissions } from '../hooks/usePermissions';

// ── Permission catalogue ───────────────────────────────────────────────────────
// Grouped by section for a readable UI. Each entry has the exact string the
// backend expects, a human label, and an icon for the group header.
// Keys must exactly match the enum in server/src/modules/roles/role.model.js
const PERM_GROUPS = [
  {
    group:  'Dashboard',
    icon:   BarChart2,
    color:  'text-blue-500',
    perms:  [
      { key: 'view_dashboard', label: 'View Dashboard' },
    ],
  },
  {
    group:  'Inventory',
    icon:   Package,
    color:  'text-purple-500',
    perms:  [
      { key: 'view_products',  label: 'View Products'   },
      { key: 'create_product', label: 'Add Products'    },
      { key: 'edit_product',   label: 'Edit Products'   },
      { key: 'delete_product', label: 'Delete Products' },
    ],
  },
  {
    group:  'Billing',
    icon:   ShoppingCart,
    color:  'text-green-500',
    perms:  [
      { key: 'view_sales',   label: 'View Sales'    },
      { key: 'create_sale',  label: 'Create Sales'  },
      { key: 'refund_sale',  label: 'Refund Sales'  },
    ],
  },
  {
    group:  'Customers',
    icon:   Users,
    color:  'text-yellow-500',
    perms:  [
      { key: 'view_customers',    label: 'View Customers'   },
      { key: 'manage_customers',  label: 'Add / Edit / Delete Customers' },
    ],
  },
  {
    group:  'Finance',
    icon:   BarChart2,
    color:  'text-orange-500',
    perms:  [
      { key: 'view_expenses',    label: 'View Expenses'             },
      { key: 'manage_expenses',  label: 'Add / Edit / Delete Expenses' },
      { key: 'view_reports',     label: 'View Reports'              },
    ],
  },
  {
    group:  'AI & Insights',
    icon:   Zap,
    color:  'text-pink-500',
    perms:  [
      { key: 'view_ai_insights', label: 'AI Insights' },
    ],
  },
  {
    group:  'Administration',
    icon:   Settings,
    color:  'text-red-500',
    perms:  [
      { key: 'manage_settings', label: 'Manage Settings' },
      { key: 'manage_users',    label: 'Manage Staff & Users' },
    ],
  },
];

const ALL_PERM_KEYS = PERM_GROUPS.flatMap((g) => g.perms.map((p) => p.key));

const EMPTY_ROLE = { name: '', description: '', permissions: [] };

// ── Role badge colour ─────────────────────────────────────────────────────────
const ROLE_COLORS = {
  owner:           'bg-blue-100 text-blue-700 border-blue-200',
  manager:         'bg-purple-100 text-purple-700 border-purple-200',
  staff:           'bg-green-100 text-green-700 border-green-200',
  billing_staff:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  inventory_staff: 'bg-orange-100 text-orange-700 border-orange-200',
};
const roleBadge = (name) =>
  ROLE_COLORS[name?.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200';

// ── Permission toggle checkbox ─────────────────────────────────────────────────
function PermToggle({ permKey, label, checked, onChange, disabled }) {
  return (
    <label className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
      disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="w-4 h-4 rounded accent-blue-600 border-gray-300 shrink-0"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

// ── Permission group card ──────────────────────────────────────────────────────
function PermGroup({ group, icon: Icon, color, perms, selected, onToggle, disabled, onToggleAll }) {
  const allChecked  = perms.every((p) => selected.includes(p.key));
  const someChecked = perms.some((p)  => selected.includes(p.key));

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Group header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-sm font-semibold text-gray-700">{group}</span>
          <span className="text-xs text-gray-400">
            ({perms.filter((p) => selected.includes(p.key)).length}/{perms.length})
          </span>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => onToggleAll(perms.map((p) => p.key), !allChecked)}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition"
          >
            {allChecked ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>

      {/* Perms list */}
      <div className="px-2 py-1 grid grid-cols-2 gap-x-2">
        {perms.map((p) => (
          <PermToggle
            key={p.key}
            permKey={p.key}
            label={p.label}
            checked={selected.includes(p.key)}
            onChange={() => onToggle(p.key)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

// ── Role form (create / edit) ──────────────────────────────────────────────────
function RoleForm({ initial = EMPTY_ROLE, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);

  const toggle = (key) =>
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((k) => k !== key)
        : [...f.permissions, key],
    }));

  const toggleGroup = (keys, selectAll) =>
    setForm((f) => ({
      ...f,
      permissions: selectAll
        ? [...new Set([...f.permissions, ...keys])]
        : f.permissions.filter((k) => !keys.includes(k)),
    }));

  const selectAllPerms = () =>
    setForm((f) => ({ ...f, permissions: [...ALL_PERM_KEYS] }));

  const clearAllPerms = () =>
    setForm((f) => ({ ...f, permissions: [] }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(form); }}
      className="space-y-5"
    >
      {/* Name + Description */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Role Name <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. inventory_staff"
            className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Description
          </label>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Short description"
            className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Permissions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Permissions</p>
            <p className="text-xs text-gray-400">
              {form.permissions.length} of {ALL_PERM_KEYS.length} selected
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={clearAllPerms}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded-lg transition">
              Clear all
            </button>
            <button type="button" onClick={selectAllPerms}
              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 border border-blue-200 bg-blue-50 rounded-lg transition">
              Select all
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {PERM_GROUPS.map((g) => (
            <PermGroup
              key={g.group}
              group={g.group}
              icon={g.icon}
              color={g.color}
              perms={g.perms}
              selected={form.permissions}
              onToggle={toggle}
              onToggleAll={toggleGroup}
              disabled={false}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 h-10 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
          {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save Role'}
        </button>
      </div>
    </form>
  );
}

// ── Role card (collapsed view) ─────────────────────────────────────────────────
function RoleCard({ role, onEdit, onDelete, canEdit }) {
  const [expanded, setExpanded] = useState(false);

  // Count filled permission groups
  const groupCounts = PERM_GROUPS.map((g) => ({
    ...g,
    count: g.perms.filter((p) => (role.permissions || []).includes(p.key)).length,
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Card header */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-sm">{role.name}</h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleBadge(role.name)}`}>
              {role.name}
            </span>
          </div>
          {role.description && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{role.description}</p>
          )}
          <p className="text-[11px] text-gray-400 mt-0.5">
            {(role.permissions || []).length} permissions granted
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            title="View permissions"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
          {canEdit && (
            <>
              <button
                onClick={() => onEdit(role)}
                className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 transition"
                title="Edit role"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(role)}
                className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition"
                title="Delete role"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded permission summary */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-4 pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {groupCounts.map((g) => {
              const GIcon = g.icon;
              return (
                <div key={g.group}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs ${
                    g.count > 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                  }`}>
                  <GIcon className={`w-3.5 h-3.5 shrink-0 ${g.count > 0 ? g.color : 'text-gray-300'}`} />
                  <div className="min-w-0">
                    <p className={`font-medium truncate ${g.count > 0 ? 'text-gray-700' : 'text-gray-400'}`}>
                      {g.group}
                    </p>
                    <p className={`text-[10px] ${g.count > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                      {g.count}/{g.perms.length}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Roles page ────────────────────────────────────────────────────────────
export default function Roles() {
  const qc = useQueryClient();
  const { can, role: currentRole } = usePermissions();
  const canEdit = can('roles');

  const [mode,       setMode]       = useState(null); // null | 'create' | 'edit'
  const [editTarget, setEditTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn:  () => rolesApi.getAll(),
  });

  const createMut = useMutation({
    mutationFn: (d) => rolesApi.create(d),
    onSuccess:  () => { qc.invalidateQueries(['roles']); toast.success('Role created'); setMode(null); },
    onError:    (e) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => rolesApi.update(id, data),
    onSuccess:  () => { qc.invalidateQueries(['roles']); toast.success('Role updated'); setMode(null); setEditTarget(null); },
    onError:    (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => rolesApi.delete(id),
    onSuccess:  () => { qc.invalidateQueries(['roles']); toast.success('Role deleted'); },
    onError:    (e) => toast.error(e.message),
  });

  const openEdit = (role) => {
    setEditTarget(role);
    setMode('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (role) => {
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    deleteMut.mutate(role._id);
  };

  const handleSave = (form) => {
    if (mode === 'edit' && editTarget) {
      updateMut.mutate({ id: editTarget._id, data: form });
    } else {
      createMut.mutate(form);
    }
  };

  const roles = data?.data?.roles || [];
  const saving = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-blue-600" />
            Roles & Permissions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage what each role can access and do in MultiShop.
          </p>
        </div>
        {canEdit && mode === null && (
          <button
            onClick={() => setMode('create')}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Role
          </button>
        )}
        {mode !== null && (
          <button
            onClick={() => { setMode(null); setEditTarget(null); }}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl transition text-sm"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
        )}
      </div>

      {/* Create / Edit form */}
      {mode !== null && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
              {mode === 'edit' ? <Edit2 className="w-4 h-4 text-blue-600" /> : <Plus className="w-4 h-4 text-blue-600" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {mode === 'edit' ? `Edit: ${editTarget?.name}` : 'New Role'}
              </p>
              <p className="text-xs text-gray-400">
                {mode === 'edit' ? 'Modify permissions and save' : 'Define a role name and grant permissions'}
              </p>
            </div>
          </div>
          <div className="p-5">
            <RoleForm
              initial={mode === 'edit' ? { ...editTarget } : EMPTY_ROLE}
              onSave={handleSave}
              onCancel={() => { setMode(null); setEditTarget(null); }}
              saving={saving}
            />
          </div>
        </div>
      )}

      {/* Built-in role reference card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3">
          Built-in Role Permissions (Reference)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              name:  'owner',
              color: 'bg-blue-600',
              perms: ['All permissions'],
            },
            {
              name:  'manager',
              color: 'bg-purple-600',
              perms: ['Dashboard', 'Inventory', 'Billing', 'Customers', 'Expenses', 'Reports', 'AI'],
            },
            {
              name:  'staff',
              color: 'bg-green-600',
              perms: ['Dashboard', 'Billing', 'Customers'],
            },
          ].map((r) => (
            <div key={r.name} className="bg-white rounded-xl p-3 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-6 h-6 ${r.color} rounded-lg flex items-center justify-center`}>
                  <Shield className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-gray-800 capitalize">{r.name}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {r.perms.map((p) => (
                  <span key={p} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100 font-medium">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Roles list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <span className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading roles…</p>
          </div>
        </div>
      ) : roles.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <UserCog className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm font-medium">No custom roles yet.</p>
          <p className="text-gray-400 text-xs mt-1">Built-in roles (owner, manager, staff) are always available.</p>
          {canEdit && (
            <button
              onClick={() => setMode('create')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" /> Create your first role
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <RoleCard
              key={role._id}
              role={role}
              onEdit={openEdit}
              onDelete={handleDelete}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}

      {/* Permission legend */}
      {!isLoading && (
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">All Available Permissions</p>
          <div className="space-y-2">
            {PERM_GROUPS.map((g) => {
              const GIcon = g.icon;
              return (
                <div key={g.group} className="flex items-start gap-3">
                  <div className="flex items-center gap-1.5 w-28 shrink-0">
                    <GIcon className={`w-3.5 h-3.5 shrink-0 ${g.color}`} />
                    <span className="text-xs font-semibold text-gray-600">{g.group}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {g.perms.map((p) => (
                      <span key={p.key} className="text-[10px] font-mono px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-500">
                        {p.key}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
