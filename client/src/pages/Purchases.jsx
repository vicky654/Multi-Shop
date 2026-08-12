import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Truck, CheckCircle2, XCircle, Trash2, Package, Loader2, Camera, AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { purchasesApi } from '../api/purchases.api';
import { productsApi } from '../api/products.api';
import useShopStore from '../store/shopStore';
import Modal from '../components/Modal';
import { formatINR } from '../utils/format';

/**
 * Purchases / GRN.
 *
 * Draft → Post → (Cancel). A draft touches no inventory; posting increases stock
 * and variant stock in lockstep; cancelling reverses the recorded movement. All of
 * that is enforced server-side — this screen is the operator's view of it.
 *
 * Totals shown while typing are a PREVIEW. The server recomputes them on save and
 * its figures are what get stored, so the two can never disagree in the record.
 */

const inr = (n) => formatINR(n ?? 0, 2);
const GST_RATES = [0, 5, 12, 18, 28];

const EMPTY_LINE = { product: '', size: '', color: '', quantity: '', costPrice: '', gstRate: 18 };

const EMPTY = () => ({
  supplierName: '', supplierGstin: '', invoiceNumber: '',
  invoiceDate: format(new Date(), 'yyyy-MM-dd'),
  freightCharges: '', otherCharges: '', invoiceDiscount: '',
  paymentMethod: 'credit', paymentStatus: 'unpaid', paidAmount: '',
  itcStatus: 'review', notes: '',
  lines: [{ ...EMPTY_LINE }],
});

const inp = 'w-full h-10 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1';

const STATUS_STYLE = {
  draft:     'bg-amber-100 text-amber-800',
  posted:    'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-200 text-gray-600',
};

