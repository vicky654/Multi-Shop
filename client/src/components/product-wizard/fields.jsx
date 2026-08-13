/**
 * Shared form field widgets for the product wizard.
 *
 * Moved verbatim out of the old ProductForm.jsx rather than rewritten — these
 * were already working, and the wizard replaces that form, so duplicating them
 * would leave two copies to fix every time.
 */
import { useState, useRef, useCallback } from 'react';
import { X, Upload, ChevronDown } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
export const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

// Footwear sizes. The motivating use case for this wizard is 100 pairs of shoes,
// and typing 5..12 by hand every time is exactly the friction it removes.
export const SHOE_SIZES = ['5', '6', '7', '8', '9', '10', '11', '12'];

export const PRESET_COLORS = [
  { name: 'Red',    hex: '#ef4444' }, { name: 'Blue',   hex: '#3b82f6' },
  { name: 'Green',  hex: '#22c55e' }, { name: 'Yellow', hex: '#eab308' },
  { name: 'Black',  hex: '#111827' }, { name: 'White',  hex: '#f9fafb' },
  { name: 'Pink',   hex: '#ec4899' }, { name: 'Purple', hex: '#a855f7' },
  { name: 'Orange', hex: '#f97316' }, { name: 'Navy',   hex: '#1e3a5f' },
  { name: 'Brown',  hex: '#92400e' }, { name: 'Gray',   hex: '#6b7280' },
];

export const SUB_CATS  = ['Mens', 'Womens', 'Kids', 'Unisex'];
export const UNITS     = ['pcs', 'pair', 'kg', 'g', 'ltr', 'ml', 'box', 'set'];
export const GST_RATES = [0, 5, 12, 18, 28];

// Categories where shoe sizes make more sense than clothing sizes.
const FOOTWEAR_HINTS = ['shoe', 'footwear', 'sneaker', 'sandal', 'boot', 'slipper', 'heel'];
export const looksLikeFootwear = (category = '') =>
  FOOTWEAR_HINTS.some((h) => category.toLowerCase().includes(h));

// ── Shared input style ────────────────────────────────────────────────────────
export const inp = [
  'w-full h-11 px-3 border border-gray-300 rounded-xl text-sm bg-white',
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  'transition placeholder-gray-400',
].join(' ');

// Same shape, but flagged as invalid. Inline validation needs the control itself
// to look wrong, not just a message underneath it.
export const inpError = inp.replace('border-gray-300', 'border-red-400 bg-red-50/40');

// ── Image helper ──────────────────────────────────────────────────────────────
const fileToBase64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

/**
 * Field — label + inline error/hint wrapper.
 *
 * The spec rules out error modals, so a message renders directly under the
 * control that caused it. An error replaces the hint rather than stacking, so
 * the layout does not jump as the user types.
 */
export function Field({ label, required, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          {label}{required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children}
      {error
        ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
        : hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

/**
 * Segmented — a small horizontal choice group.
 * Used for the variant axis, discount type and GST rate, where a <select> would
 * hide the options behind a tap on mobile.
 */
export function Segmented({ value, onChange, options, className = '' }) {
  return (
    <div className={`inline-flex p-0.5 bg-gray-100 rounded-xl ${className}`}>
      {options.map((o) => {
        const val   = typeof o === 'object' ? o.value : o;
        const label = typeof o === 'object' ? o.label : o;
        const active = val === value;
        return (
          <button
            key={String(val)}
            type="button"
            onClick={() => onChange(val)}
            className={`px-3 h-9 rounded-[10px] text-sm font-medium transition-all whitespace-nowrap ${
              active ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── CategoryCombobox ──────────────────────────────────────────────────────────
export function CategoryCombobox({ value, onChange, categories, invalid }) {
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
          data-testid="wizard-category"
          value={input}
          onChange={(e) => { setInput(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          placeholder="e.g. Running Shoes"
          className={`${invalid ? inpError : inp} pr-9`}
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
// `presets` lets the variants step offer shoe sizes instead of clothing sizes.
export function SizeSelector({ selected, onChange, presets = DEFAULT_SIZES }) {
  const [custom, setCustom] = useState('');
  const toggle = (s) =>
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]);
  const addCustom = () => {
    const v = custom.trim().toUpperCase();
    if (v && !selected.includes(v)) { onChange([...selected, v]); setCustom(''); }
  };

  const customSizes = selected.filter((s) => !presets.includes(s));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((s) => (
          <button key={s} type="button" onClick={() => toggle(s)}
            className={`h-9 min-w-[2.5rem] px-3 rounded-full text-sm font-medium border transition-all ${
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
export function ColorSelector({ selected, onChange }) {
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
              className={`w-9 h-9 rounded-full border-2 transition-all ${
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
export function ImageUploader({ images, onChange }) {
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

// ── Money formatting ──────────────────────────────────────────────────────────
export const inr = (n) =>
  `₹${Math.abs(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// Signed variant for profit figures, where the sign carries the meaning.
export const inrSigned = (n) => `${Number(n) < 0 ? '−' : ''}${inr(n)}`;
