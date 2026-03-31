import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, AlertTriangle, Tag, CreditCard,
  ChevronRight, PackageX, Loader2, IndianRupee, Phone,
} from 'lucide-react';
import { insightsApi } from '../api/insights.api';
import useShopStore    from '../store/shopStore';
import RestockModal    from './RestockModal';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// ── Widget shell ──────────────────────────────────────────────────────────────
function Widget({ icon: Icon, title, color, badge, children, loading, action }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   border: 'border-blue-100'   },
    green:  { bg: 'bg-green-50',  icon: 'text-green-600',  border: 'border-green-100'  },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-600', border: 'border-orange-100' },
    red:    { bg: 'bg-red-50',    icon: 'text-red-600',    border: 'border-red-100'    },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`bg-white rounded-2xl border ${c.border} p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${c.icon}`} />
          </div>
          <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        </div>
        {badge != null && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.icon}`}>
            {badge}
          </span>
        )}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
        </div>
      ) : (
        children
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center justify-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors pt-1"
        >
          {action.label} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── 1. Dead Stock ─────────────────────────────────────────────────────────────
function DeadStockWidget({ shopId }) {
  const { data, isLoading } = useQuery({
    queryKey:  ['dead-stock', shopId],
    queryFn:   () => insightsApi.deadStock({ shopId, days: 15 }),
    staleTime: 10 * 60_000,
  });
  const items = data?.data?.products || [];

  return (
    <Widget icon={PackageX} title="Dead Stock" color="red" badge={items.length || null} loading={isLoading}>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No stale stock found</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {items.slice(0, 5).map((p) => (
            <div key={p._id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                <p className="text-xs text-gray-400">{p.category} · {p.stock} units</p>
              </div>
              <div className="shrink-0 text-right ml-2">
                <p className="text-xs font-semibold text-red-600">{fmt(p.stockValue)}</p>
                <p className="text-xs text-gray-400">tied up</p>
              </div>
            </div>
          ))}
          {items.length > 5 && (
            <p className="text-xs text-gray-400 text-center pt-1">+{items.length - 5} more products</p>
          )}
        </div>
      )}
    </Widget>
  );
}

// ── 2. Profit Per Product ─────────────────────────────────────────────────────
function ProfitPerProductWidget({ shopId }) {
  const { data, isLoading } = useQuery({
    queryKey:  ['profit-per-product', shopId],
    queryFn:   () => insightsApi.profitPerProduct({ shopId, limit: 5 }),
    staleTime: 10 * 60_000,
  });
  const items = data?.data?.products || [];

  return (
    <Widget icon={TrendingUp} title="Top Profit (30d)" color="green" loading={isLoading}>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No sales data yet</p>
      ) : (
        <div className="space-y-2">
          {items.map((p, i) => (
            <div key={String(p._id)} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                  <p className="text-sm font-bold text-green-600 shrink-0 ml-2">{fmt(p.totalProfit)}</p>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(p.profitMargin, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{p.profitMargin}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

// ── 3. Credit / Due Tracker ───────────────────────────────────────────────────
function CreditTrackerWidget({ shopId }) {
  const { data, isLoading } = useQuery({
    queryKey:  ['credit-summary', shopId],
    queryFn:   () => insightsApi.creditSummary({ shopId }),
    staleTime: 5 * 60_000,
  });
  const { grandTotal = 0, customers = [] } = data?.data || {};

  return (
    <Widget
      icon={CreditCard}
      title="Pending Dues"
      color="orange"
      badge={customers.length || null}
      loading={isLoading}
    >
      {customers.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No pending dues</p>
      ) : (
        <>
          <div className="flex items-center justify-between bg-orange-50 rounded-xl px-3 py-2 mb-2">
            <span className="text-xs text-orange-600 font-medium">Total Outstanding</span>
            <span className="text-sm font-bold text-orange-700">{fmt(grandTotal)}</span>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {customers.slice(0, 5).map((c) => (
              <div key={String(c._id)} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.customerName || 'Unknown'}</p>
                  {c.customerPhone && (
                    <a
                      href={`tel:${c.customerPhone}`}
                      className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
                    >
                      <Phone className="w-3 h-3" /> {c.customerPhone}
                    </a>
                  )}
                </div>
                <div className="shrink-0 text-right ml-2">
                  <p className="text-sm font-bold text-orange-600">{fmt(c.totalDue)}</p>
                  <p className="text-xs text-gray-400">{c.saleCount} sale{c.saleCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Widget>
  );
}

// ── 4. Smart Discount Suggestions ────────────────────────────────────────────
function DiscountSuggestionsWidget({ shopId }) {
  const { data, isLoading } = useQuery({
    queryKey:  ['discount-suggestions', shopId],
    queryFn:   () => insightsApi.discountSuggestions({ shopId }),
    staleTime: 15 * 60_000,
  });
  const items = data?.data?.suggestions || [];

  return (
    <Widget icon={Tag} title="Discount Ideas" color="blue" badge={items.length || null} loading={isLoading}>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">All products are moving well</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {items.slice(0, 5).map((p) => (
            <div key={p._id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                <p className="text-xs text-gray-400">{p.reason}</p>
              </div>
              <div className="shrink-0 ml-2 text-center">
                <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  -{p.suggestedDiscount}%
                </span>
                <p className="text-xs text-gray-400 mt-0.5">{p.stock} units</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

// ── Main export: grid of all widgets ─────────────────────────────────────────
export default function InsightWidgets() {
  const { activeShop } = useShopStore();
  const shopId         = activeShop?._id;
  const [restockOpen, setRestockOpen] = useState(false);

  return (
    <>
      {/* Restock CTA Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Smart Insights</h2>
          <p className="text-xs text-gray-400 mt-0.5">AI-driven actions to grow your business</p>
        </div>
        <button
          onClick={() => setRestockOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
        >
          <IndianRupee className="w-3.5 h-3.5" />
          One-Click Restock
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ProfitPerProductWidget   shopId={shopId} />
        <CreditTrackerWidget      shopId={shopId} />
        <DeadStockWidget          shopId={shopId} />
        <DiscountSuggestionsWidget shopId={shopId} />
      </div>

      <RestockModal open={restockOpen} onClose={() => setRestockOpen(false)} />
    </>
  );
}
