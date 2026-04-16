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
      data-testid="pay-button"
      title={!canCreate ? "You don't have permission to create sales" : undefined}
      className="w-full h-13 bg-blue-600 hover:bg-blue-700 active:bg-blue-800
        disabled:opacity-40 disabled:cursor-not-allowed
        text-white rounded-xl
        flex items-center justify-center gap-2 text-base
        transition-colors duration-150 select-none"
      style={{ height: '3.25rem' }}
    >
      {isPending ? (
        <>
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>Processing…</span>
        </>
      ) : (
        <>
          <Receipt className="w-4 h-4 shrink-0" />
          <span>Pay ₹{grandTotal.toFixed(2)}</span>
        </>
      )}
    </button>
  );
});

export default PayButton;
