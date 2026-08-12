import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * BillingMobileSheet — bottom sheet for the POS panels on small screens.
 *
 * The desktop POS keeps customer, tax and payment permanently on screen in side
 * columns. There is no room for that on a phone, and the cart has to stay
 * visible while billing, so those panels move behind a sheet instead of pushing
 * the cart off-screen.
 *
 * A sheet rather than a centred modal: it comes up from the thumb, and a
 * part-height sheet keeps the cart total visible behind it for reassurance.
 */
export default function BillingMobileSheet({ open, onClose, title, children }) {
  // Lock the page behind the sheet, or dragging inside it scrolls the cart too.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden flex items-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            className="relative w-full max-h-[85vh] flex flex-col bg-white rounded-t-2xl shadow-2xl"
          >
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100">
              {/* Grab handle — signals the sheet is dismissible. */}
              <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 w-10 h-1 rounded-full bg-white/60" />
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{title}</h3>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 pb-safe">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
