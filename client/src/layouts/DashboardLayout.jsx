import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, X, Wand2 } from 'lucide-react';
import AlertPanel from '../components/AlertPanel';
import { useAlerts } from '../hooks/useAlerts';
import toast from 'react-hot-toast';
import DemoGeneratorModal from '../components/DemoGeneratorModal';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useQuery } from '@tanstack/react-query';
import Sidebar    from '../components/Sidebar';
import Header     from '../components/Header';
import BottomNav  from '../components/BottomNav';
import Onboarding    from '../components/Onboarding';
import OfflineBanner        from '../components/OfflineBanner';
import ImpersonationBanner  from '../components/ImpersonationBanner';
import TourGuide     from '../components/TourGuide';
import HelpPanel     from '../components/HelpPanel';
import { useTour }   from '../hooks/useTour';
import NewBillButton from '../components/NewBillButton';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { migrateLegacyHeldBills } from '../hooks/useHeldBills';
import useShopStore  from '../store/shopStore';
import useAuthStore  from '../store/authStore';
import useSetupStore from '../store/setupStore';
import useThemeStore from '../store/themeStore';
import { demoApi }   from '../api/demo.api';
import { shopsApi }    from '../api/shops.api';
import { productsApi } from '../api/products.api';
import { customersApi } from '../api/customers.api';
import { salesApi }    from '../api/sales.api';

export default function DashboardLayout() {
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDemoModal,  setShowDemoModal]  = useState(false);
  const [alertsOpen,     setAlertsOpen]     = useState(false);
  const tour     = useTour();
  const navigate = useNavigate();

  const { alerts } = useAlerts();

  // Auto-show alerts once after dashboard load (1.5 s delay)
  useEffect(() => {
    if (!alerts.length) return;
    const t = setTimeout(() => setAlertsOpen(true), 1500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.length > 0]);

  // Initialise Capacitor push notifications (no-op on web)
  usePushNotifications();

  // Ctrl+B → POS Billing, available from every screen
  useGlobalShortcuts();

  // Import bills parked under the pre-store localStorage key (runs once)
  useEffect(() => { migrateLegacyHeldBills(); }, []);

  const location = useLocation();

  // Where the nav sits. Only affects lg: and up — on smaller screens the sidebar
  // stays an overlay drawer paired with BottomNav, unchanged.
  const sidebarPosition = useThemeStore((s) => s.sidebarPosition);
  const isHorizontal    = sidebarPosition === 'top' || sidebarPosition === 'bottom';
  const isRight         = sidebarPosition === 'right';

  const { setShops, activeShop } = useShopStore();
  const user                     = useAuthStore((s) => s.user);
  const { mark, modalDismissed, getProgress, isDemoMode } = useSetupStore();
  const qc = useQueryClient();

  const clearDemoMut = useMutation({
    mutationFn: () => demoApi.clear(activeShop?._id),
    onSuccess: () => {
      useSetupStore.setState({ isDemoMode: false });
      qc.invalidateQueries(['products']);
      qc.invalidateQueries(['customers']);
      toast.success('Demo data cleared');
    },
    onError: (e) => toast.error(e.message),
  });

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

  // ── 4. Auto-start tour for first-time users (once shop is set up) ─────────
  useEffect(() => {
    if (!user || !activeShop) return;
    if (tour.hasSeenTour()) return;
    const timer = setTimeout(() => tour.startTour(), 1800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeShop]);

  return (
    <div className={[
      'h-full flex overflow-hidden bg-[var(--color-bg)]',
      // Horizontal: the bar is a row in a column layout, so `flex-col` — and
      // `lg:flex-col-reverse` drops it below the content for 'bottom'.
      // Vertical: the default row, reversed for 'right'.
      // The mobile drawer is `fixed`, so it never participates in this flex and
      // the small-screen layout is identical in all four modes.
      isHorizontal
        ? `flex-col ${sidebarPosition === 'bottom' ? 'lg:flex-col-reverse' : ''}`
        : (isRight ? 'lg:flex-row-reverse' : ''),
    ].join(' ')}>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenSetup={() => setShowOnboarding(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen((v) => !v)}
          alertCount={alerts.length}
          onAlertsClick={() => setAlertsOpen((v) => !v)}
        />

        <OfflineBanner />

        {/* Impersonation Banner — always on top when impersonating */}
        <ImpersonationBanner />

        {/* Demo Mode Banner — shown when demo is active */}
        {isDemoMode && activeShop && (
          <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
              <FlaskConical className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Demo Mode Active — sample data loaded for <strong>{activeShop.name}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDemoModal(true)}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-100 hover:bg-indigo-200 px-2.5 py-1 rounded-lg transition whitespace-nowrap"
              >
                <Wand2 className="w-3 h-3" />
                Regenerate
              </button>
              <button
                onClick={() => clearDemoMut.mutate()}
                disabled={clearDemoMut.isPending}
                className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition whitespace-nowrap"
              >
                <X className="w-3 h-3" />
                {clearDemoMut.isPending ? 'Clearing…' : 'Clear Demo'}
              </button>
            </div>
          </div>
        )}

        {/* Demo trigger — shown when no demo is active and a shop exists */}
        {!isDemoMode && activeShop && user?.role === 'owner' && (
          <div className="shrink-0 bg-indigo-50 border-b border-indigo-100 px-4 py-1.5 flex items-center justify-between gap-3">
            <p className="text-xs text-indigo-600">
              <span className="font-semibold">New here?</span> Load realistic demo data to explore all features instantly.
            </p>
            <button
              onClick={() => setShowDemoModal(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition whitespace-nowrap shadow-sm"
            >
              <Wand2 className="w-3 h-3" />
              Try Demo
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin pb-16 lg:pb-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className="max-w-7xl mx-auto px-4 sm:px-6 py-6"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
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

      {showDemoModal && activeShop && (
        <DemoGeneratorModal
          shopId={activeShop._id}
          shopName={activeShop.name}
          isDemoActive={isDemoMode}
          onClose={() => setShowDemoModal(false)}
          onGenerated={() => setShowDemoModal(false)}
          onCleared={() => setShowDemoModal(false)}
        />
      )}

      <AlertPanel
        isOpen={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        alerts={alerts}
        onAlertClick={(alert) => { navigate(alert.route); setAlertsOpen(false); }}
      />

      {/* Interactive tour guide — auto-shown on first visit */}
      <TourGuide
        isOpen={tour.isOpen}
        step={tour.step}
        beginSteps={tour.beginSteps}
        nextStep={tour.nextStep}
        prevStep={tour.prevStep}
        skipTour={tour.skipTour}
      />

      {/* Global POS shortcut — one click to a new bill from any screen */}
      <NewBillButton />

      {/* Floating help panel — always available */}
      <HelpPanel />
    </div>
  );
}
