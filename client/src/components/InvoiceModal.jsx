import { useRef } from 'react';
import { format } from 'date-fns';
import { X, Printer, Download } from 'lucide-react';

/**
 * Printable invoice modal.
 * Props: sale (populated sale object), shop (optional), onClose
 */
export default function InvoiceModal({ sale, onClose }) {
  const printRef = useRef();

  if (!sale) return null;

  const shop = sale.shopId || {};
  const date = sale.createdAt ? format(new Date(sale.createdAt), 'dd MMM yyyy, hh:mm a') : '';

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=800,height=900');
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Invoice ${sale.invoiceNumber}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; font-family: sans-serif; }
        body { padding: 32px; font-size: 13px; color: #111; }
        .inv-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
        .shop-name  { font-size:22px; font-weight:700; color:#1e40af; }
        .shop-meta  { font-size:12px; color:#6b7280; margin-top:4px; }
        .inv-title  { text-align:right; }
        .inv-title h2 { font-size:18px; font-weight:700; text-transform:uppercase; letter-spacing:2px; }
        .inv-title p  { font-size:12px; color:#6b7280; margin-top:2px; }
        .divider { border:none; border-top:1px solid #e5e7eb; margin:16px 0; }
        .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
        .meta-box  { }
        .meta-box h4 { font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#9ca3af; margin-bottom:6px; }
        .meta-box p  { font-size:13px; font-weight:600; }
        .meta-box small { font-size:11px; color:#6b7280; }
        table  { width:100%; border-collapse:collapse; margin-bottom:16px; }
        th     { background:#f3f4f6; text-align:left; padding:8px 10px; font-size:11px; text-transform:uppercase; color:#6b7280; }
        td     { padding:8px 10px; border-bottom:1px solid #f3f4f6; font-size:13px; }
        .totals { margin-left:auto; width:240px; }
        .totals .row { display:flex; justify-content:space-between; padding:5px 0; font-size:13px; }
        .totals .grand { font-weight:700; font-size:16px; border-top:2px solid #111; padding-top:8px; margin-top:4px; }
        .footer { text-align:center; margin-top:32px; font-size:12px; color:#9ca3af; }
        .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; }
        .badge-green { background:#dcfce7; color:#166534; }
        .badge-yellow { background:#fef9c3; color:#854d0e; }
        @media print { body { padding:16px; } }
      </style>
    </head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-900 text-lg">Invoice — {sale.invoiceNumber}</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition">
              <Printer className="w-4 h-4" /> Print / PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice content (scrollable) */}
        <div className="flex-1 overflow-y-auto p-5">
          <div ref={printRef}>
            {/* Shop header */}
            <div className="inv-header flex justify-between items-start mb-6">
              <div>
                {shop.logo && <img src={shop.logo} alt="logo" className="h-12 object-contain mb-2" />}
                <p className="text-xl font-bold text-blue-700">{shop.name || 'Shop'}</p>
                {shop.address && <p className="text-sm text-gray-500 mt-0.5">{shop.address}</p>}
                {shop.phone  && <p className="text-sm text-gray-500">{shop.phone}</p>}
                {shop.gstNumber && <p className="text-sm text-gray-500">GSTIN: {shop.gstNumber}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold uppercase tracking-widest text-gray-400">Invoice</p>
                <p className="text-2xl font-black text-gray-900">{sale.invoiceNumber}</p>
                <p className="text-sm text-gray-500 mt-1">{date}</p>
                <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold ${
                  sale.status === 'completed' ? 'bg-green-100 text-green-700' :
                  sale.status === 'pending'   ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-600'
                }`}>{sale.status?.toUpperCase()}</span>
              </div>
            </div>

            <hr className="border-gray-200 my-4" />

            {/* Billed to / Billed by */}
            <div className="grid grid-cols-2 gap-6 mb-5">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-1.5">Billed To</p>
                {sale.customerId ? (
                  <>
                    <p className="font-semibold text-gray-900">{sale.customerId.name || sale.customerName}</p>
                    <p className="text-sm text-gray-500">{sale.customerId.phone || sale.customerPhone}</p>
                    {sale.customerId.email && <p className="text-sm text-gray-500">{sale.customerId.email}</p>}
                  </>
                ) : sale.customerName ? (
                  <>
                    <p className="font-semibold text-gray-900">{sale.customerName}</p>
                    <p className="text-sm text-gray-500">{sale.customerPhone}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Walk-in Customer</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-1.5">Billed By</p>
                {sale.staffId && <p className="font-semibold text-gray-900">{sale.staffId.name}</p>}
                <p className="text-sm text-gray-500 capitalize">{sale.paymentMethod}</p>
              </div>
            </div>

            {/* Items table */}
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase rounded-tl-lg">#</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">Price</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">Disc%</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase rounded-tr-lg">Total</th>
                </tr>
              </thead>
              <tbody>
                {(sale.items || []).map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2.5 px-3 text-gray-400">{i + 1}</td>
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      {(item.selectedSize || item.selectedColor) && (
                        <p className="text-xs text-gray-400">
                          {[item.selectedSize, item.selectedColor].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-700">₹{item.price.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3 text-right text-green-600">{item.discount || 0}%</td>
                    <td className="py-2.5 px-3 text-right">{item.quantity}</td>
                    <td className="py-2.5 px-3 text-right font-semibold">₹{item.subtotal.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{(sale.totalAmount - sale.taxAmount).toLocaleString('en-IN')}</span>
                </div>
                {sale.totalDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₹{sale.totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                {sale.taxAmount > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tax ({sale.taxRate || 0}%)</span>
                    <span>+₹{sale.taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg text-gray-900 border-t border-gray-300 pt-2 mt-2">
                  <span>Grand Total</span>
                  <span>₹{sale.totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {sale.notes && (
              <div className="mt-5 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-gray-700">{sale.notes}</p>
              </div>
            )}

            <p className="text-center text-xs text-gray-400 mt-6">Thank you for your purchase!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
