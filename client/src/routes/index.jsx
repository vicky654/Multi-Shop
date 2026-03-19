import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from '../store/authStore';
import ProtectedRoute from './ProtectedRoute';
import DashboardLayout from '../layouts/DashboardLayout';
import AuthLayout from '../layouts/AuthLayout';

// Admin pages
import Login       from '../pages/auth/Login';
import Register    from '../pages/auth/Register';
import Dashboard   from '../pages/Dashboard';
import Inventory   from '../pages/Inventory';
import Billing     from '../pages/Billing';
import Customers   from '../pages/Customers';
import Expenses    from '../pages/Expenses';
import Reports     from '../pages/Reports';
import Settings    from '../pages/Settings';
import AiInsights  from '../pages/AiInsights';
import SystemTest  from '../pages/SystemTest';
import LoadingSpinner from '../components/LoadingSpinner';

// Customer shop pages
import ShopLayout        from '../pages/shop/ShopLayout';
import ShopHome          from '../pages/shop/ShopHome';
import ShopListing       from '../pages/shop/ShopListing';
import ShopProductDetail from '../pages/shop/ShopProductDetail';
import ShopCart          from '../pages/shop/ShopCart';

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
    <Routes>
      {/* ── Auth routes ── */}
      <Route element={<AuthLayout />}>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* ── Customer Shop (public) ── */}
      <Route element={<ShopLayout />}>
        <Route path="/shop"                   element={<ShopHome />} />
        <Route path="/shop/products"          element={<ShopListing />} />
        <Route path="/shop/products/:id"      element={<ShopProductDetail />} />
        <Route path="/shop/cart"              element={<ShopCart />} />
      </Route>

      {/* ── Protected admin dashboard ── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/"          element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/billing"   element={<Billing />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/expenses"  element={<Expenses />} />
          <Route path="/reports"      element={<Reports />} />
          <Route path="/settings"     element={<Settings />} />
          <Route path="/ai-insights"  element={<AiInsights />} />
          <Route path="/system-test"  element={<SystemTest />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
