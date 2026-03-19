import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Edit2, Trash2, Package, AlertTriangle,
  X, Upload, RefreshCw, Tag, Palette, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '../api/products.api';
import useShopStore from '../store/shopStore';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_SIZES  = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const PRESET_COLORS  = [
  { name: 'Red',    hex: '#ef4444' }, { name: 'Blue',   hex: '#3b82f6' },
  { name: 'Green',  hex: '#22c55e' }, { name: 'Yellow', hex: '#eab308' },
  { name: 'Black',  hex: '#111827' }, { name: 'White',  hex: '#f9fafb' },
  { name: 'Pink',   hex: '#ec4899' }, { name: 'Purple', hex: '#a855f7' },
  { name: 'Orange', hex: '#f97316' }, { name: 'Navy',   hex: '#1e3a5f' },
  { name: 'Brown',  hex: '#92400e' }, { name: 'Gray',   hex: '#6b7280' },
];
const SUB_CATS = ['Mens', 'Womens', 'Kids', 'Unisex'];
const UNITS    = ['pcs', 'pair', 'kg', 'g', 'ltr', 'ml', 'box', 'set'];

const EMPTY_FORM = {
  name: '', category: '', subCategory: '', price: '', costPrice: '',
  discount: 0, stock: '', barcode: '', sku: '', unit: 'pcs',
  lowStockThreshold: 10, description: '', shopId: '',
  sizes: [], colors: [], images: [],
  isFeatured: false, isNewArrival: false, isTrending: false,
};

// ── Image helpers ─────────────────────────────────────────────────────────────
const fileToBase64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

