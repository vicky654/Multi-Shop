/**
 * Step 1 — Basic product information.
 *
 * Ends with the "has variants" toggle: the decision lives here so that skipping
 * step 2 is something the user just chose, not something that silently happens.
 */
import { useRef, useState } from 'react';
import { Package, Image as ImageIcon, FileText, Camera, Grid3x3 } from 'lucide-react';
import { FormSection } from '../ui/FormSection';
import { productsApi } from '../../api/products.api';
import {
  inp, inpError, Field, CategoryCombobox, ImageUploader, SUB_CATS, UNITS,
} from './fields';

export default function StepBasic({ form, upd, errors, shops, shopId, categories }) {
  const photoRef = useRef();
  const [analyzing, setAnalyzing] = useState(false);

  // Preserved from the old ProductForm — AI fills name/category/description from
  // a photo, which is the fastest way to start a product from a physical item.
  const handlePhotoAnalyze = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await productsApi.analyzeImage(fd);
      const { name, category, description } = res?.data?.detected || {};
      if (name)        upd('name', name);
      if (category)    upd('category', category);
      if (description) upd('description', description);
    } catch {
      // Silently ignore — the user can fill the fields manually.
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <FormSection title="Product" icon={Package} color="gray">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Product Name <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => photoRef.current.click()}
              disabled={analyzing}
              className="flex items-center gap-1 px-2 py-0.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 rounded-lg text-[11px] font-semibold transition disabled:opacity-50"
            >
              {analyzing
                ? <span className="animate-spin w-3 h-3 border border-violet-400 border-t-violet-700 rounded-full" />
                : <Camera className="w-3 h-3" />}
              {analyzing ? 'Analyzing…' : 'Add by Photo'}
            </button>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoAnalyze} />
          </div>
          <input
            data-testid="wizard-name"
            value={form.name}
            onChange={(e) => upd('name', e.target.value)}
            placeholder="e.g. Men's Running Shoes"
            className={errors.name ? inpError : inp}
          />
          {errors.name && <p className="mt-1 text-xs font-medium text-red-600">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Category" required error={errors.category}>
            <CategoryCombobox
              value={form.category}
              onChange={(v) => upd('category', v)}
              categories={categories}
              invalid={!!errors.category}
            />
          </Field>

          <Field label="Brand" hint="e.g. Nike, Bata — used in search">
            <input data-testid="wizard-brand" value={form.brand} onChange={(e) => upd('brand', e.target.value)}
              placeholder="Brand name" className={inp} />
          </Field>

          <Field label="Sub-Category">
            <select value={form.subCategory} onChange={(e) => upd('subCategory', e.target.value)} className={inp}>
              <option value="">— None —</option>
              {SUB_CATS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Unit" hint="Pairs for shoes, pcs for most items">
            <select value={form.unit} onChange={(e) => upd('unit', e.target.value)} className={inp}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </Field>

          <Field label="Shop" required error={errors.shopId}>
            <select value={form.shopId || shopId || ''} onChange={(e) => upd('shopId', e.target.value)}
              className={errors.shopId ? inpError : inp}>
              <option value="">Select shop</option>
              {shops.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </Field>

          <Field label="Barcode" hint="Scan or type">
            <input value={form.barcode} onChange={(e) => upd('barcode', e.target.value)}
              placeholder="Scan or type…" className={inp} />
          </Field>

          <Field label="SKU" hint={form._id ? undefined : 'Generated automatically if left blank'}>
            <input value={form.sku} onChange={(e) => upd('sku', e.target.value)}
              placeholder="AUTO" className={inp} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Images" icon={ImageIcon} color="gray">
        <p className="text-xs text-gray-400 -mt-1">Up to 5 images. Hover an image to remove it.</p>
        <ImageUploader images={form.images} onChange={(v) => upd('images', v)} />
      </FormSection>

      <FormSection title="Description" icon={FileText} color="gray">
        <textarea
          value={form.description}
          onChange={(e) => upd('description', e.target.value)}
          rows={3}
          placeholder="Materials, features, care instructions…"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-gray-400 resize-none"
        />
      </FormSection>

      {/* ── The variant decision ───────────────────────────────────────────── */}
      <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${
        form.hasVariants
          ? 'border-purple-300 bg-purple-50'
          : 'border-gray-200 bg-gray-50 hover:border-purple-200'
      }`}>
        <input
          type="checkbox"
          checked={form.hasVariants}
          onChange={(e) => upd('hasVariants', e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded accent-purple-600 shrink-0"
        />
        <div className="min-w-0">
          <span className={`text-sm font-semibold flex items-center gap-1.5 ${
            form.hasVariants ? 'text-purple-800' : 'text-gray-700'
          }`}>
            <Grid3x3 className="w-4 h-4 shrink-0" />
            This product has variants
          </span>
          <p className={`text-xs mt-1 ${form.hasVariants ? 'text-purple-600' : 'text-gray-400'}`}>
            Split the received quantity across colors and sizes — e.g. 100 pairs across
            Black, Brown and White in sizes 7&ndash;11. Leave off for a single stock figure.
          </p>
        </div>
      </label>

      {/* Simple products enter their stock here, since they never see step 2. */}
      {!form.hasVariants && (
        <FormSection title="Stock" icon={Package} color="green">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Stock Quantity" error={errors.stock}>
              <input type="number" min="0" value={form.stock}
                onChange={(e) => upd('stock', e.target.value)}
                placeholder="0" className={errors.stock ? inpError : inp} />
            </Field>
            <Field label="Low Stock Alert ≤">
              <input type="number" min="0" value={form.lowStockThreshold}
                onChange={(e) => upd('lowStockThreshold', e.target.value)} className={inp} />
            </Field>
          </div>
        </FormSection>
      )}
    </div>
  );
}
