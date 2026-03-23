import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Users, Store, Plus, ChevronRight, ChevronLeft,
  Check, Eye, EyeOff, ToggleLeft, ToggleRight, Building2,
  TrendingUp, UserCheck, AlertCircle, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../api/admin.api';

// ── Shared input style ─────────────────────────────────────────────────────────
const inp = 'w-full h-11 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-gray-400';

const SHOP_TYPES = ['clothing', 'shoes', 'electronics', 'grocery', 'gifts', 'toys', 'other'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className={`rounded-2xl p-4 border ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <p className="text-3xl font-black text-gray-900">{value ?? '—'}</p>
    </div>
  );
}

// ── Create Owner Wizard ────────────────────────────────────────────────────────
const STEPS = ['Owner Details', 'Shop Details', 'Confirm'];

const EMPTY = {
  name: '', email: '', password: '', phone: '',
  shopName: '', shopType: 'other', currency: 'INR',
};

function CreateOwnerWizard({ onClose, onSuccess }) {
  const [step,      setStep]      = useState(0);
  const [form,      setForm]      = useState(EMPTY);
  const [showPass,  setShowPass]  = useState(false);
  const qc = useQueryClient();

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const createMut = useMutation({
    mutationFn: () => adminApi.createOwner(form),
    onSuccess: (res) => {
      qc.invalidateQueries(['admin-owners']);
      qc.invalidateQueries(['admin-overview']);
      toast.success(`Owner ${res.data?.user?.name || form.name} created!`);
      onSuccess?.();
      onClose();
    },
    onError: (e) => toast.error(e.message || 'Failed to create owner'),
  });

  const canNext0 = form.name.trim() && form.email.includes('@') && form.password.length >= 6;
  const canNext1 = form.shopName.trim();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-gray-800">Create Shop Owner</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 py-4">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  i < step ? 'bg-green-500 text-white' :
                  i === step ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-[10px] font-medium whitespace-nowrap ${i === step ? 'text-blue-600' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 rounded transition-all ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 pb-2">
          {step === 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800 text-sm">Owner Information</h3>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Full Name *</label>
                <input value={form.name} onChange={(e) => upd('name', e.target.value)}
                  placeholder="e.g. Rahul Sharma" className={inp} autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email *</label>
                <input type="email" value={form.email} onChange={(e) => upd('email', e.target.value)}
                  placeholder="owner@example.com" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Password * (min 6 chars)</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => upd('password', e.target.value)}
                    placeholder="••••••••"
                    className={`${inp} pr-10`}
                  />
                  <button type="button" onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</label>
                <input value={form.phone} onChange={(e) => upd('phone', e.target.value)}
                  placeholder="+91 98765 43210" className={inp} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800 text-sm">Shop Details</h3>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Shop Name *</label>
                <input value={form.shopName} onChange={(e) => upd('shopName', e.target.value)}
                  placeholder="e.g. Rahul's Fashion Store" className={inp} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Shop Type</label>
                  <select value={form.shopType} onChange={(e) => upd('shopType', e.target.value)} className={inp}>
                    {SHOP_TYPES.map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Currency</label>
                  <select value={form.currency} onChange={(e) => upd('currency', e.target.value)} className={inp}>
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800 text-sm">Confirm Details</h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                {[
                  ['Name',     form.name],
                  ['Email',    form.email],
                  ['Phone',    form.phone || '—'],
                  ['Shop',     form.shopName],
                  ['Type',     form.shopType],
                  ['Currency', form.currency],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-500 font-medium">{label}</span>
                    <span className="text-gray-800 font-semibold">{val}</span>
                  </div>
                ))}
              </div>
              {createMut.isError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {createMut.error?.message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium transition">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <button
            onClick={() => {
              if (step < STEPS.length - 1) setStep((s) => s + 1);
              else createMut.mutate();
            }}
            disabled={(step === 0 && !canNext0) || (step === 1 && !canNext1) || createMut.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition text-sm"
          >
            {createMut.isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {step < STEPS.length - 1 ? (
              <><span>Next</span><ChevronRight className="w-4 h-4" /></>
            ) : (
              <><Check className="w-4 h-4" /><span>Create Owner & Shop</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AdminPanel ─────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [tab,        setTab]        = useState('owners');
  const [showWizard, setShowWizard] = useState(false);
  const qc = useQueryClient();

  const { data: overviewData } = useQuery({
    queryKey: ['admin-overview'],
    queryFn:  () => adminApi.getOverview(),
  });

  const { data: ownersData, isLoading: loadingOwners } = useQuery({
    queryKey: ['admin-owners'],
    queryFn:  () => adminApi.getOwners(),
    enabled:  tab === 'owners',
  });

  const { data: shopsData, isLoading: loadingShops } = useQuery({
    queryKey: ['admin-shops'],
    queryFn:  () => adminApi.getShops(),
    enabled:  tab === 'shops',
  });

  const toggleMut = useMutation({
    mutationFn: (id) => adminApi.toggleUser(id),
    onSuccess: () => {
      qc.invalidateQueries(['admin-owners']);
      toast.success('User status updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const overview = overviewData?.data || {};
  const owners   = ownersData?.data?.owners || [];
  const shops    = shopsData?.data?.shops   || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Super Admin</h1>
            <p className="text-sm text-gray-500">Platform management</p>
          </div>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Shop Owner
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Owners"   value={overview.totalOwners}      icon={UserCheck}   color="border-blue-100 bg-blue-50/50" />
        <StatCard label="Total Shops"    value={overview.totalShops}       icon={Store}       color="border-purple-100 bg-purple-50/50" />
        <StatCard label="Active Shops"   value={overview.totalActiveShops} icon={TrendingUp}  color="border-green-100 bg-green-50/50" />
        <StatCard label="Staff Members"  value={overview.totalStaff}       icon={Users}       color="border-amber-100 bg-amber-50/50" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {[
          { key: 'owners', label: 'Owners', icon: Users },
          { key: 'shops',  label: 'Shops',  icon: Building2 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Owners Table */}
      {tab === 'owners' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {loadingOwners ? (
            <div className="divide-y divide-gray-100">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-gray-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-100 rounded w-1/3" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : owners.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-gray-400">
              <Users className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium">No owners yet</p>
              <p className="text-sm mt-1">Create your first shop owner above</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {owners.map((owner) => (
                <div key={owner._id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {owner.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 truncate">{owner.name}</p>
                      {!owner.isActive && (
                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{owner.email}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(owner.shops || []).map((s) => (
                        <span key={s._id} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">{(owner.shops || []).length} shop{owner.shops?.length !== 1 ? 's' : ''}</p>
                    <button
                      onClick={() => toggleMut.mutate(owner._id)}
                      disabled={toggleMut.isPending}
                      className="mt-1 flex items-center gap-1 text-xs font-medium transition"
                      title={owner.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {owner.isActive ? (
                        <><ToggleRight className="w-5 h-5 text-green-500" /><span className="text-green-600">Active</span></>
                      ) : (
                        <><ToggleLeft className="w-5 h-5 text-gray-400" /><span className="text-gray-400">Inactive</span></>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Shops Table */}
      {tab === 'shops' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {loadingShops ? (
            <div className="divide-y divide-gray-100">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-gray-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-100 rounded w-1/3" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : shops.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-gray-400">
              <Store className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium">No shops yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {shops.map((shop) => (
                <div key={shop._id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-lg shrink-0">
                    🏪
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 truncate">{shop.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        shop.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {shop.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{shop.type} · {shop.currency}</p>
                    {shop.owner && (
                      <p className="text-xs text-gray-400 mt-0.5">Owner: {shop.owner.name} ({shop.owner.email})</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showWizard && <CreateOwnerWizard onClose={() => setShowWizard(false)} />}
    </div>
  );
}
