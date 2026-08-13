import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt, ShieldCheck, AlertTriangle, Info, Loader2, CheckCircle2, Landmark,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { shopsApi } from '../../api/shops.api';
import { isValidGstin, stateCodeOf, stateNameOf } from '../../utils/gst';

/**
 * Settings → Tax / GST.
 *
 * GST was configurable only through the API: the Settings shop form carried a
 * default tax rate and nothing else, so GSTIN, state code, scheme, price mode,
 * invoice prefix and round-off could not be set from the app at all — yet every
 * invoice, the ITC position and the whole Tax & Profit module depend on them.
 *
 * WHAT VALIDATES WHERE
 *   This form validates as you type so mistakes are caught before a save, but the
 *   server re-validates everything and is the authority — including the rules a
 *   single field cannot express (scheme requires a GSTIN; a supplied state code
 *   must match the one embedded in the GSTIN). Nothing here is trusted.
 *
 * TWO DIFFERENT "MODES" — deliberately separated
 *   Scheme  = how the shop is registered (regular / composition / not registered)
 *   Price mode = whether catalogue prices already include GST (exclusive/inclusive)
 *   They are unrelated, and conflating them is an easy and expensive mistake.
 */

const SCHEMES = [
  {
    value: 'regular',
    label: 'Regular',
    blurb: 'Collect GST on sales and claim input tax credit on purchases.',
  },
  {
    value: 'composition',
    label: 'Composition',
    blurb: 'Pay a flat percentage of turnover. GST is NOT charged to customers and '
         + 'input tax credit is not available.',
  },
  {
    value: 'unregistered',
    label: 'Not registered',
    blurb: 'No GSTIN. No GST on invoices and no input tax credit.',
  },
];

const GST_RATES = [0, 5, 12, 18, 28];

