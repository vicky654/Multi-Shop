import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Plus, Edit2, Trash2, Save, X,
  Mail, Phone, Shield, Store, Eye, EyeOff,
  CheckCircle, XCircle, UserCog,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi }    from '../api/users.api';
import { rolesApi }    from '../api/roles.api';
import useShopStore    from '../store/shopStore';
import { usePermissions } from '../hooks/usePermissions';

// ── Role display config ───────────────────────────────────────────────────────
const ROLE_META = {
  owner:           { label: 'Owner',           color: 'bg-blue-100 text-blue-700 border-blue-200'     },
  manager:         { label: 'Manager',         color: 'bg-purple-100 text-purple-700 border-purple-200' },
  billing_staff:   { label: 'Billing Staff',   color: 'bg-green-100 text-green-700 border-green-200'  },
  inventory_staff: { label: 'Inventory Staff', color: 'bg-orange-100 text-orange-700 border-orange-200' },
};

const STAFF_ROLES = [
  { value: 'manager',         label: 'Manager',         desc: 'Full access except settings & roles' },
  { value: 'billing_staff',   label: 'Billing Staff',   desc: 'Billing + customers only'            },
  { value: 'inventory_staff', label: 'Inventory Staff', desc: 'Inventory + dashboard only'          },
];

const EMPTY_FORM = {
  name: '', email: '', password: '',
  role: 'billing_staff', phone: '',
  shopIds: [], customRoleId: '',
};

