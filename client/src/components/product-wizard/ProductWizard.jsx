/**
 * ProductWizard — the 5-step Add/Edit Product flow.
 *
 * Basic → Variants → Pricing → GST & Details → Review
 *
 * Step 2 is SKIPPED in both directions when the product has no variants, so a
 * simple product is still a fast three-screen flow. The toggle that decides it
 * lives on step 1, which is what makes the skip predictable rather than
 * surprising.
 *
 * Replaces the old single-page ProductForm and carries every one of its fields,
 * so nothing regresses for products that never touch variants.
 */
import { useState, useMemo } from 'react';
import {
  Package, Grid3x3, Tag, FileText, ClipboardCheck,
  ChevronLeft, ChevronRight, Check, AlertCircle, Loader2,
} from 'lucide-react';
import useShopStore from '../../store/shopStore';
import { useProductWizard } from './useProductWizard';
import StepBasic    from './StepBasic';
import StepVariants from './StepVariants';
import StepPricing  from './StepPricing';
import StepDetails  from './StepDetails';
import StepReview   from './StepReview';

const STEPS = [
  { n: 1, label: 'Basic',    icon: Package },
  { n: 2, label: 'Variants', icon: Grid3x3 },
  { n: 3, label: 'Pricing',  icon: Tag },
  { n: 4, label: 'Details',  icon: FileText },
  { n: 5, label: 'Review',   icon: ClipboardCheck },
];

export function ProductWizard({
  form, setForm, onSubmit, loading,
  shops = [], shopId, categories = [], isEdit = false, productId,
}) {
  const [step, setStep] = useState(1);
  const { activeShop } = useShopStore();

  const wiz = useProductWizard({
    form, setForm, shopId, productId,
    gstMode: activeShop?.gstMode || 'exclusive',
  });

  // Step 2 only exists for variant products.
  const visibleSteps = useMemo(
    () => STEPS.filter((s) => s.n !== 2 || form.hasVariants),
    [form.hasVariants]
  );

  const idx      = visibleSteps.findIndex((s) => s.n === step);
  const isFirst  = idx <= 0;
  const isLast   = idx === visibleSteps.length - 1;

  // If variants get switched off while sitting on step 2, don't strand the user.
  const safeStep = idx === -1 ? 1 : step;
  if (idx === -1 && step !== 1) setStep(1);

  const goNext = () => {
    if (!wiz.canAdvance(safeStep)) return;
    const next = visibleSteps[idx + 1];
    if (next) setStep(next.n);
  };
  const goBack = () => {
    const prev = visibleSteps[idx - 1];
    if (prev) setStep(prev.n);
  };

  const handleSave = (e) => {
    e.preventDefault();
    // Everything is validated inline; this is the last gate before the request.
    const firstBad = visibleSteps.find((s) => !wiz.canAdvance(s.n));
    if (firstBad) { setStep(firstBad.n); return; }
    onSubmit(wiz.toPayload(), wiz.clearDraft);
  };

  const reason = wiz.blockingReason(safeStep);

  return (
    <form onSubmit={handleSave} className="flex flex-col min-h-0">

      {/* ── Step rail ─────────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1 sm:gap-2 pb-4 mb-4 border-b border-gray-100 overflow-x-auto no-scrollbar">
        {visibleSteps.map((s, i) => {
          const Icon    = s.icon;
          const active  = s.n === safeStep;
          const done    = i < idx;
          const errCount = wiz.stepErrors[s.n] || 0;
          return (
            <div key={s.n} className="flex items-center shrink-0">
              <button
                type="button"
                // Jumping forward past validation would land the user on Review
                // with an unsaveable product, so only completed steps are links.
                onClick={() => (done || active) && setStep(s.n)}
                disabled={!done && !active}
                className={`flex items-center gap-2 px-2.5 sm:px-3 h-9 rounded-xl text-sm font-medium transition ${
                  active ? 'bg-blue-600 text-white shadow-sm'
                  : done  ? 'text-blue-700 hover:bg-blue-50'
                          : 'text-gray-400 cursor-default'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  active ? 'bg-white/20'
                  : done  ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-400'
                }`}>
                  {done ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                <Icon className="w-4 h-4 shrink-0 hidden sm:block" />
                <span className="hidden sm:inline">{s.label}</span>
                {errCount > 0 && !active && (
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {errCount}
                  </span>
                )}
              </button>
              {i < visibleSteps.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 mx-0.5 shrink-0" />
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Active step ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        {safeStep === 1 && (
          <StepBasic form={form} upd={wiz.upd} errors={wiz.errors}
            shops={shops} shopId={shopId} categories={categories} />
        )}
        {safeStep === 2 && (
          <StepVariants form={form} upd={wiz.upd} errors={wiz.errors}
            matrix={wiz.matrix} setMatrix={wiz.setMatrix} totals={wiz.totals}
            receivedMismatch={wiz.receivedMismatch} />
        )}
        {safeStep === 3 && (
          <StepPricing form={form} upd={wiz.upd} errors={wiz.errors}
            pricing={wiz.pricing} variantPricing={wiz.variantPricing}
            matrix={wiz.matrix} setMatrix={wiz.setMatrix} />
        )}
        {safeStep === 4 && (
          <StepDetails form={form} upd={wiz.upd} errors={wiz.errors}
            pricing={wiz.pricing} isEdit={isEdit} />
        )}
        {safeStep === 5 && (
          <StepReview form={form} matrix={wiz.matrix} totals={wiz.totals}
            pricing={wiz.pricing} variantPricing={wiz.variantPricing}
            summary={wiz.summary} shops={shops} onJumpToStep={setStep} />
        )}
      </div>

      {/* ── Blocking reason — inline, never a modal ───────────────────────── */}
      {reason && (
        <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-700">{reason}</p>
        </div>
      )}

      {/* ── Sticky footer ─────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 flex items-center gap-2 mt-4 -mx-6 px-6 pt-4 pb-safe bg-white border-t border-gray-100">
        <button
          type="button"
          onClick={goBack}
          disabled={isFirst}
          className="btn-secondary flex-1 sm:flex-none disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <span className="hidden sm:block flex-1 text-xs text-gray-400 text-center">
          Step {idx + 1} of {visibleSteps.length}
        </span>

        {isLast ? (
          <button type="submit" disabled={loading} className="btn-primary flex-1 sm:flex-none">
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Check className="w-4 h-4" />}
            {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Product'}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={!wiz.canAdvance(safeStep)}
            className="btn-primary flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </form>
  );
}

export default ProductWizard;
