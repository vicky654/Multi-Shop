import { memo } from 'react';
import { Receipt } from 'lucide-react';

const PayButton = memo(function PayButton({
  isEmpty, isPending, canCreate, grandTotal, onClick,
}) {
  const disabled = isEmpty || isPending || !canCreate;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={!canCreate ? "You don't have permission to create sales" : undefined}
      className="w-full h-16 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
        disabled:opacity-50 disabled:cursor-not-allowed
        text-white font-black rounded-2xl transition-all
        flex items-center justify-center gap-3 text-xl
        shadow-2xl shadow-blue-400/40 hover:shadow-blue-500/50
        hover:scale-[1.01] active:scale-[0.99]"
    >
      {isPending ? (
        <>
          <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
          Processing…
        </>
      ) : (
        <>
          <Receipt className="w-6 h-6" />
          Pay ₹{grandTotal.toFixed(2)}
        </>
      )}
    </button>
  );
});

export default PayButton;
