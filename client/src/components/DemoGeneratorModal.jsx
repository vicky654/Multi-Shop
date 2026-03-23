/**
 * DemoGeneratorModal.jsx
 *
 * Full-screen demo data generator with animated progress steps,
 * success summary, and reset-confirm flow.
 *
 * Usage:
 *   <DemoGeneratorModal
 *     shopId={activeShop._id}
 *     shopName={activeShop.name}
 *     isDemoActive={isDemoMode}
 *     onClose={close}
 *     onGenerated={() => { ... }}
 *     onCleared={() => { ... }}
 *   />
 */

import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FlaskConical, Zap, CheckCircle2, XCircle, Loader2,
  Package, Users, ShoppingCart, Receipt, Trash2, X,
  BarChart2, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { demoApi } from '../api/demo.api';
import useSetupStore from '../store/setupStore';

// ── Progress step definitions ─────────────────────────────────────────────────

const STEPS = [
  { id: 'products',  icon: Package,     label: 'Creating Products…',    delay: 0    },
  { id: 'customers', icon: Users,       label: 'Adding Customers…',     delay: 900  },
  { id: 'sales',     icon: ShoppingCart,label: 'Simulating Sales…',     delay: 1800 },
  { id: 'expenses',  icon: Receipt,     label: 'Logging Expenses…',     delay: 2700 },
  { id: 'analytics', icon: BarChart2,   label: 'Building Dashboard…',   delay: 3400 },
];

// ── Step row ──────────────────────────────────────────────────────────────────

