import { useState, useCallback, useMemo, useEffect } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { format, isToday, formatDistanceToNow } from 'date-fns';
import {
  Activity, Search, Filter, AlertCircle, Clock,
  FileText, UserCheck, ShieldAlert, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { logsApi }    from '../api/logs.api';
import useShopStore   from '../store/shopStore';
import { usePermissions } from '../hooks/usePermissions';

const LOG_ACTIONS = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'REGISTER_SUCCESS',
  'IMPERSONATE_START', 'IMPERSONATE_END',
  'STAFF_CREATED', 'STAFF_UPDATED', 'STAFF_DELETED',
  'PASSWORD_UPDATE_BY_OWNER',
  'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE',
  'ORDER_CREATE', 'ORDER_GET_ALL', 'ORDER_UPDATE',
  'ERROR',
];

const STATUS_OPTIONS = ['success', 'error'];

const SEVERITY_COLOR = {
  IMPERSONATE_START: 'bg-amber-100 text-amber-800 border-amber-200',
  IMPERSONATE_END:   'bg-green-100 text-green-800 border-green-200',
  ERROR:             'bg-red-100 text-red-800 border-red-200',
};

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Actor badge ───────────────────────────────────────────────────────────────
function ActorBadge({ actor, actingAs }) {
  if (!actor && !actingAs) return <span className="text-gray-400 text-xs">—</span>;

  const name  = actor?.name  || '—';
  const role  = actor?.role  || '';
  const isOwner = role === 'owner' || role === 'super_admin';

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <User className={`w-3 h-3 shrink-0 ${isOwner ? 'text-blue-500' : 'text-gray-400'}`} />
        <span className="text-xs font-semibold text-gray-900 truncate max-w-[100px]">{name}</span>
      </div>
      {actingAs && (
        <div className="flex items-center gap-1">
          <UserCheck className="w-3 h-3 text-amber-500 shrink-0" />
          <span className="text-[10px] text-amber-700 font-medium truncate max-w-[100px]">
            as {actingAs.name}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Mobile log card ───────────────────────────────────────────────────────────
function LogCard({ log }) {
  const isImpLog = !!log.actingAs;
  return (
    <div className={`bg-white rounded-xl border p-4 hover:shadow-md transition-all hover:-translate-y-0.5 ${
      isImpLog ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-2 h-2 mt-1.5 rounded-full ${
          log.status === 'success' ? 'bg-green-400' : 'bg-red-400'
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-sm text-gray-900 capitalize">
              {log.action.replace(/_/g, ' ').toLowerCase()}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
              SEVERITY_COLOR[log.action] ||
              (log.status === 'success' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200')
            }`}>
              {log.status}
            </span>
            {isImpLog && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200">
                <ShieldAlert className="w-2.5 h-2.5" /> impersonated
              </span>
            )}
          </div>

          <p className="text-sm text-gray-700 mb-2 line-clamp-2">{log.message}</p>

          {/* Actor info (mobile) */}
          {(log.actorId || log.actingAs) && (
            <div className="mb-2">
              <ActorBadge actor={log.actorId} actingAs={log.actingAs} />
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{log.module?.toUpperCase()}</span>
            <span>•</span>
            <span>
              {isToday(new Date(log.createdAt))
                ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })
                : format(new Date(log.createdAt), 'MMM dd, HH:mm')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Quick stats bar ───────────────────────────────────────────────────────────
function QuickStats({ stats, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-white rounded-xl border border-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }
  const items = [
    { icon: FileText,   label: 'Today',       value: stats.todayTotal     || 0, color: 'text-gray-500',  bg: '' },
    { icon: AlertCircle,label: 'Errors',      value: stats.todayErrors    || 0, color: 'text-red-600',   bg: 'bg-red-50' },
    { icon: Clock,      label: 'Last Hour',   value: stats.lastHour       || 0, color: 'text-blue-600',  bg: 'bg-blue-50' },
    { icon: ShieldAlert,label: 'Impersonated',value: stats.impersonatedCount || 0, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ icon: Icon, label, value, color, bg }) => (
        <div key={label} className={`rounded-xl p-4 border border-gray-200 shadow-sm ${bg || 'bg-white'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
          </div>
          <p className={`text-2xl font-semibold ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main Logs page ────────────────────────────────────────────────────────────
export default function Logs() {
  const [filters, setFilters] = useState({
    status: 'all', action: 'all', search: '', impersonatedOnly: false,
  });
  const debouncedSearch = useDebounce(filters.search, 300);
  const queryClient     = useQueryClient();
  const { activeShop }  = useShopStore();
  const { role }        = usePermissions();
  const isSuperAdmin    = role === 'super_admin';

  const queryFilters = useMemo(() => ({
    limit: 20,
    ...(filters.status !== 'all'   ? { status: filters.status }   : {}),
    ...(filters.action !== 'all'   ? { action: filters.action }   : {}),
    ...(debouncedSearch            ? { search: debouncedSearch }  : {}),
    ...(filters.impersonatedOnly   ? { impersonatedOnly: 'true' } : {}),
    ...(role === 'owner' && activeShop?._id ? { shopId: activeShop._id } : {}),
  }), [filters.status, filters.action, debouncedSearch, filters.impersonatedOnly, role, activeShop]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['logs', queryFilters],
    queryFn:  ({ pageParam = 1 }) => logsApi.getLogs({ ...queryFilters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const d = lastPage?.data?.data;
      if (!d?.page || !d?.totalPages) return undefined;
      return d.page < d.totalPages ? d.page + 1 : undefined;
    },
  });

  const logs  = data?.pages?.flatMap((p) => p?.data?.data?.logs || []) || [];
  const stats = data?.pages?.[0]?.data?.data?.stats || {};

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-blue-600" />
            Activity Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Full audit trail{!isSuperAdmin && ' for this shop'} — including impersonation sessions
          </p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() =>
              logsApi.cleanupLogs()
                .then(() => { queryClient.invalidateQueries(['logs']); toast.success('Old logs cleaned up'); })
                .catch(() => toast.error('Cleanup failed'))
            }
            className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-sm font-medium transition"
          >
            <AlertCircle className="w-4 h-4" />
            Cleanup Old Logs
          </button>
        )}
      </div>

      {/* Quick Stats */}
      <QuickStats stats={stats} loading={isLoading} />

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder="Search messages…"
              className="w-full pl-9 pr-4 h-11 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
            />
          </div>

          {/* Dropdowns */}
          <div className="flex gap-2 flex-wrap">
            <select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="all">All Status</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>

            <select value={filters.action} onChange={(e) => updateFilter('action', e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="all">All Actions</option>
              {LOG_ACTIONS.map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
              ))}
            </select>

            {/* Impersonated only toggle */}
            <button
              onClick={() => updateFilter('impersonatedOnly', !filters.impersonatedOnly)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition ${
                filters.impersonatedOnly
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Impersonated Only
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500 ml-auto">
            <Filter className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 rounded-xl border border-gray-200 bg-white animate-pulse h-20" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-400">
            <Activity className="w-16 h-16 mb-4 opacity-30" />
            <h3 className="text-lg font-semibold mb-1">No logs found</h3>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actor / As</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Module</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Message</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => {
                    const isImpLog = !!log.actingAs;
                    return (
                      <tr key={log._id} className={`hover:bg-gray-50 transition-colors ${isImpLog ? 'bg-amber-50/40' : ''}`}>
                        {/* Time */}
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {isToday(new Date(log.createdAt))
                            ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })
                            : format(new Date(log.createdAt), 'MMM d, HH:mm')}
                        </td>

                        {/* Actor / ActingAs */}
                        <td className="px-4 py-3">
                          <ActorBadge actor={log.actorId} actingAs={log.actingAs} />
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {isImpLog && <ShieldAlert className="w-3 h-3 text-amber-500 shrink-0" />}
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                              SEVERITY_COLOR[log.action] || 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                              {log.action.replace(/_/g, ' ').toLowerCase()}
                            </span>
                          </div>
                        </td>

                        {/* Module */}
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-gray-500">{log.module}</span>
                        </td>

                        {/* Message */}
                        <td className="px-4 py-3 max-w-xs">
                          <p className={`text-xs truncate ${log.status === 'error' ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                            {log.message}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {logs.map((log) => <LogCard key={log._id} log={log} />)}
            </div>
          </>
        )}

        {/* Load More */}
        {hasNextPage && (
          <div className="flex justify-center py-8">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl transition shadow-sm"
            >
              {isFetchingNextPage ? <LoadingSpinner size="sm" /> : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
