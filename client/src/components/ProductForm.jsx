import { useState, useRef, useCallback } from 'react';
import { Tag, Layers, Package, Palette, Image, FileText, X, Upload, ChevronDown } from 'lucide-react';
import { FormSection } from './ui/FormSection';

// ── Constants ──────────────────────────────────────────────────────────────────
const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const PRESET_COLORS = [
  { name: 'Red',    hex: '#ef4444' }, { name: 'Blue',   hex: '#3b82f6' },
  { name: 'Green',  hex: '#22c55e' }, { name: 'Yellow', hex: '#eab308' },
  { name: 'Black',  hex: '#111827' }, { name: 'White',  hex: '#f9fafb' },
  { name: 'Pink',   hex: '#ec4899' }, { name: 'Purple', hex: '#a855f7' },
  { name: 'Orange', hex: '#f97316' }, { name: 'Navy',   hex: '#1e3a5f' },
  { name: 'Brown',  hex: '#92400e' }, { name: 'Gray',   hex: '#6b7280' },
];
const SUB_CATS = ['Mens', 'Womens', 'Kids', 'Unisex'];
const UNITS    = ['pcs', 'pair', 'kg', 'g', 'ltr', 'ml', 'box', 'set'];

export const EMPTY_FORM = {
  name: '', category: '', subCategory: '', price: '', costPrice: '',
  discount: 0, stock: '', barcode: '', sku: '', unit: 'pcs',
  lowStockThreshold: 10, description: '', shopId: '',
  sizes: [], colors: [], images: [],
  isFeatured: false, isNewArrival: false, isTrending: false,
};

// ── Shared input style ────────────────────────────────────────────────────────
const inp = [
  'w-full h-11 px-3 border border-gray-300 rounded-xl text-sm bg-white',
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  'transition placeholder-gray-400',
].join(' ');

// ── Image helper ───────────────────────────────────────────────────────────────
const fileToBase64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

