/**
 * Step 4 — GST and remaining details.
 *
 * Everything the old ProductForm had that is not on steps 1–3 lives here, so
 * replacing that form loses nothing: batch/expiry, reorder levels, the
 * featured/new/trending flags and the notify-staff checkbox.
 */
import { Receipt, Layers, Boxes, Sparkles, Megaphone } from 'lucide-react';
import { FormSection } from '../ui/FormSection';
import { inp, Field, Segmented, GST_RATES, inr } from './fields';

const TAX_TYPES = [
  { value: 'taxable',     label: 'Taxable' },
  { value: 'exempt',      label: 'Exempt' },
  { value: 'nil_rated',   label: 'Nil rated' },
  { value: 'zero_rated',  label: 'Zero rated' },
];

export default function StepDetails({ form, upd, errors, pricing, isEdit }) {
  return (
    <div className="space-y-4">

      <FormSection title="GST" icon={Receipt} color="blue">
        <Field
          label="GST Rate"
          hint="Leave unset to use the bill's tax rate at checkout. Set it here when this product has its own rate."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={form.gstRate === '' ? '' : Number(form.gstRate)}
              onChange={(v) => upd('gstRate', v)}
              options={[
                { value: '', label: 'Not set' },
                ...GST_RATES.map((r) => ({ value: r, label: `${r}%` })),
              ]}
            />
          </div>
        </Field>

        {form.gstRate !== '' && pricing.taxAmount > 0 && (
          <p className="text-xs text-blue-700">
            At {form.gstRate}%: <b>{inr(pricing.taxAmount)}</b> tax per unit —
            customer total <b>{inr(pricing.priceWithTax)}</b>.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="HSN Code" hint="For GST-compliant invoices">
            <input value={form.hsnCode} onChange={(e) => upd('hsnCode', e.target.value)}
              placeholder="e.g. 6403" className={inp} />
          </Field>
          <Field label="Tax Type">
            <select value={form.taxType} onChange={(e) => upd('taxType', e.target.value)} className={inp}>
              {TAX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>
      </FormSection>

      <FormSection title="Stock Levels" icon={Boxes} color="green">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Low Stock ≤">
            <input type="number" min="0" value={form.lowStockThreshold}
              onChange={(e) => upd('lowStockThreshold', e.target.value)} className={inp} />
          </Field>
          <Field label="Reorder At">
            <input type="number" min="0" value={form.reorderPoint}
              onChange={(e) => upd('reorderPoint', e.target.value)} className={inp} />
          </Field>
          <Field label="Min Stock">
            <input type="number" min="0" value={form.minStock}
              onChange={(e) => upd('minStock', e.target.value)} className={inp} />
          </Field>
          <Field label="Max Stock">
            <input type="number" min="0" value={form.maxStock}
              onChange={(e) => upd('maxStock', e.target.value)} className={inp} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Batch & Expiry" icon={Layers} color="amber">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-gray-700">
              <input type="checkbox" checked={form.trackBatch}
                onChange={(e) => upd('trackBatch', e.target.checked)}
                className="w-4 h-4 rounded accent-amber-600" />
              Track batch number
            </label>
            {form.trackBatch && (
              <input value={form.batchNumber} onChange={(e) => upd('batchNumber', e.target.value)}
                placeholder="Batch / lot number" className={inp} />
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-gray-700">
              <input type="checkbox" checked={form.trackExpiry}
                onChange={(e) => upd('trackExpiry', e.target.checked)}
                className="w-4 h-4 rounded accent-amber-600" />
              Track expiry date
            </label>
            {form.trackExpiry && (
              <input type="date" value={form.expiryDate}
                onChange={(e) => upd('expiryDate', e.target.value)} className={inp} />
            )}
          </div>
        </div>
        {form.expiryDate && (
          <p className="text-xs text-amber-700">
            Expired stock is blocked from being sold server-side, regardless of this toggle.
          </p>
        )}
      </FormSection>

      <FormSection title="Storefront" icon={Sparkles} color="gray">
        <div className="flex flex-wrap gap-5">
          {[
            ['isFeatured',   '⭐ Featured'],
            ['isNewArrival', '✨ New Arrival'],
            ['isTrending',   '🔥 Trending'],
          ].map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm cursor-pointer select-none text-gray-700">
              <input type="checkbox" checked={form[k]} onChange={(e) => upd(k, e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600 border-gray-300" />
              {label}
            </label>
          ))}
        </div>
      </FormSection>

      {/* Only meaningful on create — an edit would re-notify staff about an
          existing product every time someone fixes a typo. */}
      {!isEdit && (
        <label className="flex items-start gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.notifyCustomers}
            onChange={(e) => upd('notifyCustomers', e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded accent-blue-600 shrink-0"
          />
          <div>
            <span className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
              <Megaphone className="w-4 h-4" /> Notify staff about this product
            </span>
            <p className="text-xs text-blue-600 mt-0.5">
              Sends an in-app notification to every team member of this shop.
            </p>
          </div>
        </label>
      )}
    </div>
  );
}
