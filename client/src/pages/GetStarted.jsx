/**
 * GetStarted — the first-time owner journey and the guide library in one screen.
 *
 * HONESTY RULES THIS PAGE FOLLOWS
 *   1. Every "Open …" button goes to the REAL screen and the real feature. There
 *      are no demo-only buttons and no simulated flows here.
 *   2. A step shows a green tick ONLY when completion is genuinely derivable from
 *      the owner's data — a shop exists, products exist, a sale exists, cost
 *      prices are filled in, GST is configured. Steps that cannot be detected
 *      (reading a report, running an audit) are marked "not tracked" rather than
 *      given a tick that means nothing. A fake checklist teaches an owner to
 *      distrust the whole thing.
 *   3. Progress counts only the trackable steps, so the percentage is true.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Store, Package, Upload, ShoppingCart, ClipboardCheck, BarChart2,
  TrendingUp, Receipt, CheckCircle2, Circle, ArrowRight, MinusCircle, Rocket,
} from 'lucide-react';
import useShopStore from '../store/shopStore';
import { productsApi } from '../api/products.api';
import { salesApi } from '../api/sales.api';
import { GUIDES } from '../constants/guides';
import VideoGuide from '../components/guides/VideoGuide';
import HelpTooltip from '../components/HelpTooltip';
import { TIPS } from '../constants/tooltips';

export default function GetStarted() {
  const { activeShop } = useShopStore();
  const shopId = activeShop?._id;

  // Real data, not flags. `limit: 100` is enough to answer "are cost prices set?"
  // without pulling a whole catalogue.
  const { data: productData } = useQuery({
    queryKey: ['getstarted-products', shopId],
    queryFn: () => productsApi.getAll({ shopId, limit: 100 }),
    enabled: !!shopId,
  });
  const { data: salesData } = useQuery({
    queryKey: ['getstarted-sales', shopId],
    queryFn: () => salesApi.getAll({ shopId, limit: 1 }),
    enabled: !!shopId,
  });

  const products = useMemo(() => {
    const d = productData?.data;
    return Array.isArray(d) ? d : (d?.products || []);
  }, [productData]);

  const salesCount = useMemo(() => {
    const d = salesData?.data;
    const list = Array.isArray(d) ? d : (d?.sales || []);
    return salesData?.total ?? list.length;
  }, [salesData]);

  const productCount = productData?.total ?? products.length;
  // Profit reporting is meaningless without cost prices, so this is the honest
  // test of whether the owner has set the shop up for margin analysis.
  const withCost = products.filter((p) => Number(p.costPrice) > 0).length;
  const costsComplete = products.length > 0 && withCost === products.length;
  const gstConfigured = !!(activeShop?.gstNumber || (activeShop?.gstScheme && activeShop.gstScheme !== 'regular'));

  const STEPS = [
    {
      id: 'shop', icon: Store, title: 'Create your shop',
      body: 'Name, address, phone and currency. Everything else belongs to a shop.',
      route: '/settings', cta: 'Open Settings',
      done: !!activeShop,
    },
    {
      id: 'products', icon: Package, title: 'Add your products',
      body: 'Add them one at a time with cost, price and stock — including colour and size variants.',
      route: '/inventory', cta: 'Open Inventory',
      done: productCount > 0,
      detail: productCount > 0 ? `${productCount} product${productCount === 1 ? '' : 's'} so far` : null,
    },
    {
      id: 'import', icon: Upload, title: 'Or import them in bulk',
      body: 'Download the sample CSV, paste your catalogue in, and upload it. Much faster than typing.',
      route: '/inventory', cta: 'Open Inventory',
      tracked: false,
      tip: TIPS.importSample,
    },
    {
      id: 'bill', icon: ShoppingCart, title: 'Create your first bill',
      body: 'Take payment at the counter. This reduces stock and feeds sales, profit and GST automatically.',
      route: '/billing', cta: 'Open Billing',
      done: salesCount > 0,
      detail: salesCount > 0 ? `${salesCount} sale${salesCount === 1 ? '' : 's'} recorded` : null,
      tip: TIPS.billing,
    },
    {
      id: 'audit', icon: ClipboardCheck, title: 'Check stock with an audit',
      body: 'Count the shelves and record any difference with a reason, so shrinkage is visible.',
      route: '/inventory', cta: 'Open Stock Audit',
      tracked: false,
      tip: TIPS.stockAudit,
    },
    {
      id: 'sales', icon: BarChart2, title: 'Review sales and reports',
      body: 'What sold, how it was paid for, and your profit and loss over any date range.',
      route: '/reports', cta: 'Open Reports',
      tracked: false,
      tip: TIPS.reports,
    },
    {
      id: 'margin', icon: TrendingUp, title: 'Fill in every cost price',
      body: 'Profit and margin can only be calculated where a cost price exists.',
      route: '/inventory', cta: 'Review products',
      done: costsComplete,
      detail: products.length
        ? `${withCost} of ${products.length} loaded products have a cost price`
        : null,
      tip: TIPS.profitMargin,
    },
    {
      id: 'gst', icon: Receipt, title: 'Configure GST and see your tax position',
      body: 'Enter your GSTIN and scheme, then review GST collected against the input credit you can claim.',
      route: '/settings', cta: 'Open Tax & GST settings',
      done: gstConfigured,
      tip: TIPS.taxProfit,
    },
  ];

  const trackable = STEPS.filter((s) => s.tracked !== false);
  const completed = trackable.filter((s) => s.done).length;
  const pct = trackable.length ? Math.round((completed / trackable.length) * 100) : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Rocket className="w-6 h-6 text-blue-600" /> Get started
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          The path from an empty shop to a working till, in about ten minutes. Every
          step opens the real screen — nothing here is a demo.
        </p>
      </div>

      {/* ── Progress ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-800">
            {completed} of {trackable.length} tracked steps done
          </p>
          <span className="text-sm font-bold text-blue-700">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
            data-testid="journey-progress"
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Progress is worked out from your actual data, not from which pages you have
          visited. Steps we cannot detect are marked “not tracked”.
        </p>
      </div>

      {/* ── The journey ── */}
      <div className="space-y-2.5" data-testid="journey-steps">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const untracked = step.tracked === false;
          return (
            <div
              key={step.id}
              data-testid={`journey-step-${step.id}`}
              className={`rounded-2xl border bg-white p-4 flex items-start gap-3 ${
                step.done ? 'border-green-200' : 'border-gray-200'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                step.done ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500'
              }`}>
                <Icon className="w-4.5 h-4.5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-gray-400">STEP {i + 1}</span>
                  <h3 className="font-semibold text-gray-900 text-sm">{step.title}</h3>
                  {step.tip && <HelpTooltip content={step.tip} side="right" maxWidth={300} />}
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{step.body}</p>
                {step.detail && (
                  <p className="text-[11px] text-gray-400 mt-1">{step.detail}</p>
                )}
                <Link
                  to={step.route}
                  data-testid={`journey-cta-${step.id}`}
                  className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-blue-700 hover:text-blue-800"
                >
                  {step.cta} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="shrink-0 pt-0.5">
                {untracked ? (
                  <HelpTooltip
                    content="There is no reliable way to detect this from your data, so it is not ticked automatically. It is still worth doing."
                    side="left"
                    maxWidth={240}
                  >
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <MinusCircle className="w-3.5 h-3.5" /> not tracked
                    </span>
                  </HelpTooltip>
                ) : step.done ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" data-testid={`journey-done-${step.id}`} />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Guide library ── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Short guides</h2>
        <p className="text-sm text-gray-500 mt-1 mb-3">
          One per workflow. Each has a written walkthrough, and a screen recording of
          the real app where one has been produced. Nothing plays on its own.
        </p>
        <div className="grid gap-3 md:grid-cols-2" data-testid="guide-library">
          {GUIDES.map((g) => <VideoGuide key={g.id} guide={g} />)}
        </div>
      </div>
    </div>
  );
}
