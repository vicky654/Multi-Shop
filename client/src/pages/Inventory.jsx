import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Edit2, Trash2, AlertTriangle,
  Download, RefreshCw, Upload, Copy, Barcode,
  CheckSquare, Square, X as XIcon, Package, ScanLine,
  ClipboardCheck, SlidersHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { productsApi } from '../api/products.api';
import useShopStore  from '../store/shopStore';
import useSetupStore from '../store/setupStore';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { ProductForm, EMPTY_FORM } from '../components/ProductForm';
import ImageCarousel from '../components/ImageCarousel';
import CSVImportModal from '../components/CSVImportModal';
import ProductImportReviewModal from '../components/ProductImportReviewModal';
import MiniTip from '../components/MiniTip';
import StockAdjustModal from '../components/StockAdjustModal';
import StockAuditPanel  from '../components/StockAuditPanel';

// ── Mobile product card ───────────────────────────────────────────────────────
function ProductCard({ product: p, isSelected, onSelect, onEdit, onDuplicate, onDelete }) {
  const fp      = p.price * (1 - (p.discount || 0) / 100);
  const isLow   = p.stock <= (p.lowStockThreshold || 5);
  const isOut   = p.stock < 1;
  const thumb   = p.images?.[0] || p.image || null;
  const margin  = fp > 0 ? Math.round(((fp - p.costPrice) / fp) * 100) : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{   opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden active:shadow-none touch-manipulation"
    >
      {/* Thumbnail */}
      <div className="relative aspect-square bg-gray-50">
        {thumb ? (
          <img src={thumb} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-8 h-8 text-gray-200" />
          </div>
        )}

        {/* Stock badge */}
        <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
          isOut ? 'bg-red-600 text-white' : isLow ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {isOut ? 'Out' : `${p.stock} ${p.unit || ''}`}
        </span>

        {/* Select checkbox */}
        <button
          onClick={onSelect}
          className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm"
        >
          {isSelected
            ? <CheckSquare className="w-4 h-4 text-blue-600" />
            : <Square className="w-4 h-4 text-gray-400" />}
        </button>

        {/* Demo badge */}
        {p.isDemo && (
          <span className="absolute bottom-2 left-2 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">
            DEMO
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-bold text-gray-900 text-sm truncate leading-tight">{p.name}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-md font-medium">
            {p.category}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
            margin >= 20 ? 'bg-green-100 text-green-700' : margin >= 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
          }`}>
            {margin}% margin
          </span>
        </div>

        {/* Price row + actions */}
        <div className="flex items-center justify-between mt-2.5">
          <div>
            {p.discount > 0 && (
              <p className="text-[10px] text-gray-400 line-through leading-none">₹{p.price.toLocaleString('en-IN')}</p>
            )}
            <p className="text-base font-black text-blue-600 leading-tight">
              ₹{Math.round(fp).toLocaleString('en-IN')}
            </p>
          </div>

          <div className="flex gap-1">
            <button
              onClick={onEdit}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDuplicate}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-purple-500 hover:bg-purple-50 active:bg-purple-100 transition"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-50 active:bg-red-100 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Inventory() {
  const qc = useQueryClient();
  const { activeShop, shops } = useShopStore();
  const shopId = activeShop?._id;

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [search,          setSearch]          = useState('');
  const [category,        setCategory]        = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef(null);
  const handleSearch = (v) => {
    setSearch(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(v), 350);
  };

  // ── Barcode lookup ────────────────────────────────────────────────────────────
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeRef = useRef(null);

  const handleBarcodeScan = useCallback(async (code) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      // Try to find a product with this barcode in the already-loaded list first
      const products = qc.getQueryData(['products', shopId, debouncedSearch, category])?.data || [];
      const found = products.find((p) => p.barcode === trimmed);
      if (found) {
        openEdit(found);
        setBarcodeInput('');
        return;
      }
      // Otherwise query the API
      const res = await productsApi.getAll({ shopId, barcode: trimmed, limit: 1 });
      const match = res?.data?.[0];
      if (match) {
        openEdit(match);
      } else {
        // Product not found → open create modal pre-filled with barcode
        openCreate(trimmed);
        toast('Product not found — create it now', { icon: '🏷️' });
      }
    } catch {
      toast.error('Barcode lookup failed');
    }
    setBarcodeInput('');
  }, [shopId, debouncedSearch, category, qc]);

  // ── Product modal state ───────────────────────────────────────────────────────
  const [showModal,   setShowModal]   = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form,        setForm]        = useState({ ...EMPTY_FORM, shopId });

  // Remember last-entered values so "Add another" pre-fills category/shop
  const lastValuesRef = useRef({});

  const openCreate = (prefillBarcode = '') => {
    setEditProduct(null);
    setForm({
      ...EMPTY_FORM,
      shopId,
      // Re-use last category/unit for fast entry
      category: lastValuesRef.current.category || '',
      unit:     lastValuesRef.current.unit     || 'pcs',
      barcode:  prefillBarcode,
    });
    setShowModal(true);
  };

  const openEdit = (p) => {
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

  const openDuplicate = (p) => {
    setEditProduct(null);
    setForm({
      ...EMPTY_FORM, ...p,
      _id:    undefined,
      shopId: p.shopId?._id || p.shopId || shopId,
      barcode: '',   // clear barcode to avoid duplicate key
      sku:     '',   // clear SKU so it auto-generates
      name:    `${p.name} (copy)`,
      sizes:   p.sizes  || [],
      colors:  p.colors || [],
      images:  p.images || (p.image ? [p.image] : []),
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditProduct(null); };

  // ── Bulk select state ─────────────────────────────────────────────────────────
  const [selected, setSelected] = useState(new Set());
  const toggleSelect = (id) =>
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = (products) => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map((p) => p._id)));
  };

  // ── CSV Import modal ──────────────────────────────────────────────────────────
  const [showImport,    setShowImport]    = useState(false);
  const [showBillScan,  setShowBillScan]  = useState(false);

  // ── Stock adjust + audit ──────────────────────────────────────────────────────
  const [adjustProduct, setAdjustProduct] = useState(null);  // product being adjusted
  const [auditMode,     setAuditMode]     = useState(false); // audit panel open

  // ── Queries ───────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['products', shopId, debouncedSearch, category],
    queryFn:  () => productsApi.getAll({ shopId, search: debouncedSearch, category, limit: 50 }),
  });

  const { data: catData } = useQuery({
    queryKey: ['categories', shopId],
    queryFn:  () => productsApi.categories({ shopId }),
  });

  const products   = data?.data || [];
  const categories = catData?.data?.categories || [];

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (d) => productsApi.create(d),
    onSuccess: (_, vars) => {
      useSetupStore.getState().mark('hasProducts');
      // Remember last entered category/unit for next quick-add
      lastValuesRef.current = { category: vars.category, unit: vars.unit };
      qc.invalidateQueries(['products']);
      qc.invalidateQueries(['categories']);
      toast.success('Product created');
      closeModal();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => productsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['products']); toast.success('Product updated'); closeModal(); },
    onError:   (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => productsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries(['products']); toast.success('Product deleted'); },
    onError:   (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids) => productsApi.bulkDelete(ids),
    onSuccess: (res) => {
      const count = res?.data?.data?.deletedCount ?? selected.size;
      qc.invalidateQueries(['products']);
      toast.success(`${count} product(s) deleted`);
      setSelected(new Set());
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editProduct) updateMut.mutate({ id: editProduct._id, data: form });
    else createMut.mutate(form);
  };

  // ── Export (server-side, all products) ────────────────────────────────────────
  const handleExport = async () => {
    try {
      await productsApi.exportCSV({ shopId });
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  // ── Table columns ─────────────────────────────────────────────────────────────
  const allSelected = products.length > 0 && selected.size === products.length;

  const columns = [
    {
      key: '_select',
      label: (
        <button onClick={() => toggleAll(products)} className="p-0.5">
          {allSelected
            ? <CheckSquare className="w-4 h-4 text-blue-600" />
            : <Square className="w-4 h-4 text-gray-400" />}
        </button>
      ),
      render: (_, r) => (
        <button onClick={() => toggleSelect(r._id)} className="p-0.5">
          {selected.has(r._id)
            ? <CheckSquare className="w-4 h-4 text-blue-600" />
            : <Square className="w-4 h-4 text-gray-300 hover:text-gray-500" />}
        </button>
      ),
    },
    {
      key: 'name', label: 'Product', render: (v, r) => (
        <div className="flex items-center gap-3">
          <ImageCarousel images={r.images?.length ? r.images : (r.image ? [r.image] : [])} compact name={v} />
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{v}</p>
            <p className="text-xs text-gray-400">{r.sku || r.barcode || '—'}</p>
            {r.isDemo && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded font-medium">Demo</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'category', label: 'Category', render: (v, r) => (
        <div>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">{v}</span>
          {r.subCategory && <span className="ml-1 text-xs text-gray-400">{r.subCategory}</span>}
        </div>
      ),
    },
    {
      key: 'price', label: 'Price', render: (v, r) => (
        <div>
          {r.discount > 0 && <p className="text-xs text-gray-400 line-through">₹{v.toLocaleString('en-IN')}</p>}
          <p className="font-semibold text-gray-900">₹{(v * (1 - (r.discount || 0) / 100)).toFixed(0)}</p>
          {r.discount > 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">{r.discount}% off</span>}
        </div>
      ),
    },
    {
      key: 'costPrice', label: 'Margin', render: (_, r) => {
        const fp = r.price * (1 - (r.discount || 0) / 100);
        const m  = fp > 0 ? Math.round(((fp - r.costPrice) / fp) * 100) : 0;
        return <span className={`font-medium text-sm ${m >= 20 ? 'text-green-600' : m >= 0 ? 'text-yellow-600' : 'text-red-500'}`}>{m}%</span>;
      },
    },
    {
      key: 'sizes', label: 'Sizes / Colors', render: (v, r) => (
        <div className="flex flex-wrap gap-1 max-w-[120px]">
          {(v || []).slice(0, 3).map((s) => <span key={s} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{s}</span>)}
          {(r.colors || []).slice(0, 3).map((c) => (
            <span key={c.hex} className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block" style={{ backgroundColor: c.hex }} title={c.name} />
          ))}
        </div>
      ),
    },
    {
      key: 'stock', label: 'Stock', render: (v, r) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${v <= r.lowStockThreshold ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {v <= r.lowStockThreshold && <AlertTriangle className="inline w-3 h-3 mr-0.5" />}
          {v} {r.unit}
        </span>
      ),
    },
    {
      key: '_id', label: 'Actions', render: (_, r) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(r)} title="Edit"
            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => setAdjustProduct(r)} title="Adjust Stock"
            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button onClick={() => openDuplicate(r)} title="Duplicate"
            className="p-1.5 rounded-lg text-purple-500 hover:bg-purple-50 transition">
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => { if (confirm(`Delete "${r.name}"?`)) deleteMut.mutate(r._id); }}
            title="Delete"
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">

      {/* ── Contextual tip ── */}
      <MiniTip
        id="inventory-csv"
        message="💡 You can upload a CSV to import hundreds of products at once — use the Import CSV button above."
      />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500">{products.length} products</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => setShowBillScan(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-sm font-medium transition">
            <ScanLine className="w-4 h-4" /> Scan Bill
          </button>
          <button
            onClick={() => setAuditMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition border ${
              auditMode
                ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            {auditMode ? 'Exit Audit' : 'Stock Audit'}
          </button>
          <button onClick={() => qc.invalidateQueries(['products'])}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => openCreate()} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* ── Barcode Lookup ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-xl">
        <Barcode className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          ref={barcodeRef}
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleBarcodeScan(barcodeInput); }
          }}
          placeholder="Scan or type barcode → Enter to look up (auto-fills or opens Create)"
          className="flex-1 text-sm bg-transparent focus:outline-none text-gray-700 placeholder-gray-400"
        />
        {barcodeInput && (
          <button onClick={() => setBarcodeInput('')} className="text-gray-400 hover:text-gray-600">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => handleBarcodeScan(barcodeInput)}
          className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shrink-0">
          Lookup
        </button>
      </div>

      {/* ── Filters + Bulk actions ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, barcode, or category…"
            className="ui-input pl-9" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="ui-select sm:w-44">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>

        {/* Bulk delete bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-sm font-medium text-red-700">{selected.size} selected</span>
            <button
              onClick={() => {
                if (confirm(`Delete ${selected.size} product(s)?`))
                  bulkDeleteMut.mutate([...selected]);
              }}
              disabled={bulkDeleteMut.isPending}
              className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition">
              <Trash2 className="w-3.5 h-3.5" />
              {bulkDeleteMut.isPending ? 'Deleting…' : 'Delete'}
            </button>
            <button onClick={() => setSelected(new Set())} className="text-red-400 hover:text-red-600">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Mobile card grid (< md) ── */}
      {isLoading ? (
        <div className="md:hidden grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="rounded-2xl bg-gray-100 animate-pulse h-52" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="md:hidden flex flex-col items-center justify-center py-16 text-gray-400">
          <Package className="w-12 h-12 opacity-30 mb-3" />
          <p className="font-semibold text-gray-500">No products found</p>
          <p className="text-sm mt-1">Tap + Add Product to get started</p>
        </div>
      ) : (
        <div className="md:hidden grid grid-cols-2 gap-3">
          <AnimatePresence>
            {products.map((p) => (
              <ProductCard
                key={p._id}
                product={p}
                isSelected={selected.has(p._id)}
                onSelect={() => toggleSelect(p._id)}
                onEdit={() => openEdit(p)}
                onDuplicate={() => openDuplicate(p)}
                onDelete={() => { if (confirm(`Delete "${p.name}"?`)) deleteMut.mutate(p._id); }}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Desktop table (≥ md) ── */}
      <div className="hidden md:block">
        <DataTable
          columns={columns} data={products} loading={isLoading}
          emptyMessage="No products found. Add your first product!" />
      </div>

      {/* ── Product Create/Edit Modal ── */}
      <Modal open={showModal} onClose={closeModal} title={editProduct ? 'Edit Product' : 'Add Product'} size="xl">
        <ProductForm
          form={form} setForm={setForm} onSubmit={handleSubmit}
          loading={createMut.isPending || updateMut.isPending}
          shops={shops} shopId={shopId} categories={categories}
        />
      </Modal>

      {/* ── CSV Import Modal ── */}
      <CSVImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => {
          qc.invalidateQueries(['products']);
          qc.invalidateQueries(['categories']);
        }}
      />

      {/* ── Bill Scan / Product Import Review Modal ── */}
      <ProductImportReviewModal
        open={showBillScan}
        onClose={() => setShowBillScan(false)}
        shopId={shopId}
      />
    </div>
  );
}
