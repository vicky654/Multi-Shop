import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Zap, TrendingUp, Package, Tag, RotateCcw, BarChart2,
  AlertTriangle, CheckCircle, RefreshCw, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import { aiApi } from '../api/ai.api';
import useShopStore from '../store/shopStore';

// ── Helpers ───────────────────────────────────────────────────────────────────
function currency(n, sym = '₹') {
  if (n === undefined || n === null) return '—';
  return `${sym}${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function CardShell({ icon: Icon, color, title, count, children, badge }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 text-sm">{title}</p>
            {badge && <p className="text-xs text-gray-500">{badge}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {count !== undefined && (
            <span className="text-xs bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded-full">
              {count} items
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ── Sub-sections ──────────────────────────────────────────────────────────────
function FastMovingSection({ data }) {
  if (!data?.length) return <p className="text-sm text-gray-400 py-2">No fast-moving products found.</p>;
  return (
    <div className="space-y-2">
      {data.map((p) => (
        <div key={p.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
          <div>
            <p className="text-sm font-medium text-gray-800">{p.name}</p>
            <p className="text-xs text-gray-500">{p.category}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-green-600">{p.totalSold} sold</p>
            <p className="text-xs text-gray-500">stock: {p.currentStock}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RestockSection({ data }) {
  if (!data?.length) return <p className="text-sm text-gray-400 py-2">All products are adequately stocked.</p>;
  return (
    <div className="space-y-2">
      {data.map((p) => (
        <div key={p.productId} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100">
          <div>
            <p className="text-sm font-medium text-gray-800">{p.name}</p>
            <p className="text-xs text-orange-500 font-medium">
              Only {p.currentStock} left · Need {p.deficit} more
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-orange-600">Order {p.suggestedOrder}</p>
            <p className="text-xs text-gray-400">{p.category}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DiscountSection({ data }) {
  if (!data?.length) return <p className="text-sm text-gray-400 py-2">No discount recommendations at this time.</p>;
  return (
    <div className="space-y-2">
      {data.map((p) => (
        <div key={p.productId} className="flex items-center justify-between p-3 bg-purple-50 rounded-xl border border-purple-100">
          <div>
            <p className="text-sm font-medium text-gray-800">{p.name}</p>
            <p className="text-xs text-gray-500">No sales in {p.daysSinceLastSale || 30}+ days</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-purple-600">{p.suggestedDiscount}% off</p>
            <p className="text-xs text-gray-500">margin: {p.profitMargin?.toFixed(1)}%</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendSection({ data }) {
  if (!data) return <p className="text-sm text-gray-400 py-2">Insufficient data for trend analysis.</p>;

  const { changePercent, direction, forecast, dailyData = [] } = data;

  const TrendIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const trendColor = direction === 'up' ? 'text-green-500' : direction === 'down' ? 'text-red-500' : 'text-gray-400';

  const max = Math.max(...dailyData.map((d) => d.revenue || 0), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-1 text-lg font-bold ${trendColor}`}>
          <TrendIcon className="w-5 h-5" />
          {Math.abs(changePercent || 0).toFixed(1)}%
        </div>
        <div>
          <p className="text-sm text-gray-600">vs previous period</p>
          <p className="text-xs text-gray-400">Tomorrow forecast: <span className="font-semibold">{currency(forecast)}</span></p>
        </div>
      </div>

      {/* Mini bar chart */}
      {dailyData.length > 0 && (
        <div className="flex items-end gap-1 h-16">
          {dailyData.slice(-14).map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full bg-blue-400 rounded-sm"
                style={{ height: `${((d.revenue || 0) / max) * 48}px`, minHeight: '2px' }}
                title={`${d.date}: ${currency(d.revenue)}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Alert banner ──────────────────────────────────────────────────────────────
function AlertBanner({ alerts = [] }) {
  if (!alerts.length) return null;
  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">{a}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AiInsights() {
  const { activeShop } = useShopStore();
  const shopId = activeShop?._id;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['ai-summary', shopId],
    queryFn: () => aiApi.summary({ shopId }),
    enabled: !!shopId,
    staleTime: 5 * 60_000,
  });

  const summary = data?.data;

  if (!shopId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Zap className="w-12 h-12 mb-3 opacity-30" />
        <p className="font-medium">Select a shop to view AI insights</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
          <p className="text-sm text-gray-500 mt-0.5">Rule-based recommendations powered by your sales data</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="grid gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center py-16 text-red-400">
          <AlertTriangle className="w-10 h-10 mb-2" />
          <p className="text-sm">Failed to load AI insights. Try refreshing.</p>
        </div>
      )}

      {summary && (
        <>
          {/* Summary stat pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Fast Moving',  value: summary.fastMoving?.length  || 0, color: 'bg-green-50 text-green-700',  icon: TrendingUp },
              { label: 'Restock Now',  value: summary.restock?.length     || 0, color: 'bg-orange-50 text-orange-700',icon: RotateCcw  },
              { label: 'Apply Discount',value:summary.discounts?.length   || 0, color: 'bg-purple-50 text-purple-700',icon: Tag        },
              { label: 'Alerts',       value: summary.alerts?.length      || 0, color: 'bg-red-50 text-red-700',      icon: AlertTriangle },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className={`flex items-center gap-3 p-3 rounded-xl ${color}`}>
                <Icon className="w-5 h-5 shrink-0" />
                <div>
                  <p className="text-xl font-bold leading-none">{value}</p>
                  <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Alerts */}
          {summary.alerts?.length > 0 && <AlertBanner alerts={summary.alerts} />}

          {/* Detail cards */}
          <div className="space-y-4">
            <CardShell
              icon={TrendingUp}
              color="bg-green-500"
              title="Fast-Moving Products"
              count={summary.fastMoving?.length}
              badge="Selling quickly — keep stocked"
            >
              <FastMovingSection data={summary.fastMoving} />
            </CardShell>

            <CardShell
              icon={RotateCcw}
              color="bg-orange-500"
              title="Restock Suggestions"
              count={summary.restock?.length}
              badge="Products running low on stock"
            >
              <RestockSection data={summary.restock} />
            </CardShell>

            <CardShell
              icon={Tag}
              color="bg-purple-500"
              title="Discount Recommendations"
              count={summary.discounts?.length}
              badge="Slow-moving products — try discounting"
            >
              <DiscountSection data={summary.discounts} />
            </CardShell>

            <CardShell
              icon={BarChart2}
              color="bg-blue-500"
              title="Sales Trend"
              badge="14-day moving average"
            >
              <TrendSection data={summary.trend} />
            </CardShell>
          </div>

          <p className="text-xs text-gray-400 text-center pb-4">
            Insights are rule-based, generated from your last 30 days of sales data.
          </p>
        </>
      )}
    </div>
  );
}
