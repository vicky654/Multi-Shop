import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users, Store, ShoppingBag, IndianRupee, TrendingUp, Activity,
  Package, UserCheck, AlertTriangle, RefreshCcw, Terminal,
  ArrowLeft, Shield, Download, Zap, BarChart3, LogIn,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import useAuthStore from '../store/authStore';
import { adminApi } from '../api/admin.api';

// ── Guard ─────────────────────────────────────────────────────────────────────
function AccessDenied() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-4">
        <Shield className="w-8 h-8 text-red-500" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
      <p className="text-sm text-gray-500 mt-1">This page is restricted to super admins only.</p>
      <button
        onClick={() => navigate('/dashboard')}
        className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, gradient, loading }) {
  return (
    <div className={`rounded-2xl p-5 border shadow-sm ${gradient}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <div className="w-8 h-8 rounded-xl bg-white/60 flex items-center justify-center">
          <Icon className="w-4 h-4 text-gray-600" />
        </div>
      </div>
      {loading ? (
        <div className="h-8 bg-white/50 rounded-lg animate-pulse w-2/3" />
      ) : (
        <p className="text-2xl font-semibold text-gray-900 tabular-nums">{value ?? '—'}</p>
      )}
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Chart Tooltip ─────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label, prefix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {prefix}{p.value?.toLocaleString('en-IN')}</p>
      ))}
    </div>
  );
}

const FEATURE_COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4','#F97316','#84CC16'];

const PERIODS = [
  { label: '7 Days',  value: 7  },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
];

export default function AdminAnalytics() {
  const user     = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [period, setPeriod] = useState(7);

  // Guard
  if (user?.role !== 'super_admin') return <AccessDenied />;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-analytics', period],
    queryFn:  () => adminApi.getAnalytics({ period }),
    staleTime: 60_000,
  });

  const ov     = data?.data?.overview || {};
  const charts = data?.data?.charts   || {};

  const kpis = [
    { label: 'Total Users',      value: ov.totalUsers,      sub: `${ov.totalOwners ?? 0} owners · ${ov.totalStaff ?? 0} staff`,    icon: Users,         gradient: 'bg-blue-50  border-blue-100'   },
    { label: 'Active Today',     value: ov.activeUsersToday,sub: `${ov.loginsToday ?? 0} logins today`,                             icon: Activity,      gradient: 'bg-green-50 border-green-100'  },
    { label: 'Total Shops',      value: ov.totalShops,      sub: `${ov.activeShops ?? 0} active`,                                   icon: Store,         gradient: 'bg-purple-50 border-purple-100'},
    { label: 'Total Orders',     value: ov.totalOrders?.toLocaleString('en-IN'), sub: `${ov.newUsersThisPeriod ?? 0} new users this period`, icon: ShoppingBag, gradient: 'bg-orange-50 border-orange-100'},
    { label: 'Total Revenue',    value: `₹${(ov.totalRevenue || 0).toLocaleString('en-IN')}`, sub: 'All-time',                     icon: IndianRupee,   gradient: 'bg-emerald-50 border-emerald-100'},
    { label: 'Total Products',   value: ov.totalProducts?.toLocaleString('en-IN'), sub: 'Across all shops',                        icon: Package,       gradient: 'bg-indigo-50 border-indigo-100' },
    { label: 'Errors Today',     value: ov.errorCountToday, sub: 'Failed actions',                                                  icon: AlertTriangle, gradient: ov.errorCountToday > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100' },
    { label: 'Logins Today',     value: ov.loginsToday,     sub: 'LOGIN_SUCCESS events',                                            icon: LogIn,         gradient: 'bg-sky-50   border-sky-100'    },
  ];

  // CSV export
  const handleExport = () => {
    if (!data?.data) return;
    const { overview, charts: ch } = data.data;
    const rows = [
      ['Metric', 'Value'],
      ['Total Users', overview.totalUsers],
      ['Total Owners', overview.totalOwners],
      ['Total Staff', overview.totalStaff],
      ['Total Shops', overview.totalShops],
      ['Active Shops', overview.activeShops],
      ['Total Orders', overview.totalOrders],
      ['Total Revenue', overview.totalRevenue],
      ['Total Products', overview.totalProducts],
      ['Active Users Today', overview.activeUsersToday],
      ['Logins Today', overview.loginsToday],
      [],
      ['Date', 'Orders', 'Revenue'],
      ...(ch.dailyOrders || []).map((d) => [d._id, d.orders, d.revenue]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const a   = document.createElement('a');
    a.href    = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download= `multishop-analytics-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Platform Analytics
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Super admin · live platform data</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  period === p.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            onClick={() => navigate('/admin/console')}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-medium transition-colors"
          >
            <Terminal className="w-3.5 h-3.5" />
            Console
          </button>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} loading={isLoading} />
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Orders + Revenue */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Daily Orders & Revenue
            <span className="text-xs font-normal text-gray-400">({period} days)</span>
          </h3>
          {isLoading ? (
            <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={charts.dailyOrders || []}>
                <defs>
                  <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="_id" tick={{ fontSize: 10 }} tickFormatter={(d) => d?.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} width={36} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="orders"  name="Orders"  stroke="#3B82F6" fill="url(#ordGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10B981" fill="url(#revGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Daily Logins */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <LogIn className="w-4 h-4 text-purple-500" />
            Daily Logins
            <span className="text-xs font-normal text-gray-400">({period} days)</span>
          </h3>
          {isLoading ? (
            <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={charts.dailyLogins || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="_id" tick={{ fontSize: 10 }} tickFormatter={(d) => d?.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} width={28} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="count" name="Logins" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Bottom Row: Top Shops + Feature Usage ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top shops */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Store className="w-4 h-4 text-orange-500" />
            Top Shops by Orders
          </h3>
          {isLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />)}</div>
          ) : (charts.topShops || []).length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No order data yet</p>
          ) : (
            <div className="space-y-2">
              {(charts.topShops || []).map((shop, i) => {
                const max = charts.topShops[0]?.orders || 1;
                const pct = Math.round((shop.orders / max) * 100);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-400 w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-800 truncate">{shop.shopName || 'Unknown'}</span>
                        <span className="text-gray-500 shrink-0 ml-2">{shop.orders} orders</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">
                      ₹{(shop.revenue || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Feature usage */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Feature Usage by Module
          </h3>
          {isLoading ? (
            <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
          ) : (charts.featureUsage || []).length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No activity data yet</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie
                    data={charts.featureUsage || []}
                    dataKey="count"
                    nameKey="_id"
                    cx="50%" cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {(charts.featureUsage || []).map((_, idx) => (
                      <Cell key={idx} fill={FEATURE_COLORS[idx % FEATURE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => v.toLocaleString('en-IN')} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 min-w-0">
                {(charts.featureUsage || []).slice(0, 7).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: FEATURE_COLORS[i % FEATURE_COLORS.length] }}
                    />
                    <span className="text-gray-700 capitalize truncate">{f._id}</span>
                    <span className="text-gray-400 ml-auto shrink-0">{f.count?.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