export default function Purchases() {
  const qc = useQueryClient();
  const { activeShop } = useShopStore();
  const shopId = activeShop?._id;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', shopId],
    queryFn:  () => purchasesApi.getAll({ shopId, limit: 50 }),
    enabled:  !!shopId,
  });
  const purchases = data?.data || [];

  const { data: prodData } = useQuery({
    queryKey: ['products', shopId, '', ''],
    queryFn:  () => productsApi.getAll({ shopId, limit: 200 }),
    enabled:  !!shopId,
  });
  const products = prodData?.data || [];
  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p._id, p])), [products]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['purchases'] });
    // Inventory and the tax position both move when a GRN posts.
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['tax-summary'] });
  };

  const createMut = useMutation({
    mutationFn: (d) => purchasesApi.create(d),
    onSuccess: () => { refresh(); toast.success('Draft saved'); setOpen(false); setForm(EMPTY); },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const postMut = useMutation({
    mutationFn: (id) => purchasesApi.post(id),
    onSuccess: (res) => {
      refresh();
      toast.success(`Goods received — ${res.data.purchase.totalUnits} unit(s) added to inventory`);
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }) => purchasesApi.cancel(id, { reason }),
    onSuccess: () => { refresh(); toast.success('Cancelled — inventory movement reversed'); },
    // The common refusal is "goods already sold"; surfacing the server's words
    // matters more than a generic failure toast.
    onError: (e) => toast.error(e?.response?.data?.message || e.message, { duration: 6000 }),
  });

  const snapshotMut = useMutation({
    mutationFn: () => purchasesApi.openingSnapshot({ shopId }),
    onSuccess: (res) => {
      const s = res.data.snapshot;
      qc.invalidateQueries({ queryKey: ['tax-summary'] });
      toast.success(`Opening stock recorded: ${s.units} units / ${inr(s.value)}`);
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const upd  = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const updL = (i, k, v) => setForm((f) => ({
    ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)),
  }));
  const addLine = () => setForm((f) => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] }));
  const delLine = (i) => setForm((f) => ({
    ...f, lines: f.lines.length === 1 ? f.lines : f.lines.filter((_, j) => j !== i),
  }));

  /** Preview only — the server recomputes and stores its own figures. */
  const totals = useMemo(() => {
    let sub = 0, gst = 0, units = 0;
    for (const l of form.lines) {
      const q = Number(l.quantity) || 0;
      const c = Number(l.costPrice) || 0;
      const line = q * c;
      sub += line;
      gst += line * ((Number(l.gstRate) || 0) / 100);
      units += q;
    }
    const charges = (Number(form.freightCharges) || 0) + (Number(form.otherCharges) || 0);
    const net = Math.max(0, sub + gst + charges - (Number(form.invoiceDiscount) || 0));
    return { sub, gst, net, units, charges };
  }, [form]);

  const submit = (e) => {
    e.preventDefault();
    createMut.mutate({
      ...form,
      shopId,
      freightCharges: Number(form.freightCharges) || 0,
      otherCharges:   Number(form.otherCharges) || 0,
      invoiceDiscount: Number(form.invoiceDiscount) || 0,
      paidAmount:     Number(form.paidAmount) || 0,
      lines: form.lines.map((l) => ({
        product: l.product,
        size: l.size || '', color: l.color || '',
        quantity: Number(l.quantity) || 0,
        costPrice: Number(l.costPrice) || 0,
        gstRate: Number(l.gstRate) || 0,
      })),
    });
  };

  if (!shopId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <Truck className="w-12 h-12 text-gray-300 mb-4" />
        <p className="font-bold text-gray-800">Select a shop</p>
        <p className="text-sm text-gray-500 mt-1">Choose an active shop to record purchases.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Purchases / GRN</h1>
          <p className="text-sm text-gray-500">
            {activeShop?.name} · {purchases.length} record{purchases.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => snapshotMut.mutate()}
            disabled={snapshotMut.isPending}
            title="Record current inventory valuation as this year's opening stock"
            className="btn-secondary text-sm"
          >
            {snapshotMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            Record Opening Stock
          </button>
          <button onClick={() => { setForm(EMPTY); setOpen(true); }} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> New Purchase
          </button>
        </div>
      </div>

      {/* ── List ─────────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : purchases.length === 0 ? (
        <div className="ui-card py-16 text-center">
          <Package className="w-12 h-12 mx-auto text-gray-200 mb-3" />
          <p className="font-bold text-gray-800">No purchases yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Record a supplier invoice, then Post it to receive the goods into inventory.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {purchases.map((p) => (
            <div key={p._id} className="ui-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{p.supplierName}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLE[p.status]}`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.invoiceNumber} · {format(new Date(p.invoiceDate), 'dd MMM yyyy')} ·{' '}
                    {p.totalUnits} unit{p.totalUnits === 1 ? '' : 's'} · {p.lines?.length} line
                    {p.lines?.length === 1 ? '' : 's'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {p.lines?.slice(0, 3).map((l) => (
                      `${l.name}${l.color || l.size ? ` (${[l.color, l.size].filter(Boolean).join('/')})` : ''} ×${l.quantity}`
                    )).join(' · ')}
                    {p.lines?.length > 3 ? ` +${p.lines.length - 3} more` : ''}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-gray-900 tabular-nums">{inr(p.netTotal)}</p>
                  <p className="text-[11px] text-gray-500 tabular-nums">
                    goods {inr(p.subTotal)} + GST {inr(p.totalGst)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                {p.status === 'draft' && (
                  <button
                    onClick={() => postMut.mutate(p._id)}
                    disabled={postMut.isPending}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-60"
                  >
                    {postMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Post GRN — receive into inventory
                  </button>
                )}
                {p.status !== 'cancelled' && (
                  <button
                    onClick={() => {
                      const reason = window.prompt(
                        p.status === 'posted'
                          ? 'Cancelling reverses the inventory movement. Reason?'
                          : 'Cancel this draft? Reason (optional):'
                      );
                      if (reason !== null) cancelMut.mutate({ id: p._id, reason });
                    }}
                    disabled={cancelMut.isPending}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-bold transition"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Cancel
                  </button>
                )}
                {p.status === 'posted' && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 self-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Received {p.postedAt ? format(new Date(p.postedAt), 'dd MMM, hh:mm a') : ''}
                    {' '}— edit by cancelling and posting a correction
                  </span>
                )}
                {p.status === 'cancelled' && p.cancelReason && (
                  <span className="text-[11px] text-gray-500 self-center">Reason: {p.cancelReason}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── New purchase ─────────────────────────────────────────────────────── */}
      <Modal size="xl" open={open} onClose={() => setOpen(false)} title="New Purchase (Draft)">
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200">
            <AlertTriangle className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              Saving creates a <b>draft</b> — inventory is not touched. Use <b>Post GRN</b> on the
              list afterwards to receive the goods.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={lbl}>Supplier name *</label>
              <input required value={form.supplierName} onChange={(e) => upd('supplierName', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Supplier GSTIN</label>
              <input value={form.supplierGstin} onChange={(e) => upd('supplierGstin', e.target.value.toUpperCase())}
                maxLength={15} className={`${inp} font-mono uppercase`} /></div>
            <div><label className={lbl}>Invoice number *</label>
              <input required value={form.invoiceNumber} onChange={(e) => upd('invoiceNumber', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Invoice date *</label>
              <input required type="date" value={form.invoiceDate} onChange={(e) => upd('invoiceDate', e.target.value)} className={inp} /></div>
          </div>

          {/* ── Lines ── */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Items received</p>
              <button type="button" onClick={addLine}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-blue-600 text-white text-[11px] font-bold">
                <Plus className="w-3 h-3" /> Add line
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {form.lines.map((l, i) => {
                const p = byId[l.product];
                const isVariant = !!p?.trackVariantStock;
                // Only offer sizes/colours this product actually has.
                const sizes  = [...new Set((p?.variantStock || []).map((v) => v.size).filter(Boolean))];
                const colors = [...new Set((p?.variantStock || []).map((v) => v.color).filter(Boolean))];
                return (
                  <div key={i} className="p-3 space-y-2">
                    <div className="flex gap-2">
                      <select required value={l.product}
                        onChange={(e) => { updL(i, 'product', e.target.value); updL(i, 'size', ''); updL(i, 'color', ''); }}
                        className={`${inp} flex-1`}>
                        <option value="">Select product…</option>
                        {products.map((pr) => (
                          <option key={pr._id} value={pr._id}>
                            {pr.name}{pr.trackVariantStock ? ' (variants)' : ''}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => delLine(i)}
                        className="w-10 h-10 shrink-0 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {isVariant && (
                        <>
                          <select value={l.color} onChange={(e) => updL(i, 'color', e.target.value)} className={inp}>
                            <option value="">Colour…</option>
                            {colors.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <select value={l.size} onChange={(e) => updL(i, 'size', e.target.value)} className={inp}>
                            <option value="">Size…</option>
                            {sizes.map((sz) => <option key={sz} value={sz}>{sz}</option>)}
                          </select>
                        </>
                      )}
                      <input required type="number" min="1" placeholder="Qty" value={l.quantity}
                        onChange={(e) => updL(i, 'quantity', e.target.value)} className={inp} />
                      <input required type="number" min="0" step="0.01" placeholder="Cost/unit" value={l.costPrice}
                        onChange={(e) => updL(i, 'costPrice', e.target.value)} className={inp} />
                      <select value={l.gstRate} onChange={(e) => updL(i, 'gstRate', e.target.value)} className={inp}>
                        {GST_RATES.map((r) => <option key={r} value={r}>GST {r}%</option>)}
                      </select>
                    </div>

                    {isVariant && !l.color && !l.size && (
                      <p className="text-[11px] font-semibold text-amber-700">
                        This product tracks stock per variant — pick a colour and/or size.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label className={lbl}>Freight (₹)</label>
              <input type="number" min="0" value={form.freightCharges} onChange={(e) => upd('freightCharges', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Other charges</label>
              <input type="number" min="0" value={form.otherCharges} onChange={(e) => upd('otherCharges', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Invoice discount</label>
              <input type="number" min="0" value={form.invoiceDiscount} onChange={(e) => upd('invoiceDiscount', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Payment method</label>
              <select value={form.paymentMethod} onChange={(e) => upd('paymentMethod', e.target.value)} className={inp}>
                {['credit', 'cash', 'bank_transfer', 'upi', 'card', 'cheque', 'other'].map((m) =>
                  <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={lbl}>Input tax credit</label>
              <select value={form.itcStatus} onChange={(e) => upd('itcStatus', e.target.value)} className={inp}>
                <option value="review">Review (default — not claimed)</option>
                <option value="eligible">Eligible</option>
                <option value="not_eligible">Not eligible</option>
              </select></div>
            <div><label className={lbl}>Notes</label>
              <input value={form.notes} onChange={(e) => upd('notes', e.target.value)} className={inp} /></div>
          </div>

          {/* Preview — the server recomputes and its figures are what get stored. */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                ['Units', totals.units],
                ['Goods value', inr(totals.sub)],
                ['GST', inr(totals.gst)],
                ['Net total', inr(totals.net)],
              ].map(([k, v]) => (
                <div key={k} className="bg-white/80 rounded-lg py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{k}</p>
                  <p className="font-bold text-blue-800 tabular-nums">{v}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-blue-700 mt-2 text-center">
              Preview — the server recalculates these on save and stores its own figures.
            </p>
          </div>

          <button type="submit" disabled={createMut.isPending}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl transition flex items-center justify-center gap-2">
            {createMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save as Draft
          </button>
        </form>
      </Modal>
    </div>
  );
}
