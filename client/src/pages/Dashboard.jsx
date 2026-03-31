import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Package, Users, Receipt, AlertTriangle,
  ShoppingCart, IndianRupee, ArrowUpRight, Clock,
  BarChart3, Calendar, CalendarDays,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { reportsApi }  from '../api/reports.api';
import { productsApi } from '../api/products.api';
import StatCard        from '../components/StatCard';
import useShopStore    from '../store/shopStore';
import LoadingSpinner  from '../components/LoadingSpinner';
import SaleBanner      from '../components/SaleBanner';
import DailySummaryCard from '../components/DailySummaryCard';
import QuickActions    from '../components/QuickActions';
import InsightWidgets  from '../components/InsightWidgets';

const fmt    = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const PIE_COLORS = { cash: '#3b82f6', card: '#8b5cf6', upi: '#22c55e', credit: '#f59e0b' };
const PIE_LABEL  = { cash: 'Cash', card: 'Card', upi: 'UPI', credit: 'Credit' };

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.name.includes('Revenue') || p.name.includes('Profit') ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// ── Simple Period Tabs ────────────────────────────────────────────────────────
const PERIODS = [
  { key: 'today', label: 'Today',   icon: Clock       },
  { key: 'week',  label: 'Week',    icon: Calendar    },
  { key: 'month', label: 'Month',   icon: CalendarDays },
];

