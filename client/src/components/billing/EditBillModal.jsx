import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Trash2, Plus, Minus, Loader2, AlertTriangle, ShieldAlert, Search, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { salesApi } from '../../api/sales.api';
import { productsApi } from '../../api/products.api';
import NumberInput from '../ui/NumberInput';

const GST_PRESETS = [0, 5, 12, 18, 28];
const METHODS = ['cash', 'card', 'upi', 'credit'];

/**
 * EditBillModal — modify a completed bill, with confirmation and a mandatory reason.
 *
 * Totals, tax and discount are recalculated live from the edited lines and the
 * figures shown here mirror what the server recomputes on save. The server
 * applies stock as a delta, corrects the customer's spend and credit position,
 * and appends an audit entry recording who changed what and why.
 *
 * Props: sale (populated), onClose, onSaved(updatedSale)
 */
export default function EditBillModal({ sale, onClose, onSaved }) {
  const qc = useQueryClient();
  const shopId = sale?.shopId?._id || sale?.shopId;

  // ── Editable working copy ───────────────────────────────────────────────────
  const [lines, setLines] = useState(() =>
    (sale?.items || []).map((i) => ({
      key:           crypto.randomUUID(),
      productId:     i.product?._id || i.product,
      name:          i.name,
      price:         Number(i.price) || 0,
      quantity:      Number(i.quantity) || 1,
      discount:      Number(i.discount) || 0,
      selectedSize:  i.selectedSize  || '',
      selectedColor: i.selectedColor || '',
      sku:           i.sku || i.product?.sku || '',
    }))
  );
  const [taxRate,       setTaxRate]       = useState(Number(sale?.taxRate) || 0);
  const [paymentMethod, setPaymentMethod] = useState(sale?.paymentMethod || 'cash');
  const [dueAmount,     setDueAmount]     = useState(Number(sale?.dueAmount) || 0);
  const [notes,         setNotes]         = useState(sale?.notes || '');
  const [reason,        setReason]        = useState('');
  const [confirming,    setConfirming]    = useState(false);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: prodData, isFetching: searching } = useQuery({
    queryKey: ['edit-bill-products', shopId, debounced],
    queryFn:  () => productsApi.getAll({ shopId, search: debounced, limit: 8 }),
    enabled:  !!shopId && debounced.trim().length > 1,
  });
  const results = prodData?.data || [];

  // ── Live recalculation (mirrors the server) ─────────────────────────────────
  const totals = useMemo(() => {
    let subtotal = 0, discount = 0;
    for (const l of lines) {
      const raw = (Number(l.price) || 0) * (Number(l.quantity) || 0);
      const d   = raw * ((Number(l.discount) || 0) / 100);
      subtotal += raw;
      discount += d;
    }
    const beforeTax = subtotal - discount;
    const tax       = beforeTax * ((Number(taxRate) || 0) / 100);
    return {
      subtotal,
      discount,
      beforeTax,
      tax,
      grandTotal: beforeTax + tax,
    };
  }, [lines, taxRate]);

  const originalTotal = Number(sale?.totalAmount) || 0;
  const delta         = totals.grandTotal - originalTotal;

  // ── Line mutations ──────────────────────────────────────────────────────────
  const patchLine = (key, patch) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key) => setLines((prev) => prev.filter((l) => l.key !== key));

  const addProduct = (p) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p._id && !l.selectedSize && !l.selectedColor);
      if (existing) {
        return prev.map((l) => (l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, {
        key:           crypto.randomUUID(),
        productId:     p._id,
        name:          p.name,
        price:         Number(p.price) || 0,
        quantity:      1,
        discount:      0,
        selectedSize:  '',
        selectedColor: '',
        sku:           p.sku || '',
      }];
    });
    setSearch('');
    setDebounced('');
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: () => salesApi.update(sale._id, {
      items: lines.map((l) => ({
        productId:     l.productId,
        name:          l.name,
        price:         Number(l.price),
        quantity:      Number(l.quantity),
        discount:      Number(l.discount) || 0,
        selectedSize:  l.selectedSize,
        selectedColor: l.selectedColor,
      })),
      taxRate:  Number(taxRate),
      paymentMethod,
      ...(paymentMethod === 'credit' ? { dueAmount: Number(dueAmount) || 0 } : {}),
      notes,
      reason: reason.trim(),
    }),
    onSuccess: (res) => {
      toast.success('Bill updated — stock and totals recalculated');
      qc.invalidateQueries(['sales']);
      qc.invalidateQueries(['products']);
      qc.invalidateQueries(['products-billing']);
      onSaved?.(res.data.sale);
    },
    onError: (e) => {
      toast.error(e.message || 'Could not update this bill');
      setConfirming(false);
    },
  });

  // ── Validation ──────────────────────────────────────────────────────────────
  const reasonOk  = reason.trim().length >= 3;
  const linesOk   = lines.length > 0 && lines.every((l) => Number(l.quantity) > 0 && Number(l.price) >= 0);
  const creditOk  = paymentMethod !== 'credit' || !!(sale?.customerId?._id || sale?.customerId);
  const canSave   = reasonOk && linesOk && creditOk && !saveMut.isPending;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" data-testid="edit-bill-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <div>
              <h2 className="font-bold text-gray-900 leading-tight">Modify Bill</h2>
              <p className="text-[11px] text-gray-400 font-semibold">
                {sale?.invoiceNumber}
                {sale?.editCount > 0 && ` · edited ${sale.editCount}×`}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={saveMut.isPending} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-900 leading-snug">
              This bill is already completed. Saving adjusts <strong>stock by the difference</strong>,
              recalculates tax, discount and totals, corrects the customer's balance,
              and records the change against your name.
            </p>
          </div>

          {/* Add item */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Add an item — search by name, SKU or barcode…"
              className="w-full h-10 pl-10 pr-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-400 transition"
            />
            {debounced.trim().length > 1 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-56 overflow-y-auto scrollbar-thin">
                {searching ? (
                  <div className="flex items-center justify-center py-4 text-gray-400 text-sm gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Searching…
                  </div>
                ) : results.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-400">No products found</p>
                ) : results.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); addProduct(p); }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0 transition"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                      <p className="text-[11px] text-gray-400">{p.sku || 'No SKU'} · stock {p.stock}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-800 shrink-0 ml-3">₹{p.price}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lines */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="text-left py-2.5 px-3">Item</th>
                  <th className="w-28 py-2.5 px-2 text-center">Qty</th>
                  <th className="w-24 py-2.5 px-2 text-center">Rate ₹</th>
                  <th className="w-20 py-2.5 px-2 text-center">Disc %</th>
                  <th className="w-24 py-2.5 px-3 text-right">Total</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.length === 0 ? (
                  <tr><td colSpan="6" className="py-8 text-center text-sm text-gray-400 italic">
                    A bill must have at least one item.
                  </td></tr>
                ) : lines.map((l) => {
                  const lineTotal = (Number(l.price) || 0) * (Number(l.quantity) || 0) * (1 - (Number(l.discount) || 0) / 100);
                  return (
                    <tr key={l.key} data-testid={`edit-line-${l.productId}`}>
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-gray-800 truncate max-w-[200px]">{l.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">
                          {[l.sku, l.selectedSize, l.selectedColor].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => patchLine(l.key, { quantity: Math.max(1, l.quantity - 1) })}
                            className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <NumberInput
                            min="1"
                            step="0.001"
                            value={l.quantity}
                            onCommit={(v) => patchLine(l.key, { quantity: Math.max(0.001, parseFloat(v) || 1) })}
                            className="w-12 h-7 text-xs text-center border border-gray-200 rounded font-semibold tabular-nums outline-none focus:border-blue-400"
                          />
                          <button
                            type="button"
                            onClick={() => patchLine(l.key, { quantity: l.quantity + 1 })}
                            className="w-6 h-6 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <NumberInput
                          min="0"
                          step="0.01"
                          value={l.price}
                          onCommit={(v) => patchLine(l.key, { price: Math.max(0, parseFloat(v) || 0) })}
                          className="w-full h-7 text-xs text-center border border-gray-200 rounded font-semibold tabular-nums outline-none focus:border-blue-400"
                        />
                      </td>
                      <td className="py-2.5 px-2">
                        <NumberInput
                          min="0"
                          max="100"
                          value={l.discount}
                          onCommit={(v) => patchLine(l.key, { discount: Math.min(100, Math.max(0, parseFloat(v) || 0)) })}
                          className="w-full h-7 text-xs text-center border border-gray-200 rounded font-semibold tabular-nums outline-none focus:border-blue-400"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-900 tabular-nums">
                        ₹{lineTotal.toFixed(2)}
                      </td>
                      <td className="py-2.5 pr-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(l.key)}
                          title="Remove line"
                          className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tax + payment + totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">GST / Tax rate</span>
                <div className="flex flex-wrap gap-1.5">
                  {GST_PRESETS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setTaxRate(g)}
                      className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg border transition ${
                        Number(taxRate) === g
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {g}%
                    </button>
                  ))}
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="w-16 h-7 text-[11px] px-2 border border-gray-200 rounded-lg text-center font-bold outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Payment method</span>
                <div className="flex flex-wrap gap-1.5">
                  {METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`px-3 py-1 text-[11px] font-extrabold rounded-lg border uppercase transition ${
                        paymentMethod === m
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {paymentMethod === 'credit' && (
                  <div className="mt-2">
                    <span className="block text-[10px] font-bold text-amber-700 uppercase">Credit due (₹)</span>
                    <input
                      type="number"
                      min="0"
                      value={dueAmount}
                      onChange={(e) => setDueAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full h-8 px-2 border border-amber-200 rounded-lg text-xs font-bold outline-none focus:border-amber-400"
                    />
                    {!creditOk && (
                      <p className="text-[11px] font-semibold text-red-500 mt-1">
                        This bill has no customer — credit needs one.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Notes</span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-400 transition resize-none"
                />
              </div>
            </div>

            {/* Recalculated totals with the delta made obvious */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm h-fit">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span><span className="tabular-nums">₹{totals.subtotal.toFixed(2)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span><span className="tabular-nums">−₹{totals.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500">
                <span>Taxable value</span><span className="tabular-nums">₹{totals.beforeTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>GST ({taxRate}%)</span><span className="tabular-nums">+₹{totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-gray-200">
                <span className="text-[10px] font-bold text-gray-400 uppercase">New total</span>
                <span className="text-2xl font-black text-gray-900 tabular-nums" data-testid="edit-new-total">
                  ₹{totals.grandTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs pt-1">
                <span className="text-gray-400">Was ₹{originalTotal.toFixed(2)}</span>
                {Math.abs(delta) >= 0.01 && (
                  <span className={`font-black tabular-nums ${delta > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {delta > 0 ? '+' : '−'}₹{Math.abs(delta).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Mandatory reason */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Reason for modification <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Wrong quantity billed for item 2"
              data-testid="edit-reason"
              maxLength={300}
              className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-400 transition"
            />
            {reason && !reasonOk && (
              <p className="text-[11px] font-semibold text-red-500 mt-1">Please give at least 3 characters.</p>
            )}
          </div>
        </div>

        {/* Footer — explicit confirmation before committing */}
        <div className="shrink-0 border-t border-gray-200 p-4 bg-gray-50/60">
          {confirming ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-800 text-center">
                Save changes to {sale?.invoiceNumber}? Total{' '}
                <span className="tabular-nums">₹{originalTotal.toFixed(2)} → ₹{totals.grandTotal.toFixed(2)}</span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={saveMut.isPending}
                  className="flex-1 h-11 border border-gray-200 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-100 transition disabled:opacity-40"
                >
                  Go back
                </button>
                <button
                  type="button"
                  onClick={() => saveMut.mutate()}
                  disabled={saveMut.isPending}
                  data-testid="edit-confirm-save"
                  className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-40"
                >
                  {saveMut.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    : <><Save className="w-4 h-4" /> Yes, modify this bill</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 border border-gray-200 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={() => setConfirming(true)}
                data-testid="edit-save-button"
                className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 transition"
              >
                <Save className="w-4 h-4" /> Review & Save
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
