import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '../api/products.api';
import Modal from './Modal';

const REASONS = [
  { value: 'restock',    label: 'Restock / Received',   color: 'text-green-700  bg-green-50  border-green-200' },
  { value: 'damage',     label: 'Damaged / Expired',     color: 'text-red-700    bg-red-50    border-red-200' },
  { value: 'theft',      label: 'Theft / Shrinkage',     color: 'text-red-700    bg-red-50    border-red-200' },
  { value: 'correction', label: 'Data Correction',        color: 'text-blue-700   bg-blue-50   border-blue-200' },
  { value: 'return',     label: 'Customer Return',        color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { value: 'audit',      label: 'Audit Adjustment',       color: 'text-amber-700  bg-amber-50  border-amber-200' },
];

export default function StockAdjustModal({ product, open, onClose }) {
  const qc     = useQueryClient();
  const [delta,  setDelta]  = useState('');
  const [reason, setReason] = useState('restock');
  const [notes,  setNotes]  = useState('');

  const mut = useMutation({
    mutationFn: () => productsApi.adjustStock(product._id, {
      delta: parseInt(delta, 10),
      reason,
      notes,
    }),
    onSuccess: (res) => {
      const { previousStock, newStock } = res.data;
      toast.success(`Stock updated: ${previousStock} → ${newStock}`);
      qc.invalidateQueries({ queryKey: ['products'] });
      handleClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleClose = () => {
    setDelta(''); setReason('restock'); setNotes('');
    onClose();
  };

  const num      = parseInt(delta, 10);
  const isValid  = !isNaN(num) && num !== 0;
  const newStock = isValid ? (product?.stock ?? 0) + num : null;
  const isNeg    = num < 0;

  return (
    <Modal open={open} onClose={handleClose} title={`Adjust Stock — ${product?.name}`}>
      <div className="space-y-4">

        {/* Current stock */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
          <span className="text-sm text-gray-500">Current stock</span>
          <span className="text-xl font-black text-gray-900 tabular-nums">
            {product?.stock ?? 0} <span className="text-sm font-medium text-gray-400">{product?.unit || 'pcs'}</span>
          </span>
        </div>

        {/* Delta input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Quantity change
            <span className="ml-1 text-xs text-gray-400 font-normal">
              (use − for reduction, + for addition)
            </span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDelta((v) => String((parseInt(v, 10) || 0) - 1))}
              className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition touch-manipulation"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="0"
              className="flex-1 h-11 text-center text-lg font-black border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 tabular-nums"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setDelta((v) => String((parseInt(v, 10) || 0) + 1))}
              className="w-11 h-11 rounded-xl bg-green-50 hover:bg-green-100 text-green-600 flex items-center justify-center transition touch-manipulation"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* New stock preview */}
          {isValid && (
            <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              newStock < 0 ? 'bg-red-50 text-red-700' : isNeg ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
            }`}>
              {newStock < 0 && <AlertTriangle className="w-4 h-4 shrink-0" />}
              New stock will be: <span className="font-black ml-1">{newStock} {product?.unit || 'pcs'}</span>
              {newStock < 0 && <span className="ml-1">(cannot go below 0)</span>}
            </div>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason *</label>
          <div className="grid grid-cols-2 gap-2">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={`px-3 py-2.5 rounded-xl border text-xs font-semibold text-left transition ${
                  reason === r.value ? r.color + ' border-current' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. damaged in transit, physical count mismatch…"
            className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Submit */}
        <button
          onClick={() => mut.mutate()}
          disabled={!isValid || newStock < 0 || mut.isPending}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
        >
          {mut.isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          Confirm Adjustment
        </button>
      </div>
    </Modal>
  );
}
