import { Clock, AlertCircle, QrCode, Settings2 } from 'lucide-react';

// Quick-tender denominations — the notes a cashier is actually handed
const CASH_CHIPS = [100, 200, 500, 2000];

export default function PaymentPanel({
  paymentMethod,
  setPaymentMethod,
  receivedAmount,
  setReceivedAmount,
  dueAmount,
  setDueAmount,
  grandTotal,
  onCheckout,
  checkoutPending,
  isCartEmpty,
  upiEnabled = false,
}) {
  const parsedReceived = parseFloat(receivedAmount) || 0;
  const balance = Math.max(0, parsedReceived - grandTotal);
  const shortfall = Math.max(0, grandTotal - parsedReceived);

  const parsedDue = parseFloat(dueAmount) || 0;
  const paidNow = Math.max(0, grandTotal - parsedDue);

  const isUpiQr = paymentMethod === 'upi_qr';

  const METHODS = [
    { id: 'cash',   label: 'CASH',   hint: 'F4' },
    { id: 'card',   label: 'CARD',   hint: 'F5' },
    { id: 'upi',    label: 'UPI',    hint: 'F6' },
    { id: 'credit', label: 'CREDIT', hint: 'F7' },
  ];

  const handleQuickPay = (method) => {
    setPaymentMethod(method);
    if (method === 'cash') {
      // Pre-fill with the exact total rounded up — the common case
      setReceivedAmount(Math.ceil(grandTotal).toString());
    } else {
      setReceivedAmount('');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-4">
      {/* Quick Tender Toggles */}
      <div>
        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Tender Payments</span>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              data-testid={`payment-${m.id}`}
              aria-pressed={paymentMethod === m.id ? 'true' : 'false'}
              onClick={() => handleQuickPay(m.id)}
              className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                paymentMethod === m.id
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Scan-to-pay — only offered when a VPA is configured */}
        {upiEnabled ? (
          <button
            type="button"
            data-testid="payment-upi_qr"
            aria-pressed={isUpiQr ? 'true' : 'false'}
            onClick={() => handleQuickPay('upi_qr')}
            className={`mt-2 w-full py-2.5 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 ${
              isUpiQr
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            <QrCode className="w-4 h-4" /> PAY BY UPI QR (F8)
          </button>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-400 font-semibold">
            <Settings2 className="w-3 h-3" />
            Enable UPI QR in Settings → Payments
          </p>
        )}
      </div>

      {/* Numerical Tender Inputs based on method */}
      {paymentMethod === 'cash' && (
        <div className="space-y-2.5">
          <div>
            <span className="block text-[10px] font-bold text-gray-400 uppercase">Received Amount (₹)</span>
            <input
              type="number"
              min="0"
              value={receivedAmount}
              onChange={(e) => setReceivedAmount(e.target.value)}
              placeholder={`e.g. ₹${Math.ceil(grandTotal)}`}
              data-testid="cash-received"
              className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm font-bold bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-400 transition-colors"
            />
          </div>

          {/* Quick-tender chips — faster than typing, fewer mistakes */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setReceivedAmount(grandTotal.toFixed(2))}
              className="px-2 py-1 text-[10px] font-bold rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition"
            >
              Exact
            </button>
            {CASH_CHIPS.filter((c) => c >= grandTotal).slice(0, 3).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setReceivedAmount(String(c))}
                className="px-2 py-1 text-[10px] font-bold rounded-lg bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
              >
                ₹{c}
              </button>
            ))}
          </div>

          {shortfall > 0.01 && parsedReceived > 0 ? (
            <div className="flex justify-between items-center bg-red-50/60 border border-red-100 rounded-xl p-3">
              <span className="text-xs text-red-700 font-bold uppercase tracking-wider">Short by:</span>
              <span className="text-lg font-black text-red-600 tabular-nums">₹{shortfall.toFixed(2)}</span>
            </div>
          ) : (
            <div className="flex justify-between items-center bg-green-50/50 border border-green-100 rounded-xl p-3">
              <span className="text-xs text-green-700 font-bold uppercase tracking-wider">Change to give:</span>
              <span className="text-lg font-black text-green-600 tabular-nums" data-testid="cash-change">₹{balance.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {isUpiQr && (
        <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-3.5 space-y-1.5">
          <p className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5" /> Scan-to-pay
          </p>
          <p className="text-[11px] text-indigo-700 leading-snug">
            A QR for exactly <strong>₹{grandTotal.toFixed(2)}</strong> opens after you
            start the bill. The bill stays <strong>Pending</strong> until you enter the
            customer's UPI reference — it is never marked paid by a click alone.
          </p>
        </div>
      )}

      {paymentMethod === 'credit' && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-3.5 space-y-3">
          <p className="text-xs font-bold text-amber-800 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Credit Configuration
          </p>
          <div className="space-y-2">
            <div>
              <span className="block text-[10px] font-bold text-amber-700 uppercase">Deferred Credit (₹)</span>
              <input
                type="number"
                min="0"
                max={grandTotal}
                value={dueAmount}
                onChange={(e) => setDueAmount(e.target.value)}
                placeholder={`Max ₹${grandTotal.toFixed(0)}`}
                data-testid="credit-due-input"
                className="w-full h-9 px-3 border border-amber-200 rounded-xl text-xs font-bold bg-white focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>
            {parsedDue > 0 && (
              <div className="text-[11px] font-bold text-amber-800 space-y-1 pt-1">
                <div className="flex justify-between">
                  <span>Paid now:</span>
                  <span className="tabular-nums">₹{paidNow.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span className="flex items-center gap-0.5"><AlertCircle className="w-3 h-3" /> Due on account:</span>
                  <span className="tabular-nums">₹{parsedDue.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transaction CTAs */}
      <div className="space-y-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          disabled={isCartEmpty || checkoutPending}
          onClick={onCheckout}
          data-testid="pay-button"
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md shadow-blue-100 flex flex-col items-center justify-center gap-0 transition"
        >
          {checkoutPending ? (
            'Processing Checkout…'
          ) : (
            <>
              <span className="text-base tabular-nums leading-tight">₹{grandTotal.toFixed(2)}</span>
              <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider">
                {isUpiQr ? 'Generate UPI QR (Ctrl+Enter)' : 'Complete & Print (Ctrl+Enter)'}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
