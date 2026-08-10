import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * heldBillsStore — parked (held) bills for the POS.
 *
 * Why a store and not a hook-local useState:
 *   The previous useHeldBills hook read the resumed bill out of a setState
 *   updater and returned it immediately. React doesn't run that updater
 *   synchronously, so the caller always received `null` — the bill was removed
 *   from the list but the cart was never restored, i.e. the bill vanished.
 *   Reading from store state directly makes resume synchronous and correct,
 *   and `persist` keeps everything through navigation and full page reloads.
 *
 * A held bill is a complete snapshot of the POS: line items with their prices,
 * quantities and discounts, the customer, tax selection, notes and the
 * in-progress payment state — so resuming restores the exact bill.
 */

const nextSeq = (bills) =>
  bills.reduce((max, b) => Math.max(max, b.seq || 0), 0) + 1;

const useHeldBillsStore = create(
  persist(
    (set, get) => ({
      bills: [],

      /**
       * Park the current bill.
       * @param {object} snapshot — full POS state (see Billing.jsx handleHold)
       * @returns {string} the new bill's id
       */
      hold: (snapshot) => {
        const bills = get().bills;
        const seq   = nextSeq(bills);
        const bill  = {
          id:     crypto.randomUUID(),
          seq,                                  // human-facing Bill ID (#1, #2, …)
          billNo: `HOLD-${String(seq).padStart(3, '0')}`,
          heldAt: Date.now(),
          ...snapshot,
        };
        set({ bills: [...bills, bill] });
        return bill.id;
      },

      /**
       * Read a held bill WITHOUT removing it. The caller removes it only after
       * successfully restoring the cart, so a failure can never lose the bill.
       */
      peek: (id) => get().bills.find((b) => b.id === id) || null,

      remove: (id) => set({ bills: get().bills.filter((b) => b.id !== id) }),

      clearAll: () => set({ bills: [] }),
    }),
    {
      name: 'ms_held_bills',
      version: 1,
      // One-time import of bills parked by the previous localStorage format,
      // so nobody loses a held bill when this ships.
      migrate: (persisted) => persisted,
    }
  )
);

export default useHeldBillsStore;
