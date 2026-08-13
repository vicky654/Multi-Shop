/**
 * Step 3 — Pricing.
 *
 * The user enters cost and a desired profit %, and the selling price appears.
 * Or they type the selling price and the profit % appears. Nothing is calculated
 * by hand, and the summary card updates on every keystroke.
 *
 * Both profit figures are shown, and that is intentional: the input is markup on
 * COST (₹1000 + 30% = ₹1300), while the Inventory table's "margin" column is a
 * share of the SELLING price (23% for the same product). Showing only one would
 * make the two screens look like they disagree.
 */
import { Tag, TrendingDown, Percent, IndianRupee, Layers } from 'lucide-react';
import { FormSection } from '../ui/FormSection';
import VariantPricingTable from './VariantPricingTable';
import { inp, inpError, Field, Segmented, inr } from './fields';

const DISCOUNT_TYPES = [
  { value: 'none',    label: 'None' },
  { value: 'percent', label: '%' },
  { value: 'fixed',   label: '₹' },
];

export default function StepPricing({
  form, upd, errors, pricing, variantPricing, matrix, setMatrix,
}) {
  const hasDiscount = form.discountType !== 'none';

  return (
    <div className="space-y-4">

      <FormSection title="Cost & Profit" icon={Tag} color="blue">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Cost Price (₹)" required error={errors.costPrice}
            hint="What you paid per unit">
            <input
              data-testid="wizard-costPrice"
              type="number" min="0" step="0.01" value={form.costPrice}
              onChange={(e) => upd('costPrice', e.target.value)}
              placeholder="1000" className={errors.costPrice ? inpError : inp}
            />
          </Field>

          <Field label="Profit %" hint="Markup on cost">
            <input
              data-testid="wizard-profitPercent"
              type="number" min="0" step="0.1" value={form.profitPercent}
              onChange={(e) => upd('profitPercent', e.target.value)}
              placeholder="30" className={inp}
            />
          </Field>

          <Field label="Selling Price (₹)" required error={errors.price}
            hint="Edit either — the other updates">
            <input
              type="number" min="0" step="0.01" value={form.price}
              onChange={(e) => upd('price', e.target.value)}
              data-testid="wizard-price"
              placeholder="1300" className={errors.price ? inpError : inp}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Discount" icon={Percent} color="amber">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Type">
            <Segmented
              value={form.discountType}
              onChange={(v) => upd('discountType', v)}
              options={DISCOUNT_TYPES}
            />
          </Field>

          {hasDiscount && (
            <Field
              label={form.discountType === 'fixed' ? 'Amount off (₹)' : 'Discount (%)'}
              error={errors.discountValue}
              className="flex-1 min-w-[10rem]"
            >
              <div className="relative">
                {form.discountType === 'fixed'
                  ? <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  : <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />}
                <input
                  type="number" min="0" step="0.01"
                  max={form.discountType === 'percent' ? 100 : undefined}
                  value={form.discountValue}
                  onChange={(e) => upd('discountValue', e.target.value)}
                  placeholder={form.discountType === 'fixed' ? '130' : '10'}
                  className={`${errors.discountValue ? inpError : inp} pl-9`}
                />
              </div>
            </Field>
          )}
        </div>
      </FormSection>

      {/* ── Live summary ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 space-y-3">
        <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
          <Tag className="w-4 h-4" /> Price Summary
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Selling Price', value: inr(pricing.price), tone: 'text-gray-800' },
            {
              label: 'Discount',
              value: pricing.discountAmount > 0 ? `− ${inr(pricing.discountAmount)}` : '—',
              tone: pricing.discountAmount > 0 ? 'text-amber-600' : 'text-gray-400',
            },
            { label: 'Customer Pays', value: inr(pricing.finalPrice), tone: 'text-blue-700', big: true },
            {
              label: 'Profit / unit',
              value: `${pricing.profitAmount < 0 ? '− ' : ''}${inr(pricing.profitAmount)}`,
              tone: pricing.profitAmount >= 0 ? 'text-green-600' : 'text-red-500',
              big: true,
            },
          ].map(({ label, value, tone, big }) => (
            <div key={label} className="bg-white/80 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
              <p className={`mt-0.5 font-bold ${big ? 'text-lg' : 'text-base'} ${tone}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-blue-700/80 border-t border-blue-200 pt-2.5">
          <span>
            <b>{Math.round(pricing.profitPercentOnCost)}%</b> profit on cost
          </span>
          <span>
            <b>{pricing.marginPercentOnSell}%</b> margin on sale
          </span>
          {pricing.gstRate !== null && pricing.gstRate > 0 && (
            <span>
              GST {pricing.gstRate}% → <b>{inr(pricing.taxAmount)}</b>{' '}
              (customer total {inr(pricing.priceWithTax)})
            </span>
          )}
        </div>

        {/* A loss is worth flagging loudly, but it is a legitimate choice —
            clearance stock gets sold below cost — so it warns, never blocks. */}
        {pricing.profitAmount < 0 && Number(form.price) > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
            <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">
              Selling below cost — you lose <b>{inr(pricing.profitAmount)}</b> per unit.
            </p>
          </div>
        )}
      </div>

      {/* ── Optional per-variant pricing ──────────────────────────────────── */}
      {form.hasVariants && (
        <FormSection title="Variant Pricing" icon={Layers} color="purple">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.hasVariantPricing}
              onChange={(e) => upd('hasVariantPricing', e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-purple-600 shrink-0"
            />
            <div>
              <span className="text-sm font-semibold text-purple-800">Different price by variant</span>
              <p className="text-xs text-purple-600 mt-0.5">
                Off by default — every variant uses the pricing above. Turn on when
                a size or color genuinely costs or sells for a different amount.
              </p>
            </div>
          </label>

          {form.hasVariantPricing && (
            <VariantPricingTable
              form={form} matrix={matrix} setMatrix={setMatrix}
              variantPricing={variantPricing}
            />
          )}
        </FormSection>
      )}
    </div>
  );
}
