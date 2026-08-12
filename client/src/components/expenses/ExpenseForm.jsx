import { useRef } from 'react';
import {
  Tag, Building2, FileText, ShieldQuestion, Paperclip, X, Upload, Info,
} from 'lucide-react';
import { FormSection } from '../ui/FormSection';

/**
 * ExpenseForm — full capture for an expense, including the fields a tax position
 * actually depends on.
 *
 * The original form had four fields (type, amount, date, description), which is
 * why every existing expense sits unclassified: there was nowhere to record the
 * GST paid, the supplier's GSTIN or the invoice number, and no way to say whether
 * the cost is deductible or its GST claimable.
 *
 * DEFAULTS ARE CAUTIOUS ON PURPOSE
 *   ITC and deduction both default to "Review". Nothing is treated as claimable
 *   or deductible until a person says so, and anything left in Review is excluded
 *   from every tax figure. The form says this rather than hiding it.
 */

export const EXPENSE_CATEGORIES = [
  { value: 'rent',                  label: 'Shop rent' },
  { value: 'electricity',           label: 'Electricity' },
  { value: 'internet_phone',        label: 'Internet / phone' },
  { value: 'salary',                label: 'Employee salary' },
  { value: 'packaging',             label: 'Packaging' },
  { value: 'transport_freight',     label: 'Transport / freight' },
  { value: 'maintenance',           label: 'Repairs & maintenance' },
  { value: 'advertising',           label: 'Advertising / marketing' },
  { value: 'software_subscription', label: 'Software / subscriptions' },
  { value: 'professional_fees',     label: 'Professional / accounting fees' },
  { value: 'bank_charges',          label: 'Bank / payment charges' },
  { value: 'insurance',             label: 'Business insurance' },
  { value: 'supplies',              label: 'Supplies' },
  { value: 'utilities_other',       label: 'Other utilities' },
  { value: 'other',                 label: 'Other business expense' },
];

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'upi',           label: 'UPI' },
  { value: 'card',          label: 'Card' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'other',         label: 'Other' },
];

const GST_RATES = [0, 5, 12, 18, 28];

export const EMPTY_EXPENSE = {
  type: 'rent',
  amount: '',
  gstAmount: '',
  gstRate: '',
  date: '',
  description: '',
  vendorName: '',
  vendorGstin: '',
  invoiceNumber: '',
  invoiceDate: '',
  paymentMethod: 'cash',
  businessPurpose: '',
  attachment: '',
  itcStatus: 'review',
  deductionStatus: 'review',
  isCapitalAsset: false,
  shopId: '',
};

const inp = [
  'w-full h-11 px-3 border border-gray-300 rounded-xl text-sm bg-white',
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  'transition placeholder-gray-400',
].join(' ');

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
      {label}{required && <span className="text-red-500"> *</span>}
    </label>
    {children}
    {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
  </div>
);

