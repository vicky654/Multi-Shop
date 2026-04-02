import { useState, useCallback } from 'react';

const STORAGE_KEY = 'multishop:held-bills';

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

const persist = (bills) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
  } catch {
    // storage full — silently ignore
  }
};

/**
 * useHeldBills — lightweight hold/resume for the Billing page.
 *
 * A "held bill" is a snapshot of the current cart (items, customer, discount, etc.)
 * saved to localStorage so it can be resumed later without losing the current state.
 *
 * Returns:
 *   heldBills   — array of held bill snapshots
 *   holdBill    — (label, snapshot) → saves current bill, returns bill id
 *   resumeBill  — (id) → returns the snapshot and removes it from the list
 *   deleteBill  — (id) → removes a held bill without resuming
 */
export function useHeldBills() {
  const [heldBills, setHeldBills] = useState(load);

  const holdBill = useCallback((label, snapshot) => {
    const bill = {
      id:        crypto.randomUUID(),
      label:     label || `Bill ${new Date().toLocaleTimeString()}`,
      heldAt:    Date.now(),
      ...snapshot,
    };
    setHeldBills((prev) => {
      const next = [...prev, bill];
      persist(next);
      return next;
    });
    return bill.id;
  }, []);

  const resumeBill = useCallback((id) => {
    let found = null;
    setHeldBills((prev) => {
      const next = prev.filter((b) => {
        if (b.id === id) { found = b; return false; }
        return true;
      });
      persist(next);
      return next;
    });
    return found;
  }, []);

  const deleteBill = useCallback((id) => {
    setHeldBills((prev) => {
      const next = prev.filter((b) => b.id !== id);
      persist(next);
      return next;
    });
  }, []);

  return { heldBills, holdBill, resumeBill, deleteBill };
}
