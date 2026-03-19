import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, Users, IndianRupee, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import { customersApi } from '../api/customers.api';
import useShopStore from '../store/shopStore';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

const EMPTY = { name: '', phone: '', email: '', address: '', notes: '' };

function CustomerForm({ form, setForm, onSubmit, loading, shops, shopId }) {
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
        <input required value={form.name} onChange={(e) => upd('name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input value={form.phone} onChange={(e) => upd('phone', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+91 98765 43210" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={form.email} onChange={(e) => upd('email', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Shop</label>
        <select required value={form.shopId || shopId} onChange={(e) => upd('shopId', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {shops.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <input value={form.address} onChange={(e) => upd('address', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea value={form.notes} onChange={(e) => upd('notes', e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>
      <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2">
        {loading && <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />}
        {loading ? 'Saving…' : 'Save Customer'}
      </button>
    </form>
  );
}

export default function Customers() {
  const qc = useQueryClient();
  const { activeShop, shops } = useShopStore();
  const shopId = activeShop?._id;
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState({ ...EMPTY, shopId });

  const { data, isLoading } = useQuery({
    queryKey: ['customers', shopId, search],
    queryFn: () => customersApi.getAll({ shopId, search }),
  });

  const createMut = useMutation({
    mutationFn: (d) => customersApi.create(d),
    onSuccess: () => { qc.invalidateQueries(['customers']); toast.success('Customer created'); closeModal(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => customersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['customers']); toast.success('Customer updated'); closeModal(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => customersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries(['customers']); toast.success('Customer deleted'); },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => { setEditCustomer(null); setForm({ ...EMPTY, shopId }); setShowModal(true); };
  const openEdit   = (c) => { setEditCustomer(c); setForm({ ...c, shopId: c.shopId?._id || c.shopId }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditCustomer(null); };
  const handleSubmit = (e) => { e.preventDefault(); editCustomer ? updateMut.mutate({ id: editCustomer._id, data: form }) : createMut.mutate(form); };

  const customers = data?.data || [];

  const columns = [
    { key: 'name', label: 'Customer', render: (v, r) => (
      <div>
        <p className="font-medium text-gray-900">{v}</p>
        <p className="text-xs text-gray-400">{r.email || 'No email'}</p>
      </div>
    )},
    { key: 'phone', label: 'Phone', render: (v) => v || '—' },
    { key: 'totalPurchases', label: 'Purchases', render: (v) => (
      <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3 text-blue-500" />{v || 0}</span>
    )},
    { key: 'totalSpent', label: 'Total Spent', render: (v) => (
      <span className="flex items-center gap-1 font-semibold text-green-600"><IndianRupee className="w-3 h-3" />{(v || 0).toLocaleString('en-IN')}</span>
    )},
    { key: '_id', label: 'Actions', render: (_, r) => (
      <div className="flex gap-2">
        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"><Edit2 className="w-4 h-4" /></button>
        <button onClick={() => { if (confirm('Delete this customer?')) deleteMut.mutate(r._id); }} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">{customers.length} customers</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers…" className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <DataTable columns={columns} data={customers} loading={isLoading} emptyMessage="No customers yet. Add your first customer!" />
      <Modal open={showModal} onClose={closeModal} title={editCustomer ? 'Edit Customer' : 'Add Customer'}>
        <CustomerForm form={form} setForm={setForm} onSubmit={handleSubmit} loading={createMut.isPending || updateMut.isPending} shops={shops} shopId={shopId} />
      </Modal>
    </div>
  );
}
