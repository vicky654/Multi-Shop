/**
 * MiniTip — dismissable contextual tip, stored in localStorage.
 *
 * Usage:
 *   <MiniTip id="inventory-csv" message="You can upload CSV to add products faster" />
 *   <MiniTip id="billing-private" message="Enable Private Mode to hide a sale from reports" />
 *
 * Each tip is dismissed independently. Once dismissed, it never shows again.
 * Pass reset={true} to force re-show (useful in dev).
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lightbulb } from 'lucide-react';

const KEY = (id) => `multishop_tip_${id}`;

export default function MiniTip({ id, message, reset = false }) {
  const [visible, setVisible] = useState(() => {
    if (reset) return true;
    return localStorage.getItem(KEY(id)) !== 'true';
  });

  const dismiss = () => {
    localStorage.setItem(KEY(id), 'true');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
          exit={{   opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.22 }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-2.5 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-2xl">
            <Lightbulb className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="flex-1 text-sm text-blue-700 leading-relaxed">{message}</p>
            <button
              onClick={dismiss}
              aria-label="Dismiss tip"
              className="p-0.5 text-blue-400 hover:text-blue-600 shrink-0 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