export default function GstSettings({ shop }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);

  // Load the shop's stored values. Re-runs when the active shop changes so the
  // form is always the selected shop's own configuration, never a stale one.
  useEffect(() => {
    if (!shop) return;
    setForm({
      gstNumber:       shop.gstNumber || '',
      stateCode:       shop.stateCode || '',
      gstScheme:       shop.gstScheme || 'regular',
      gstMode:         shop.gstMode || 'exclusive',
      taxRate:         shop.taxRate ?? 0,
      invoicePrefix:   shop.invoicePrefix || 'INV',
      invoiceRoundOff: shop.invoiceRoundOff !== false,
    });
    setSaved(false);
  }, [shop?._id, shop?.gstNumber, shop?.stateCode, shop?.gstScheme,
      shop?.gstMode, shop?.taxRate, shop?.invoicePrefix, shop?.invoiceRoundOff]);

  const mut = useMutation({
    mutationFn: (data) => shopsApi.update(shop._id, data),
    onSuccess: () => {
      // Every consumer of GST config must pick the change up: billing reads the
      // shop for each sale, and the tax position is derived from it.
      qc.invalidateQueries({ queryKey: ['shops'] });
      qc.invalidateQueries({ queryKey: ['tax-summary'] });
      setSaved(true);
      toast.success('GST settings saved');
    },
    onError: (e) => {
      setSaved(false);
      // Surface the server's own message — its cross-field rules are the ones
      // worth reading ("state code does not match the GSTIN…").
      toast.error(e?.response?.data?.message || e.message, { duration: 6000 });
    },
  });

  const upd = (k, v) => { setSaved(false); setForm((f) => ({ ...f, [k]: v })); };

  /** Client-side mirror of the server's rules, for immediate feedback. */
  const errors = useMemo(() => {
    if (!form) return {};
    const e = {};
    const gstin = (form.gstNumber || '').trim().toUpperCase();

    if (gstin && !isValidGstin(gstin)) {
      e.gstNumber = gstin.length !== 15
        ? `A GSTIN is 15 characters — this has ${gstin.length}`
        : 'Invalid GSTIN — the check digit does not match';
    }
    if (form.gstScheme !== 'unregistered' && !gstin) {
      e.gstScheme = 'A GSTIN is required for the regular and composition schemes';
    }
    const rate = Number(form.taxRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      e.taxRate = 'Must be between 0 and 100';
    }
    const prefix = (form.invoicePrefix || '').trim().toUpperCase();
    if (!prefix) e.invoicePrefix = 'Required';
    else if (!/^[A-Z0-9/-]{1,10}$/.test(prefix)) {
      e.invoicePrefix = 'Letters, numbers, / and - only (max 10)';
    }
    return e;
  }, [form]);

  if (!shop) {
    return (
      <section className="ui-card p-5">
        <p className="text-sm text-gray-500">Select a shop to configure its GST settings.</p>
      </section>
    );
  }
  if (!form) {
    return (
      <section className="ui-card p-5 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading GST settings…
      </section>
    );
  }

  const gstin = (form.gstNumber || '').trim().toUpperCase();
  // The GSTIN embeds the state, so it is the authority — shown read-only.
  const derivedCode = isValidGstin(gstin) ? stateCodeOf(gstin) : null;
  const derivedName = derivedCode ? stateNameOf(derivedCode) : null;
  const collectsGst = form.gstScheme === 'regular';
  const hasErrors = Object.keys(errors).length > 0;

  const submit = (e) => {
    e.preventDefault();
    if (hasErrors) return toast.error('Fix the highlighted fields first');
    mut.mutate({
      gstNumber: gstin,
      // Sent for completeness; the server derives it from the GSTIN and rejects a
      // mismatch, so it can never silently disagree.
      stateCode: derivedCode || form.stateCode || '',
      gstScheme: form.gstScheme,
      gstMode: form.gstMode,
      taxRate: Number(form.taxRate),
      invoicePrefix: (form.invoicePrefix || '').trim().toUpperCase(),
      invoiceRoundOff: !!form.invoiceRoundOff,
    });
  };

  return (
    <form onSubmit={submit} className="ui-card p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Receipt className="w-4 h-4 text-gray-400" />
        <h3 className="text-base font-semibold text-gray-900">Tax / GST</h3>
        <span className="text-xs text-gray-400">· {shop.name}</span>
        {saved && !mut.isPending && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        These settings drive every invoice, the input-tax-credit position and the Tax &amp;
        Profit module. They apply to <b>{shop.name}</b> only — each shop is configured
        separately.
      </p>

      {/* ── Registration ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Registration</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
            <input
              value={form.gstNumber}
              onChange={(e) => upd('gstNumber', e.target.value.toUpperCase())}
              placeholder="03AAPFU0939F1Z5"
              maxLength={15}
              className={`ui-input font-mono uppercase ${errors.gstNumber ? 'border-red-400' : ''}`}
            />
            {errors.gstNumber
              ? <p className="mt-1 text-xs font-medium text-red-600">{errors.gstNumber}</p>
              : gstin && isValidGstin(gstin)
                ? <p className="mt-1 text-xs font-medium text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Valid GSTIN
                  </p>
                : <p className="mt-1 text-xs text-gray-400">Printed on every invoice</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State (place of supply)
            </label>
            {/* Read-only on purpose: the GSTIN's first two digits ARE the state, and
                letting the two diverge silently flips CGST+SGST to IGST. */}
            <div className={`ui-input flex items-center ${derivedName ? '' : 'text-gray-400'}`}>
              {derivedName ? `${derivedCode} — ${derivedName}` : 'Derived from the GSTIN'}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Decides CGST+SGST (same state) vs IGST (inter-state)
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">GST scheme</label>
          <div className="space-y-2">
            {SCHEMES.map((s) => (
              <label key={s.value}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                  form.gstScheme === s.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                <input type="radio" name="gstScheme" value={s.value}
                  checked={form.gstScheme === s.value}
                  onChange={() => upd('gstScheme', s.value)}
                  className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-gray-800">{s.label}</span>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.blurb}</p>
                </div>
              </label>
            ))}
          </div>
          {errors.gstScheme && (
            <p className="mt-1.5 text-xs font-medium text-red-600">{errors.gstScheme}</p>
          )}
        </div>

        {/* The consequence of a non-regular scheme, stated before saving. */}
        {!collectsGst && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              {form.gstScheme === 'composition'
                ? 'On the composition scheme, invoices will NOT charge GST to customers and '
                  + 'purchase GST is treated as a cost rather than a claimable credit.'
                : 'Not registered — invoices will NOT charge GST and no input tax credit is available.'}
              {' '}Billing enforces this server-side, so a bill cannot add GST by mistake.
            </p>
          </div>
        )}
      </div>

      {/* ── Pricing & invoices ───────────────────────────────────────────────── */}
      <div className="space-y-3 pt-4 border-t border-gray-100">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Pricing &amp; invoices
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Do catalogue prices already include GST?
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'exclusive', label: 'Exclusive — GST added at billing' },
              { value: 'inclusive', label: 'Inclusive — GST already in the price' },
            ].map((m) => (
              <button key={m.value} type="button" onClick={() => upd('gstMode', m.value)}
                aria-pressed={form.gstMode === m.value}
                className={`px-3 h-10 rounded-xl border text-xs font-bold transition ${
                  form.gstMode === m.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Inclusive backs the tax out of the price instead of adding it on top.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default GST rate (%)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {GST_RATES.map((r) => (
                <button key={r} type="button" onClick={() => upd('taxRate', r)}
                  className={`px-2.5 h-9 rounded-lg border text-xs font-bold transition ${
                    Number(form.taxRate) === r
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {r}%
                </button>
              ))}
            </div>
            <input type="number" min="0" max="100" value={form.taxRate}
              onChange={(e) => upd('taxRate', e.target.value)}
              className={`ui-input mt-1.5 ${errors.taxRate ? 'border-red-400' : ''}`} />
            {errors.taxRate
              ? <p className="mt-1 text-xs font-medium text-red-600">{errors.taxRate}</p>
              : <p className="mt-1 text-xs text-gray-400">
                  Fallback only — a product's own GST rate wins when set
                </p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice prefix</label>
            <input value={form.invoicePrefix}
              onChange={(e) => upd('invoicePrefix', e.target.value.toUpperCase())}
              maxLength={10}
              className={`ui-input font-mono uppercase ${errors.invoicePrefix ? 'border-red-400' : ''}`} />
            {errors.invoicePrefix
              ? <p className="mt-1 text-xs font-medium text-red-600">{errors.invoicePrefix}</p>
              : <p className="mt-1 text-xs text-gray-400">
                  e.g. {(form.invoicePrefix || 'INV')}/2026-27/000001
                </p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Round off</label>
            <button type="button" onClick={() => upd('invoiceRoundOff', !form.invoiceRoundOff)}
              aria-pressed={form.invoiceRoundOff}
              className={`w-full h-10 rounded-xl border text-xs font-bold transition ${
                form.invoiceRoundOff
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600'
              }`}>
              {form.invoiceRoundOff ? 'On — round to the rupee' : 'Off — keep paise'}
            </button>
            <p className="mt-1 text-xs text-gray-400">
              Recorded separately so the invoice always reconciles
            </p>
          </div>
        </div>
      </div>

      {/* ── Where these apply ────────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 leading-relaxed">
          <p className="font-semibold mb-0.5">These settings feed:</p>
          <p>
            <b>Billing</b> — the GST charged and its CGST/SGST vs IGST split ·{' '}
            <b>Invoices</b> — GSTIN, prefix and round-off ·{' '}
            <b>Purchases</b> — how purchase GST is treated ·{' '}
            <b>Tax &amp; Profit</b> — output GST, eligible ITC and the estimated payable ·{' '}
            <b>Reports</b> — tax totals
          </p>
          <p className="mt-1 text-blue-700">
            Statutory rates for income tax and composition are configured per financial year
            under Tax &amp; Profit — they are never hardcoded.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={mut.isPending || hasErrors}
          className="btn-primary disabled:opacity-50">
          {mut.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            : <><Landmark className="w-4 h-4" /> Save GST Settings</>}
        </button>
        {hasErrors && (
          <span className="text-xs font-medium text-red-600">
            {Object.keys(errors).length} field{Object.keys(errors).length === 1 ? '' : 's'} need attention
          </span>
        )}
      </div>
    </form>
  );
}