// ── CategoryCombobox ───────────────────────────────────────────────────────────
function CategoryCombobox({ value, onChange, categories }) {
  const [open,  setOpen]  = useState(false);
  const [input, setInput] = useState(value);
  const boxRef = useRef();

  // Sync when parent resets the form
  if (value !== input && !open) setInput(value);

  const filtered = (categories || []).filter((c) =>
    c.toLowerCase().includes(input.toLowerCase())
  );

  const select = (c) => {
    setInput(c);
    onChange(c);
    setOpen(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!boxRef.current?.contains(document.activeElement)) {
        setOpen(false);
        onChange(input);
      }
    }, 150);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          placeholder="e.g. T-Shirts"
          className={`${inp} pr-9`}
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {open && (filtered.length > 0 || input.trim()) && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map((c) => (
            <li key={c}>
              <button type="button" onMouseDown={() => select(c)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition">
                {c}
              </button>
            </li>
          ))}
          {input.trim() && !filtered.find((c) => c.toLowerCase() === input.toLowerCase()) && (
            <li>
              <button type="button" onMouseDown={() => select(input.trim())}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition font-medium border-t border-gray-100">
                + Create &ldquo;{input.trim()}&rdquo;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ── SizeSelector ──────────────────────────────────────────────────────────────
function SizeSelector({ selected, onChange }) {
  const [custom, setCustom] = useState('');
  const toggle = (s) =>
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]);
  const addCustom = () => {
    const v = custom.trim().toUpperCase();
    if (v && !selected.includes(v)) { onChange([...selected, v]); setCustom(''); }
  };

  const customSizes = selected.filter((s) => !DEFAULT_SIZES.includes(s));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {DEFAULT_SIZES.map((s) => (
          <button key={s} type="button" onClick={() => toggle(s)}
            className={`h-8 px-3 rounded-full text-sm font-medium border transition-all ${
              selected.includes(s)
                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                : 'border-gray-300 text-gray-600 hover:border-purple-400 hover:text-purple-600 bg-white'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {customSizes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customSizes.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              {s}
              <button type="button" onClick={() => toggle(s)} className="hover:text-purple-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input value={custom} onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder="Add custom size…"
          className={`${inp} h-9 flex-1`} />
        <button type="button" onClick={addCustom}
          className="h-9 px-4 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl text-sm font-medium text-gray-700 transition whitespace-nowrap">
          Add
        </button>
      </div>
    </div>
  );
}

// ── ColorSelector ─────────────────────────────────────────────────────────────
function ColorSelector({ selected, onChange }) {
  const [customName, setCustomName] = useState('');
  const [customHex,  setCustomHex]  = useState('#6366f1');

  const toggle = (c) => {
    const exists = selected.find((x) => x.hex === c.hex);
    onChange(exists ? selected.filter((x) => x.hex !== c.hex) : [...selected, c]);
  };
  const addCustom = () => {
    const name = customName.trim() || customHex;
    if (!selected.find((x) => x.hex === customHex)) {
      onChange([...selected, { name, hex: customHex }]);
      setCustomName(''); setCustomHex('#6366f1');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => {
          const active = !!selected.find((x) => x.hex === c.hex);
          return (
            <button key={c.hex} type="button" title={c.name} onClick={() => toggle(c)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                active
                  ? 'border-purple-600 scale-110 shadow-md ring-2 ring-purple-300 ring-offset-1'
                  : 'border-transparent hover:scale-110 hover:border-gray-400'
              }`}
              style={{ backgroundColor: c.hex }}
            />
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((c) => (
            <span key={c.hex}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{
                backgroundColor: c.hex + '22',
                borderColor: c.hex,
                color: c.hex === '#f9fafb' || c.hex === '#eab308' ? '#374151' : c.hex,
              }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: c.hex }} />
              {c.name}
              <button type="button" onClick={() => toggle(c)} className="ml-0.5 opacity-60 hover:opacity-100">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input type="color" value={customHex} onChange={(e) => setCustomHex(e.target.value)}
          className="w-11 h-9 rounded-xl border border-gray-300 cursor-pointer p-0.5 bg-white" />
        <input value={customName} onChange={(e) => setCustomName(e.target.value)}
          placeholder="Color name (optional)"
          className={`${inp} h-9 flex-1`} />
        <button type="button" onClick={addCustom}
          className="h-9 px-4 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl text-sm font-medium text-gray-700 transition whitespace-nowrap">
          Add
        </button>
      </div>
    </div>
  );
}

// ── ImageUploader ─────────────────────────────────────────────────────────────
function ImageUploader({ images, onChange }) {
  const ref = useRef();
  const handleFiles = useCallback(async (files) => {
    const remaining = 5 - images.length;
    const b64s = await Promise.all(Array.from(files).slice(0, remaining).map(fileToBase64));
    onChange([...images, ...b64s]);
  }, [images, onChange]);

  return (
    <div className="flex flex-wrap gap-2">
      {images.map((src, i) => (
        <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-gray-200 group cursor-pointer">
          <img src={src} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
            <button type="button"
              onClick={() => onChange(images.filter((_, j) => j !== i))}
              className="w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
      {images.length < 5 && (
        <button type="button" onClick={() => ref.current.click()}
          className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-all">
          <Upload className="w-5 h-5" />
          <span className="text-[11px] font-medium">Upload</span>
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

// ── ProductForm (named export) ─────────────────────────────────────────────────
export function ProductForm({ form, setForm, onSubmit, loading, shops, shopId, categories }) {
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const price      = parseFloat(form.price)     || 0;
  const costPrice  = parseFloat(form.costPrice) || 0;
  const discount   = parseFloat(form.discount)  || 0;
  const finalPrice = +(price * (1 - discount / 100)).toFixed(2);
  const profit     = +(finalPrice - costPrice).toFixed(2);
  const margin     = finalPrice > 0 ? Math.round((profit / finalPrice) * 100) : 0;

  return (
    <form onSubmit={onSubmit} className="space-y-4">

      {/* ── Basic Info ── */}
      <FormSection title="Basic Info" icon={Package} color="gray">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Product Name <span className="text-red-500">*</span>
          </label>
          <input required value={form.name} onChange={(e) => upd('name', e.target.value)}
            placeholder="e.g. Men's Cotton T-Shirt"
            className={inp} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Category <span className="text-red-500">*</span>
            </label>
            <CategoryCombobox value={form.category} onChange={(v) => upd('category', v)} categories={categories} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sub-Category</label>
            <select value={form.subCategory} onChange={(e) => upd('subCategory', e.target.value)} className={inp}>
              <option value="">— None —</option>
              {SUB_CATS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Unit</label>
            <select value={form.unit} onChange={(e) => upd('unit', e.target.value)} className={inp}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Shop <span className="text-red-500">*</span>
            </label>
            <select required value={form.shopId || shopId} onChange={(e) => upd('shopId', e.target.value)} className={inp}>
              <option value="">Select shop</option>
              {shops.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </FormSection>

      {/* ── Pricing ── */}
      <FormSection title="Pricing" icon={Tag} color="blue">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">
              Sell Price (₹) <span className="text-red-500">*</span>
            </label>
            <input required type="number" min="0" step="0.01" value={form.price}
              onChange={(e) => upd('price', e.target.value)} placeholder="0" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">
              Cost Price (₹) <span className="text-red-500">*</span>
            </label>
            <input required type="number" min="0" step="0.01" value={form.costPrice}
              onChange={(e) => upd('costPrice', e.target.value)} placeholder="0" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">Discount (%)</label>
            <input type="number" min="0" max="100" value={form.discount}
              onChange={(e) => upd('discount', e.target.value)} placeholder="0" className={inp} />
          </div>
        </div>

        {price > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-blue-200">
            {[
              { label: 'Final Price', value: `₹${finalPrice.toLocaleString('en-IN')}`, color: 'text-blue-700' },
              {
                label: 'Profit / Unit',
                value: `${profit >= 0 ? '+' : ''}₹${profit.toLocaleString('en-IN')}`,
                color: profit >= 0 ? 'text-green-600' : 'text-red-500',
              },
              {
                label: 'Margin',
                value: `${margin}%`,
                color: margin >= 20 ? 'text-green-600' : margin >= 0 ? 'text-yellow-600' : 'text-red-500',
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center bg-white/70 rounded-lg py-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                <p className={`font-bold text-base mt-0.5 ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      {/* ── Inventory ── */}
      <FormSection title="Inventory" icon={Layers} color="green">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5">Stock Qty</label>
            <input type="number" min="0" value={form.stock} onChange={(e) => upd('stock', e.target.value)}
              placeholder="0" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5">Low Stock Alert ≤</label>
            <input type="number" min="0" value={form.lowStockThreshold}
              onChange={(e) => upd('lowStockThreshold', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5">Barcode</label>
            <input value={form.barcode} onChange={(e) => upd('barcode', e.target.value)}
              placeholder="Scan or type…" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5">
              SKU{' '}
              {!form._id && <span className="text-[10px] text-gray-400 normal-case font-normal">(auto if blank)</span>}
            </label>
            <input value={form.sku} onChange={(e) => upd('sku', e.target.value)}
              placeholder="AUTO" className={inp} />
          </div>
        </div>
      </FormSection>

      {/* ── Variants ── */}
      <FormSection title="Variants" icon={Palette} color="purple">
        <div>
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Sizes</p>
          <SizeSelector selected={form.sizes} onChange={(v) => upd('sizes', v)} />
        </div>
        <div>
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Colors</p>
          <ColorSelector selected={form.colors} onChange={(v) => upd('colors', v)} />
        </div>
      </FormSection>

      {/* ── Media ── */}
      <FormSection title="Product Images" icon={Image} color="gray">
        <p className="text-xs text-gray-400 -mt-1">Upload up to 5 images. Hover over an image to remove it.</p>
        <ImageUploader images={form.images} onChange={(v) => upd('images', v)} />
      </FormSection>

      {/* ── Details ── */}
      <FormSection title="Details" icon={FileText} color="gray">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
          <textarea value={form.description} onChange={(e) => upd('description', e.target.value)}
            rows={3} placeholder="Product description, features, care instructions…"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-gray-400 resize-none" />
        </div>
        <div className="flex flex-wrap gap-5">
          {[['isFeatured', '⭐ Featured'], ['isNewArrival', '✨ New Arrival'], ['isTrending', '🔥 Trending']].map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-sm cursor-pointer select-none text-gray-700">
              <input type="checkbox" checked={form[k]} onChange={(e) => upd(k, e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600 border-gray-300" />
              {l}
            </label>
          ))}
        </div>
      </FormSection>

      <button type="submit" disabled={loading}
        className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm">
        {loading && <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" />}
        {loading ? 'Saving…' : 'Save Product'}
      </button>
    </form>
  );
}
