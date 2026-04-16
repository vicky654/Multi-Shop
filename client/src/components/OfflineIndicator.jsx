import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff, RefreshCw, CloudOff, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import SyncStatusPanel from './SyncStatusPanel';

/**
 * Sticky top banner + expandable sync status panel.
 *
 * Props:
 *   isOnline      — current network status
 *   pendingCount  — sales waiting to sync
 *   failedCount   — sales that failed 3 attempts
 *   isSyncing     — sync in progress
 *   lastSyncTime  — ISO string of last successful sync
 *   onSyncNow     — trigger manual sync
 *   onRetryFailed — reset failed → pending and re-sync
 *   shopId        — for local analytics inside SyncStatusPanel
 */
export default function OfflineIndicator({
  isOnline,
  pendingCount,
  failedCount,
  isSyncing,
  lastSyncTime,
  onSyncNow,
  onRetryFailed,
  shopId,
}) {
  const [showPanel, setShowPanel] = useState(false);

  const showOfflineBanner = !isOnline;
  const showSyncBanner    = isOnline && (pendingCount > 0 || failedCount > 0);
  const showAnyBanner     = showOfflineBanner || showSyncBanner;

  return (
    <>
      <AnimatePresence>
        {/* ── Offline banner (red) ─────────────────────────────────────────── */}
        {showOfflineBanner && (
          <motion.div
            key="offline"
            initial={{ opacity: 0, y: -44 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -44 }}
            transition={{ duration: 0.2 }}
            className="fixed top-0 left-0 right-0 z-[999] bg-red-600 text-white text-xs
                       font-semibold shadow-lg"
          >
            <div className="flex items-center justify-between px-4 py-2 max-w-screen-xl mx-auto">
              <div className="flex items-center gap-2">
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                <span>Offline Mode — sales saved locally</span>
                {pendingCount > 0 && (
                  <span className="bg-white text-red-600 text-[10px] font-bold px-1.5 py-0.5
                                   rounded-full leading-none">
                    {pendingCount} pending
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowPanel((v) => !v)}
                className="flex items-center gap-1 opacity-80 hover:opacity-100 transition"
                aria-label="Toggle sync details"
              >
                <span className="hidden sm:inline">Details</span>
                {showPanel
                  ? <ChevronUp   className="w-3.5 h-3.5" />
                  : <ChevronDown className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Sync banner (amber when online + pending) ─────────────────────── */}
        {showSyncBanner && (
          <motion.div
            key="sync"
            initial={{ opacity: 0, y: -44 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -44 }}
            transition={{ duration: 0.2 }}
            className={`fixed top-0 left-0 right-0 z-[999] text-white text-xs font-semibold
                        shadow-lg ${failedCount > 0 && pendingCount === 0 ? 'bg-rose-600' : 'bg-amber-500'}`}
          >
            <div className="flex items-center justify-between px-4 py-2 max-w-screen-xl mx-auto">
              <div className="flex items-center gap-2 min-w-0">
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span className="truncate">
                      Syncing {pendingCount} sale{pendingCount !== 1 ? 's' : ''}…
                    </span>
                  </>
                ) : (
                  <>
                    {failedCount > 0 && pendingCount === 0
                      ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      : <CloudOff      className="w-3.5 h-3.5 shrink-0" />
                    }
                    <span className="truncate">
                      {pendingCount > 0 && `${pendingCount} sale${pendingCount !== 1 ? 's' : ''} pending`}
                      {pendingCount > 0 && failedCount > 0 && ' · '}
                      {failedCount  > 0 && `${failedCount} failed`}
                    </span>

                    {pendingCount > 0 && (
                      <button
                        onClick={onSyncNow}
                        className="ml-1 underline hover:no-underline font-bold shrink-0"
                      >
                        Sync now
                      </button>
                    )}
                    {failedCount > 0 && (
                      <button
                        onClick={onRetryFailed}
                        className="ml-1 underline hover:no-underline font-bold shrink-0"
                      >
                        Retry
                      </button>
                    )}
                  </>
                )}
              </div>

              <button
                onClick={() => setShowPanel((v) => !v)}
                className="flex items-center gap-1 ml-3 opacity-80 hover:opacity-100 transition shrink-0"
                aria-label="Toggle sync details"
              >
                <span className="hidden sm:inline">Details</span>
                {showPanel
                  ? <ChevronUp   className="w-3.5 h-3.5" />
                  : <ChevronDown className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expandable status panel ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showPanel && showAnyBanner && (
          <SyncStatusPanel
            isOnline={isOnline}
            pendingCount={pendingCount}
            failedCount={failedCount}
            isSyncing={isSyncing}
            lastSyncTime={lastSyncTime}
            onSyncNow={onSyncNow}
            onRetryFailed={onRetryFailed}
            onClose={() => setShowPanel(false)}
            shopId={shopId}
          />
        )}
      </AnimatePresence>
    </>
  );
}