function SimpleReportTabs({ shopId }) {
  const [period, setPeriod] = useState('today');

  const { data, isLoading } = useQuery({
    queryKey:  ['simple-report', shopId, period],
    queryFn:   () => reportsApi.simpleReport({ shopId, period }),
    staleTime: 3 * 60_000,
  });
  const d = data?.data || {};

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600" /> Quick Summary
        </h3>
        <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                period === key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="sm" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xs text-blue-600 font-medium mb-1">Revenue</p>
            <p className="text-base font-bold text-blue-700">{fmt(d.sales?.revenue)}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xs text-green-600 font-medium mb-1">Profit</p>
            <p className="text-base font-bold text-green-700">{fmt(d.sales?.profit)}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center">
            <p className="text-xs text-purple-600 font-medium mb-1">Orders</p>
            <p className="text-base font-bold text-purple-700">{d.sales?.orders || 0}</p>
          </div>
          <div className={`rounded-xl p-3 text-center ${d.netProfit >= 0 ? 'bg-teal-50' : 'bg-red-50'}`}>
            <p className={`text-xs font-medium mb-1 ${d.netProfit >= 0 ? 'text-teal-600' : 'text-red-600'}`}>Net Profit</p>
            <p className={`text-base font-bold ${d.netProfit >= 0 ? 'text-teal-700' : 'text-red-700'}`}>
              {fmt(d.netProfit)}
            </p>
          </div>
        </div>
      )}

      {/* Top product for period */}
      {!isLoading && d.topProduct && (
        <div className="mt-3 flex items-center justify-between bg-yellow-50 rounded-xl px-3 py-2 border border-yellow-100">
          <p className="text-xs text-yellow-700 font-medium">Top product this {period}</p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-900">{d.topProduct.name}</p>
            <span className="text-xs bg-yellow-200 text-yellow-800 font-bold px-1.5 py-0.5 rounded-full">
              {d.topProduct.qty} sold
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { activeShop } = useShopStore();
  const shopId = activeShop?._id;

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', shopId],
    queryFn:  () => reportsApi.dashboard({ shopId }),
  });

  const { data: trendData } = useQuery({
    queryKey: ['sales-trend', shopId],
    queryFn:  () => reportsApi.salesTrend({ shopId, groupBy: 'day' }),
  });

  const { data: payBreakdown } = useQuery({
    queryKey: ['payment-breakdown', shopId],
    queryFn:  () => reportsApi.paymentBreakdown({ shopId }),
  });

  const { data: bestSellers } = useQuery({
    queryKey: ['best-sellers', shopId],
    queryFn:  () => reportsApi.bestSellers({ shopId, limit: 5 }),
  });

  const { data: lowStockData } = useQuery({
    queryKey: ['low-stock', shopId],
    queryFn:  () => productsApi.lowStock({ shopId }),
  });

  const d    = dashData?.data || {};
  const trend = (trendData?.data?.trend || []).map((t) => ({
    name:    t._id.day ? `${t._id.day}/${t._id.month}` : `${t._id.month}/${t._id.year}`,
    Revenue: Math.round(t.revenue),
    Profit:  Math.round(t.profit),
  }));

  const payData = (payBreakdown?.data?.breakdown || []).map((p) => ({
    name:  PIE_LABEL[p._id] || p._id,
    value: Math.round(p.total),
    count: p.count,
    color: PIE_COLORS[p._id] || '#94a3b8',
  }));

  const sellers = bestSellers?.data?.products || [];

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <LoadingSpinner size="lg" />
    </div>
  );

  const netProfit = (d.totalProfit || 0) - (d.totalExpenses || 0);

  return (
    <div className="space-y-6">
      {/* Daily Summary Popup (shown once per day) */}
      <DailySummaryCard />

      {/* ── Sale Banner (shown if enabled in shop settings) ── */}
      {activeShop?.saleBanner?.enabled && (
        <SaleBanner banner={activeShop.saleBanner} />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeShop ? activeShop.name : 'All Shops'} — {format(new Date(), 'dd MMM yyyy')}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
          <Clock className="w-3.5 h-3.5" />
          Last updated: {format(new Date(), 'hh:mm a')}
        </div>
      </div>

      {/* ── Quick Period Summary (Today / Week / Month) ── */}
      <SimpleReportTabs shopId={shopId} />

      {/* ── Today's KPIs ── */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">All-Time Overview</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={ShoppingCart} label="Total Sales"   value={d.totalSalesCount || 0}   color="blue"   sub="transactions" />
          <StatCard icon={IndianRupee}  label="Total Revenue" rawValue={d.totalRevenue}         color="green"  />
          <StatCard icon={TrendingUp}   label="Gross Profit"  rawValue={d.totalProfit}          color="purple" />
          <StatCard icon={Receipt}      label="Net Profit"    rawValue={netProfit}               color={netProfit >= 0 ? 'green' : 'red'} sub="after expenses" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Sales trend chart ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Sales Trend</h3>
            <span className="text-xs text-gray-400">Last 30 days</span>
          </div>
          {trend.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Profit"  stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-60 text-gray-400 text-sm">No sales data yet</div>
          )}
        </div>

        {/* ── Low stock alerts ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <h3 className="font-semibold text-gray-800">Low Stock</h3>
            {d.lowStockCount > 0 && (
              <span className="ml-auto text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                {d.lowStockCount}
              </span>
            )}
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
            {(lowStockData?.data?.products || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">All stocked up!</p>
            ) : (
              (lowStockData?.data?.products || []).map((p) => (
                <div key={p._id} className="flex items-center justify-between p-2.5 rounded-xl bg-orange-50 border border-orange-200">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.category}</p>
                  </div>
                  <span className="shrink-0 ml-2 text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                    {p.stock} left
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Payment method breakdown ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Payment Methods</h3>
          {payData.length ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={payData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    paddingAngle={3} dataKey="value">
                    {payData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {payData.map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-gray-600">{p.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{fmt(p.value)}</p>
                      <p className="text-xs text-gray-400">{p.count} sales</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-44 text-gray-400 text-sm">No payment data yet</div>
          )}
        </div>

        {/* ── Best sellers ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Top Products</h3>
            <ArrowUpRight className="w-4 h-4 text-gray-400" />
          </div>
          {sellers.length ? (
            <div className="space-y-3">
              {sellers.map((p, i) => (
                <div key={p._id} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.totalQty} units sold</p>
                  </div>
                  <p className="text-sm font-semibold text-green-600 shrink-0">{fmt(p.totalRevenue)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-44 text-gray-400 text-sm">No sales data yet</div>
          )}
        </div>
      </div>

      {/* ── Smart Insights Section ── */}
      <InsightWidgets />

      {/* ── Summary metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Customers"  value={d.totalCustomers || 0} color="blue"   sub="total registered" />
        <StatCard icon={Package}     label="Products"   value={d.totalProducts  || 0} color="purple" />
        <StatCard icon={Receipt}     label="Expenses"   rawValue={d.totalExpenses}    color="red"    sub="all time" />
        <StatCard icon={IndianRupee} label="Avg Sale"   rawValue={d.totalSalesCount ? d.totalRevenue / d.totalSalesCount : 0} color="orange" sub="per transaction" />
      </div>

      {/* ── Floating Quick Actions ── */}
      <QuickActions />
    </div>
  );
}
