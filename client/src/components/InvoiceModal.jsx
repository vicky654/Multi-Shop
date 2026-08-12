import { useRef, useState } from 'react';
import { X, Printer, MessageCircle, Send, Loader2, PencilLine, ChevronDown } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { campaignsApi } from '../api/campaigns.api';
import { usePermissions } from '../hooks/usePermissions';
import BillEditHistory from './billing/BillEditHistory';
import EditBillModal from './billing/EditBillModal';
import InvoiceReceipt from './billing/InvoiceReceipt';
import { printReceipt, PRINT_LAYOUTS } from './billing/invoicePrint';

/**
 * Bill details / printable invoice modal.
 *
 * This is the shell only — actions, share, edit and the audit trail. The receipt
 * document itself lives in billing/InvoiceReceipt.jsx and its paper styling in
 * billing/invoicePrint.js, because all three were previously one file that had
 * grown past the point of being comfortably editable.
 *
 * Props:
 *   sale      — populated sale object
 *   onClose   — dismiss
 *   onUpdated — optional; called with the updated sale after a successful edit
 */
export default function InvoiceModal({ sale, onClose, onUpdated }) {
  const printRef = useRef();
  const [waLink,  setWaLink]  = useState(null);
  const [editing, setEditing] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const { can } = usePermissions();

  const receiptMut = useMutation({
    mutationFn: (channel) => campaignsApi.sendReceipt({
      shopId:     sale?.shopId?._id || sale?.shopId,
      customerId: sale?.customerId?._id || sale?.customerId,
      sale,
      channel,
    }),
    onSuccess: (res, channel) => {
      if (channel === 'whatsapp') {
        const link = res.data.campaign?.whatsappLinks?.[0]?.url;
        if (link) setWaLink(link);
      } else {
        toast.success('Receipt SMS sent!');
      }
    },
    onError: (e) => toast.error(e.message),
  });

  if (!sale) return null;

  const shop = sale.shopId || {};
  const hasCustomer = !!(sale.customerId?._id || (typeof sale.customerId === 'string' && sale.customerId));

  // A bill can only be amended once it is settled and untouched by refunds.
  const payStatus  = sale.paymentStatus || 'paid';
  const isRefunded = (sale.items || []).some((i) => (i.refundedQty || 0) > 0);
  const canEditBill =
    can('billing', 'update') &&
    sale.status === 'completed' &&
    payStatus === 'paid' &&
    !isRefunded &&
    !sale.isOnlineOrder;

  const handlePrint = (layout) => {
    setLayoutOpen(false);
    const ok = printReceipt(
      printRef.current.innerHTML,
      `Invoice ${sale.invoiceNumber}`,
      layout
    );
    if (!ok) toast.error('Allow pop-ups for this site to print');
  };

  const statusTone =
    sale.status === 'completed' ? 'bg-green-100 text-green-700'
    : sale.status === 'pending' ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-600';

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4"
      data-testid="invoice-modal"
    >
      {/* Full-height sheet on mobile, centred card on desktop. */}
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Invoice</p>
            <h2 className="font-bold text-gray-900 text-sm sm:text-base truncate" data-testid="invoice-number">
              {sale.invoiceNumber}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusTone}`}>
              {sale.status?.toUpperCase()}
            </span>
            <span
              className={`hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                payStatus === 'paid' ? 'bg-green-100 text-green-700'
                : payStatus === 'pending' ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-600'
              }`}
              data-testid="payment-status-badge"
            >
              {payStatus === 'paid' ? 'PAID' : payStatus.toUpperCase()}
            </span>
            {sale.editCount > 0 && (
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                EDITED ×{sale.editCount}
              </span>
            )}
            <button
              onClick={onClose}
              aria-label="Close invoice"
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Receipt (scrollable) ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 bg-gray-50/60">
          {/* The paper. printRef wraps ONLY this, so the action bar and audit
              trail never end up on a customer's receipt. */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-7 shadow-sm">
            <div ref={printRef}>
              <InvoiceReceipt sale={sale} shop={shop} />
            </div>
          </div>

          <BillEditHistory sale={sale} />
        </div>

        {/* ── Action bar — sticky on mobile so Print is always reachable ────── */}
        <div className="shrink-0 border-t border-gray-100 px-4 sm:px-5 py-3 pb-safe bg-white">
          <div className="flex flex-wrap items-center gap-2">
            {/* Print with a layout choice: a counter prints 80mm rolls, an
                emailed copy wants A4. */}
            <div className="relative flex-1 sm:flex-none min-w-[9rem]">
              <button
                onClick={() => handlePrint('a4')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 h-10 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-semibold transition"
              >
                <Printer className="w-4 h-4" /> Print / PDF
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Choose print layout"
                  onClick={(e) => { e.stopPropagation(); setLayoutOpen((v) => !v); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setLayoutOpen((v) => !v); }
                  }}
                  className="ml-1 -mr-1 p-0.5 rounded hover:bg-white/20"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </span>
              </button>

              {layoutOpen && (
                <div className="absolute bottom-full mb-2 left-0 z-10 w-44 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {PRINT_LAYOUTS.map((l) => (
                    <button
                      key={l.value}
                      onClick={() => handlePrint(l.value)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition"
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {hasCustomer && (
              <>
                {waLink ? (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-10 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition"
                  >
                    <MessageCircle className="w-4 h-4" /> Open WhatsApp
                  </a>
                ) : (
                  <button
                    onClick={() => receiptMut.mutate('whatsapp')}
                    disabled={receiptMut.isPending}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-10 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition"
                  >
                    {receiptMut.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <MessageCircle className="w-4 h-4" />}
                    WhatsApp
                  </button>
                )}
                <button
                  onClick={() => receiptMut.mutate('sms')}
                  disabled={receiptMut.isPending}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-10 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition"
                >
                  <Send className="w-4 h-4" /> SMS
                </button>
              </>
            )}

            {canEditBill && (
              <button
                onClick={() => setEditing(true)}
                data-testid="edit-bill-button"
                title="Modify this bill (audited)"
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-10 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-sm font-semibold transition"
              >
                <PencilLine className="w-4 h-4" /> Edit Bill
              </button>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <EditBillModal
          sale={sale}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setEditing(false);
            onUpdated?.(updated);
          }}
        />
      )}
    </div>
  );
}
