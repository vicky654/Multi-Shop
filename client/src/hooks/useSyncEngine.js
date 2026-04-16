import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  getPendingSales,
  updatePendingSale,
  countPendingSales,
  countFailedSales,
  resetFailedSales,
} from '../lib/offlineDB';

/**
 * Sync Engine — pushes offline sales to the server when internet returns.
 *
 * Improvements over v1:
 *  - FIFO ordering (getPendingSales already sorts by createdAt ASC)
 *  - Uses POST /api/sales/bulk-sync — single request for all pending sales
 *  - Tracks failedCount separately from pendingCount
 *  - Tracks lastSyncTime (ISO string)
 *  - Exposes retryFailed() — resets failed → pending and re-syncs immediately
 *  - Triggers on visibilitychange (tab comes back into focus) in addition to 'online'
 *  - Concurrency lock prevents overlapping sync runs
 */
export function useSyncEngine() {
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount,  setFailedCount]  = useState(0);
  const [isSyncing,    setIsSyncing]    = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(
    () => localStorage.getItem('ms_last_sync') || null
  );
  const lockRef = useRef(false);

  // ── Refresh badge counts ──────────────────────────────────────────────────
  const refreshCount = useCallback(async () => {
    try {
      const [p, f] = await Promise.all([countPendingSales(), countFailedSales()]);
      setPendingCount(p);
      setFailedCount(f);
    } catch { /* IndexedDB unavailable in some private-browsing modes */ }
  }, []);

  // ── Core bulk-sync function ───────────────────────────────────────────────
  const syncNow = useCallback(async () => {
    if (lockRef.current || !navigator.onLine) return;

    const pending = await getPendingSales().catch(() => []);
    if (!pending.length) { refreshCount(); return; }

    lockRef.current = true;
    setIsSyncing(true);

    const toastId = toast.loading(
      `Syncing ${pending.length} offline sale${pending.length > 1 ? 's' : ''}…`,
      { duration: Infinity }
    );

    try {
      // ── Lazy-import to avoid circular deps ──────────────────────────────
      const { salesApi } = await import('../api/sales.api');

      // Build the payload. offlineId is sent so the backend can deduplicate.
      const salesPayload = pending.map(({ syncStatus, attempts, ...rest }) => rest);

      const res     = await salesApi.bulkSync(salesPayload);
      const results = res?.data?.results || [];

      // ── Process per-item results ─────────────────────────────────────────
      let ok = 0, fail = 0;

      for (const result of results) {
        const { offlineId, success, saleId, error } = result;

        if (success) {
          await updatePendingSale(offlineId, {
            syncStatus:   'synced',
            syncedAt:     new Date().toISOString(),
            serverSaleId: saleId,
          });
          ok++;
        } else {
          const sale     = pending.find((s) => s.offlineId === offlineId);
          const nextAtt  = (sale?.attempts || 0) + 1;
          await updatePendingSale(offlineId, {
            attempts:   nextAtt,
            syncStatus: nextAtt >= 3 ? 'failed' : 'pending',
            lastError:  error,
          });
          fail++;
        }
      }

      // Sales missing from results (network partial failure) stay pending
      const returned = new Set(results.map((r) => r.offlineId));
      for (const sale of pending) {
        if (!returned.has(sale.offlineId)) {
          const nextAtt = (sale.attempts || 0) + 1;
          await updatePendingSale(sale.offlineId, {
            attempts:   nextAtt,
            syncStatus: nextAtt >= 3 ? 'failed' : 'pending',
            lastError:  'No response from server',
          });
          fail++;
        }
      }

      // ── Update last sync time ─────────────────────────────────────────────
      const now = new Date().toISOString();
      setLastSyncTime(now);
      localStorage.setItem('ms_last_sync', now);

      toast.dismiss(toastId);
      if (ok)   toast.success(`✓ Synced ${ok} sale${ok > 1 ? 's' : ''}`);
      if (fail) toast.error(`${fail} sale${fail > 1 ? 's' : ''} failed — tap Retry`);

    } catch (err) {
      // Entire bulk request failed (network down, 500, etc.)
      toast.dismiss(toastId);
      toast.error('Sync failed — will retry when connected');

      for (const sale of pending) {
        const nextAtt = (sale.attempts || 0) + 1;
        await updatePendingSale(sale.offlineId, {
          attempts:   nextAtt,
          syncStatus: nextAtt >= 3 ? 'failed' : 'pending',
          lastError:  err.message,
        });
      }
    } finally {
      lockRef.current = false;
      setIsSyncing(false);
      await refreshCount();
    }
  }, [refreshCount]);

  // ── Retry failed: reset → pending, then sync immediately ─────────────────
  const retryFailed = useCallback(async () => {
    const reset = await resetFailedSales().catch(() => 0);
    if (reset > 0) {
      toast.success(`${reset} failed sale${reset > 1 ? 's' : ''} queued for retry`);
      await refreshCount();
      syncNow();
    }
  }, [syncNow, refreshCount]);

  // ── Trigger: network reconnect ────────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => setTimeout(syncNow, 800); // let link stabilise first
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [syncNow]);

  // ── Trigger: tab becomes visible (user switched back to POS tab) ──────────
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncNow();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [syncNow]);

  // ── Trigger: 30-second background interval ────────────────────────────────
  useEffect(() => {
    refreshCount(); // populate counts on mount

    const id = setInterval(() => {
      if (navigator.onLine) syncNow();
    }, 30_000);

    return () => clearInterval(id);
  }, [syncNow, refreshCount]);

  return {
    pendingCount,
    failedCount,
    isSyncing,
    lastSyncTime,
    syncNow,
    retryFailed,
    refreshCount,
  };
}
