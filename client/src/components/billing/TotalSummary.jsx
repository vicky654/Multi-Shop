import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TotalSummary = memo(function TotalSummary({ totals, taxRate, taxAmount, grandTotal }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="space-y-2 text-sm mb-3">
        <div className="flex justify-between text-gray-500">
          <span>Subtotal</span>
          <motion.span
            key={totals.subtotal.toFixed(2)}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            className="tabular-nums text-gray-700"
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
              key="tax"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex justify-between text-gray-400 text-xs overflow-hidden"
            >
              <span>GST ({taxRate}%)</span>
              <span className="tabular-nums">+₹{taxAmount.toFixed(2)}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-between items-baseline border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-400 uppercase tracking-wide">Total</span>
        <motion.span
          key={grandTotal.toFixed(2)}
          initial={{ scale: 1.04, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="text-2xl text-gray-900 tabular-nums"
        >
          ₹{grandTotal.toFixed(2)}
        </motion.span>
      </div>
    </div>
  );
});

export default TotalSummary;
