import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { useMutation } from '@tanstack/react-query';
import {
  QrCode, X, Loader2, CheckCircle2, XCircle, AlertTriangle, Copy, Store, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { salesApi } from '../../api/sales.api';
import { buildUpiUri, isValidTxnRef } from '../../utils/upi';

/**
 * UpiQrModal — scan-to-pay for a pending UPI bill.
 *
 * The bill already exists on the server with status 'pending' /
 * paymentStatus 'pending', so it is out of every revenue report until the
 * money is confirmed. This modal:
 *   1. renders a QR encoding the EXACT bill amount for the shop's configured VPA
 *   2. requires the cashier to enter the UPI transaction reference (UTR) that
 *      the customer's app shows, then verifies server-side
 *   3. or marks the payment failed/cancelled, which restores the stock
 *
 * A button click alone never settles a bill — the server rejects verification
 * without a valid reference.
 *
 * Props:
 *   sale     — the pending sale (must carry upiTxn.refId and totalAmount)
 *   shop     — active shop (needs upiSettings)
 *   onPaid   — (verifiedSale) => void, called after successful verification
 *   onVoided — (voidedSale)  => void, called after failed/cancelled
 *   onClose  — dismiss without deciding (bill stays pending)
 */
export default function UpiQrModal({ sale, shop, onPaid, onVoided, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrError,   setQrError]   = useState('');
  const [txnRef,    setTxnRef]    = useState('');
  const [confirmVoid, setConfirmVoid] = useState(false);
  const refInput = useRef(null);

  const upi      = shop?.upiSettings || {};
  const amount   = sale?.totalAmount || 0;
  const refId    = sale?.upiTxn?.refId || '';
  const payeeVpa = sale?.upiTxn?.vpa || upi.vpa || '';
  const payeeName = upi.merchantName || shop?.name || 'Merchant';

  const upiUri = buildUpiUri({
    vpa:          payeeVpa,
    merchantName: payeeName,
    amount,
    refId,
    note:         sale?.invoiceNumber ? `Bill ${sale.invoiceNumber}` : '',
  });

  // ── Render the QR ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!upiUri) {
      setQrError('UPI is not configured correctly for this shop.');
      return;
    }
    QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => { if (!cancelled) { setQrDataUrl(url); setQrError(''); } })
      .catch(() => { if (!cancelled) setQrError('Could not generate the QR code.'); });
    return () => { cancelled = true; };
  }, [upiUri]);

  useEffect(() => { refInput.current?.focus(); }, []);

  // ── Verify ──────────────────────────────────────────────────────────────────
  const verifyMut = useMutation({
    mutationFn: () => salesApi.verifyUpi(sale._id, { transactionId: txnRef.trim() }),
    onSuccess: (res) => {
      toast.success('Payment verified — bill completed');
      onPaid?.(res.data.sale);
    },
    onError: (e) => toast.error(e.message || 'Could not verify this payment'),
  });

  const voidMut = useMutation({
    mutationFn: (paymentStatus) => salesApi.cancelUpi(sale._id, {
      paymentStatus,
      reason: paymentStatus === 'failed' ? 'Payment failed at the counter' : 'Cancelled by cashier',
    }),
    onSuccess: (res) => {
      toast(`Payment ${res.data.sale.paymentStatus} — stock restored`, { icon: '↩️' });
      onVoided?.(res.data.sale);
    },
    onError: (e) => toast.error(e.message || 'Could not cancel this payment'),
  });

  const refOk    = isValidTxnRef(txnRef);
  const busy     = verifyMut.isPending || voidMut.isPending;

  const copyVpa = () => {
    navigator.clipboard?.writeText(payeeVpa)
      .then(() => toast.success('UPI ID copied'))
      .catch(() => {});
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" data-testid="upi-qr-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="font-bold text-gray-900 leading-tight">Pay by UPI QR</h2>
              <p className="text-[11px] text-gray-400 font-semibold">{sale?.invoiceNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wide">
              Pending
            </span>
            <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition disabled:opacity-40">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
          {/* Amount — the single most important number on screen */}
          <div className="text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Amount to collect</p>
            <p className="text-4xl font-black text-gray-900 tabular-nums leading-tight" data-testid="upi-qr-amount">
              ₹{amount.toFixed(2)}
            </p>
          </div>

          {/* QR */}
          <div className="flex flex-col items-center">
            {qrError ? (
              <div className="w-full flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">{qrError}</p>
                  <p className="text-xs mt-0.5">Set a valid UPI ID in Settings → Payments, then retry.</p>
                </div>
              </div>
            ) : qrDataUrl ? (
              <div className="p-3 bg-white border-2 border-gray-900 rounded-2xl">
                <img src={qrDataUrl} alt="UPI payment QR code" className="w-56 h-56" data-testid="upi-qr-image" />
              </div>
            ) : (
              <div className="w-56 h-56 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-2xl">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            )}

            {/* Payee details — the customer should be able to sanity-check these */}
            <div className="mt-3 w-full space-y-1.5 text-center">
              <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-gray-900">
                <Store className="w-3.5 h-3.5 text-gray-400" />
                {upi.displayName?.trim() || payeeName}
              </p>
              <button
                type="button"
                onClick={copyVpa}
                className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition"
              >
                {payeeVpa || '—'} <Copy className="w-3 h-3" />
              </button>
              <p className="text-[11px] text-gray-400">
                Scan with Google Pay, PhonePe, Paytm or any UPI app
              </p>
              {refId && (
                <p className="text-[10px] text-gray-400 font-mono">Ref: {refId}</p>
              )}
            </div>
          </div>

          {/* Verification — the only path to 'paid' */}
          <div className="pt-4 border-t border-gray-100 space-y-2">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              UPI transaction / UTR reference <span className="text-red-500">*</span>
            </label>
            <input
              ref={refInput}
              type="text"
              value={txnRef}
              onChange={(e) => setTxnRef(e.target.value.replace(/\s/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter' && refOk && !busy) verifyMut.mutate(); }}
              placeholder="e.g. 412345678901"
              data-testid="upi-txn-ref"
              autoComplete="off"
              className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm font-mono font-bold
                         bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-400 transition"
            />
            <p className="text-[11px] text-gray-400 leading-snug">
              Read the reference from the customer's payment confirmation. The bill
              stays <strong>Pending</strong> until a reference is recorded — confirming
              without one is not possible.
            </p>
            {txnRef && !refOk && (
              <p className="text-[11px] font-semibold text-red-500">
                Reference must be 6–35 letters, digits or dashes.
              </p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-gray-200 p-4 space-y-2 bg-gray-50/60">
          <button
            type="button"
            disabled={!refOk || busy}
            onClick={() => verifyMut.mutate()}
            data-testid="upi-verify-button"
            className="w-full h-12 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed
                       text-white font-black text-sm rounded-xl shadow-md shadow-green-600/20
                       flex items-center justify-center gap-2 transition"
          >
            {verifyMut.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
              : <><CheckCircle2 className="w-4 h-4" /> Payment Received — Verify & Complete</>}
          </button>

          {confirmVoid ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => voidMut.mutate('failed')}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-40"
              >
                Mark Failed
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => voidMut.mutate('cancelled')}
                className="flex-1 h-10 bg-gray-800 hover:bg-black text-white text-xs font-bold rounded-xl transition disabled:opacity-40"
              >
                Mark Cancelled
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmVoid(false)}
                className="h-10 px-3 border border-gray-200 text-gray-500 text-xs font-bold rounded-xl hover:bg-gray-100 transition"
              >
                Back
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmVoid(true)}
              data-testid="upi-void-button"
              className="w-full h-10 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold
                         rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-40"
            >
              <XCircle className="w-3.5 h-3.5" /> Payment not received — cancel & restore stock
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="w-full h-9 text-[11px] font-bold text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1.5 transition"
          >
            <RefreshCw className="w-3 h-3" /> Keep pending — settle from Orders later
          </button>
        </div>
      </div>
    </div>
  );
}
