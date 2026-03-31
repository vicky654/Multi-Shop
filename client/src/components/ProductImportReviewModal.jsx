import { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Camera, FileText, Upload, X, Trash2, CheckCircle,
  AlertCircle, Loader2, ScanLine, Edit2, Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { parserApi }   from '../api/parser.api';
import { productsApi } from '../api/products.api';
import useShopStore    from '../store/shopStore';
import Modal           from './Modal';

const CATEGORIES = ['Grocery', 'Clothing', 'Electronics', 'Personal Care', 'Medicine', 'Toys', 'General'];

// ── Editable row ──────────────────────────────────────────────────────────────
function ItemRow({ item, index, onChange, onRemove }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-2 px-3">
        <input
          value={item.name}
          onChange={(e) => onChange(index, 'name', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Product name"
        />
      </td>
      <td className="py-2 px-2 w-24">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.price}
            onChange={(e) => onChange(index, 'price', parseFloat(e.target.value) || 0)}
            className="w-full text-sm border border-gray-200 rounded-lg pl-6 pr-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </td>
      <td className="py-2 px-2 w-16">
        <input
          type="number"
          min="1"
          value={item.qty}
          onChange={(e) => onChange(index, 'qty', parseInt(e.target.value) || 1)}
          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
        />
      </td>
      <td className="py-2 px-2 w-32 hidden sm:table-cell">
        <select
          value={item.category}
          onChange={(e) => onChange(index, 'category', e.target.value)}
          className="w-full text-xs border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className="py-2 px-2 w-10">
        <button
          onClick={() => onRemove(index)}
          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function ProductImportReviewModal({ open, onClose, shopId }) {
  const qc = useQueryClient();
  const fileRef = useRef(null);

  const [tab,      setTab]      = useState('image'); // 'image' | 'text'
  const [preview,  setPreview]  = useState(null);    // image preview URL
  const [imageFile, setImageFile] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [items,    setItems]    = useState([]);
  const [step,     setStep]     = useState('input'); // 'input' | 'review' | 'done'
  const [importing, setImporting] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  // ── Parse mutation ────────────────────────────────────────────────────────
  const parseMut = useMutation({
    mutationFn: () =>
      tab === 'image' && imageFile
        ? parserApi.extractFromImage(imageFile)
        : parserApi.extractFromText(textInput),
    onSuccess: (res) => {
      const parsed = res.data?.data?.items || [];
      if (parsed.length === 0) {
        toast('No items detected — try clearer text or image', { icon: '🔍' });
        return;
      }
      // Add shopId + initialise stock = qty
      setItems(parsed.map((it, i) => ({ ...it, _key: i, stock: it.qty, shopId })));
      setStep('review');
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Parsing failed'),
  });

  // ── Image pick handlers ───────────────────────────────────────────────────
  const handleFile = useCallback((file) => {
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) handleFile(file);
  };

  // ── Item edit helpers ─────────────────────────────────────────────────────
  const changeItem = (i, field, val) =>
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const removeItem = (i) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));

  const addRow = () =>
    setItems((prev) => [...prev, { _key: Date.now(), name: '', price: 0, qty: 1, stock: 1, category: 'General', shopId }]);

  // ── Import all items as products ──────────────────────────────────────────
  const handleImport = async () => {
    const valid = items.filter((it) => it.name && it.price > 0);
    if (valid.length === 0) { toast.error('Add at least one valid item'); return; }

    setImporting(true);
    let ok = 0;
    for (const it of valid) {
      try {
        await productsApi.create({
          name:     it.name,
          price:    it.price,
          stock:    it.stock || it.qty || 1,
          category: it.category || 'General',
          shopId:   shopId,
          unit:     'pcs',
        });
        ok++;
      } catch { /* skip failed items */ }
    }
    setImporting(false);
    qc.invalidateQueries(['products']);
    setDoneCount(ok);
    setStep('done');
    toast.success(`${ok} product${ok !== 1 ? 's' : ''} added to inventory`);
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = () => {
    setTab('image'); setPreview(null); setImageFile(null);
    setTextInput(''); setItems([]); setStep('input'); setDoneCount(0);
  };

  const handleClose = () => { reset(); onClose(); };

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Scan Bill / Extract Products" size="lg">
      {/* ── STEP: INPUT ── */}
      {step === 'input' && (
        <div className="space-y-4">
          {/* Tab switch */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {[
              { id: 'image', Icon: Camera,   label: 'Scan Image' },
              { id: 'text',  Icon: FileText,  label: 'Paste Text' },
            ].map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={[
                  'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition',
                  tab === id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50',
                ].join(' ')}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Image tab */}
          {tab === 'image' && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"   // opens rear camera on mobile
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />

              {preview ? (
                <div className="relative inline-block">
                  <img src={preview} alt="Bill preview" className="max-h-52 max-w-full rounded-xl object-contain mx-auto" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreview(null); setImageFile(null); }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="py-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <ScanLine className="w-8 h-8 text-blue-600" />
                  </div>
                  <p className="font-semibold text-gray-800 mb-1">📸 Scan Bill</p>
                  <p className="text-sm text-gray-500">Tap to take photo or upload image</p>
                  <p className="text-xs text-gray-400 mt-2">Supports JPG, PNG, HEIC · max 10 MB</p>
                </div>
              )}
            </div>
          )}

          {/* Text tab */}
          {tab === 'text' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Paste bill text, one item per line. Format: <span className="font-mono bg-gray-100 px-1 rounded">Name Price Qty</span></p>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={`e.g.\nMilk 50 10\nBread 30 5\nEggs 120 1`}
                rows={8}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-none"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => parseMut.mutate()}
              disabled={parseMut.isPending || (tab === 'image' ? !imageFile : !textInput.trim())}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition text-sm"
            >
              {parseMut.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Extracting…</>
                : <><ScanLine className="w-4 h-4" /> Extract Items</>}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: REVIEW ── */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{items.length} items</span> detected. Edit before importing.
            </p>
            <button
              onClick={() => setStep('input')}
              className="text-xs text-blue-600 hover:underline"
            >
              ← Rescan
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left py-2 px-3 font-medium">Name</th>
                  <th className="text-left py-2 px-2 font-medium w-24">Price</th>
                  <th className="text-left py-2 px-2 font-medium w-16">Qty</th>
                  <th className="text-left py-2 px-2 font-medium w-32 hidden sm:table-cell">Category</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <ItemRow
                    key={it._key ?? i}
                    item={it}
                    index={i}
                    onChange={changeItem}
                    onRemove={removeItem}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={addRow}
            className="w-full py-2 text-sm text-blue-600 border border-dashed border-blue-300 rounded-xl hover:bg-blue-50 transition font-medium"
          >
            + Add Row
          </button>

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || items.filter((i) => i.name && i.price > 0).length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl transition text-sm"
            >
              {importing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                : <><Package className="w-4 h-4" /> Add {items.filter((i) => i.name && i.price > 0).length} Products</>}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: DONE ── */}
      {step === 'done' && (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{doneCount} Products Added!</p>
            <p className="text-sm text-gray-500 mt-1">They're now available in your Inventory</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition text-sm"
            >
              Scan Another Bill
            </button>
            <button
              onClick={handleClose}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
