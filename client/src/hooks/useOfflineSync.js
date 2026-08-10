import { useNetworkStatus } from './useNetworkStatus';
import { useSyncEngine } from './useSyncEngine';
import { addPendingSale } from '../lib/offlineDB';

export function useOfflineSync(shopId) {
  const { isOnline } = useNetworkStatus();
  const sync = useSyncEngine();

  const saveOffline = async (payload, grandTotal) => {
    const offlineId = crypto.randomUUID();
    await addPendingSale({
      offlineId,
      ...payload,
      totalAmount: grandTotal,
      syncStatus: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
    });
    sync.refreshCount();
  };

  return {
    isOnline,
    pendingCount: sync.pendingCount,
    failedCount: sync.failedCount,
    isSyncing: sync.isSyncing,
    lastSyncTime: sync.lastSyncTime,
    syncNow: sync.syncNow,
    retryFailed: sync.retryFailed,
    saveOffline,
  };
}
