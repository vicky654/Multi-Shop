import { memo } from 'react';
import { Receipt } from 'lucide-react';
import { motion } from 'framer-motion';

const PayButton = memo(function PayButton({
  isEmpty, isPending, canCreate, grandTotal, onClick,
}) {
  const disabled = isEmpty || isPending || !canCreate;

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      data-testid="pay-button"
      whileTap={disabled ? undefined : { scale: 0.98 }}
      whileHover={disabled ? undefined : { scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      title={!canCreate ? "You don't have permission to create sales" : undefined}
      className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600
        hover:from-blue-700 hover:to-indigo-700
        disabled:opacity-50 disabled:cursor-not-allowed
        text-white font-black rounded-2xl
        flex items-center justify-center gap-2.5 text-lg
        shadow-xl shadow-blue-400/40
        transition-colors duration-150 select-none"
    >
      {isPending ? (
        <>
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>Processing…</span>
        </>
      ) : (
        <>
          <Receipt className="w-5 h-5 shrink-0" />
          <span>Pay ₹{grandTotal.toFixed(2)}</span>
        </>
      )}
    </motion.button>
  );
});

export default PayButton;
