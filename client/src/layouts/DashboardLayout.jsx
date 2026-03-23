import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Sidebar    from '../components/Sidebar';
import Header     from '../components/Header';
import BottomNav  from '../components/BottomNav';
import Onboarding from '../components/Onboarding';
import useShopStore  from '../store/shopStore';
import useAuthStore  from '../store/authStore';
import useSetupStore from '../store/setupStore';
import { shopsApi }    from '../api/shops.api';
import { productsApi } from '../api/products.api';
import { customersApi } from '../api/customers.api';
import { salesApi }    from '../api/sales.api';

export default function DashboardLayout() {
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { setShops, activeShop } = useShopStore();
  const user                     = useAuthStore((s) => s.user);
  const { mark, modalDismissed, getProgress } = useSetupStore();

  // ── 1. Load shops ─────────────────────────────────────────────────────────
  const { data: shopData } = useQuery({
    queryKey: ['shops'],
    queryFn:  () => shopsApi.getAll(),
    enabled:  !!user,
  });

  useEffect(() => {
    if (shopData?.data?.shops) setShops(shopData.data.shops);
  }, [shopData]);

  // ── 2. Boot-time setup check ──────────────────────────────────────────────
  // Runs once when activeShop becomes available. Fetches minimal data (limit 1)
  // to ensure the setup flags reflect reality, not just this browser session.
  // staleTime = 3 min so it doesn't re-run on every tab focus.
  const shopId = activeShop?._id;

  const { data: checkData } = useQuery({
    queryKey: ['setup-check', shopId],
    queryFn: async () => {
      const [p, c, s] = await Promise.all([
        productsApi.getAll({ shopId, limit: 1 }),
        customersApi.getAll({ shopId, limit: 1 }),
        salesApi.getAll({ shopId, limit: 1 }),
      ]);
      return {
        hasProducts:  (p?.data?.length  || 0) > 0,
        hasCustomers: (c?.data?.length  || 0) > 0,
        hasSales:     (s?.data?.length  || 0) > 0,
      };
    },
    enabled:   !!shopId,
    staleTime: 3 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });

  useEffect(() => {
    if (!checkData) return;
    if (checkData.hasProducts)  mark('hasProducts');
    if (checkData.hasCustomers) mark('hasCustomers');
    if (checkData.hasSales)     mark('hasSales');
  }, [checkData]);

  // ── 3. Show welcome modal for brand-new users ─────────────────────────────
  // Conditions: user exists, modal not yet dismissed, setup is incomplete,
  // AND no shop has been created yet (truly first-time user).
  useEffect(() => {
    if (!user) return;
    const { isComplete } = getProgress(activeShop);
    const isNewUser = !activeShop && !isComplete && !modalDismissed;
    if (isNewUser) setShowOnboarding(true);
  }, [user, activeShop, modalDismissed]);

  return (
    <div className="h-full flex overflow-hidden bg-gray-50">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenSetup={() => setShowOnboarding(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin pb-16 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {showOnboarding && (
        <Onboarding onClose={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}
