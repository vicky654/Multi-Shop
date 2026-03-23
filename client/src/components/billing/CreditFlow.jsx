import { memo } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

const CreditFlow = memo(function CreditFlow({ grandTotal, dueAmount, onChange }) {
  const due  = parseFloat(dueAmount) || 0;
  const paid = Math.max(0, grandTotal - due);

  return (
    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
      <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5 mb-3">
        <Clock className="w-4 h-4" /> Credit Sale
      </p>
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <p className="text-xs font-medium text-amber-600 mb-1.5">Amount Due (₹)</p>
          <input
            type="number"
            min="0"
            max={grandTotal}
            value={dueAmount}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Max ₹${grandTotal.toFixed(0)}`}
            className="w-full h-10 px-3 border-2 border-amber-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-amber-400 bg-white"
          />
        </div>
        {due > 0 && (
          <div className="space-y-1.5 pb-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Paid now</span>
              <span className="font-bold text-green-600 tabular-nums">₹{paid.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-red-500 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Due
              </span>
              <span className="font-bold text-red-600 tabular-nums">₹{due.toFixed(0)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default CreditFlow;
