import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Receipt, Landmark, AlertTriangle, Info, ShieldCheck,
  ChevronRight, FileWarning, Percent,
} from 'lucide-react';
import { taxApi } from '../api/tax.api';
import useShopStore from '../store/shopStore';
import { formatINR } from '../utils/format';
import ExpenseClassifier from '../components/tax/ExpenseClassifier';
import HelpTooltip from '../components/HelpTooltip';
import { TIPS } from '../constants/tooltips';

/**
 * Tax & Profit — legal tax optimisation and accounting.
 *
 * DESIGN STANCE
 *   This screen never shows a tax number the software invented. Statutory rates
 *   live on the shop's TaxProfile and must be confirmed by an accountant; until
 *   then the tax cards render an explicit "rates not confirmed" state instead of a
 *   figure. Every estimate is labelled as an estimate.
 *
 *   Expenses and input tax credit awaiting review are shown BESIDE the totals but
 *   excluded from them, so an unreviewed item can never quietly inflate a
 *   deduction or a credit.
 */

const FY_OPTIONS = ['2024-25', '2025-26', '2026-27', '2027-28'];

const inr = (n) => (n === null || n === undefined ? '—' : formatINR(n, 2));

export default function TaxProfit() {
  const { activeShop } = useShopStore();
  const shopId = activeShop?._id;
  const [fy, setFy] = useState('2026-27');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tax-summary', shopId, fy],
    queryFn:  () => taxApi.summary({ shopId, financialYear: fy }),
    enabled:  !!shopId,
  });

  const { data: reviewData } = useQuery({
    queryKey: ['tax-review', shopId, fy],
    queryFn:  () => taxApi.review({ shopId, financialYear: fy }),
    enabled:  !!shopId,
  });

  const s = data?.data;
  const reviewItems = reviewData?.data?.items || [];

  if (!shopId) {
    return (
      <EmptyState icon={Landmark} title="Select a shop"
        body="Choose an active shop to see its tax and profit position." />
    );
  }
  if (isLoading) return <Skeleton />;
  if (isError) {
    return (
      <EmptyState icon={FileWarning} title="Could not load the tax summary"
        body={error?.message || 'Please try again.'} />
    );
  }

  const ratesConfirmed = s.confirmed.incomeTaxRates;

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            Tax &amp; Profit
            <HelpTooltip content={TIPS.taxProfit} side="right" maxWidth={320} />
          </h1>
          <p className="text-sm text-gray-500">
            {activeShop?.name} · Financial year {s.period.financialYear}
          </p>
        </div>
        <select
          value={fy}
          onChange={(e) => setFy(e.target.value)}
          aria-label="Financial year"
          className="ui-select sm:w-40"
        >
          {FY_OPTIONS.map((y) => <option key={y} value={y}>FY {y}</option>)}
        </select>
      </div>

      {/* ── Estimate disclaimer. Not decoration — this screen shows tax figures. ── */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-200">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">{s.disclaimer}</p>
      </div>

      {/* ── Three primary cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PrimaryCard
          icon={TrendingUp}
          tone="green"
          label="Estimated Business Profit"
          value={inr(s.estimatedTaxableProfit)}
          foot={s.basis === 'presumptive_44ad'
            ? 'Presumptive basis (44AD) — a percentage of turnover'
            : 'Net sales − COGS − deductible expenses − depreciation'}
        />
        <PrimaryCard
          icon={Receipt}
          tone={s.gst.applicable ? 'blue' : 'gray'}
          label={s.gst.scheme === 'composition' ? 'Estimated GST (Composition)' : 'Estimated GST Payable'}
          value={s.gst.applicable ? inr(s.gst.payable) : 'Not registered'}
          foot={s.gst.scheme === 'regular'
            ? `Output ${inr(s.gst.outputGst)} − eligible ITC ${inr(s.gst.eligibleItc)}`
            : s.gst.reason}
          unconfirmed={s.gst.applicable && !s.gst.confirmed}
        />
        <PrimaryCard
          icon={Landmark}
          tone={ratesConfirmed ? 'violet' : 'amber'}
          label="Estimated Income Tax"
          value={ratesConfirmed ? inr(s.incomeTax.total) : 'Rates not confirmed'}
          foot={ratesConfirmed
            ? `After-tax profit ${inr(s.afterTaxProfit)}`
            : 'Your accountant must confirm this year’s rates before an estimate can be shown'}
          unconfirmed={!ratesConfirmed}
        />
      </div>

      {/* ── Rates not confirmed: say exactly what is missing ─────────────────── */}
      {s.missingRates?.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Tax rates for FY {s.period.financialYear} are not confirmed
          </p>
          <p className="text-xs text-amber-800 mt-1.5 leading-relaxed">
            MultiShop deliberately ships no tax rates. Indian rates change by year, and a
            rate this software guessed would be worse than none — you might file against it.
            Ask your accountant to confirm these in Settings, and the estimates above will
            appear:
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {s.missingRates.map((m) => (
              <li key={m} className="text-[11px] font-mono px-2 py-0.5 rounded bg-white border border-amber-300 text-amber-900">
                {m}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Profit chain ───────────────────────────────────────────────────── */}
      <section className="ui-card p-0 overflow-hidden">
        <SectionHead title="How the profit is calculated" />
        <div className="p-4 sm:p-5 space-y-0.5 max-w-2xl">
          <Line label="Gross Sales (excluding GST)" value={inr(s.sales.grossSales)} />
          <Line label="Sales Returns" value={`− ${inr(s.sales.salesReturns)}`} tone="amber" />
          <Line label="Net Sales" value={inr(s.sales.netSales)} strong />
          <Line label="Cost of Goods Sold" value={`− ${inr(s.cogs)}`} tone="amber" />
          <Line label="Gross Profit" value={inr(s.grossProfit)} strong />
          <Line label="Deductible Expenses" value={`− ${inr(s.expenses.deductible)}`} tone="amber" />
          <Line label="Depreciation" value={`− ${inr(s.depreciation.total)}`} tone="amber" />
          <div className="pt-2 mt-1 border-t-2 border-gray-900">
            <Line label={s.basis === 'presumptive_44ad' ? 'Book Profit (not used for tax)' : 'Estimated Business Profit'}
              value={inr(s.bookProfit)} strong big />
          </div>

          {s.basis === 'presumptive_44ad' && s.presumptive && (
            <div className="mt-3 p-3 rounded-lg bg-violet-50 border border-violet-200 space-y-1">
              <p className="text-xs font-bold text-violet-900 uppercase tracking-wide">Presumptive basis (44AD)</p>
              <Line label={`Digital turnover @ ${s.presumptive.ratesUsed.digitalRatePct}%`}
                value={inr(s.presumptive.digitalTurnover)} small />
              <Line label={`Cash turnover @ ${s.presumptive.ratesUsed.cashRatePct}%`}
                value={inr(s.presumptive.cashTurnover)} small />
              <Line label="Deemed Profit" value={inr(s.presumptive.deemedProfit)} strong />
              {s.presumptive.exceedsLimit && (
                <p className="text-[11px] font-semibold text-red-700 pt-1">
                  Turnover exceeds the 44AD limit — confirm eligibility with your accountant.
                </p>
              )}
            </div>
          )}

          {/* The single most misread line on a tax screen, stated explicitly. */}
          <p className="text-xs text-gray-500 pt-3 leading-relaxed">{s.expenses.note}</p>
        </div>
      </section>

      {/* ── Purchases & stock ──────────────────────────────────────────────── */}
      <section className="ui-card p-0 overflow-hidden">
        <SectionHead title="Purchases & stock" right={`${s.purchases?.grnCount ?? 0} GRN(s)`} />
        <div className="p-4 sm:p-5 space-y-0.5 max-w-2xl">
          <Line label="Opening Stock"
            value={s.openingStock ? inr(s.openingStock.value) : 'Not recorded'}
            tone={s.openingStock ? undefined : 'amber'} />
          <Line label={`Purchases (${s.purchases?.units ?? 0} units received)`}
            value={inr(s.purchases?.value)} />
          <Line label="Closing Stock (valued now)" value={inr(s.stockValuation?.closingStockValue)} />
          {s.periodicReconciliation?.available ? (
            <div className="pt-2 mt-1 border-t-2 border-gray-900">
              <Line label="COGS (Opening + Purchases − Closing)"
                value={inr(s.periodicReconciliation.periodicCogs)} strong big />
              <p className="text-xs text-gray-500 pt-2 leading-relaxed">
                Cross-check against the sale-line figure of {inr(s.cogs)} — a gap indicates
                shrinkage, damage or unrecorded movement.
              </p>
            </div>
          ) : (
            <p className="text-xs text-amber-800 mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 leading-relaxed">
              <b>Opening + Purchases − Closing is not available.</b>{' '}
              {s.periodicReconciliation?.blockedBy}
            </p>
          )}
          {s.purchases?.gstReview > 0 && (
            <p className="text-[11px] text-amber-700 pt-2">
              {inr(s.purchases.gstReview)} of purchase GST awaits review — not counted as credit.
            </p>
          )}
        </div>
      </section>

      {/* ── COGS basis. Honest about the method actually used. ──────────────── */}
      <section className="ui-card p-4 sm:p-5">
        <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-gray-400" /> Cost of goods sold basis
        </p>
        <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
          Calculated from the cost price recorded on each sale line
          (<span className="font-mono text-[11px]">{s.cogsMethod}</span>), which is the actual
          cost of the goods that left the shelf.
        </p>
        {!s.periodicReconciliation.available && (
          <p className="text-xs text-amber-800 mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 leading-relaxed">
            <b>Opening + Purchases − Closing reconciliation is not available.</b>{' '}
            {s.periodicReconciliation.blockedBy}
          </p>
        )}
      </section>

      {/* ── GST position ───────────────────────────────────────────────────── */}
      <section className="ui-card p-0 overflow-hidden">
        <SectionHead title={`GST — ${s.gst.scheme} scheme`} />
        <div className="p-4 sm:p-5 space-y-0.5 max-w-2xl">
          {s.gst.scheme === 'regular' ? (
            <>
              <Line label="Output GST collected on sales" value={inr(s.gst.outputGst)} />
              <Line label="Eligible input tax credit" value={`− ${inr(s.gst.eligibleItc)}`} tone="green" />
              <Line label="Estimated GST payable" value={inr(s.gst.payable)} strong big />
              {s.gst.creditCarryForward > 0 && (
                <Line label="Credit carried forward" value={inr(s.gst.creditCarryForward)} tone="green" small />
              )}
            </>
          ) : (
            <p className="text-sm text-gray-700">{s.gst.reason}</p>
          )}

          {s.gst.reviewItc > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {inr(s.gst.reviewItc)} of purchase GST awaiting review
              </p>
              <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                Not counted as credit above. Input tax credit has conditions only a person can
                confirm — a valid tax invoice, a registered supplier, business use — so
                MultiShop never claims it automatically.
              </p>
            </div>
          )}

          {s.gst.itcForgone > 0 && (
            <p className="text-[11px] text-gray-500 mt-2">
              {inr(s.gst.itcForgone)} of purchase GST is a cost under this scheme rather than a credit.
            </p>
          )}
        </div>
      </section>

      {/* ── Review queue ───────────────────────────────────────────────────── */}
      <section className="ui-card p-0 overflow-hidden">
        <SectionHead
          title="Needs your decision"
          right={`${reviewItems.length} item${reviewItems.length === 1 ? '' : 's'}`}
        />
        <ExpenseClassifier
          items={reviewItems}
          financialYear={s.period.financialYear}
        />
      </section>

      {/* ── Compliance signals ─────────────────────────────────────────────── */}
      <section className="ui-card p-4 sm:p-5">
        <p className="text-sm font-bold text-gray-800 mb-3">Record-keeping checks</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Check ok={s.counts.itcReview === 0}
            label={s.counts.itcReview === 0 ? 'All purchase GST reviewed'
              : `${s.counts.itcReview} expense(s) with unreviewed GST`} />
          <Check ok={s.counts.review === 0}
            label={s.counts.review === 0 ? 'All expenses have a confirmed treatment'
              : `${s.counts.review} expense(s) awaiting a deduction decision`} />
          <Check ok={s.profileConfigured}
            label={s.profileConfigured ? 'Tax profile configured'
              : 'Tax profile not set up — using defaults'} />
          <Check ok={ratesConfirmed}
            label={ratesConfirmed ? `FY ${s.period.financialYear} rates confirmed`
              : `FY ${s.period.financialYear} rates not confirmed`} />
        </div>
      </section>
    </div>
  );
}

/* ── Building blocks ───────────────────────────────────────────────────────── */

const TONES = {
  green:  'bg-emerald-50 border-emerald-200 text-emerald-900',
  blue:   'bg-blue-50 border-blue-200 text-blue-900',
  violet: 'bg-violet-50 border-violet-200 text-violet-900',
  amber:  'bg-amber-50 border-amber-200 text-amber-900',
  gray:   'bg-gray-50 border-gray-200 text-gray-700',
};

function PrimaryCard({ icon: Icon, label, value, foot, tone = 'gray', unconfirmed }) {
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${TONES[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 opacity-70" />
        <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      </div>
      <p className={`mt-2 font-black tabular-nums ${unconfirmed ? 'text-base' : 'text-2xl sm:text-3xl'}`}>
        {value}
      </p>
      {foot && <p className="text-[11px] opacity-70 mt-1.5 leading-relaxed">{foot}</p>}
    </div>
  );
}

function SectionHead({ title, right }) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50">
      <p className="text-sm font-bold text-gray-700">{title}</p>
      {right && <span className="text-xs font-semibold text-gray-500">{right}</span>}
    </div>
  );
}

function Line({ label, value, strong, big, small, tone }) {
  const toneCls = tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : '';
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1 ${small ? 'text-xs' : 'text-sm'}`}>
      <span className={strong ? 'font-bold text-gray-900' : 'text-gray-600'}>{label}</span>
      <span className={[
        'tabular-nums shrink-0',
        big ? 'text-lg font-black' : strong ? 'font-bold' : 'font-medium',
        toneCls || 'text-gray-900',
      ].join(' ')}>
        {value}
      </span>
    </div>
  );
}

function Chip({ label }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
      {label}
    </span>
  );
}

function Check({ ok, label }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
      ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
         : 'bg-amber-50 border-amber-200 text-amber-800'
    }`}>
      {ok ? <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
      {label}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6">
      <Icon className="w-12 h-12 text-gray-300 mb-4" />
      <p className="font-bold text-gray-800">{title}</p>
      <p className="text-sm text-gray-500 mt-1 max-w-sm">{body}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-5">
      <div className="h-9 w-56 rounded bg-gray-100 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />)}
      </div>
      <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
    </div>
  );
}
