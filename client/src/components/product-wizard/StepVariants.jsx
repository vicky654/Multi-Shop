/**
 * Step 2 — Variants and stock breakdown.
 *
 * Only reached when "this product has variants" is on. The axis selector decides
 * whether the grid is color × size, size only, or color only — all three are
 * real shapes the model supports, so all three are offered rather than forcing
 * a fake second axis.
 */
import { Grid3x3, Palette, Ruler, AlertTriangle, PackageCheck } from 'lucide-react';
import { FormSection } from '../ui/FormSection';
import VariantMatrix from './VariantMatrix';
import { distributeEvenly } from '../../utils/variantMatrix';
import {
  inp, Field, Segmented, SizeSelector, ColorSelector,
  SHOE_SIZES, DEFAULT_SIZES, looksLikeFootwear,
} from './fields';

const AXES = [
  { value: 'both',  label: 'Color + Size' },
  { value: 'color', label: 'Color only' },
  { value: 'size',  label: 'Size only' },
];

export default function StepVariants({
  form, upd, errors, matrix, setMatrix, totals, receivedMismatch,
}) {
  const showColors = form.variantAxis !== 'size';
  const showSizes  = form.variantAxis !== 'color';

  // Shoe sizes for footwear, clothing sizes otherwise — the wizard's whole point
  // is not making the user type 7,8,9,10,11 by hand.
  const sizePresets = looksLikeFootwear(form.category) ? SHOE_SIZES : DEFAULT_SIZES;

  return (
    <div className="space-y-4">

      <FormSection title="Variant Type" icon={Grid3x3} color="purple">
        <p className="text-xs text-purple-600 -mt-1">
          How is this product divided? You can change this later without losing quantities.
        </p>
        <Segmented
          value={form.variantAxis}
          onChange={(v) => upd('variantAxis', v)}
          options={AXES}
          className="w-full sm:w-auto"
        />
      </FormSection>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {showColors && (
          <FormSection title="Colors" icon={Palette} color="purple">
            <ColorSelector selected={form.colors} onChange={(v) => upd('colors', v)} />
            {errors.colors && <p className="text-xs font-medium text-red-600">{errors.colors}</p>}
          </FormSection>
        )}

        {showSizes && (
          <FormSection title="Sizes" icon={Ruler} color="purple">
            <SizeSelector
              selected={form.sizes}
              onChange={(v) => upd('sizes', v)}
              presets={sizePresets}
            />
            {errors.sizes && <p className="text-xs font-medium text-red-600">{errors.sizes}</p>}
          </FormSection>
        )}
      </div>

      <FormSection title="Stock Breakdown" icon={PackageCheck} color="green">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label={`Total Received (${form.unit || 'pcs'})`}
            hint="Optional cross-check — the matrix below is what gets saved"
          >
            <input
              type="number" min="0" value={form.totalReceived}
              onChange={(e) => upd('totalReceived', e.target.value)}
              placeholder="e.g. 100" className={inp}
            />
          </Field>
          <Field label="Low Stock Alert ≤">
            <input type="number" min="0" value={form.lowStockThreshold}
              onChange={(e) => upd('lowStockThreshold', e.target.value)} className={inp} />
          </Field>
        </div>

        {/* Mismatch is a WARNING. It must never block Next — the user may
            genuinely have received a different count than they expected. */}
        {receivedMismatch && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 flex-1 min-w-[12rem]">
              Matrix totals <b>{receivedMismatch.matrixTotal}</b> but you received{' '}
              <b>{receivedMismatch.received}</b> —{' '}
              {receivedMismatch.diff > 0 ? 'over' : 'short'} by{' '}
              <b>{Math.abs(receivedMismatch.diff)}</b>.
            </p>
            <button
              type="button"
              onClick={() => upd('totalReceived', String(receivedMismatch.matrixTotal))}
              className="h-8 px-3 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg text-xs font-semibold text-amber-800 transition"
            >
              Use matrix total
            </button>
            <button
              type="button"
              onClick={() => setMatrix(distributeEvenly(matrix, receivedMismatch.received))}
              className="h-8 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition"
            >
              Distribute {receivedMismatch.received}
            </button>
          </div>
        )}

        <VariantMatrix
          matrix={matrix}
          totals={totals}
          setMatrix={setMatrix}
          totalReceived={form.totalReceived}
        />

        {errors.matrix && <p className="text-xs font-medium text-red-600">{errors.matrix}</p>}
      </FormSection>
    </div>
  );
}
