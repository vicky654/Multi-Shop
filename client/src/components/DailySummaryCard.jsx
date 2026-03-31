import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, TrendingUp, ShoppingCart, IndianRupee, Package, Star } from 'lucide-react';
import { reportsApi } from '../api/reports.api';
import useShopStore   from '../store/shopStore';

const fmt  = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const KEY   = 'ms_daily_summary_dismissed';

function wasDismissedToday() {
  const v = localStorage.getItem(KEY);
  if (!v) return false;
  return v === new Date().toISOString().slice(0, 10);
}

function dismissToday() {
  localStorage.setItem(KEY, new Date().toISOString().slice(0, 10));
}

export default function DailySummaryCard() {
  const { activeShop } = useShopStore();
  const shopId = activeShop?._id;
  const [open, setOpen] = useState(false);

  // Show once per day (not if already dismissed today)
  useEffect(() => {
    if (!wasDismissedToday()) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const { data, isLoading } = useQuery({
    queryKey:  ['daily-closing', shopId],
    queryFn:   () => reportsApi.dailyClosing({ shopId }),
    enabled:   open,
    staleTime: 5 * 60_000,
  });

  const d = data?.data || {};

  const close = () => { dismissToday(); setOpen(false); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Today's Summary</p>
            <p className="text-white font-bold text-lg leading-tight">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
          </div>
          <button onClick={close} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading today's data…</div>
        ) : (
          <div className="p-5 space-y-4">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <IndianRupee className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs text-blue-600 font-medium">Sales</span>
                </div>
                <p className="text-lg font-bold text-blue-700">{fmt(d.revenue)}</p>
                <p className="text-xs text-blue-500">{d.orders || 0} orders</p>
              </div>

              <div className="bg-green-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">Profit</span>
                </div>
                <p className="text-lg font-bold text-green-700">{fmt(d.profit)}</p>
                <p className="text-xs text-green-500">gross profit</p>
              </div>

              <div className="bg-purple-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-xs text-purple-600 font-medium">Orders</span>
                </div>
                <p className="text-lg font-bold text-purple-700">{d.orders || 0}</p>
                <p className="text-xs text-purple-500">transactions</p>
              </div>

              <div className="bg-orange-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-3.5 h-3.5 text-orange-600" />
                  <span className="text-xs text-orange-600 font-medium">Discount</span>
                </div>
                <p className="text-lg font-bold text-orange-700">{fmt(d.discount)}</p>
                <p className="text-xs text-orange-500">given today</p>
              </div>
            </div>

            {/* Top Product */}
            {d.topProduct && (
              <div className="flex items-center gap-3 bg-yellow-50 rounded-xl p-3 border border-yellow-200">
                <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-yellow-700 font-medium">Top Product Today</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{d.topProduct.name}</p>
                </div>
                <span className="text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full shrink-0">
                  {d.topProduct.qty} sold
                </span>
              </div>
            )}

            {/* No activity */}
            {!d.orders && (
              <div className="text-center py-2 text-sm text-gray-400">No sales recorded yet today.</div>
            )}

            <button
              onClick={close}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              Got it, let's go!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