function ProgressRow({ step, status }) {
  // status: 'pending' | 'active' | 'done'
  const Icon = step.icon;
  return (
    <div className={`flex items-center gap-3 py-2 transition-opacity ${status === 'pending' ? 'opacity-30' : 'opacity-100'}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
        status === 'done'   ? 'bg-green-100'
        : status === 'active' ? 'bg-blue-100 animate-pulse'
        : 'bg-gray-100'
      }`}>
        {status === 'done' ? (
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        ) : status === 'active' ? (
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
        ) : (
          <Icon className="w-4 h-4 text-gray-400" />
        )}
      </div>
      <span className={`text-sm font-medium ${
        status === 'done'   ? 'text-green-700'
        : status === 'active' ? 'text-blue-700'
        : 'text-gray-400'
      }`}>
        {status === 'done' ? step.label.replace('…', ' ✓') : step.label}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DemoGeneratorModal({
  shopId,
  shopName,
  isDemoActive,
  onClose,
  onGenerated,
  onCleared,
}) {
  const qc = useQueryClient();

  // 'idle' | 'confirm-reset' | 'generating' | 'done' | 'clearing'
  const [phase,       setPhase]       = useState(isDemoActive ? 'confirm-reset' : 'idle');
  const [activeStep,  setActiveStep]  = useState(-1);
  const [doneSteps,   setDoneSteps]   = useState(new Set());
  const [result,      setResult]      = useState(null);
  const timersRef = useRef([]);

  // ── Seed mutation ───────────────────────────────────────────────────────────
  const seedMut = useMutation({
    mutationFn: () => demoApi.seed(shopId),
    onSuccess: (res) => {
      const data = res.data || res;
      setResult(data);
      // Mark all steps done immediately then transition to 'done'
      setDoneSteps(new Set(STEPS.map((s) => s.id)));
      setActiveStep(-1);
      setTimeout(() => setPhase('done'), 400);

      useSetupStore.setState({ isDemoMode: true, hasProducts: true, hasCustomers: true, hasSales: true });
      qc.invalidateQueries(['products']);
      qc.invalidateQueries(['customers']);
      qc.invalidateQueries(['sales']);
      qc.invalidateQueries(['dashboard']);
      qc.invalidateQueries(['reports']);
      qc.invalidateQueries(['expenses']);

      onGenerated?.();
    },
    onError: (e) => {
      clearTimers();
      setPhase('idle');
      toast.error(`Demo generation failed: ${e.message}`);
    },
  });

  // ── Clear mutation ──────────────────────────────────────────────────────────
  const clearMut = useMutation({
    mutationFn: () => demoApi.clear(shopId),
    onSuccess: () => {
      useSetupStore.setState({ isDemoMode: false });
      qc.invalidateQueries(['products']);
      qc.invalidateQueries(['customers']);
      qc.invalidateQueries(['sales']);
      qc.invalidateQueries(['expenses']);
      qc.invalidateQueries(['dashboard']);
      qc.invalidateQueries(['reports']);
      toast.success('Demo data cleared');
      onCleared?.();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Animated progress steps ─────────────────────────────────────────────────
  const clearTimers = () => timersRef.current.forEach(clearTimeout);

  const startProgress = () => {
    clearTimers();
    timersRef.current = [];
    setDoneSteps(new Set());
    setActiveStep(0);

    STEPS.forEach((step, i) => {
      // Activate step i at its delay
      const t1 = setTimeout(() => setActiveStep(i), step.delay);
      // Mark step i done 750ms later (or when next step starts)
      const doneDelay = step.delay + 750;
      const t2 = setTimeout(() => {
        setDoneSteps((prev) => new Set([...prev, step.id]));
      }, doneDelay);
      timersRef.current.push(t1, t2);
    });
  };

  useEffect(() => () => clearTimers(), []);

  const handleGenerate = () => {
    setPhase('generating');
    startProgress();
    seedMut.mutate();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* ══ IDLE / initial screen ════════════════════════════════════════════ */}
        {phase === 'idle' && (
          <div className="p-7 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <FlaskConical className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-lg leading-tight">Generate Demo Data</h2>
                  <p className="text-xs text-gray-400">{shopName}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* What gets generated */}
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Will generate</p>
              {[
                { icon: Package,      color: 'text-blue-500',   bg: 'bg-blue-50',   text: '~30 Products across 6 categories' },
                { icon: Users,        color: 'text-purple-500', bg: 'bg-purple-50', text: '30 Customers with Indian numbers' },
                { icon: ShoppingCart, color: 'text-green-500',  bg: 'bg-green-50',  text: '~200 Sales over 30 days (chart-ready)' },
                { icon: Receipt,      color: 'text-amber-500',  bg: 'bg-amber-50',  text: '15 Operational Expenses' },
              ].map(({ icon: Icon, color, bg, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                  </div>
                  <p className="text-sm text-gray-700">{text}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400 text-center leading-relaxed">
              All demo records are tagged <span className="font-mono bg-gray-100 px-1 rounded">isDemo: true</span> for safe cleanup.
            </p>

            <div className="flex gap-2.5">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-sm font-bold transition shadow-lg shadow-indigo-200"
              >
                <Zap className="w-4 h-4" />
                Generate Now
              </button>
            </div>
          </div>
        )}

        {/* ══ CONFIRM RESET (demo already active) ═════════════════════════════ */}
        {phase === 'confirm-reset' && (
          <div className="p-7 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-amber-100 rounded-2xl flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-lg leading-tight">Demo Already Active</h2>
                  <p className="text-xs text-gray-400">{shopName}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              Demo data is already loaded for this shop. Choose an action:
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => setPhase('idle')}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-indigo-200 hover:border-indigo-400 bg-indigo-50 transition text-left"
              >
                <RefreshCw className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-indigo-800">Regenerate Demo</p>
                  <p className="text-xs text-indigo-600">Clear existing demo + generate fresh data</p>
                </div>
              </button>
              <button
                onClick={() => clearMut.mutate()}
                disabled={clearMut.isPending}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-red-200 hover:border-red-400 bg-red-50 transition disabled:opacity-60 text-left"
              >
                {clearMut.isPending ? (
                  <Loader2 className="w-5 h-5 text-red-500 animate-spin shrink-0" />
                ) : (
                  <Trash2 className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-bold text-red-800">
                    {clearMut.isPending ? 'Clearing…' : 'Clear Demo Data'}
                  </p>
                  <p className="text-xs text-red-600">Remove all demo records permanently</p>
                </div>
              </button>
            </div>

            <button onClick={onClose} className="w-full py-2.5 rounded-2xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        )}

        {/* ══ GENERATING ══════════════════════════════════════════════════════ */}
        {phase === 'generating' && (
          <div className="p-7 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FlaskConical className="w-7 h-7 text-indigo-600 animate-bounce" />
              </div>
              <h2 className="font-bold text-gray-900 text-lg">Generating Demo Data…</h2>
              <p className="text-xs text-gray-400 mt-1">Making your shop look fully active</p>
            </div>

            <div className="bg-gray-50 rounded-2xl px-4 py-3 space-y-0.5">
              {STEPS.map((step, i) => {
                const status = doneSteps.has(step.id)
                  ? 'done'
                  : activeStep === i
                  ? 'active'
                  : 'pending';
                return <ProgressRow key={step.id} step={step} status={status} />;
              })}
            </div>

            <p className="text-center text-xs text-gray-400">
              This may take a few seconds…
            </p>
          </div>
        )}

        {/* ══ DONE ════════════════════════════════════════════════════════════ */}
        {phase === 'done' && result && (
          <div className="p-7 space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-3xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
              <h2 className="font-black text-gray-900 text-2xl">Demo Ready! 🎉</h2>
              <p className="text-sm text-gray-500 mt-1">Your system is fully loaded</p>
            </div>

            {/* Counts grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Package,      color: 'text-blue-600',   bg: 'bg-blue-50',   label: 'Products',  count: result.products  },
                { icon: Users,        color: 'text-purple-600', bg: 'bg-purple-50', label: 'Customers', count: result.customers },
                { icon: ShoppingCart, color: 'text-green-600',  bg: 'bg-green-50',  label: 'Sales',     count: result.sales     },
                { icon: Receipt,      color: 'text-amber-600',  bg: 'bg-amber-50',  label: 'Expenses',  count: result.expenses  },
              ].map(({ icon: Icon, color, bg, label, count }) => (
                <div key={label} className={`${bg} rounded-2xl p-3.5 flex items-center gap-3`}>
                  <Icon className={`w-5 h-5 ${color} shrink-0`} />
                  <div>
                    <p className={`text-xl font-black tabular-nums ${color}`}>{count ?? '—'}</p>
                    <p className="text-xs font-semibold text-gray-500">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
              <FlaskConical className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 font-medium">
                Demo Mode Active — a banner at the top lets you clear data any time.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm transition"
            >
              Explore Your Demo
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
