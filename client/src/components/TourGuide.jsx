/**
 * TourGuide — custom spotlight tour (no extra deps, uses framer-motion)
 *
 * step === -1 → Welcome modal (centered)
 * step  0-3  → Spotlight on data-tour element + floating tooltip
 */
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { TOUR_STEPS } from '../hooks/useTour';

const TOOLTIP_W = 304;
const PAD       = 12;
const SPOT_PAD  = 10;

function getTooltipPos(rect) {
  if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Prefer right of element
  if (rect.left + rect.width + PAD + TOOLTIP_W < vw) {
    return {
      top:  Math.max(PAD, Math.min(vh - 200, rect.top + rect.height / 2 - 90)),
      left: rect.left + rect.width + PAD,
    };
  }
  // Below element
  if (rect.top + rect.height + PAD + 160 < vh) {
    return {
      top:  rect.top + rect.height + PAD,
      left: Math.max(PAD, Math.min(vw - TOOLTIP_W - PAD, rect.left)),
    };
  }
  // Above element
  return {
    top:  Math.max(PAD, rect.top - 160 - PAD),
    left: Math.max(PAD, Math.min(vw - TOOLTIP_W - PAD, rect.left)),
  };
}

// ── Spotlight overlay ─────────────────────────────────────────────────────────
function Spotlight({ rect }) {
  if (!rect) return null;
  return (
    <div
      className="fixed pointer-events-none z-[9998]"
      style={{
        top:       rect.top    - SPOT_PAD,
        left:      rect.left   - SPOT_PAD,
        width:     rect.width  + SPOT_PAD * 2,
        height:    rect.height + SPOT_PAD * 2,
        borderRadius: 14,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
        border:    '2px solid rgba(59,130,246,0.7)',
        transition: 'top 0.3s, left 0.3s, width 0.3s, height 0.3s',
      }}
    />
  );
}

// ── Welcome modal ─────────────────────────────────────────────────────────────
function WelcomeModal({ onStart, onSkip }) {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onSkip} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1,   opacity: 1, y: 0  }}
        exit={{   scale: 0.9, opacity: 0, y: 20  }}
        transition={{ type: 'spring', damping: 22, stiffness: 350 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 text-center"
      >
        <button onClick={onSkip} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition">
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
          <Sparkles className="w-8 h-8 text-white" />
        </div>

        <h2 className="text-2xl font-black text-gray-900 mb-2">
          👋 Welcome to MultiShop
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          This app helps you manage your shop easily — add products, create bills,
          track sales, and get smart AI suggestions to grow your profit.
        </p>

        {/* 3 quick highlights */}
        <div className="space-y-2 text-left mb-6">
          {['📦 Manage products & inventory', '🛍️ Create bills in seconds', '📊 Track daily profit & sales'].map((t) => (
            <div key={t} className="flex items-center gap-2.5 text-sm text-gray-600">
              <span>{t}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/30"
        >
          Start Tour <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={onSkip} className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 transition py-1">
          Skip for now
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Step tooltip ──────────────────────────────────────────────────────────────
function StepTooltip({ step, rect, onNext, onPrev, onSkip }) {
  const current = TOUR_STEPS[step];
  const pos     = getTooltipPos(rect);
  const isMobile = window.innerWidth < 1024;
  const isLast  = step === TOUR_STEPS.length - 1;

  // On mobile, sidebar is hidden → center the tooltip
  const style = isMobile
    ? { position: 'fixed', bottom: '6rem', left: '50%', transform: 'translateX(-50%)', width: TOOLTIP_W }
    : { position: 'fixed', ...pos, width: TOOLTIP_W };

  return (
    <motion.div
      key={step}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1  }}
      exit={{   opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.18 }}
      style={style}
      className="z-[9999] bg-white rounded-2xl shadow-2xl shadow-black/25 p-4 border border-gray-100"
    >
      {/* Step counter */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {TOUR_STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-blue-600' : 'w-1.5 bg-gray-200'}`} />
          ))}
        </div>
        <button onClick={onSkip} className="p-1 rounded-full hover:bg-gray-100 text-gray-400 transition">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <h3 className="font-bold text-gray-900 text-sm mb-1">{current.title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed mb-4">{current.content}</p>

      {/* Buttons */}
      <div className="flex items-center gap-2">
        {step > 0 && (
          <button
            onClick={onPrev}
            className="flex items-center gap-1 h-8 px-3 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
        )}
        <button
          onClick={onNext}
          className="flex-1 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
        >
          {isLast ? 'Finish ✓' : <>Next <ChevronRight className="w-3.5 h-3.5" /></>}
        </button>
      </div>
    </motion.div>
  );
}

// ── Main TourGuide ─────────────────────────────────────────────────────────────
export default function TourGuide({ isOpen, step, beginSteps, nextStep, prevStep, skipTour }) {
  const [rect, setRect] = useState(null);

  const updateRect = useCallback(() => {
    const current = TOUR_STEPS[step];
    if (!current || step < 0) { setRect(null); return; }
    const el = document.querySelector(current.target);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setRect(null); // element not visible (e.g. sidebar hidden on mobile)
    }
  }, [step]);

  useEffect(() => {
    if (!isOpen || step < 0) { setRect(null); return; }
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isOpen, step, updateRect]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen || step < 0) return;
    const onKey = (e) => {
      if (e.key === 'Escape') skipTour();
      if (e.key === 'ArrowRight') nextStep();
      if (e.key === 'ArrowLeft' && step > 0) prevStep();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, step, nextStep, prevStep, skipTour]);

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      {step === -1 ? (
        <WelcomeModal key="welcome" onStart={beginSteps} onSkip={skipTour} />
      ) : (
        <>
          {/* Dark backdrop (click to skip) */}
          <div
            className="fixed inset-0 z-[9997]"
            onClick={skipTour}
          />
          {/* Spotlight highlight */}
          {rect && <Spotlight key={`spot-${step}`} rect={rect} />}
          {/* Tooltip */}
          <StepTooltip
            key={`tip-${step}`}
            step={step}
            rect={rect}
            onNext={nextStep}
            onPrev={prevStep}
            onSkip={skipTour}
          />
        </>
      )}
    </AnimatePresence>
  );
}
