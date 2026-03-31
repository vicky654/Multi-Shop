import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, PackagePlus, Loader2, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { insightsApi } from '../api/insights.api';
import useShopStore    from '../store/shopStore';

const urgencyBadge = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
};

export default function RestockModal({ open, onClose }) {
  const { activeShop } = useShopStore();
  const shopId         = activeShop?._id;
  const queryClient    = useQueryClient();
  const [qtys, setQtys]  = useState({});
  const [done, setDone]  = useState(false);

  const { data, isLoading } = useQuery({
    queryKey:  ['restock-suggestions', shopId],
    queryFn:   () => insightsApi.restockSuggestions({ shopId }),
    enabled:   open && !!shopId,
    staleTime: 2 * 60_000,
  });

  const suggestions = data?.data?.suggestions || [];

  const { mutate: doRestock, isPending } = useMutation({
    mutationFn: () => {
      const items = suggestions.map((s) => ({
        productId: s._id,
        addQty:    qtys[s._id] ?? s.suggestedQty,
      }));
      return insightsApi.bulkRestock({ shopId, items });
    },
    onSuccess: (res) => {
      toast.success(`${res.data?.data?.updated || 0} product(s) restocked!`);
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['restock-suggestions'] });
      setDone(true);
    },
    onError: () => toast.error('Restock failed, please try again'),
  });

  const handleClose = () => { setDone(false); setQtys({}); onClose(); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900">Smart Restock</h2>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : done ? (
            <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="font-bold text-gray-900 text-lg">All restocked!</p>
              <p className="text-sm text-gray-500">Stock levels have been updated successfully.</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="font-semibold text-gray-800">All stocked up!</p>
              <p className="text-sm text-gray-500">No products need restocking right now.</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {suggestions.map((s) => (
                <div key={s._id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${urgencyBadge[s.urgency]}`}>
                        {s.urgency}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500">{s.stock} left</span>
                      {s.soldLast7Days > 0 && (
                        <span className="text-xs text-blue-500">{s.soldLast7Days} sold/week</span>
                      )}
                    </div>
                  </div>
                  {/* Qty input */}
                  <div className="shrink-0 flex items-center gap-1">
                    <span className="text-xs text-gray-400">+</span>
                    <input
                      type="number"
                      min="1"
                      value={qtys[s._id] ?? s.suggestedQty}
                      onChange={(e) => setQtys((v) => ({ ...v, [s._id]: Number(e.target.value) }))}
                      className="w-16 text-center text-sm font-semibold border border-gray-300 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!done && suggestions.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
              <span>Quantities are AI-suggested based on sales velocity. Edit before confirming.</span>
            </div>
            <button
              onClick={() => doRestock()}
              disabled={isPending}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Restocking…</>
              ) : (
                <><Zap className="w-4 h-4" /> Restock All ({suggestions.length} items)</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
