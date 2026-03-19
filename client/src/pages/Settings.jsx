import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Store, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { shopsApi } from '../api/shops.api';
import { authApi } from '../api/auth.api';
import useShopStore from '../store/shopStore';
import useAuthStore from '../store/authStore';
import Modal from '../components/Modal';
import { usePermissions } from '../hooks/usePermissions';

const SHOP_TYPES = ['clothes', 'toys', 'shoes', 'gifts', 'electronics', 'grocery', 'other'];
const STAFF_ROLES = ['manager', 'billing_staff', 'inventory_staff'];
const ROLE_LABELS = { manager: 'Manager', billing_staff: 'Billing Staff', inventory_staff: 'Inventory Staff' };

const EMPTY_SHOP  = { name: '', type: 'clothes', address: '', phone: '', email: '', currency: '₹', taxRate: 0 };
const EMPTY_STAFF = { name: '', email: '', password: '', role: 'billing_staff', phone: '', shopIds: [] };

export default function Settings() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const { shops } = useShopStore();

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

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

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

      {/* Shop modal */}
      <Modal open={shopModal} onClose={() => setShopModal(false)} title={editShop ? 'Edit Shop' : 'New Shop'}>
        <form onSubmit={handleShopSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name *</label>
              <input required value={shopForm.name} onChange={(e) => setShopForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={shopForm.type} onChange={(e) => setShopForm((f) => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {SHOP_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={shopForm.phone} onChange={(e) => setShopForm((f) => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input value={shopForm.address} onChange={(e) => setShopForm((f) => ({ ...f, address: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={shopForm.email} onChange={(e) => setShopForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
              <input type="number" min="0" max="100" value={shopForm.taxRate} onChange={(e) => setShopForm((f) => ({ ...f, taxRate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <button type="submit" disabled={createShopMut.isPending || updateShopMut.isPending} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg transition">Save Shop</button>
        </form>
      </Modal>

      {/* Staff modal */}
      <Modal open={staffModal} onClose={() => setStaffModal(false)} title="Add Staff Member">
        <form onSubmit={handleStaffSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input required value={staffForm.name} onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={staffForm.phone} onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input required type="email" value={staffForm.email} onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <input required type="password" minLength="6" value={staffForm.password} onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select value={staffForm.role} onChange={(e) => setStaffForm((f) => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
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
