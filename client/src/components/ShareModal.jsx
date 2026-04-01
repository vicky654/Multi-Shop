import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, MessageCircle, Send, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';

function buildOrderText(sale) {
  const items = (sale.items || [])
    .map((item) => {
      const line = item.price * item.quantity * (1 - (item.discount || 0) / 100);
      return `  • ${item.name} ×${item.quantity}  ₹${line.toFixed(0)}`;
    })
    .join('\n');

  return [
    `🧾 *Invoice: ${sale.invoiceNumber}*`,
    `📅 ${new Date(sale.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    ``,
    items,
    ``,
    `💰 *Total: ₹${sale.totalAmount?.toLocaleString('en-IN')}*`,
    `💳 Payment: ${(sale.paymentMethod || '').toUpperCase()}`,
    sale.customerId?.name ? `👤 Customer: ${sale.customerId.name}` : '',
  ].filter(Boolean).join('\n');
}

export default function ShareModal({ sale, onClose }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!sale) return null;

  const text    = buildOrderText(sale);
  const encoded = encodeURIComponent(text);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: `Invoice ${sale.invoiceNumber}`, text });
      onClose();
    } catch { /* user cancelled — no-op */ }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
      onClose();
    } catch {
      toast.error('Copy failed — try manually');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Sheet */}
        <motion.div
          className="relative w-full max-w-sm bg-[#1E293B] border border-[#334155] rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 overflow-hidden"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 380 }}
        >
          {/* Drag handle (mobile only) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-[#475569]" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div>
              <p className="text-[#E2E8F0] font-semibold text-sm">Share Order</p>
              <p className="text-[#64748B] text-xs mt-0.5 font-mono">{sale.invoiceNumber}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#334155] hover:bg-[#475569] flex items-center justify-center text-[#94A3B8] transition-colors touch-manipulation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Text preview */}
          <div className="mx-5 mb-4 p-3 bg-[#0F172A] rounded-2xl border border-[#334155]">
            <pre className="text-[11px] text-[#94A3B8] whitespace-pre-wrap font-mono leading-relaxed line-clamp-6 overflow-hidden">
              {text}
            </pre>
          </div>

          {/* Action buttons */}
          <div className="px-5 pb-6 space-y-2.5">
            {/* Native share — only on mobile browsers that support it */}
            {canShare && (
              <button
                onClick={handleNativeShare}
                className="w-full flex items-center justify-center gap-2.5 h-12 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-2xl text-white font-semibold text-sm transition-colors touch-manipulation"
              >
                <Share2 className="w-4 h-4" />
                Share via…
              </button>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              {/* WhatsApp */}
              <a
                href={`https://wa.me/?text=${encoded}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex items-center justify-center gap-2 h-12 bg-[#25D366]/10 hover:bg-[#25D366]/20 active:bg-[#25D366]/30 border border-[#25D366]/30 rounded-2xl text-[#25D366] font-medium text-sm transition-colors touch-manipulation"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>

              {/* Copy */}
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 h-12 bg-[#334155] hover:bg-[#475569] active:bg-[#1E293B] rounded-2xl text-[#E2E8F0] font-medium text-sm transition-colors touch-manipulation"
              >
                <Copy className="w-4 h-4" />
                Copy Text
              </button>
            </div>

            {/* Telegram */}
            <a
              href={`https://t.me/share/url?url=&text=${encoded}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2.5 h-11 bg-[#334155] hover:bg-[#475569] rounded-2xl text-[#94A3B8] hover:text-[#E2E8F0] font-medium text-sm transition-colors touch-manipulation"
            >
              <Send className="w-4 h-4" />
              Telegram
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