/** Three-way status picker. Used for both ITC and deductibility. */
function StatusPicker({ value, onChange, options, name }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-3 h-10 rounded-xl border text-xs font-bold transition ${
            value === o.value
              ? o.tone
              : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
          }`}
        >
          {o.label}
        </button>
      ))}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

const ITC_OPTIONS = [
  { value: 'eligible',     label: 'Eligible',     tone: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
  { value: 'not_eligible', label: 'Not eligible', tone: 'border-gray-400 bg-gray-100 text-gray-700' },
  { value: 'review',       label: 'Review',       tone: 'border-amber-500 bg-amber-50 text-amber-800' },
];

const DEDUCTION_OPTIONS = [
  { value: 'deductible',     label: 'Yes',    tone: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
  { value: 'not_deductible', label: 'No',     tone: 'border-gray-400 bg-gray-100 text-gray-700' },
  { value: 'review',         label: 'Review', tone: 'border-amber-500 bg-amber-50 text-amber-800' },
];

export default function ExpenseForm({ form, setForm, onSubmit, loading, shops, shopId }) {
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const fileRef = useRef();

  const amount = parseFloat(form.amount) || 0;
  const gst    = parseFloat(form.gstAmount) || 0;

  /** Derive the GST amount when a rate is picked, so it is not typed twice. */
  const applyRate = (rate) => {
    upd('gstRate', rate);
    if (rate !== '' && amount > 0) {
      upd('gstAmount', +((amount * Number(rate)) / 100).toFixed(2));
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => upd('attachment', reader.result);
    reader.readAsDataURL(file);
  };

  // Documentation ITC normally depends on. Shown as a prompt, never as a decision.
  const itcDocMissing = gst > 0 && (!form.vendorGstin || !form.invoiceNumber);

  return (
    <form onSubmit={onSubmit} className="space-y-4">

      <FormSection title="Expense" icon={Tag} color="gray">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Category" required>
            <select required value={form.type} onChange={(e) => upd('type', e.target.value)} className={inp}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Date" required>
            <input required type="date" value={form.date}
              onChange={(e) => upd('date', e.target.value)} className={inp} />
          </Field>
          <Field label="Amount excluding GST (₹)" required hint="The business cost itself">
            <input required type="number" min="0" step="0.01" value={form.amount}
              onChange={(e) => upd('amount', e.target.value)} placeholder="0.00" className={inp} />
          </Field>
          <Field label="Shop" required>
            <select required value={form.shopId || shopId || ''}
              onChange={(e) => upd('shopId', e.target.value)} className={inp}>
              <option value="">Select shop</option>
              {shops.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Payment method">
            <select value={form.paymentMethod} onChange={(e) => upd('paymentMethod', e.target.value)} className={inp}>
              {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Description">
            <input value={form.description} onChange={(e) => upd('description', e.target.value)}
              placeholder="e.g. October shop rent" className={inp} />
          </Field>
        </div>
      </FormSection>

      {/* ── GST paid, tracked apart from the cost because it may be a credit ── */}
      <FormSection title="GST Paid" icon={FileText} color="blue">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="GST rate" hint="Fills the amount below automatically">
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => applyRate('')}
                className={`px-3 h-10 rounded-xl border text-xs font-bold transition ${
                  form.gstRate === '' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 bg-white'
                }`}>
                None
              </button>
              {GST_RATES.map((r) => (
                <button key={r} type="button" onClick={() => applyRate(r)}
                  className={`px-3 h-10 rounded-xl border text-xs font-bold transition ${
                    Number(form.gstRate) === r && form.gstRate !== ''
                      ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 bg-white'
                  }`}>
                  {r}%
                </button>
              ))}
            </div>
          </Field>
          <Field label="GST amount (₹)" hint="Kept separate from the cost — it may be claimable">
            <input type="number" min="0" step="0.01" value={form.gstAmount}
              onChange={(e) => upd('gstAmount', e.target.value)} placeholder="0.00" className={inp} />
          </Field>
        </div>
        {amount > 0 && (
          <p className="text-xs text-blue-800 bg-white/70 rounded-lg px-3 py-2">
            Total paid to vendor:{' '}
            <b>₹{(amount + gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
            {gst > 0 && <> — of which ₹{gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })} is GST</>}
          </p>
        )}
      </FormSection>

      {/* ── Documentation. ITC and deductibility both rest on this existing. ── */}
      <FormSection title="Vendor & Invoice" icon={Building2} color="gray">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Vendor name">
            <input value={form.vendorName} onChange={(e) => upd('vendorName', e.target.value)}
              placeholder="Supplier / service provider" className={inp} />
          </Field>
          <Field label="Vendor GSTIN" hint="Required for an input tax credit claim">
            <input value={form.vendorGstin}
              onChange={(e) => upd('vendorGstin', e.target.value.toUpperCase())}
              placeholder="e.g. 03AAPFU0939F1Z5" maxLength={15}
              className={`${inp} font-mono uppercase`} />
          </Field>
          <Field label="Invoice number">
            <input value={form.invoiceNumber} onChange={(e) => upd('invoiceNumber', e.target.value)}
              placeholder="Vendor's invoice number" className={inp} />
          </Field>
          <Field label="Invoice date">
            <input type="date" value={form.invoiceDate}
              onChange={(e) => upd('invoiceDate', e.target.value)} className={inp} />
          </Field>
        </div>

        <Field label="Business purpose" hint="Why this is a business cost — the first thing asked in any review">
          <textarea rows={2} value={form.businessPurpose}
            onChange={(e) => upd('businessPurpose', e.target.value)}
            placeholder="e.g. Monthly rent for the shop premises at…"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
        </Field>

        <Field label="Receipt / invoice copy">
          {form.attachment ? (
            <div className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-200 bg-white">
              {form.attachment.startsWith('data:image')
                ? <img src={form.attachment} alt="" className="w-12 h-12 rounded-lg object-cover" />
                : <Paperclip className="w-5 h-5 text-gray-400" />}
              <span className="text-xs text-gray-600 flex-1">Attached</span>
              <button type="button" onClick={() => upd('attachment', '')}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current.click()}
              className="w-full h-11 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" /> Attach receipt
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
        </Field>
      </FormSection>

      {/* ── Tax treatment. Cautious by default, and it says so. ── */}
      <FormSection title="Tax Treatment" icon={ShieldQuestion} color="amber">
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/70 border border-amber-200">
          <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Both default to <b>Review</b>. Anything left in Review is <b>excluded</b> from the
            tax estimates — MultiShop never decides that a cost is deductible or its GST
            claimable. Your confirmation is recorded with your name and the time.
          </p>
        </div>

        <Field label="Input tax credit (ITC) on the GST paid">
          <StatusPicker value={form.itcStatus} onChange={(v) => upd('itcStatus', v)}
            options={ITC_OPTIONS} name="itcStatus" />
        </Field>

        <Field label="Deductible against business profit?">
          <StatusPicker value={form.deductionStatus} onChange={(v) => upd('deductionStatus', v)}
            options={DEDUCTION_OPTIONS} name="deductionStatus" />
        </Field>

        {itcDocMissing && form.itcStatus === 'eligible' && (
          <p className="text-xs font-semibold text-amber-900 bg-amber-100 border border-amber-300 rounded-lg px-3 py-2">
            GST is recorded but the vendor GSTIN and/or invoice number is missing. An ITC claim
            normally needs both — add them, or set this to Review.
          </p>
        )}

        <label className="flex items-start gap-2.5 cursor-pointer pt-1">
          <input type="checkbox" checked={form.isCapitalAsset}
            onChange={(e) => upd('isCapitalAsset', e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded accent-amber-600 shrink-0" />
          <div>
            <span className="text-sm font-semibold text-amber-900">This is a capital purchase</span>
            <p className="text-xs text-amber-700 mt-0.5">
              Equipment, furniture, computers. Depreciated over time rather than deducted in
              full this year, so it is excluded from the expense deduction.
            </p>
          </div>
        </label>
      </FormSection>

      <button type="submit" disabled={loading}
        className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl transition flex items-center justify-center gap-2">
        {loading && <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />}
        {loading ? 'Saving…' : 'Save Expense'}
      </button>
    </form>
  );
}
