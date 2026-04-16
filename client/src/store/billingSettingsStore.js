import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * billingSettingsStore — persisted fast-billing preferences.
 *
 * Stored in localStorage under key 'ms_billing_settings'.
 * All keys are optional; the Billing page reads these to enable
 * zero-friction "1-click billing" mode.
 */
const useBillingSettingsStore = create(
  persist(
    (set) => ({
      // ── Auto-billing toggles ────────────────────────────────────────────
      // When ON: checkout fires immediately after Enter on the pay button,
      // with no confirmation modal.
      skipConfirmation: false,

      // When ON: payment method is locked to this value — no manual selection
      autoPaymentMode: 'cash',   // 'cash' | 'card' | 'upi' | 'credit'

      // When ON: first search result is added to cart on Enter
      // (instead of requiring the user to arrow-down then Enter)
      autoAddFirstResult: true,

      // When ON: after checkout the receipt modal is skipped; invoice prints
      // automatically and cart resets immediately
      autoPrint: false,

      // When ON: "Walk-in Customer" is pre-selected, skipping the customer
      // search step entirely for anonymous sales
      autoWalkIn: true,

      // Debounce delay for product search (ms). Lower = faster, higher = fewer API calls
      searchDebounceMs: 200,

      // ── Actions ─────────────────────────────────────────────────────────
      update: (patch) => set((s) => ({ ...s, ...patch })),
      reset:  ()      => set({
        skipConfirmation:  false,
        autoPaymentMode:   'cash',
        autoAddFirstResult: true,
        autoPrint:         false,
        autoWalkIn:        true,
        searchDebounceMs:  200,
      }),
    }),
    { name: 'ms_billing_settings' }
  )
);

export default useBillingSettingsStore;
