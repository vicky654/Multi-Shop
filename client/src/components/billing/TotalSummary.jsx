import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TotalSummary = memo(function TotalSummary({ totals, taxRate, taxAmount, grandTotal }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-4 shadow-xl shadow-blue-400/30">
      {/* Decorative glow orbs */}
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-indigo-400/20 rounded-full blur-xl pointer-events-none" />

      {/* Line items */}
      <div className="relative space-y-1.5 text-sm mb-3">
        <div className="flex justify-between text-blue-200">
          <span>Subtotal</span>
          <motion.span
            key={totals.subtotal.toFixed(2)}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            className="font-semibold tabular-nums"
          >
            ₹{totals.subtotal.toFixed(2)}
          </motion.span>
        </div>

        <AnimatePresence>
          {totals.discount > 0 && (
            <motion.div
              key="discount"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex justify-between text-emerald-300 font-semibold overflow-hidden"
            >
              <span>Discount</span>
              <span className="tabular-nums">−₹{totals.discount.toFixed(2)}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {taxAmount > 0 && (
            <motion.div
              key="tax"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex justify-between text-blue-300 text-xs overflow-hidden"
            >
              <span>GST ({taxRate}%)</span>
              <span className="tabular-nums">+₹{taxAmount.toFixed(2)}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Grand total */}
      <div className="relative flex justify-between items-baseline border-t border-white/20 pt-3">
        <span className="text-xs font-semibold text-white/70 tracking-widest uppercase">Total</span>
        <motion.span
          key={grandTotal.toFixed(2)}
          initial={{ scale: 1.06, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="text-2xl font-black text-white tracking-tight tabular-nums"
        >
          ₹{grandTotal.toFixed(2)}
        </motion.span>
      </div>
    </div>
  );
});

export default TotalSummary;
