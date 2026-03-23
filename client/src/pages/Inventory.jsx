import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Edit2, Trash2, AlertTriangle,
  Download, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '../api/products.api';
import useShopStore  from '../store/shopStore';
import useSetupStore from '../store/setupStore';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { ProductForm, EMPTY_FORM } from '../components/ProductForm';
import ImageCarousel from '../components/ImageCarousel';

export default function Inventory() {
  const qc = useQueryClient();
  const { activeShop, shops } = useShopStore();
  const shopId = activeShop?._id;

  const [search,      setSearch]      = useState('');
  const [category,    setCategory]    = useState('');
  const [showModal,   setShowModal]   = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form,        setForm]        = useState({ ...EMPTY_FORM, shopId });

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef(null);
  const handleSearch = (v) => {
    setSearch(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(v), 350);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['products', shopId, debouncedSearch, category],
    queryFn: () => productsApi.getAll({ shopId, search: debouncedSearch, category, limit: 50 }),
  });

  const { data: catData } = useQuery({
    queryKey: ['categories', shopId],
    queryFn: () => productsApi.categories({ shopId }),
  });

  const createMut = useMutation({
    mutationFn: (d) => productsApi.create(d),
    onSuccess: () => {
      useSetupStore.getState().mark('hasProducts');
      qc.invalidateQueries(['products']);
      qc.invalidateQueries(['categories']);
      toast.success('Product created');
      closeModal();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => productsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['products']); toast.success('Product updated'); closeModal(); },
    onError:   (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => productsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries(['products']); toast.success('Product deleted'); },
    onError:   (e) => toast.error(e.message),
  });

  const openCreate = () => { setEditProduct(null); setForm({ ...EMPTY_FORM, shopId }); setShowModal(true); };
  const openEdit   = (p) => {
    setEditProduct(p);
    setForm({
      ...EMPTY_FORM, ...p,
      shopId: p.shopId?._id || p.shopId,
      sizes:  p.sizes  || [],
      colors: p.colors || [],
      images: p.images || (p.image ? [p.image] : []),
    });
    setShowModal(true);
  };
  const closeModal  = () => { setShowModal(false); setEditProduct(null); };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (editProduct) updateMut.mutate({ id: editProduct._id, data: form });
    else createMut.mutate(form);
  };

  const products   = data?.data || [];
  const categories = catData?.data?.categories || [];

  const columns = [
    { key: 'name', label: 'Product', render: (v, r) => (
      <div className="flex items-center gap-3">
        <ImageCarousel images={r.images?.length ? r.images : (r.image ? [r.image] : [])} compact name={v} />
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{v}</p>
          <p className="text-xs text-gray-400">{r.sku || r.barcode || '—'}</p>
          {r.isDemo && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded font-medium">Demo</span>}
        </div>
      </div>
    )},
    { key: 'category', label: 'Category', render: (v, r) => (
      <div>
        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">{v}</span>
        {r.subCategory && <span className="ml-1 text-xs text-gray-400">{r.subCategory}</span>}
      </div>
    )},
    { key: 'price', label: 'Price', render: (v, r) => (
      <div>
        {r.discount > 0 && <p className="text-xs text-gray-400 line-through">₹{v.toLocaleString('en-IN')}</p>}
        <p className="font-semibold text-gray-900">₹{(v * (1 - (r.discount || 0) / 100)).toFixed(0)}</p>
        {r.discount > 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">{r.discount}% off</span>}
      </div>
    )},
    { key: 'costPrice', label: 'Margin', render: (_, r) => {
      const fp = r.price * (1 - (r.discount || 0) / 100);
      const m  = fp > 0 ? Math.round(((fp - r.costPrice) / fp) * 100) : 0;
      return <span className={`font-medium text-sm ${m >= 20 ? 'text-green-600' : m >= 0 ? 'text-yellow-600' : 'text-red-500'}`}>{m}%</span>;
    }},
    { key: 'sizes', label: 'Sizes / Colors', render: (v, r) => (
      <div className="flex flex-wrap gap-1 max-w-[120px]">
        {(v || []).slice(0, 3).map((s) => <span key={s} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{s}</span>)}
        {(r.colors || []).slice(0, 3).map((c) => (
          <span key={c.hex} className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block" style={{ backgroundColor: c.hex }} title={c.name} />
        ))}
      </div>
    )},
    { key: 'stock', label: 'Stock', render: (v, r) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${v <= r.lowStockThreshold ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
        {v <= r.lowStockThreshold && <AlertTriangle className="inline w-3 h-3 mr-0.5" />}
        {v} {r.unit}
      </span>
    )},
    { key: '_id', label: 'Actions', render: (_, r) => (
      <div className="flex gap-2">
        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition">
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => { if (confirm(`Delete "${r.name}"?`)) deleteMut.mutate(r._id); }}
          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )},
  ];

  const exportCSV = () => {
    const rows = [['Name', 'SKU', 'Category', 'SubCategory', 'Price', 'Cost', 'Discount', 'Stock', 'Barcode']];
    products.forEach((p) => rows.push([p.name, p.sku || '', p.category, p.subCategory || '', p.price, p.costPrice, p.discount || 0, p.stock, p.barcode || '']));
    const csv  = rows.map((r) => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.href  = 'data:text/csv,' + encodeURIComponent(csv);
    link.download = 'inventory.csv';
    link.click();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500">{products.length} products</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => qc.invalidateQueries(['products'])}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition text-sm">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-44 bg-white">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns} data={products} loading={isLoading}
        emptyMessage="No products found. Add your first product!" />

      <Modal open={showModal} onClose={closeModal} title={editProduct ? 'Edit Product' : 'Add Product'} size="xl">
        <ProductForm
          form={form} setForm={setForm} onSubmit={handleSubmit}
          loading={createMut.isPending || updateMut.isPending}
          shops={shops} shopId={shopId} categories={categories}
        />
      </Modal>
    </div>
  );
}
