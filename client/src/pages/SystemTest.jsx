import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  CheckCircle, XCircle, Loader2, RefreshCw,
  FlaskConical, Server, Globe, Zap, Bell,
  ShoppingCart, Package, Users, BarChart2, Settings,
} from 'lucide-react';
import { authApi } from '../api/auth.api';
import { shopsApi } from '../api/shops.api';
import { productsApi } from '../api/products.api';
import { salesApi } from '../api/sales.api';
import { customersApi } from '../api/customers.api';
import { expensesApi } from '../api/expenses.api';
import { reportsApi } from '../api/reports.api';
import { rolesApi } from '../api/roles.api';
import { notificationsApi } from '../api/notifications.api';
import { aiApi } from '../api/ai.api';
import { shopApi } from '../api/shop.api';
import useShopStore from '../store/shopStore';

const STATUS = { idle: 'idle', running: 'running', pass: 'pass', fail: 'fail' };

const TESTS = [
  {
    group: 'Auth',
    icon: Settings,
    color: 'bg-gray-500',
    items: [
      { id: 'auth_me', label: 'GET /auth/me', fn: () => authApi.getMe() },
      { id: 'auth_staff', label: 'GET /auth/staff', fn: () => authApi.getStaff() },
    ],
  },
  {
    group: 'Shops',
    icon: Settings,
    color: 'bg-blue-500',
    items: [
      { id: 'shops_list', label: 'GET /shops', fn: () => shopsApi.getAll() },
      { id: 'shops_public', label: 'GET /shops/public (no-auth)', fn: () => shopApi.getShops() },
    ],
  },
  {
    group: 'Products',
    icon: Package,
    color: 'bg-purple-500',
    items: [
      { id: 'products_list', label: 'GET /products', fn: () => productsApi.getAll() },
      { id: 'products_public', label: 'GET /products/public (no-auth)', fn: () => shopApi.getProducts() },
    ],
  },
  {
    group: 'Sales / Billing',
    icon: ShoppingCart,
    color: 'bg-green-500',
    items: [
      { id: 'sales_list', label: 'GET /sales', fn: () => salesApi.getAll() },
    ],
  },
  {
    group: 'Customers',
    icon: Users,
    color: 'bg-indigo-500',
    items: [
      { id: 'customers_list', label: 'GET /customers', fn: () => customersApi.getAll() },
    ],
  },
  {
    group: 'Expenses',
    icon: BarChart2,
    color: 'bg-orange-500',
    items: [
      { id: 'expenses_list', label: 'GET /expenses', fn: () => expensesApi.getAll() },
    ],
  },
  {
    group: 'Reports',
    icon: BarChart2,
    color: 'bg-teal-500',
    items: [
      { id: 'reports_summary', label: 'GET /reports/summary', fn: () => reportsApi.getSummary() },
    ],
  },
  {
    group: 'Roles & RBAC',
    icon: Settings,
    color: 'bg-pink-500',
    items: [
      { id: 'roles_list', label: 'GET /roles', fn: () => rolesApi.getAll() },
      { id: 'roles_perms', label: 'GET /roles/permissions', fn: () => rolesApi.getPermissions() },
    ],
  },
  {
    group: 'Notifications',
    icon: Bell,
    color: 'bg-red-500',
    items: [
      { id: 'notif_list', label: 'GET /notifications', fn: () => notificationsApi.getAll() },
    ],
  },
  {
    group: 'AI Insights',
    icon: Zap,
    color: 'bg-yellow-500',
    items: [
      { id: 'ai_summary', label: 'GET /ai/summary', fn: () => aiApi.summary() },
      { id: 'ai_restock', label: 'GET /ai/restock', fn: () => aiApi.restock() },
      { id: 'ai_fast', label: 'GET /ai/fast-moving', fn: () => aiApi.fastMoving() },
      { id: 'ai_discounts', label: 'GET /ai/discounts', fn: () => aiApi.discounts() },
      { id: 'ai_trend', label: 'GET /ai/trend', fn: () => aiApi.trend() },
    ],
  },
  {
    group: 'Health',
    icon: Server,
    color: 'bg-slate-500',
    items: [
      {
        id: 'health',
        label: 'GET /health',
        fn: async () => {
          const { default: axios } = await import('axios');
          const base = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/api$/, '');
          return axios.get(`${base}/api/health`);
        },
      },
    ],
  },
];

// Build flat map of all test items
const allTests = TESTS.flatMap((g) => g.items);

export default function SystemTest() {
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);

  const setResult = (id, status, detail = '') =>
    setResults((prev) => ({ ...prev, [id]: { status, detail } }));

  const runTest = async (item) => {
    setResult(item.id, STATUS.running);
    try {
      const res = await item.fn();
      // For health check (raw axios): res.status is the HTTP code
      // For api calls (intercepted): res is already res.data, so fallback to 200
      const code = res?.status && typeof res.status === 'number' ? res.status : 200;
      setResult(item.id, STATUS.pass, `${code} OK`);
    } catch (err) {
      // axios interceptor preserves err.status and err.response
      const code = err?.status || err?.response?.status || 'ERR';
      const msg  = err?.response?.data?.message || err?.message || 'Unknown error';
      setResult(item.id, STATUS.fail, `${code}: ${msg}`);
    }
  };

  const runAll = async () => {
    setRunning(true);
    setResults({});
    for (const item of allTests) {
      await runTest(item);
    }
    setRunning(false);
  };

  const passCount = Object.values(results).filter((r) => r.status === STATUS.pass).length;
  const failCount = Object.values(results).filter((r) => r.status === STATUS.fail).length;
  const total = allTests.length;
  const tested = passCount + failCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-blue-600" />
            System Test
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Frontend QA — checks all API endpoints</p>
        </div>
        <button
          onClick={runAll}
          disabled={running}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-60"
        >
          {running
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
          {running ? 'Running…' : 'Run All Tests'}
        </button>
      </div>

      {/* Progress bar */}
      {tested > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold text-gray-700">{tested} / {total} tested</span>
            <span className="flex items-center gap-3">
              <span className="text-green-600 font-medium">{passCount} passed</span>
              <span className="text-red-500 font-medium">{failCount} failed</span>
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${(passCount / total) * 100}%` }}
            />
          </div>
          {tested === total && (
            <p className={`text-sm font-semibold mt-3 ${failCount === 0 ? 'text-green-600' : 'text-red-500'}`}>
              {failCount === 0 ? '✅ All tests passed!' : `❌ ${failCount} test(s) failed — check the details below.`}
            </p>
          )}
        </div>
      )}

      {/* Test groups */}
      <div className="space-y-4">
        {TESTS.map(({ group, icon: Icon, color, items }) => (
          <div key={group} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50">
              <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}>
                <Icon className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-gray-800 text-sm">{group}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {items.map((item) => {
                const r = results[item.id];
                return (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={r?.status} />
                      <span className="text-sm text-gray-700 font-mono">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r?.detail && (
                        <span className={`text-xs font-medium ${r.status === STATUS.pass ? 'text-green-600' : 'text-red-500'}`}>
                          {r.detail}
                        </span>
                      )}
                      <button
                        onClick={() => runTest(item)}
                        disabled={running}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-40"
                      >
                        Run
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === STATUS.running) return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
  if (status === STATUS.pass) return <CheckCircle className="w-4 h-4 text-green-500" />;
  if (status === STATUS.fail) return <XCircle className="w-4 h-4 text-red-500" />;
  return <div className="w-4 h-4 rounded-full border-2 border-gray-200" />;
}
