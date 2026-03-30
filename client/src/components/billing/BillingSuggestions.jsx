import { useQuery }  from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus } from 'lucide-react';
import { aiApi } from '../../api/sales.api';

export default function BillingSuggestions({ cart, shopId, onAdd }) {
  const productIds = cart.map((i) => i.productId || i._id).filter(Boolean).join(',');

  const { data, isLoading } = useQuery({
    queryKey: ['billing-suggestions', shopId, productIds],
    queryFn:  () => aiApi.suggestions({ shopId, productIds }),
    enabled:  !!shopId && cart.length > 0 && productIds.length > 0,
    staleTime: 120_000,
  });

  const suggestions = (data?.data?.suggestions || []).filter(
    (s) => !cart.some((c) => (c.productId || c._id) === String(s.productId))
  );

  if (cart.length === 0 || (!isLoading && suggestions.length === 0)) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden"
      >
        <div className="px-1 py-2">
          {/* Header */}
          <div className="flex items-center gap-1.5 mb-2 px-0.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Frequently bought together
            </span>
          </div>

          {isLoading ? (
            <div className="flex gap-2">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-9 w-32 rounded-xl bg-gray-100 animate-pulse shrink-0" />
              ))}
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {suggestions.map((s) => (
                <motion.button
                  key={s.productId}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onAdd(s)}
                  className="flex items-center gap-1.5 shrink-0 pl-2.5 pr-2 py-1.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl text-violet-800 text-xs font-semibold transition-colors"
                >
                  <span className="truncate max-w-[100px]">{s.name}</span>
                  <span className="text-violet-500 font-bold">₹{Math.round(s.price)}</span>
                  <span className="w-4 h-4 rounded-full bg-violet-500 text-white flex items-center justify-center shrink-0">
                    <Plus className="w-2.5 h-2.5" />
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
