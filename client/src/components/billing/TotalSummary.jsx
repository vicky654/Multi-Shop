import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const GST_PRESETS = [
  { label: 'Shop', value: 'shop' },
  { label: '0%', value: 0 },
  { label: '5%', value: 5 },
  { label: '12%', value: 12 },
  { label: '18%', value: 18 },
  { label: '28%', value: 28 },
  { label: 'Custom', value: 'custom' },
];

const TotalSummary = memo(function TotalSummary({
  totals,
  taxPreset,
  shopTaxRate,
  customTaxVal,
  onTaxPresetChange,
  onCustomTaxValChange,
  taxAmount,
  grandTotal,
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3.5">
      {/* Inline Tax Preset Selector */}
      <div className="space-y-1.5">
        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tax Preset / GST</span>
        <div className="flex gap-1 flex-wrap">
          {GST_PRESETS.map((g) => {
            const isActive = taxPreset === g.value;
            const label = g.value === 'shop' ? `Shop (${shopTaxRate}%)` : g.label;
            return (
              <button
                key={String(g.value)}
                type="button"
                onClick={() => onTaxPresetChange(g.value)}
                className={`px-2 py-1 text-[10px] font-extrabold rounded-lg border transition-all ${
                  isActive
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Custom Tax Input */}
        <AnimatePresence>
          {taxPreset === 'custom' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-1.5 pt-1 overflow-hidden"
            >
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={customTaxVal}
                onChange={(e) => onCustomTaxValChange(e.target.value)}
                placeholder="GST %"
                className="w-20 h-7 text-xs px-2 border border-gray-200 rounded-lg outline-none focus:border-blue-400 font-semibold text-center bg-gray-50"
              />
              <span className="text-[10px] text-gray-400 font-bold uppercase">% GST Value</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Numerical Subtotal Calculations */}
      <div className="space-y-1.5 pt-2 border-t border-gray-100 text-sm font-semibold text-gray-600">
        <div className="flex justify-between">
          <span className="text-gray-400 font-medium">Subtotal</span>
          <span className="tabular-nums text-gray-700">₹{totals.subtotal.toFixed(2)}</span>
        </div>

        <AnimatePresence>
          {totals.discount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex justify-between text-green-600 overflow-hidden"
            >
              <span>Discount</span>
              <span className="tabular-nums">−₹{totals.discount.toFixed(2)}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {taxAmount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex justify-between text-gray-400 text-xs overflow-hidden"
            >
              <span>GST Amount</span>
              <span className="tabular-nums">+₹{taxAmount.toFixed(2)}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Grand Total */}
      <div className="flex justify-between items-baseline pt-2.5 border-t border-gray-100">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Grand Total</span>
        <motion.span
          key={grandTotal.toFixed(2)}
          initial={{ scale: 1.05, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-2xl font-black text-gray-900 tabular-nums"
        >
          ₹{grandTotal.toFixed(2)}
        </motion.span>
      </div>
    </div>
  );
});

export default TotalSummary;
