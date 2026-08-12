/**
 * InvoiceReceipt — the printable retail receipt.
 *
 * Modelled on how a real apparel/footwear counter bill reads (Zudio, Nike et al):
 * store identity centred at the top, a scannable item block, an explicit
 * "you saved" line, then the statutory GST ladder.
 *
 * TWO THINGS THIS FIXES, NOT JUST RESTYLES
 *
 * 1. The totals ladder was in a misleading order. It printed
 *        Subtotal  2,341.52     ← actually the TAXABLE value, post-discount
 *        Discount   −258.44     ← reads as "subtract this too"
 *        CGST/SGST  +421.48
 *        Grand      2,763.00
 *    A customer adding that up gets 2,504.56, not 2,763. The correct order for a
 *    tax invoice is Gross → Discount → Taxable → Tax → Round off → Grand, which
 *    reconciles line by line. Taxable now comes from `sale.gst.taxableAmount`
 *    (the engine's own figure) instead of being back-derived from the ROUNDED
 *    grand total, which is where the stray 4-paise disagreement with the line
 *    total came from.
 *
 * 2. Per-line discount printed as a raw percentage — "9.94%" — because a rupee
 *    discount is stored as its exact percentage equivalent. That is right for
 *    billing maths and meaningless to a shopper. Lines now print the rupee amount
 *    saved, with the percentage only when it is a clean figure.
 *
 * The markup carries plain `r-*` class names alongside Tailwind so the same nodes
 * print correctly via invoicePrint.js, which has no Tailwind available.
 */
import { format } from 'date-fns';

const money = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// A percentage worth showing to a shopper: whole-ish, not an artefact of a
// rupee-to-percent conversion. 10% prints; 9.9384...% does not.
const isCleanPct = (p) => Number.isFinite(p) && p > 0 && Math.abs(p - Math.round(p * 10) / 10) < 0.005;

