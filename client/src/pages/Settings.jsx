import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Store, Users, Link2, ExternalLink, Bell, MessageCircle, Send, Sun, Moon, Monitor, LayoutGrid, Tag, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { shopsApi } from '../api/shops.api';
import { authApi } from '../api/auth.api';
import useShopStore from '../store/shopStore';
import useAuthStore from '../store/authStore';
import Modal from '../components/Modal';
import { usePermissions } from '../hooks/usePermissions';
import useThemeStore from '../store/themeStore';
import { PRIMARY_PRESETS } from '../styles/theme';
import { BANNER_TEMPLATES } from '../components/SaleBanner';

const SHOP_TYPES = ['clothes', 'toys', 'shoes', 'gifts', 'electronics', 'grocery', 'other'];
const STAFF_ROLES = ['manager', 'billing_staff', 'inventory_staff'];
const ROLE_LABELS = { manager: 'Manager', billing_staff: 'Billing Staff', inventory_staff: 'Inventory Staff' };

const EMPTY_SHOP  = { name: '', type: 'clothes', address: '', phone: '', email: '', currency: '₹', taxRate: 0, description: '', logo: '', banner: '' };
const EMPTY_STAFF = { name: '', email: '', password: '', role: 'billing_staff', phone: '', shopIds: [] };

