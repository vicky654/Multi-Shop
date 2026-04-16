import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw, AlertTriangle, CheckCircle, Clock,
  Download, RotateCcw, X, WifiOff, Wifi,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getAllPendingSales, getLocalAnalytics, exportAllData } from '../lib/offlineDB';

/**
 * Collapsible panel that shows full sync status, local analytics, and actions.
 * Rendered by OfflineIndicator when user clicks "Details".
 */
export default function SyncStatusPanel({
  isOnline,
  pendingCount,
  failedCount,
  isSyncing,
  lastSyncTime,
  onSyncNow,
  onRetryFailed,
  onClose,
  shopId,
}) {
  const [sales,     setSales]     = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Load data whenever the panel opens
  useEffect(() => {
    getAllPendingSales().then(setSales).catch(() => []);
    getLocalAnalytics(shopId).then(setAnalytics).catch(() => null);
  }, [shopId, pendingCount, failedCount]);

  // ── Export offline data as JSON download ──────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const data  = await exportAllData();
      const blob  = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement('a');
      a.href      = url;
      a.download  = `multishop-offline-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const statusIcon = (syncStatus) => {
    if (syncStatus === 'synced')  return <CheckCircle  className="w-3.5 h-3.5 text-green-500" />;
    if (syncStatus === 'failed')  return <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />;
    return                               <Clock         className="w-3.5 h-3.5 text-amber-500" />;
  };

  const statusLabel = (syncStatus) => ({
    synced:  'Synced',
    failed:  'Failed',
    pending: 'Pending',
  }[syncStatus] || syncStatus);

  return (
    <motion.div
      key="sync-panel"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="fixed top-[36px] left-0 right-0 z-[998] bg-white border-b border-gray-200
                 shadow-xl max-h-[80vh] overflow-y-auto"
    >
      <div className="max-w-2xl mx-auto px-4 py-4">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isOnline
              ? <Wifi    className="w-4 h-4 text-green-500" />
              : <WifiOff className="w-4 h-4 text-red-500"   />
            }
            <h3 className="text-sm font-semibold text-gray-800">
              Offline Sync Status
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── KPI row ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-[11px] text-amber-700 font-medium mt-0.5">Pending</p>
          </div>
          <div className={`rounded-xl p-3 text-center border ${
            failedCount > 0
              ? 'bg-rose-50 border-rose-200'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <p className={`text-2xl font-bold ${failedCount > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
              {failedCount}
            </p>
            <p className={`text-[11px] font-medium mt-0.5 ${failedCount > 0 ? 'text-rose-700' : 'text-gray-500'}`}>
              Failed
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-600">
              {analytics?.syncedCount ?? '—'}
            </p>
            <p className="text-[11px] text-green-700 font-medium mt-0.5">Synced</p>
          </div>
        </div>

        {/* ── Local analytics ────────────────────────────────────────────────── */}
        {analytics && (pendingCount > 0 || failedCount > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div>
              <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">
                Offline Revenue (today)
              </p>
              <p className="text-sm font-semibold text-blue-800">
                ₹{analytics.todayRevenue.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">
                Today's Sales
              </p>
              <p className="text-sm font-semibold text-blue-800">
                {analytics.todaySalesCount}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">
                Total Pending Revenue
              </p>
              <p className="text-sm font-semibold text-blue-800">
                ₹{analytics.totalRevenue.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">
                Items in Pending Sales
              </p>
              <p className="text-sm font-semibold text-blue-800">
                {analytics.totalItems}
              </p>
            </div>
          </div>
        )}

        {/* ── Last sync time ──────────────────────────────────────────────────── */}
        {lastSyncTime && (
          <p className="text-[11px] text-gray-500 mb-3 flex items-center gap-1.5">
            <CheckCircle className="w-3 h-3 text-green-500" />
            Last synced {formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}
          </p>
        )}

        {/* ── Actions ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-4">
          {isOnline && pendingCount > 0 && (
            <button
              onClick={onSyncNow}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700
                         text-white text-xs font-semibold rounded-lg transition disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing…' : 'Sync Now'}
            </button>
          )}

          {failedCount > 0 && (
            <button
              onClick={onRetryFailed}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700
                         text-white text-xs font-semibold rounded-lg transition disabled:opacity-60"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry {failedCount} Failed
            </button>
          )}

          <button
            onClick={handleExport}
            disabled={exporting || sales.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200
                       text-gray-700 text-xs font-semibold rounded-lg transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exporting…' : 'Backup Data'}
          </button>
        </div>

        {/* ── Sale list ───────────────────────────────────────────────────────── */}
        {sales.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Offline Sales Queue ({sales.length})
            </p>
            {sales.map((sale) => (
              <div
                key={sale.offlineId}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs
                            border ${
                              sale.syncStatus === 'synced'  ? 'bg-green-50  border-green-200' :
                              sale.syncStatus === 'failed'  ? 'bg-rose-50   border-rose-200'  :
                                                              'bg-amber-50  border-amber-200'
                            }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {statusIcon(sale.syncStatus)}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {sale.items?.length || 0} item{sale.items?.length !== 1 ? 's' : ''} ·{' '}
                      ₹{(sale.totalAmount || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {new Date(sale.createdAt).toLocaleTimeString([], {
                        hour: '2-digit', minute: '2-digit',
                      })}
                      {sale.attempts > 0 && ` · ${sale.attempts} attempt${sale.attempts !== 1 ? 's' : ''}`}
                      {sale.lastError && ` · ${sale.lastError}`}
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  sale.syncStatus === 'synced'  ? 'bg-green-100 text-green-700' :
                  sale.syncStatus === 'failed'  ? 'bg-rose-100  text-rose-700'  :
                                                  'bg-amber-100 text-amber-700'
                }`}>
                  {statusLabel(sale.syncStatus)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-4">
            No offline sales in queue.
          </p>
        )}
      </div>
    </motion.div>
  );
}
