/**
 * useSetupStore — tracks onboarding progress from real frontend data.
 *
 * Design principles:
 *  • NO backend flag. State is derived from whether data actually exists.
 *  • Persisted to localStorage so flags survive page reloads.
 *  • Individual pages call `mark()` after successful mutations.
 *  • DashboardLayout does a boot-time API check to sync flags on fresh login.
 *  • On logout, call `reset()` so the next user starts clean.
 */
import { create } from 'zustand';
import { persist }  from 'zustand/middleware';

const useSetupStore = create(
  persist(
    (set, get) => ({
      hasProducts:    false,
      hasCustomers:   false,
      hasSales:       false,
      modalDismissed: false, // user explicitly closed the welcome modal

      /**
       * Mark a step as done.
       * key: 'hasProducts' | 'hasCustomers' | 'hasSales' | 'modalDismissed'
       */
      mark: (key) => set({ [key]: true }),

      /** Dismiss the welcome modal without completing all steps. */
      dismissModal: () => set({ modalDismissed: true }),

      /**
       * Compute progress. Accepts `activeShop` from useShopStore because
       * Zustand stores cannot directly read each other's state.
       *
       * Call as:  useSetupStore.getState().getProgress(activeShop)
       * Or in a component:
       *   const progress = useSetupStore(s => s.getProgress(activeShop));
       */
      getProgress: (activeShop) => {
        const { hasProducts, hasCustomers, hasSales } = get();
        const steps = {
          shop:     !!activeShop,
          product:  hasProducts,
          customer: hasCustomers,
          sale:     hasSales,
        };
        const completed = Object.values(steps).filter(Boolean).length;
        return {
          steps,
          completed,
          total:      4,
          isComplete: completed === 4,
          pct:        Math.round((completed / 4) * 100),
        };
      },

      /** Call on logout so the next user doesn't inherit this user's flags. */
      reset: () => set({
        hasProducts:    false,
        hasCustomers:   false,
        hasSales:       false,
        modalDismissed: false,
      }),
    }),
    {
      name:    'ms-setup-v1',   // localStorage key
      version: 1,
    }
  )
);

export default useSetupStore;
