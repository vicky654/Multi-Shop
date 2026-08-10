import { useCallback } from 'react';
import useHeldBillsStore from '../store/heldBillsStore';

const LEGACY_KEY = 'multishop:held-bills';

/**
 * useHeldBills — hold/resume for the Billing page.
 *
 * Thin wrapper over heldBillsStore (zustand + persist). State lives in the
 * store so held bills survive navigation and page reloads, and so `resumeBill`
 * can return the snapshot synchronously.
 *
 * Returns:
 *   heldBills   — array of held bill snapshots (newest last)
 *   holdBill    — (label, snapshot) → saves the current bill, returns its id
 *   resumeBill  — (id) → returns the snapshot, or null if it no longer exists.
 *                 Does NOT remove it; call completeResume(id) once the cart has
 *                 actually been restored so a failure can't lose the bill.
 *   completeResume — (id) → drop the bill after a successful restore
 *   deleteBill  — (id) → remove a held bill without resuming
 */
export function useHeldBills() {
  const bills    = useHeldBillsStore((s) => s.bills);
  const hold     = useHeldBillsStore((s) => s.hold);
  const peek     = useHeldBillsStore((s) => s.peek);
  const remove   = useHeldBillsStore((s) => s.remove);
  const clearAll = useHeldBillsStore((s) => s.clearAll);

  const holdBill = useCallback((label, snapshot) => hold({
    label: label || `Bill ${new Date().toLocaleTimeString()}`,
    ...snapshot,
  }), [hold]);

  const resumeBill = useCallback((id) => peek(id), [peek]);

  return {
    heldBills: bills,
    holdBill,
    resumeBill,
    completeResume: remove,
    deleteBill: remove,
    clearAll,
  };
}

/**
 * One-time migration of bills parked under the old localStorage key.
 * Safe to call on every mount — it clears the legacy key once imported.
 */
export function migrateLegacyHeldBills() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const legacy = JSON.parse(raw);
    if (Array.isArray(legacy) && legacy.length) {
      const { bills } = useHeldBillsStore.getState();
      const existing  = new Set(bills.map((b) => b.id));
      const imported  = legacy
        .filter((b) => b?.id && !existing.has(b.id))
        .map((b, i) => ({
          seq:    bills.length + i + 1,
          billNo: `HOLD-${String(bills.length + i + 1).padStart(3, '0')}`,
          heldAt: b.heldAt || Date.now(),
          ...b,
        }));
      if (imported.length) useHeldBillsStore.setState({ bills: [...bills, ...imported] });
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // corrupt legacy payload — nothing recoverable, move on
  }
}
