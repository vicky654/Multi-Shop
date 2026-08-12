/**
 * VariantPricingTable — optional per-combination pricing.
 *
 * An EMPTY input means "inherit the product-level value", and the inherited
 * figure shows as placeholder text. That distinction matters: null inherits,
 * whereas a typed 0 is a real ₹0 the server will store and bill. Making the two
 * look different on screen is what stops someone accidentally selling shoes free.
 */
import NumberInput from '../ui/NumberInput';
import { setCell, cellKey } from '../../utils/variantMatrix';
import { inr } from './fields';

const cellInput =
  'w-full h-9 px-2 text-right border border-gray-300 rounded-lg text-sm bg-white '
  + 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition '
  + 'placeholder-gray-300';

export default function VariantPricingTable({ form, matrix, setMatrix, variantPricing }) {
  const rows = variantPricing.filter((r) => r.stock > 0 || r.cell.price !== null);

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-400">
        Enter quantities on the Variants step first.
      </p>
    );
  }

  // Written back onto the cell; '' clears the override back to inherit (null).
  const write = (color, size, key) => (raw) =>
    setMatrix(setCell(matrix, color, size, { [key]: raw === '' ? null : Number(raw) }));

  const th = 'px-2 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide';

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className={`${th} sticky left-0 z-20 bg-white text-left min-w-[8rem]`}>Variant</th>
            <th className={`${th} text-right min-w-[3.5rem]`}>Qty</th>
            <th className={`${th} text-right min-w-[6rem]`}>Cost</th>
            <th className={`${th} text-right min-w-[6rem]`}>Selling</th>
            <th className={`${th} text-right min-w-[5.5rem]`}>Disc %</th>
            <th className={`${th} text-right min-w-[6rem] bg-blue-50/60`}>Customer Pays</th>
            <th className={`${th} text-right min-w-[5.5rem]`}>Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ color, size, cell, pricing, stock }) => {
            const label = [color, size].filter(Boolean).join(' / ') || '—';
            const overridden = cell.price !== null || cell.costPrice !== null;
            return (
              <tr key={cellKey(color, size)} className="group">
                <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50/80 px-2 py-1.5 border-t border-gray-100 font-medium text-gray-800">
                  {label}
                  {overridden && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold">
                      custom
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 border-t border-gray-100 text-right text-gray-500">{stock}</td>

                <td className="px-1 py-1.5 border-t border-gray-100">
                  <NumberInput
                    value={cell.costPrice ?? ''}
                    onCommit={write(color, size, 'costPrice')}
                    min="0" step="0.01"
                    placeholder={String(form.costPrice || 0)}
                    className={cellInput}
                  />
                </td>
                <td className="px-1 py-1.5 border-t border-gray-100">
                  <NumberInput
                    value={cell.price ?? ''}
                    onCommit={write(color, size, 'price')}
                    min="0" step="0.01"
                    placeholder={String(form.price || 0)}
                    className={cellInput}
                  />
                </td>
                <td className="px-1 py-1.5 border-t border-gray-100">
                  <NumberInput
                    value={cell.discountValue ?? ''}
                    onCommit={(raw) => setMatrix(setCell(matrix, color, size, {
                      discountValue: raw === '' ? null : Number(raw),
                      // A per-variant discount is always a percentage — the extra
                      // ₹/% switch per row would cost more clarity than it buys.
                      discountType:  raw === '' ? null : 'percent',
                    }))}
                    min="0" max="100"
                    placeholder={String(form.discountType === 'percent' ? form.discountValue || 0 : 0)}
                    className={cellInput}
                  />
                </td>

                <td className="px-2 py-1.5 border-t border-gray-100 text-right font-bold text-blue-700 bg-blue-50/40">
                  {inr(pricing.finalPrice)}
                </td>
                <td className={`px-2 py-1.5 border-t border-gray-100 text-right font-semibold ${
                  pricing.profitAmount >= 0 ? 'text-green-600' : 'text-red-500'
                }`}>
                  {pricing.profitAmount < 0 ? '−' : ''}{inr(pricing.profitAmount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-gray-400">
        Leave a cell blank to use the product price shown as a placeholder.
      </p>
    </div>
  );
}
