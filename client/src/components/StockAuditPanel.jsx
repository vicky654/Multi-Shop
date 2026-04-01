import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, AlertTriangle, ClipboardCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '../api/products.api';

/**
 * StockAuditPanel — inline audit mode overlaid on the Inventory page.
 *
 * Props:
 *   products  — current product list from React Query
 *   shopId    — active shop
 *   onClose   — callback to exit audit mode
 *
 * Flow:
 *   1. User enters physical count for each product (pre-filled with DB stock).
 *   2. Discrepancy column updates live.
 *   3. "Confirm Audit" submits all changed items to PATCH /products/audit/bulk.
 *   4. React Query cache is invalidated on success.
 */
export default function StockAuditPanel({ products, shopId, onClose }) {
  const qc = useQueryClient();

  // Map productId → physical count string (starts as current DB stock)
  const [counts, setCounts] = useState(
    () => Object.fromEntries(products.map((p) => [p._id, String(p.stock)]))
  );

  const setCount = (id, val) =>
    setCounts((prev) => ({ ...prev, [id]: val }));

  // Compute discrepancies
  const rows = useMemo(() =>
    products.map((p) => {
      const physical  = parseInt(counts[p._id], 10);
      const isValid   = !isNaN(physical) && physical >= 0;
      const discrepancy = isValid ? physical - p.stock : null;
      return { ...p, physical, isValid, discrepancy };
    }),
    [products, counts]
  );

  const changedRows   = rows.filter((r) => r.isValid && r.discrepancy !== 0);
  const totalShrink   = changedRows.filter((r) => r.discrepancy < 0).reduce((s, r) => s + Math.abs(r.discrepancy * r.costPrice), 0);
  const totalGain     = changedRows.filter((r) => r.discrepancy > 0).reduce((s, r) => s + r.discrepancy * r.costPrice, 0);

  const mut = useMutation({
    mutationFn: () => productsApi.bulkAuditAdjust(shopId, changedRows.map((r) => ({
      productId:     r._id,
      physicalCount: r.physical,
    }))),
    onSuccess: (res) => {
      toast.success(`Audit complete — ${res.data.adjusted} product(s) adjusted`);
      qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-amber-500 text-white">
        <div className="flex items-center gap-2.5">
          <ClipboardCheck className="w-5 h-5" />
          <div>
            <p className="font-bold text-sm">Stock Audit Mode</p>
            <p className="text-xs text-amber-100">Enter physical counts — discrepancies are highlighted automatically</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Summary bar */}
      {changedRows.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2.5 bg-white border-b border-amber-200 text-sm">
          <span className="font-semibold text-gray-700">
            {changedRows.length} discrepanc{changedRows.length === 1 ? 'y' : 'ies'} found
          </span>
          {totalShrink > 0 && (
            <span className="text-red-600 font-medium">
              Shrinkage: ₹{totalShrink.toLocaleString('en-IN')} at cost
            </span>
          )}
          {totalGain > 0 && (
            <span className="text-green-600 font-medium">
              Gain: +₹{totalGain.toLocaleString('en-IN')} at cost
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white border-b border-amber-100 text-left text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 font-medium text-center">System Stock</th>
              <th className="px-4 py-2.5 font-medium text-center">Physical Count</th>
              <th className="px-4 py-2.5 font-medium text-center">Discrepancy</th>
              <th className="px-4 py-2.5 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-50">
            {rows.map((r) => {
              const hasDisc = r.isValid && r.discrepancy !== 0;
              const isNeg   = r.discrepancy < 0;

              return (
                <tr
                  key={r._id}
                  className={`transition-colors ${hasDisc ? (isNeg ? 'bg-red-50' : 'bg-green-50') : 'bg-white'}`}
                >
                  {/* Name */}
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900 truncate max-w-[180px]">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.category}</p>
                  </td>

                  {/* System stock */}
                  <td className="px-4 py-2.5 text-center">
                    <span className="font-bold text-gray-700 tabular-nums">{r.stock}</span>
                    <span className="text-gray-400 ml-1 text-xs">{r.unit || 'pcs'}</span>
                  </td>

                  {/* Physical count input */}
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="number"
                      min="0"
                      value={counts[r._id]}
                      onChange={(e) => setCount(r._id, e.target.value)}
                      className={`w-20 h-8 text-center text-sm font-bold border-2 rounded-lg focus:outline-none tabular-nums transition ${
                        hasDisc
                          ? isNeg
                            ? 'border-red-300 bg-red-50 focus:border-red-500 text-red-700'
                            : 'border-green-300 bg-green-50 focus:border-green-500 text-green-700'
                          : 'border-gray-200 bg-white focus:border-blue-500 text-gray-900'
                      }`}
                    />
                  </td>

                  {/* Discrepancy */}
                  <td className="px-4 py-2.5 text-center">
                    {r.isValid && r.discrepancy !== 0 ? (
                      <span className={`font-black tabular-nums ${isNeg ? 'text-red-600' : 'text-green-600'}`}>
                        {r.discrepancy > 0 ? '+' : ''}{r.discrepancy}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Status icon */}
                  <td className="px-4 py-2.5 text-center">
                    {!r.isValid ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />
                    ) : r.discrepancy === 0 ? (
                      <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                    ) : (
                      <XCircle className={`w-4 h-4 mx-auto ${isNeg ? 'text-red-500' : 'text-amber-500'}`} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-amber-200 gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium transition"
        >
          Cancel
        </button>

        <button
          onClick={() => mut.mutate()}
          disabled={changedRows.length === 0 || mut.isPending}
          className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition"
        >
          {mut.isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          <ClipboardCheck className="w-4 h-4" />
          Confirm Audit
          {changedRows.length > 0 && (
            <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
              {changedRows.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
