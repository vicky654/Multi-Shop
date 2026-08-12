/**
 * Step 5 — Review and save.
 *
 * Every money figure here is totalled from the PER-VARIANT pricing rather than
 * multiplying one price by the grand total. That matters the moment any variant
 * is priced differently: 100 pairs where size 11 costs more is not
 * 100 × the base cost, and a review screen that says otherwise is lying at the
 * exact moment the user is deciding whether to save.
 */
import {
  Package, Grid3x3, Tag, Receipt, Pencil, Boxes, TrendingUp,
} from 'lucide-react';
import { cellKey } from '../../utils/variantMatrix';
import { PRESET_COLORS, inr } from './fields';

const hexFor = (name) => PRESET_COLORS.find((c) => c.name === name)?.hex || '#cbd5e1';

function Section({ title, icon: Icon, step, onJumpToStep, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <Icon className="w-4 h-4 shrink-0" /> {title}
        </p>
        {step && (
          <button
            type="button"
            onClick={() => onJumpToStep(step)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right truncate">{value || '—'}</span>
    </div>
  );
}

export default function StepReview({
  form, matrix, totals, pricing, summary, shops, onJumpToStep,
}) {
  const shopName = shops.find((s) => s._id === (form.shopId))?.name;
  const thumb    = form.images?.[0];

  const money = [
    { label: 'Total Stock',      value: `${summary.units} ${form.unit || 'pcs'}`, tone: 'text-gray-800' },
    { label: 'Cost Value',       value: inr(summary.costValue),       tone: 'text-gray-800' },
    { label: 'Expected Revenue', value: inr(summary.expectedRevenue), tone: 'text-blue-700' },
    {
      label: 'Expected Profit',
      value: `${summary.expectedProfit < 0 ? '− ' : ''}${inr(summary.expectedProfit)}`,
      tone: summary.expectedProfit >= 0 ? 'text-green-600' : 'text-red-500',
    },
  ];

  return (
    <div className="space-y-4">

      <Section title="Product" icon={Package} step={1} onJumpToStep={onJumpToStep}>
        <div className="flex gap-4">
          {thumb ? (
            <img src={thumb} alt="" className="w-20 h-20 rounded-xl object-cover border border-gray-200 shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
              <Package className="w-7 h-7 text-gray-200" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{form.name || 'Untitled product'}</p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <Row label="Category" value={form.category} />
              <Row label="Brand"    value={form.brand} />
              <Row label="Unit"     value={form.unit} />
              <Row label="Shop"     value={shopName} />
              <Row label="SKU"      value={form.sku || 'Auto-generated'} />
              <Row label="Barcode"  value={form.barcode} />
            </div>
          </div>
        </div>
      </Section>

      <Section
        title={form.hasVariants ? 'Variant Stock' : 'Stock'}
        icon={Grid3x3}
        step={form.hasVariants ? 2 : 1}
        onJumpToStep={onJumpToStep}
      >
        {!form.hasVariants ? (
          <p className="text-sm text-gray-600">
            No variants — a single stock line of{' '}
            <b className="text-gray-900">{Number(form.stock) || 0} {form.unit || 'pcs'}</b>.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide sticky left-0 bg-white z-10">
                    Color
                  </th>
                  {matrix.cols.map((c) => (
                    <th key={c} className="px-2 py-1.5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide min-w-[3rem]">
                      {c || 'Qty'}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <tr key={row}>
                    <td className="px-2 py-1.5 border-t border-gray-100 sticky left-0 bg-white z-10">
                      <span className="flex items-center gap-2">
                        {row && (
                          <span className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: hexFor(row) }} />
                        )}
                        <span className="font-medium text-gray-800">{row || 'All colors'}</span>
                      </span>
                    </td>
                    {matrix.cols.map((col) => (
                      <td key={col} className="px-2 py-1.5 border-t border-gray-100 text-center text-gray-600">
                        {matrix.cells[cellKey(row, col)]?.stock ?? 0}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 border-t border-gray-100 text-right font-bold text-gray-800">
                      {totals.rowTotals[row] ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="px-2 py-2 border-t-2 border-gray-200 text-[11px] font-semibold text-gray-400 uppercase tracking-wide sticky left-0 bg-white z-10">
                    Total
                  </td>
                  {matrix.cols.map((c) => (
                    <td key={c} className="px-2 py-2 border-t-2 border-gray-200 text-center font-bold text-gray-800">
                      {totals.colTotals[c] ?? 0}
                    </td>
                  ))}
                  <td className="px-2 py-2 border-t-2 border-blue-200 text-right font-black text-blue-700 bg-blue-50">
                    {totals.grandTotal}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Section>

      <Section title="Pricing" icon={Tag} step={3} onJumpToStep={onJumpToStep}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <Row label="Cost / unit"    value={inr(pricing.costPrice)} />
          <Row label="Selling price"  value={inr(pricing.price)} />
          <Row
            label="Discount"
            value={pricing.discountAmount > 0
              ? `${inr(pricing.discountAmount)} (${form.discountType === 'fixed' ? '₹ fixed' : `${pricing.discountPercent.toFixed(2)}%`})`
              : 'None'}
          />
          <Row label="Customer pays"  value={inr(pricing.finalPrice)} />
          <Row label="Profit / unit"  value={`${inr(pricing.profitAmount)} (${Math.round(pricing.profitPercentOnCost)}% on cost)`} />
          <Row label="Margin on sale" value={`${pricing.marginPercentOnSell}%`} />
        </div>
        {form.hasVariantPricing && (
          <p className="mt-2 text-xs font-medium text-purple-700">
            Per-variant pricing is on — totals below use each variant's own price.
          </p>
        )}
      </Section>

      <Section title="GST" icon={Receipt} step={4} onJumpToStep={onJumpToStep}>
        {form.gstRate === '' || form.gstRate === null ? (
          <p className="text-sm text-gray-600">
            No product GST rate — bills will use the shop's tax rate at checkout.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <Row label="Rate"          value={`${form.gstRate}%`} />
            <Row label="HSN"           value={form.hsnCode} />
            <Row label="Tax / unit"    value={inr(pricing.taxAmount)} />
            <Row label="Total / unit"  value={inr(pricing.priceWithTax)} />
          </div>
        )}
      </Section>

      {/* ── The bottom line ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 space-y-3">
        <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4" /> Inventory Summary
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {money.map(({ label, value, tone }) => (
            <div key={label} className="bg-white/80 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
              <p className={`mt-0.5 font-bold text-base ${tone}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-blue-700/80 border-t border-blue-200 pt-2.5">
          {summary.discountGiven > 0 && (
            <span>Discount given: <b>{inr(summary.discountGiven)}</b></span>
          )}
          {summary.taxEstimate > 0 && (
            <span>
              GST (estimated): <b>{inr(summary.taxEstimate)}</b>
              {' '}— the final split is decided at billing by place of supply
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Boxes className="w-3.5 h-3.5" />
            {form.hasVariants
              ? `${Object.keys(matrix.cells).length} variant combinations`
              : 'Single stock line'}
          </span>
        </div>
      </div>
    </div>
  );
}
