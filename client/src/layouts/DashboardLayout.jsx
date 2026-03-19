import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import Onboarding from '../components/Onboarding';
import useShopStore from '../store/shopStore';
import useAuthStore from '../store/authStore';
import { shopsApi } from '../api/shops.api';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { setShops } = useShopStore();
  const user = useAuthStore((s) => s.user);

  // Show onboarding for new users who haven't completed it
  useEffect(() => {
    if (user && user.onboardingComplete === false) {
      setShowOnboarding(true);
    }
  }, [user]);

  const { data } = useQuery({
    queryKey: ['shops'],
    queryFn: () => shopsApi.getAll(),
    enabled: !!user,
  });

  useEffect(() => {
    if (data?.data?.shops) setShops(data.data.shops);
  }, [data]);

  return (
    <div className="h-full flex overflow-hidden bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin pb-16 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Onboarding modal */}
      {showOnboarding && (
        <Onboarding onClose={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}