export default function Settings() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const { shops, activeShop } = useShopStore();
  const EMPTY_NOTIF = { ownerWhatsapp: '', smsApiKey: '', smsSenderId: '', dailySummaryEnabled: false };
  const [notifForm,  setNotifForm]  = useState(EMPTY_NOTIF);

  // Sync notifForm when active shop changes
  useEffect(() => {
    if (activeShop?.notifSettings) {
      setNotifForm({ ...EMPTY_NOTIF, ...activeShop.notifSettings });
    } else {
      setNotifForm(EMPTY_NOTIF);
    }
  }, [activeShop?._id]);

  const updateNotifMut = useMutation({
    mutationFn: (data) => shopsApi.update(activeShop._id, { notifSettings: data }),
    onSuccess: () => { qc.invalidateQueries(['shops']); toast.success('Notification settings saved'); },
    onError: (e) => toast.error(e.message),
  });

  // ── Sale Banner state ──────────────────────────────────────────────────────
  const EMPTY_BANNER = { enabled: false, title: '', subtitle: '', discount: '', theme: 'blue', endDate: '' };
  const [bannerForm, setBannerForm] = useState(EMPTY_BANNER);

  useEffect(() => {
    if (activeShop?.saleBanner) {
      setBannerForm({
        ...EMPTY_BANNER, ...activeShop.saleBanner,
        endDate: activeShop.saleBanner.endDate
          ? new Date(activeShop.saleBanner.endDate).toISOString().slice(0, 16)
          : '',
      });
    } else {
      setBannerForm(EMPTY_BANNER);
    }
  }, [activeShop?._id]);

  const updateBannerMut = useMutation({
    mutationFn: (data) => shopsApi.update(activeShop._id, {
      saleBanner: { ...data, endDate: data.endDate ? new Date(data.endDate) : null },
    }),
    onSuccess: () => { qc.invalidateQueries(['shops']); toast.success('Sale banner saved'); },
    onError:   (e) => toast.error(e.message),
  });

  const [shopModal, setShopModal] = useState(false);
  const [staffModal, setStaffModal] = useState(false);
  const [editShop,  setEditShop]  = useState(null);
  const [editStaff, setEditStaff] = useState(null);
  const [shopForm,  setShopForm]  = useState(EMPTY_SHOP);
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF);

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => authApi.getStaff(),
    enabled: can('staff'),
  });

  const createShopMut = useMutation({
    mutationFn: (d) => shopsApi.create(d),
    onSuccess: () => { qc.invalidateQueries(['shops']); toast.success('Shop created'); setShopModal(false); },
    onError: (e) => toast.error(e.message),
  });

  const updateShopMut = useMutation({
    mutationFn: ({ id, data }) => shopsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['shops']); toast.success('Shop updated'); setShopModal(false); },
    onError: (e) => toast.error(e.message),
  });

  const deleteShopMut = useMutation({
    mutationFn: (id) => shopsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries(['shops']); toast.success('Shop deleted'); },
    onError: (e) => toast.error(e.message),
  });

  const createStaffMut = useMutation({
    mutationFn: (d) => authApi.createStaff(d),
    onSuccess: () => { qc.invalidateQueries(['staff']); toast.success('Staff created'); setStaffModal(false); },
    onError: (e) => toast.error(e.message),
  });

  const deleteStaffMut = useMutation({
    mutationFn: (id) => authApi.deleteStaff(id),
    onSuccess: () => { qc.invalidateQueries(['staff']); toast.success('Staff deleted'); },
    onError: (e) => toast.error(e.message),
  });

  const openEditShop = (s) => { setEditShop(s); setShopForm({ ...s }); setShopModal(true); };
  const openNewShop  = ()  => { setEditShop(null); setShopForm(EMPTY_SHOP); setShopModal(true); };

  const handleShopSubmit = (e) => {
    e.preventDefault();
    editShop ? updateShopMut.mutate({ id: editShop._id, data: shopForm }) : createShopMut.mutate(shopForm);
  };

  const handleStaffSubmit = (e) => {
    e.preventDefault();
    createStaffMut.mutate({ ...staffForm, shopIds: staffForm.shopIds });
  };

  const staff = staffData?.data?.staff || [];
  const { theme, setTheme, compact, setCompact, primaryColor, setPrimaryColor, reset: resetTheme } = useThemeStore();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>

      {/* ── Display Preferences ── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Sun className="w-5 h-5 text-amber-500" />
          <h2 className="font-semibold text-gray-900 text-lg">Display Preferences</h2>
        </div>

        {/* Theme */}
        <div className="mb-5">
          <p className="text-sm font-medium text-gray-700 mb-2">Theme</p>
          <div className="flex gap-2">
            {[
              { value: 'light',  label: 'Light',  Icon: Sun },
              { value: 'dark',   label: 'Dark',   Icon: Moon },
              { value: 'system', label: 'System', Icon: Monitor },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={[
                  'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all',
                  theme === value
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                ].join(' ')}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Primary / Accent color */}
        <div className="mb-5 border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Primary Color</p>
              <p className="text-xs text-gray-400 mt-0.5">Applies to buttons, links and highlights</p>
            </div>
            <button
              onClick={resetTheme}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 hover:bg-gray-100 rounded-lg transition"
            >
              Reset
            </button>
          </div>

          {/* Preset swatches */}
          <div className="flex flex-wrap gap-2 mb-3">
            {PRIMARY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setPrimaryColor(preset.value)}
                title={preset.name}
                className="relative w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ backgroundColor: preset.value, focusRingColor: preset.value }}
              >
                {primaryColor === preset.value && (
                  <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">✓</span>
                )}
              </button>
            ))}

            {/* Custom color picker */}
            <label
              className="relative w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-gray-400 transition overflow-hidden"
              title="Custom color"
            >
              <span className="text-xs text-gray-400">+</span>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </label>
          </div>

          {/* Current swatch preview */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="w-6 h-6 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: primaryColor }} />
            <span className="text-xs font-mono text-gray-600">{primaryColor.toUpperCase()}</span>
            <button
              className="ml-auto px-3 py-1 rounded-lg text-xs font-semibold text-white transition"
              style={{ backgroundColor: primaryColor }}
            >
              Preview button
            </button>
          </div>
        </div>

        {/* Compact mode */}
        <div className="flex items-center justify-between py-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <LayoutGrid className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-800">Compact Mode</p>
              <p className="text-xs text-gray-500">Reduce spacing for a denser layout</p>
            </div>
          </div>
          <button
            onClick={() => setCompact(!compact)}
            className={[
              'relative w-11 h-6 rounded-full transition-colors duration-200',
              compact ? 'bg-blue-600' : 'bg-gray-300',
            ].join(' ')}
          >
            <span className={[
              'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
              compact ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')} />
          </button>
        </div>
      </section>

      {/* ── Shop Management ── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900 text-lg">My Shops</h2>
          </div>
          {can('settings') && (
            <button onClick={openNewShop} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition">
              <Plus className="w-4 h-4" /> New Shop
            </button>
          )}
        </div>
        <div className="space-y-3">
          {shops.map((shop) => (
            <div key={shop._id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-lg">
                  {({ clothes: '👗', toys: '🧸', shoes: '👟', gifts: '🎁', electronics: '📱', grocery: '🛒', other: '🏪' })[shop.type] || '🏪'}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{shop.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{shop.type} · {shop.address || 'No address'}</p>
                  {shop.slug && (
                    <a
                      href={`/shop/${shop.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-0.5 font-medium"
                    >
                      <Link2 className="w-3 h-3" />
                      /shop/{shop.slug}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEditShop(shop)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => { if (confirm('Delete this shop?')) deleteShopMut.mutate(shop._id); }} className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {!shops.length && <p className="text-sm text-gray-400 text-center py-8">No shops yet. Create your first shop!</p>}
        </div>
      </section>

      {/* ── Staff Management ── */}
      {can('staff') && (
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900 text-lg">Staff Members</h2>
            </div>
            <button onClick={() => { setStaffForm({ ...EMPTY_STAFF, shopIds: shops.map((s) => s._id) }); setStaffModal(true); }} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition">
              <Plus className="w-4 h-4" /> Add Staff
            </button>
          </div>
          <div className="space-y-3">
            {staff.map((s) => (
              <div key={s._id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600">
                    {s.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.email} · <span className="capitalize">{ROLE_LABELS[s.role]}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => { if (confirm('Remove this staff member?')) deleteStaffMut.mutate(s._id); }} className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            {!staff.length && !staffLoading && <p className="text-sm text-gray-400 text-center py-8">No staff added yet.</p>}
          </div>
        </section>
      )}

      {/* ── Sale Banner ── */}
      {can('settings') && activeShop && (
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-orange-500" />
              <h2 className="font-semibold text-gray-900 text-lg">Sale Banner</h2>
            </div>
            {/* Enable toggle */}
            <button
              onClick={() => setBannerForm((f) => ({ ...f, enabled: !f.enabled }))}
              className={['relative w-11 h-6 rounded-full transition-colors duration-200', bannerForm.enabled ? 'bg-blue-600' : 'bg-gray-300'].join(' ')}
            >
              <span className={['absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200', bannerForm.enabled ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
            </button>
          </div>

          {/* Preset templates */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Quick Templates</p>
            <div className="flex flex-wrap gap-2">
              {BANNER_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setBannerForm((f) => ({ ...f, title: t.title, subtitle: t.subtitle, discount: t.discount, theme: t.theme, enabled: true }))}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700 transition"
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input value={bannerForm.title} onChange={(e) => setBannerForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. 🎉 Weekend Sale" className="ui-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Discount Text</label>
              <input value={bannerForm.discount} onChange={(e) => setBannerForm((f) => ({ ...f, discount: e.target.value }))}
                placeholder="e.g. 20% OFF" className="ui-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Subtitle</label>
              <input value={bannerForm.subtitle} onChange={(e) => setBannerForm((f) => ({ ...f, subtitle: e.target.value }))}
                placeholder="e.g. This weekend only" className="ui-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date &amp; Time (optional)</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input type="datetime-local" value={bannerForm.endDate} onChange={(e) => setBannerForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="ui-input pl-9" />
              </div>
            </div>
          </div>

          {/* Theme */}
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-600 mb-2">Colour Theme</p>
            <div className="flex gap-2">
              {[
                { id: 'blue',   cls: 'bg-blue-600'   },
                { id: 'orange', cls: 'bg-orange-500'  },
                { id: 'green',  cls: 'bg-emerald-600' },
                { id: 'purple', cls: 'bg-purple-600'  },
                { id: 'red',    cls: 'bg-rose-600'    },
              ].map(({ id, cls }) => (
                <button
                  key={id}
                  onClick={() => setBannerForm((f) => ({ ...f, theme: id }))}
                  className={['w-8 h-8 rounded-full transition-all border-2', cls, bannerForm.theme === id ? 'border-gray-900 scale-110' : 'border-transparent'].join(' ')}
                />
              ))}
            </div>
          </div>

          <button
            onClick={() => updateBannerMut.mutate(bannerForm)}
            disabled={updateBannerMut.isPending}
            className="mt-5 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition"
          >
            {updateBannerMut.isPending ? 'Saving…' : 'Save Banner'}
          </button>
        </section>
      )}

      {/* ── Notification Settings ── */}
      {can('settings') && activeShop && (
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Bell className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-gray-900 text-lg">Notification Settings</h2>
              <p className="text-xs text-gray-400 mt-0.5">For <span className="font-semibold text-gray-600">{activeShop.name}</span></p>
            </div>
          </div>

          <div className="space-y-4">
            {/* WhatsApp */}
            <div className="p-4 border border-green-200 rounded-xl bg-green-50/50">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="w-4 h-4 text-green-600" />
                <p className="text-sm font-semibold text-green-800">WhatsApp (Daily Summary)</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Owner WhatsApp number</label>
                <input
                  value={notifForm.ownerWhatsapp}
                  onChange={(e) => setNotifForm((f) => ({ ...f, ownerWhatsapp: e.target.value }))}
                  placeholder="9876543210 (10-digit)"
                  className="mt-1.5 w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-400 mt-1">Daily summaries will be sent as a WhatsApp message to this number.</p>
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifForm.dailySummaryEnabled}
                  onChange={(e) => setNotifForm((f) => ({ ...f, dailySummaryEnabled: e.target.checked }))}
                  className="rounded accent-green-600"
                />
                <span className="text-sm text-gray-700">Enable automatic daily summary</span>
              </label>
            </div>

            {/* SMS */}
            <div className="p-4 border border-blue-200 rounded-xl bg-blue-50/50">
              <div className="flex items-center gap-2 mb-3">
                <Send className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-semibold text-blue-800">SMS (Fast2SMS — India)</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600">Fast2SMS API Key</label>
                  <input
                    type="password"
                    value={notifForm.smsApiKey}
                    onChange={(e) => setNotifForm((f) => ({ ...f, smsApiKey: e.target.value }))}
                    placeholder="Paste your Fast2SMS API key"
                    className="ui-input mt-1.5 h-9"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Sender ID (optional)</label>
                  <input
                    value={notifForm.smsSenderId}
                    onChange={(e) => setNotifForm((f) => ({ ...f, smsSenderId: e.target.value }))}
                    placeholder="FSTSMS"
                    maxLength={6}
                    className="ui-input mt-1.5 h-9"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Get your API key at <span className="font-mono text-blue-600">fast2sms.com</span>. Used for SMS receipts and customer campaigns.
              </p>
            </div>

            <button
              onClick={() => updateNotifMut.mutate(notifForm)}
              disabled={updateNotifMut.isPending}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg transition text-sm"
            >
              {updateNotifMut.isPending ? 'Saving…' : 'Save Notification Settings'}
            </button>
          </div>
        </section>
      )}

      {/* Shop modal */}
      <Modal open={shopModal} onClose={() => setShopModal(false)} title={editShop ? 'Edit Shop' : 'New Shop'}>
        <form onSubmit={handleShopSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name *</label>
              <input required value={shopForm.name} onChange={(e) => setShopForm((f) => ({ ...f, name: e.target.value }))} className="ui-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={shopForm.type} onChange={(e) => setShopForm((f) => ({ ...f, type: e.target.value }))} className="ui-input">
                {SHOP_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={shopForm.phone} onChange={(e) => setShopForm((f) => ({ ...f, phone: e.target.value }))} className="ui-input" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input value={shopForm.address} onChange={(e) => setShopForm((f) => ({ ...f, address: e.target.value }))} className="ui-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={shopForm.email} onChange={(e) => setShopForm((f) => ({ ...f, email: e.target.value }))} className="ui-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
              <input type="number" min="0" max="100" value={shopForm.taxRate} onChange={(e) => setShopForm((f) => ({ ...f, taxRate: e.target.value }))} className="ui-input" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea rows={2} value={shopForm.description || ''} onChange={(e) => setShopForm((f) => ({ ...f, description: e.target.value }))} placeholder="Tell customers about your shop…" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
              <input value={shopForm.logo || ''} onChange={(e) => setShopForm((f) => ({ ...f, logo: e.target.value }))} placeholder="https://…" className="ui-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banner URL</label>
              <input value={shopForm.banner || ''} onChange={(e) => setShopForm((f) => ({ ...f, banner: e.target.value }))} placeholder="https://… (hero background)" className="ui-input" />
            </div>
          </div>
          {editShop?.slug && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <Link2 className="w-4 h-4 text-blue-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-800">Your public shop URL</p>
                <a href={`/shop/${editShop.slug}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                  /shop/{editShop.slug}
                </a>
              </div>
            </div>
          )}
          <button type="submit" disabled={createShopMut.isPending || updateShopMut.isPending} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg transition">Save Shop</button>
        </form>
      </Modal>

      {/* Staff modal */}
      <Modal open={staffModal} onClose={() => setStaffModal(false)} title="Add Staff Member">
        <form onSubmit={handleStaffSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input required value={staffForm.name} onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))} className="ui-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={staffForm.phone} onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))} className="ui-input" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input required type="email" value={staffForm.email} onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))} className="ui-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <input required type="password" minLength="6" value={staffForm.password} onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))} className="ui-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select value={staffForm.role} onChange={(e) => setStaffForm((f) => ({ ...f, role: e.target.value }))} className="ui-input">
                {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shop Access</label>
            <div className="space-y-2">
              {shops.map((s) => (
                <label key={s._id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={staffForm.shopIds.includes(s._id)}
                    onChange={(e) => setStaffForm((f) => ({
                      ...f,
                      shopIds: e.target.checked ? [...f.shopIds, s._id] : f.shopIds.filter((id) => id !== s._id),
                    }))}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={createStaffMut.isPending} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2">
            {createStaffMut.isPending && <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />}
            Create Staff Account
          </button>
        </form>
      </Modal>
    </div>
  );
}
