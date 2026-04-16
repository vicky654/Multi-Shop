import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import useAuthStore from '../store/authStore';
import ProtectedRoute from './ProtectedRoute';
import DashboardLayout from '../layouts/DashboardLayout';
import AuthLayout from '../layouts/AuthLayout';
import LoadingSpinner from '../components/LoadingSpinner';

// ── Auth pages (small, eager-load) ───────────────────────────────────────────
import Login    from '../pages/auth/Login';
import Register from '../pages/auth/Register';

// ── Admin pages (lazy-loaded for code splitting) ──────────────────────────────
const Dashboard   = lazy(() => import('../pages/Dashboard'));
const Inventory   = lazy(() => import('../pages/Inventory'));
const Billing     = lazy(() => import('../pages/Billing'));
const Customers   = lazy(() => import('../pages/Customers'));
const Expenses    = lazy(() => import('../pages/Expenses'));
const Reports     = lazy(() => import('../pages/Reports'));
const Settings    = lazy(() => import('../pages/Settings'));
const AiInsights  = lazy(() => import('../pages/AiInsights'));
const Campaigns   = lazy(() => import('../pages/Campaigns'));
const Roles       = lazy(() => import('../pages/Roles'));
const Users       = lazy(() => import('../pages/Users'));
const AdminPanel      = lazy(() => import('../pages/AdminPanel'));
const AdminAnalytics  = lazy(() => import('../pages/AdminAnalytics'));
const AdminConsole    = lazy(() => import('../pages/AdminConsole'));
const SystemTest  = lazy(() => import('../pages/SystemTest'));
const Logs        = lazy(() => import('../pages/Logs'));
const Orders      = lazy(() => import('../pages/Orders'));
const Automations = lazy(() => import('../pages/Automations'));

// ── Customer shop pages (separate bundle) ─────────────────────────────────────
const ShopLayout        = lazy(() => import('../pages/shop/ShopLayout'));
const ShopHome          = lazy(() => import('../pages/shop/ShopHome'));
const ShopListing       = lazy(() => import('../pages/shop/ShopListing'));
const ShopProductDetail = lazy(() => import('../pages/shop/ShopProductDetail'));
const ShopCart          = lazy(() => import('../pages/shop/ShopCart'));
const CustomerShop      = lazy(() => import('../pages/shop/CustomerShop'));
const SlugProductDetail = lazy(() => import('../pages/shop/SlugProductDetail'));

// ── Fallback spinner for Suspense ─────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}

export default function AppRoutes() {
  const { fetchMe, token, initialized } = useAuthStore();

  useEffect(() => {
    if (token) fetchMe();
    else useAuthStore.setState({ initialized: true });
  }, []);

  if (!initialized && token) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ── Auth routes ── */}
        <Route element={<AuthLayout />}>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* ── Slug-based public shop (e.g. /shop/vicky-fashion) ── */}
        <Route path="/shop/:slug"              element={<CustomerShop />} />
        <Route path="/shop/:slug/product/:id"  element={<SlugProductDetail />} />

        {/* ── Query-param shop (legacy / internal) ── */}
        <Route element={<ShopLayout />}>
          <Route path="/shop"              element={<ShopHome />} />
          <Route path="/shop/products"     element={<ShopListing />} />
          <Route path="/shop/products/:id" element={<ShopProductDetail />} />
          <Route path="/shop/cart"         element={<ShopCart />} />
        </Route>

        {/* ── Protected admin dashboard ── */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/"             element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/inventory"    element={<Inventory />} />
            <Route path="/billing"      element={<Billing />} />
            <Route path="/orders"       element={<Orders />} />
            <Route path="/customers"    element={<Customers />} />
            <Route path="/expenses"     element={<Expenses />} />
            <Route path="/reports"      element={<Reports />} />
            <Route path="/settings"     element={<Settings />} />
            <Route path="/ai-insights"  element={<AiInsights />} />
            <Route path="/campaigns"    element={<Campaigns />} />
            <Route path="/roles"        element={<Roles />} />
            <Route path="/users"        element={<Users />} />
            <Route path="/admin"            element={<AdminPanel />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/console"   element={<AdminConsole />} />
            <Route path="/system-test"  element={<SystemTest />} />
            <Route path="/logs"         element={<Logs />} />
            <Route path="/automations" element={<Automations />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