// ── Sub-components ────────────────────────────────────────────────────────────
function SizeSelector({ selected, onChange }) {
  const [custom, setCustom] = useState('');
  const toggle = (s) =>
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]);
  const addCustom = () => {
    const v = custom.trim().toUpperCase();
    if (v && !selected.includes(v)) { onChange([...selected, v]); setCustom(''); }
  };
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Sizes</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {DEFAULT_SIZES.map((s) => (
          <button key={s} type="button" onClick={() => toggle(s)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition ${
              selected.includes(s)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 text-gray-600 hover:border-blue-400'
            }`}>{s}</button>
        ))}
      </div>
      {selected.filter((s) => !DEFAULT_SIZES.includes(s)).map((s) => (
        <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs mr-1">
          {s} <button type="button" onClick={() => toggle(s)}><X className="w-3 h-3" /></button>
        </span>
      ))}
      <div className="flex gap-2 mt-2">
        <input value={custom} onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder="Custom size…" className="inp flex-1" />
        <button type="button" onClick={addCustom} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">Add</button>
      </div>
    </div>
  );
}

function ColorSelector({ selected, onChange }) {
  const [customName, setCustomName] = useState('');
  const [customHex,  setCustomHex]  = useState('#000000');

  const toggle = (c) => {
    const exists = selected.find((x) => x.hex === c.hex);
    onChange(exists ? selected.filter((x) => x.hex !== c.hex) : [...selected, c]);
  };
  const addCustom = () => {
    const name = customName.trim() || customHex;
    if (!selected.find((x) => x.hex === customHex)) {
      onChange([...selected, { name, hex: customHex }]);
      setCustomName(''); setCustomHex('#000000');
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Colors</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {PRESET_COLORS.map((c) => {
          const active = !!selected.find((x) => x.hex === c.hex);
          return (
            <button key={c.hex} type="button" title={c.name} onClick={() => toggle(c)}
              className={`w-7 h-7 rounded-full border-2 transition ${active ? 'border-blue-600 scale-110 shadow-md' : 'border-gray-300 hover:scale-105'}`}
              style={{ backgroundColor: c.hex }}
            />
          );
        })}
      </div>
      {selected.map((c) => (
        <span key={c.hex} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs mr-1 mb-1 border"
          style={{ backgroundColor: c.hex + '33', borderColor: c.hex }}>
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.hex }} />
          {c.name}
          <button type="button" onClick={() => toggle(c)}><X className="w-3 h-3" /></button>
        </span>
      ))}
      <div className="flex items-center gap-2 mt-2">
        <input type="color" value={customHex} onChange={(e) => setCustomHex(e.target.value)} className="w-9 h-9 rounded border cursor-pointer" />
        <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Color name" className="inp flex-1" />
        <button type="button" onClick={addCustom} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">Add</button>
      </div>
    </div>
  );
}

function ImageUploader({ images, onChange }) {
  const ref = useRef();
  const handleFiles = useCallback(async (files) => {
    const remaining = 5 - images.length;
    const toProcess = Array.from(files).slice(0, remaining);
    const b64s = await Promise.all(toProcess.map(fileToBase64));
    onChange([...images, ...b64s]);
  }, [images, onChange]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Product Images (max 5)</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {images.map((src, i) => (
          <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-300 group">
            <img src={src} alt="" className="w-full h-full object-cover" />
            <button type="button"
              onClick={() => onChange(images.filter((_, j) => j !== i))}
              className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {images.length < 5 && (
          <button type="button" onClick={() => ref.current.click()}
            className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition">
            <Upload className="w-5 h-5" />
            <span className="text-xs mt-1">Upload</span>
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
}

// ── Advanced Product Form ──────────────────────────────────────────────────────
function ProductForm({ form, setForm, onSubmit, loading, shops, shopId, categories }) {
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const price     = parseFloat(form.price)     || 0;
  const costPrice = parseFloat(form.costPrice) || 0;
  const discount  = parseFloat(form.discount)  || 0;
  const finalPrice = +(price * (1 - discount / 100)).toFixed(2);
  const profit     = +(finalPrice - costPrice).toFixed(2);
  const margin     = finalPrice > 0 ? Math.round((profit / finalPrice) * 100) : 0;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* ── Basic Info ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="lbl">Product Name *</label>
          <input required value={form.name} onChange={(e) => upd('name', e.target.value)} className="inp" placeholder="e.g. Men's Cotton T-Shirt" />
        </div>

        <div>
          <label className="lbl">Category *</label>
          <input required list="cat-list" value={form.category} onChange={(e) => upd('category', e.target.value)} className="inp" placeholder="e.g. T-Shirts" />
          <datalist id="cat-list">
            {(categories || []).map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div>
          <label className="lbl">Sub-Category</label>
          <select value={form.subCategory} onChange={(e) => upd('subCategory', e.target.value)} className="inp">
            <option value="">— Select —</option>
            {SUB_CATS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="lbl">Unit</label>
          <select value={form.unit} onChange={(e) => upd('unit', e.target.value)} className="inp">
            {UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>

        <div>
          <label className="lbl">Shop *</label>
          <select required value={form.shopId || shopId} onChange={(e) => upd('shopId', e.target.value)} className="inp">
            <option value="">Select shop</option>
            {shops.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Pricing ── */}
      <div className="bg-blue-50 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5"><Tag className="w-4 h-4" /> Pricing</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="lbl">Selling Price (₹) *</label>
            <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => upd('price', e.target.value)} className="inp" placeholder="0" />
          </div>
          <div>
            <label className="lbl">Cost Price (₹) *</label>
            <input required type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => upd('costPrice', e.target.value)} className="inp" placeholder="0" />
          </div>
          <div>
            <label className="lbl">Discount (%)</label>
            <input type="number" min="0" max="100" value={form.discount} onChange={(e) => upd('discount', e.target.value)} className="inp" placeholder="0" />
          </div>
        </div>
        {/* Live price preview */}
        {price > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-1 border-t border-blue-200">
            <div className="text-center">
              <p className="text-xs text-gray-500">Final Price</p>
              <p className="font-bold text-blue-700 text-lg">₹{finalPrice.toLocaleString('en-IN')}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Profit / Unit</p>
              <p className={`font-bold text-lg ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {profit >= 0 ? '+' : ''}₹{profit.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Margin</p>
              <p className={`font-bold text-lg ${margin >= 20 ? 'text-green-600' : margin >= 0 ? 'text-yellow-600' : 'text-red-500'}`}>
                {margin}%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Stock & Identifiers ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="lbl">Stock Quantity</label>
          <input type="number" min="0" value={form.stock} onChange={(e) => upd('stock', e.target.value)} className="inp" placeholder="0" />
        </div>
        <div>
          <label className="lbl">Low Stock Alert ≤</label>
          <input type="number" min="0" value={form.lowStockThreshold} onChange={(e) => upd('lowStockThreshold', e.target.value)} className="inp" />
        </div>
        <div>
          <label className="lbl">Barcode</label>
          <input value={form.barcode} onChange={(e) => upd('barcode', e.target.value)} className="inp" placeholder="Scan or type…" />
        </div>
        <div>
          <label className="lbl">SKU {!form._id && <span className="text-xs text-gray-400">(auto if blank)</span>}</label>
          <input value={form.sku} onChange={(e) => upd('sku', e.target.value)} className="inp" placeholder="AUTO" />
        </div>
      </div>

      {/* ── Sizes ── */}
      <SizeSelector selected={form.sizes} onChange={(v) => upd('sizes', v)} />

      {/* ── Colors ── */}
      <ColorSelector selected={form.colors} onChange={(v) => upd('colors', v)} />

      {/* ── Images ── */}
      <ImageUploader images={form.images} onChange={(v) => upd('images', v)} />

      {/* ── Description ── */}
      <div>
        <label className="lbl">Description</label>
        <textarea value={form.description} onChange={(e) => upd('description', e.target.value)} rows={3} className="inp resize-none" placeholder="Product description…" />
      </div>

      {/* ── Feature Flags ── */}
      <div className="flex gap-6">
        {[['isFeatured','Featured'], ['isNewArrival','New Arrival'], ['isTrending','Trending']].map(([k,l]) => (
          <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form[k]} onChange={(e) => upd(k, e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 border-gray-300" />
            {l}
          </label>
        ))}
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl transition flex items-center justify-center gap-2">
        {loading && <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />}
        {loading ? 'Saving…' : 'Save Product'}
      </button>

      <style>{`
        .inp { @apply w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent; }
        .lbl { @apply block text-sm font-medium text-gray-700 mb-1; }
      `}</style>
    </form>
  );
}

// ── Main Inventory Page ────────────────────────────────────────────────────────
export default function Inventory() {
  const qc = useQueryClient();
  const { activeShop, shops } = useShopStore();
  const shopId = activeShop?._id;

  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [editProduct,setEditProduct]= useState(null);
  const [form,       setForm]       = useState({ ...EMPTY_FORM, shopId });

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
    onSuccess: () => { qc.invalidateQueries(['products']); qc.invalidateQueries(['categories']); toast.success('Product created'); closeModal(); },
    onError:   (e) => toast.error(e.message),
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
  const closeModal = () => { setShowModal(false); setEditProduct(null); };

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
        {(r.images?.[0] || r.image) ? (
          <img src={r.images?.[0] || r.image} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-gray-400" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{v}</p>
          <p className="text-xs text-gray-400">{r.sku || r.barcode || '—'}</p>
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
        <p className="font-semibold text-gray-900">₹{(v * (1 - (r.discount||0)/100)).toFixed(0)}</p>
        {r.discount > 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">{r.discount}% off</span>}
      </div>
    )},
    { key: 'costPrice', label: 'Margin', render: (_, r) => {
      const fp = r.price * (1 - (r.discount||0)/100);
      const m  = fp > 0 ? Math.round(((fp - r.costPrice) / fp) * 100) : 0;
      return <span className={`font-medium text-sm ${m >= 20 ? 'text-green-600' : m >= 0 ? 'text-yellow-600' : 'text-red-500'}`}>{m}%</span>;
    }},
    { key: 'sizes', label: 'Sizes/Colors', render: (v, r) => (
      <div className="flex flex-wrap gap-1 max-w-[120px]">
        {(v || []).slice(0,3).map((s) => <span key={s} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{s}</span>)}
        {(r.colors || []).slice(0,3).map((c) => <span key={c.hex} className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block" style={{backgroundColor:c.hex}} title={c.name} />)}
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
        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition"><Edit2 className="w-4 h-4" /></button>
        <button onClick={() => { if (confirm(`Delete "${r.name}"?`)) deleteMut.mutate(r._id); }} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition"><Trash2 className="w-4 h-4" /></button>
      </div>
    )},
  ];

  // Export CSV
  const exportCSV = () => {
    const rows = [['Name','SKU','Category','SubCategory','Price','Cost','Discount','Stock','Barcode']];
    products.forEach((p) => rows.push([p.name, p.sku||'', p.category, p.subCategory||'', p.price, p.costPrice, p.discount||0, p.stock, p.barcode||'']));
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
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => qc.invalidateQueries(['products'])} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition text-sm">
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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-44">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <DataTable columns={columns} data={products} loading={isLoading} emptyMessage="No products found. Add your first product!" />

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
