import { memo } from 'react';

const TotalSummary = memo(function TotalSummary({ totals, taxRate, taxAmount, grandTotal }) {
  return (
    <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-5 text-white shadow-xl shadow-blue-300/40">
      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between text-blue-200">
          <span>Subtotal</span>
          <span className="font-medium tabular-nums">₹{totals.subtotal.toFixed(2)}</span>
        </div>
        {totals.discount > 0 && (
          <div className="flex justify-between text-emerald-300 font-semibold">
            <span>Discount</span>
            <span className="tabular-nums">−₹{totals.discount.toFixed(2)}</span>
          </div>
        )}
        {taxAmount > 0 && (
          <div className="flex justify-between text-blue-300 text-xs">
            <span>GST ({taxRate}%)</span>
            <span className="tabular-nums">+₹{taxAmount.toFixed(2)}</span>
          </div>
        )}
      </div>
      <div className="flex justify-between items-baseline border-t border-white/20 pt-4">
        <span className="text-base font-bold text-white/80 tracking-wide">Total</span>
        <span className="text-4xl font-black tracking-tight tabular-nums">₹{grandTotal.toFixed(2)}</span>
      </div>
    </div>
  );
});

export default TotalSummary;