export default function InvoiceReceipt({ sale, shop }) {
  const items = sale.items || [];

  // ── Reconciled money figures ────────────────────────────────────────────────
  // Gross is the sum of list price × qty, which is what the shopper compares
  // against the tag on the shoe.
  const gross = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
  const lineTotal = items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);

  // Prefer the GST engine's own taxable figure; fall back for pre-engine sales.
  const taxable = sale.gst?.taxableAmount > 0
    ? sale.gst.taxableAmount
    : lineTotal || Math.max(0, (sale.totalAmount || 0) - (sale.taxAmount || 0));

  const discount = sale.totalDiscount > 0 ? sale.totalDiscount : Math.max(0, gross - taxable);
  const savedPct = gross > 0 ? (discount / gross) * 100 : 0;

  const cgst = sale.gst?.cgstAmount || 0;
  const sgst = sale.gst?.sgstAmount || 0;
  const igst = sale.gst?.igstAmount || 0;
  const hasBreakdown = cgst > 0 || sgst > 0 || igst > 0;
  const roundOff = sale.gst?.roundOff || 0;

  const totalQty   = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const date       = sale.createdAt ? format(new Date(sale.createdAt), 'dd MMM yyyy, hh:mm a') : '';
  const payStatus  = sale.paymentStatus || 'paid';
  const customer   = sale.customerId?.name || sale.customerName || 'Walk-in Customer';
  const customerPh = sale.customerId?.phone || sale.customerPhone || '';

  const metaOf = (item) => [
    item.selectedSize  && `Size ${item.selectedSize}`,
    item.selectedColor,
    item.sku || item.product?.sku,
    item.hsnCode && `HSN ${item.hsnCode}`,
  ].filter(Boolean);

  // Per-line saving in rupees — what "9.94%" was failing to communicate.
  const lineSaving = (item) => {
    const listed = (Number(item.price) || 0) * (Number(item.quantity) || 0);
    return Math.max(0, listed - (Number(item.subtotal) || 0));
  };

  return (
    <div className="r-wrap text-gray-900">

      {/* ── Store identity ─────────────────────────────────────────────────── */}
      <div className="r-center text-center">
        {shop.logo && <img src={shop.logo} alt="" className="r-logo mx-auto max-h-12 object-contain mb-2" />}
        <p className="r-name text-2xl sm:text-3xl font-extrabold tracking-tight">
          {shop.name || 'MultiShop'}
        </p>
        {shop.address && (
          <p className="r-small r-muted text-xs sm:text-sm text-gray-500 mt-1">{shop.address}</p>
        )}
        <p className="r-small r-muted text-xs sm:text-sm text-gray-500">
          {[shop.phone, shop.gstNumber && `GSTIN: ${shop.gstNumber}`].filter(Boolean).join('  ·  ')}
        </p>
        <span className="r-title inline-block mt-2 px-2.5 py-0.5 border border-gray-900 rounded text-[10px] font-bold uppercase tracking-[0.12em]">
          Tax Invoice
        </span>
      </div>

      <hr className="r-rule my-3 border-0 border-t border-dashed border-gray-400" />

      {/* ── Bill meta ──────────────────────────────────────────────────────── */}
      <div className="r-meta grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs sm:text-sm">
        {[
          ['Invoice',  sale.invoiceNumber],
          ['Date',     date],
          ['Customer', customerPh ? `${customer} · ${customerPh}` : customer],
          ['Cashier',  sale.staffId?.name || '—'],
          ['Payment',  (sale.paymentMethod || '').toUpperCase()],
          ['Status',   payStatus === 'paid' ? 'PAID' : payStatus.toUpperCase()],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="k text-gray-500 shrink-0">{k}</span>
            <span className="v font-semibold truncate">{v || '—'}</span>
          </div>
        ))}
      </div>

      {sale.gst?.placeOfSupply && (
        <p className="r-tiny r-muted text-[11px] text-gray-500 mt-1">
          Place of supply: {sale.gst.placeOfSupply}
          {sale.gst.interState ? ' (inter-state)' : ''}
        </p>
      )}

      <hr className="r-rule my-3 border-0 border-t border-dashed border-gray-400" />

      {/* ── Items: table on desktop ────────────────────────────────────────── */}
      <table className="r-items w-full hidden sm:table">
        <thead>
          <tr>
            <th className="text-left py-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-300">Item</th>
            <th className="r-right r-col-hide text-right py-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-300">MRP</th>
            <th className="r-right text-right py-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-300">Qty</th>
            <th className="r-right r-col-hide text-right py-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-300">Saved</th>
            <th className="r-right text-right py-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-300">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const saved = lineSaving(item);
            const meta  = metaOf(item);
            return (
              <tr key={i} className="border-b border-dotted border-gray-200">
                <td className="py-2 px-1">
                  <p className="r-prod font-semibold">{item.name}</p>
                  {meta.length > 0 && (
                    <p className="r-prod-meta text-[11px] text-gray-500 mt-0.5">{meta.join(' · ')}</p>
                  )}
                  {(item.refundedQty || 0) > 0 && (
                    <p className="r-tiny text-[11px] font-semibold text-red-600 mt-0.5">
                      {item.refundedQty} returned
                    </p>
                  )}
                </td>
                <td className="r-num r-right r-col-hide text-right py-2 px-1 tabular-nums text-gray-500 line-through">
                  {saved > 0 ? `₹${money(item.price)}` : ''}
                </td>
                <td className="r-num r-right text-right py-2 px-1 tabular-nums">{item.quantity}</td>
                <td className="r-num r-right r-col-hide text-right py-2 px-1 tabular-nums text-green-700">
                  {saved > 0 ? `₹${money(saved)}` : '—'}
                </td>
                <td className="r-num r-right text-right py-2 px-1 tabular-nums font-semibold">
                  ₹{money(item.subtotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── Items: stacked on mobile ───────────────────────────────────────── */}
      <div className="sm:hidden divide-y divide-dotted divide-gray-200" data-print="hide">
        {items.map((item, i) => {
          const saved = lineSaving(item);
          const meta  = metaOf(item);
          return (
            <div key={i} className="py-2.5">
              <div className="flex justify-between gap-3">
                <p className="font-semibold text-sm leading-snug">{item.name}</p>
                <p className="text-sm font-bold tabular-nums shrink-0">₹{money(item.subtotal)}</p>
              </div>
              {meta.length > 0 && (
                <p className="text-[11px] text-gray-500 mt-0.5">{meta.join(' · ')}</p>
              )}
              <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 tabular-nums">
                <span>{item.quantity} × ₹{money(item.price)}</span>
                {saved > 0 && (
                  <span className="font-semibold text-green-700">saved ₹{money(saved)}</span>
                )}
                {(item.refundedQty || 0) > 0 && (
                  <span className="font-semibold text-red-600">{item.refundedQty} returned</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <hr className="r-rule my-3 border-0 border-t border-dashed border-gray-400" />

      {/* ── Totals ladder — reconciles top to bottom ───────────────────────── */}
      <div className="r-totals w-full sm:w-2/3 sm:ml-auto space-y-0.5 text-sm">
        <Row label={`Gross (${items.length} item${items.length === 1 ? '' : 's'}, ${totalQty} qty)`} value={`₹${money(gross)}`} />
        {discount > 0 && (
          <Row label="Discount" value={`− ₹${money(discount)}`} tone="text-green-700" />
        )}
        <Row label="Taxable Value" value={`₹${money(taxable)}`} />

        {igst > 0 && <Row label={`IGST (${sale.taxRate || 0}%)`} value={`+ ₹${money(igst)}`} />}
        {cgst > 0 && <Row label={`CGST (${((sale.taxRate || 0) / 2).toFixed(2)}%)`} value={`+ ₹${money(cgst)}`} />}
        {sgst > 0 && <Row label={`SGST (${((sale.taxRate || 0) / 2).toFixed(2)}%)`} value={`+ ₹${money(sgst)}`} />}
        {/* Sales predating the GST engine have a flat tax and no breakdown. */}
        {!hasBreakdown && sale.taxAmount > 0 && (
          <Row label={`Tax (${sale.taxRate || 0}%)`} value={`+ ₹${money(sale.taxAmount)}`} />
        )}

        {Math.abs(roundOff) >= 0.01 && (
          <Row
            label="Round off"
            value={`${roundOff > 0 ? '+' : '−'} ₹${money(Math.abs(roundOff))}`}
            tone="text-gray-500"
            small
          />
        )}

        <div className="r-totals grand flex justify-between items-baseline font-extrabold text-base sm:text-lg border-y-2 border-gray-900 py-1.5 mt-1.5">
          <span>Grand Total</span>
          <span className="r-num tabular-nums">₹{money(sale.totalAmount)}</span>
        </div>

        {sale.dueAmount > 0 && (
          <>
            <Row label="Paid" value={`₹${money((sale.totalAmount || 0) - sale.dueAmount)}`} />
            <Row label="Balance Due" value={`₹${money(sale.dueAmount)}`} tone="text-red-600 font-semibold" />
          </>
        )}
      </div>

      {/* The single line a shopper actually looks for. */}
      {discount > 0 && (
        <p className="r-saved my-3 py-1.5 px-2 text-center border border-dashed border-green-700 rounded text-green-700 font-bold text-sm">
          You saved ₹{money(discount)}
          {savedPct >= 0.5 ? ` (${savedPct.toFixed(savedPct >= 10 ? 0 : 1)}%)` : ''} on this bill
        </p>
      )}

      {/* ── Split payments ─────────────────────────────────────────────────── */}
      {Array.isArray(sale.payments) && sale.payments.length > 1 && (
        <div className="r-box mt-2 p-2 border border-gray-200 rounded">
          <p className="r-tiny r-caps text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Payments</p>
          {sale.payments.map((p, i) => (
            <div key={i} className="flex justify-between text-xs tabular-nums">
              <span className="capitalize">{p.method}</span>
              <span>₹{money(p.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── UPI settlement proof ───────────────────────────────────────────── */}
      {sale.isUpiQr && sale.upiTxn && (
        <div className="r-box mt-2 p-2 border border-gray-200 rounded">
          <p className="r-tiny r-caps text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">UPI Payment</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 text-[11px] text-gray-700">
            {sale.upiTxn.transactionId && <p><span className="text-gray-400">UTR </span><span className="font-mono font-semibold">{sale.upiTxn.transactionId}</span></p>}
            {sale.upiTxn.refId && <p><span className="text-gray-400">Ref </span><span className="font-mono">{sale.upiTxn.refId}</span></p>}
            {sale.upiTxn.vpa && <p><span className="text-gray-400">To </span><span className="font-mono">{sale.upiTxn.vpa}</span></p>}
            {sale.upiTxn.verifiedAt && <p><span className="text-gray-400">Verified </span>{format(new Date(sale.upiTxn.verifiedAt), 'dd MMM, hh:mm a')}</p>}
          </div>
        </div>
      )}

      {sale.notes && (
        <div className="r-box mt-2 p-2 border border-gray-200 rounded">
          <p className="r-tiny r-caps text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Notes</p>
          <p className="text-xs text-gray-700">{sale.notes}</p>
        </div>
      )}

      {/* A missing seller state silently turns an inter-state sale into
          CGST+SGST, so the engine flags it and the invoice must not hide it. */}
      {sale.gst?.configWarning && (
        <p className="r-box mt-2 p-2 border border-amber-300 bg-amber-50 rounded text-[11px] text-amber-800">
          {sale.gst.configWarning}
        </p>
      )}

      <hr className="r-rule my-3 border-0 border-t border-dashed border-gray-400" />

      <div className="r-foot text-center text-[11px] text-gray-500 leading-relaxed">
        <p className="font-semibold text-gray-700">Thank you for shopping with us!</p>
        <p>Exchange within 7 days with this invoice · Tags must be intact</p>
        <p className="r-tiny">This is a computer-generated invoice.</p>
      </div>
    </div>
  );
}

function Row({ label, value, tone = 'text-gray-600', small = false }) {
  return (
    <div className={`row flex justify-between ${small ? 'text-xs' : ''} ${tone}`}>
      <span>{label}</span>
      <span className="r-num tabular-nums">{value}</span>
    </div>
  );
}