// ── Staff form ─────────────────────────────────────────────────────────────────
function StaffForm({ initial = EMPTY_FORM, isEdit = false, onSave, onCancel, saving, shops, customRoles }) {
  const [form,    setForm]    = useState(initial);
  const [showPwd, setShowPwd] = useState(false);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleShop = (id) =>
    setForm((f) => ({
      ...f,
      shopIds: f.shopIds.includes(id)
        ? f.shopIds.filter((s) => s !== id)
        : [...f.shopIds, id],
    }));

  const inp = 'w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition';

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      {/* Name + Phone */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input required value={form.name}
            onChange={(e) => upd('name', e.target.value)}
            placeholder="e.g. Ravi Kumar"
            className={inp} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Phone
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={form.phone}
              onChange={(e) => upd('phone', e.target.value)}
              placeholder="+91 98765 43210"
              className={`${inp} pl-8`} />
          </div>
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Email <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input required type="email" value={form.email}
            onChange={(e) => upd('email', e.target.value)}
            placeholder="staff@yourshop.com"
            className={`${inp} pl-8`} />
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Password {isEdit && <span className="text-gray-400 font-normal normal-case">(leave blank to keep current)</span>}
          {!isEdit && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            required={!isEdit}
            value={form.password}
            onChange={(e) => upd('password', e.target.value)}
            placeholder="Min. 6 characters"
            className={`${inp} pr-10`} />
          <button type="button" onClick={() => setShowPwd((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Role */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Role <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {STAFF_ROLES.map((r) => (
            <button key={r.value} type="button"
              onClick={() => upd('role', r.value)}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                form.role === r.value
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'border-gray-200 text-gray-700 hover:border-blue-300 bg-white'
              }`}>
              <p className={`text-xs font-semibold ${form.role === r.value ? 'text-white' : 'text-gray-800'}`}>
                {r.label}
              </p>
              <p className={`text-[10px] mt-0.5 leading-tight ${form.role === r.value ? 'text-blue-100' : 'text-gray-400'}`}>
                {r.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Role Override */}
      {customRoles.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Custom Role Override
            <span className="ml-1 text-[10px] text-gray-400 font-normal normal-case">(overrides built-in role permissions)</span>
          </label>
          <select value={form.customRoleId} onChange={(e) => upd('customRoleId', e.target.value)} className={inp}>
            <option value="">— Use built-in role —</option>
            {customRoles.map((r) => (
              <option key={r._id} value={r._id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Shop access */}
      {shops.length > 1 && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Shop Access
            <span className="ml-1 text-[10px] text-gray-400 font-normal normal-case">(select which shops they can access)</span>
          </label>
          <div className="space-y-1.5">
            {shops.map((s) => (
              <label key={s._id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox"
                  checked={form.shopIds.includes(s._id)}
                  onChange={() => toggleShop(s._id)}
                  className="w-4 h-4 rounded accent-blue-600" />
                <Store className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-700">{s.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

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
          {saving ? 'Saving…' : isEdit ? 'Update Staff' : 'Add Staff'}
        </button>
      </div>
    </form>
  );
}

// ── Staff card ─────────────────────────────────────────────────────────────────
function StaffCard({ member, onEdit, onDelete, onToggleActive, canEdit }) {
  const meta = ROLE_META[member.role] || { label: member.role, color: 'bg-gray-100 text-gray-700 border-gray-200' };
  const initials = member.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
      member.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
    }`}>
      <div className="p-4 flex items-start gap-3">
        {/* Avatar */}
        <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">{member.name}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>
              {meta.label}
            </span>
            {!member.isActive && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
                Inactive
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 mt-0.5">
            <Mail className="w-3 h-3 text-gray-400 shrink-0" />
            <p className="text-xs text-gray-400 truncate">{member.email}</p>
          </div>

          {member.phone && (
            <div className="flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3 text-gray-400 shrink-0" />
              <p className="text-xs text-gray-400">{member.phone}</p>
            </div>
          )}

          {member.customRoleId && (
            <div className="flex items-center gap-1 mt-1">
              <UserCog className="w-3 h-3 text-purple-400 shrink-0" />
              <span className="text-[10px] text-purple-600 font-medium">{member.customRoleId.name}</span>
            </div>
          )}

          {(member.shops || []).length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {(member.shops || []).map((s) => (
                <span key={s._id} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md">
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="flex flex-col gap-1 shrink-0">
            <button onClick={() => onEdit(member)}
              className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition" title="Edit">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onToggleActive(member)}
              className={`p-1.5 rounded-lg transition ${member.isActive ? 'text-yellow-500 hover:bg-yellow-50' : 'text-green-500 hover:bg-green-50'}`}
              title={member.isActive ? 'Deactivate' : 'Activate'}>
              {member.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => onDelete(member)}
              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Users page ────────────────────────────────────────────────────────────
export default function UsersPage() {
  const qc = useQueryClient();
  const { shops } = useShopStore();
  const { can }   = usePermissions();
  const canEdit   = can('staff');

  const [mode,       setMode]       = useState(null); // null | 'create' | 'edit'
  const [editTarget, setEditTarget] = useState(null);

  // ── Data ──────────────────────────────────────────────────────────────────────
  const { data: staffData, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn:  () => usersApi.getAll(),
  });

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn:  () => rolesApi.getAll(),
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (d) => usersApi.create(d),
    onSuccess:  () => { qc.invalidateQueries(['staff']); toast.success('Staff member added'); setMode(null); },
    onError:    (e) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => usersApi.update(id, data),
    onSuccess:  () => { qc.invalidateQueries(['staff']); toast.success('Staff updated'); setMode(null); setEditTarget(null); },
    onError:    (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => usersApi.delete(id),
    onSuccess:  () => { qc.invalidateQueries(['staff']); toast.success('Staff removed'); },
    onError:    (e) => toast.error(e.message),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openEdit = (member) => {
    setEditTarget(member);
    setMode('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (member) => {
    if (!confirm(`Remove "${member.name}" from your team? They will lose access immediately.`)) return;
    deleteMut.mutate(member._id);
  };

  const handleToggleActive = (member) => {
    updateMut.mutate({ id: member._id, data: { isActive: !member.isActive } });
  };

  const handleSave = (form) => {
    // Strip empty password on edit so we don't accidentally clear it
    const payload = { ...form };
    if (mode === 'edit' && !payload.password) delete payload.password;
    if (!payload.customRoleId) delete payload.customRoleId;

    if (mode === 'edit' && editTarget) {
      updateMut.mutate({ id: editTarget._id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const staff       = staffData?.data?.staff || [];
  const customRoles = rolesData?.data?.roles  || [];
  const saving      = createMut.isPending || updateMut.isPending;

  const active   = staff.filter((s) => s.isActive);
  const inactive = staff.filter((s) => !s.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Staff Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Add team members and control what they can access.
          </p>
        </div>
        {canEdit && mode === null && (
          <button
            onClick={() => setMode('create')}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition text-sm shadow-sm">
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        )}
        {mode !== null && (
          <button
            onClick={() => { setMode(null); setEditTarget(null); }}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl transition text-sm">
            <X className="w-4 h-4" /> Cancel
          </button>
        )}
      </div>

      {/* Form panel */}
      {mode !== null && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
              {mode === 'edit' ? <Edit2 className="w-4 h-4 text-blue-600" /> : <Plus className="w-4 h-4 text-blue-600" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {mode === 'edit' ? `Edit: ${editTarget?.name}` : 'Add New Staff Member'}
              </p>
              <p className="text-xs text-gray-400">
                {mode === 'edit' ? 'Update role, access, or contact info' : 'They\'ll receive login credentials to access MultiShop'}
              </p>
            </div>
          </div>
          <div className="p-5">
            <StaffForm
              initial={mode === 'edit' ? {
                name: editTarget.name,
                email: editTarget.email,
                password: '',
                role: editTarget.role,
                phone: editTarget.phone || '',
                shopIds: (editTarget.shops || []).map((s) => s._id || s),
                customRoleId: editTarget.customRoleId?._id || '',
              } : EMPTY_FORM}
              isEdit={mode === 'edit'}
              onSave={handleSave}
              onCancel={() => { setMode(null); setEditTarget(null); }}
              saving={saving}
              shops={shops}
              customRoles={customRoles}
            />
          </div>
        </div>
      )}

      {/* Role permissions quick ref */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" /> Role Permissions Reference
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {STAFF_ROLES.map((r) => {
            const meta = ROLE_META[r.value] || {};
            return (
              <div key={r.value} className="bg-white rounded-xl p-3 border border-blue-100">
                <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border mb-2 ${meta.color}`}>
                  {r.label}
                </span>
                <p className="text-xs text-gray-500 leading-relaxed">{r.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Staff list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <span className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading staff…</p>
          </div>
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Users className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm font-medium">No staff members yet.</p>
          <p className="text-gray-400 text-xs mt-1">Add your first team member to delegate work.</p>
          {canEdit && (
            <button
              onClick={() => setMode('create')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition">
              <Plus className="w-4 h-4" /> Add Staff Member
            </button>
          )}
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                Active Staff ({active.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {active.map((m) => (
                  <StaffCard key={m._id} member={m} canEdit={canEdit}
                    onEdit={openEdit} onDelete={handleDelete} onToggleActive={handleToggleActive} />
                ))}
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                Inactive Staff ({inactive.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {inactive.map((m) => (
                  <StaffCard key={m._id} member={m} canEdit={canEdit}
                    onEdit={openEdit} onDelete={handleDelete} onToggleActive={handleToggleActive} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
