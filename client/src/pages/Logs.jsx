import { useState, useCallback, useMemo, useEffect } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { format, isToday, formatDistanceToNow } from 'date-fns';
import { Activity, Search, Filter, Calendar, AlertCircle, Clock, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../components/DataTable';
import LoadingSpinner from '../components/LoadingSpinner';
import { logsApi } from '../api/logs.api';
import useShopStore from '../store/shopStore';
import { usePermissions } from '../hooks/usePermissions';

const LOG_ACTIONS = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'REGISTER_SUCCESS',
  'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE',
  'ORDER_CREATE', 'ORDER_GET_ALL', 'ORDER_UPDATE',
  'ERROR'
];

const STATUS_OPTIONS = ['success', 'error'];

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function LogCard({ log }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:shadow-blue-100/50 transition-all hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-2 h-2 mt-1.5 rounded-full ${
          log.status === 'success' ? 'bg-green-400' : 'bg-red-400'
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-gray-900">{log.action.replace(/_/g, ' ').toLowerCase()}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              log.status === 'success'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {log.status}
            </span>
          </div>
          <p className="text-sm text-gray-700 mb-2 line-clamp-2">{log.message}</p>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{log.module.toUpperCase()}</span>
            <span>•</span>
            <span>{isToday(new Date(log.createdAt)) ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }) : format(new Date(log.createdAt), 'MMM dd, HH:mm')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStats({ stats, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-white rounded-xl border border-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Today</span>
        </div>
        <p className="text-2xl font-bold text-gray-900">{stats.todayTotal || 0}</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Errors Today</span>
        </div>
        <p className="text-2xl font-bold text-red-600">{stats.todayErrors || 0}</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Hour</span>
        </div>
        <p className="text-2xl font-bold text-blue-600">{stats.lastHour || 0}</p>
      </div>
    </div>
  );
}

export default function Logs() {
  const [filters, setFilters] = useState({ status: 'all', action: 'all', search: '' });
  const debouncedSearch = useDebounce(filters.search, 300);
  const queryClient = useQueryClient();
  const { activeShop } = useShopStore();
  const { role } = usePermissions();

  const isSuperAdmin = role === 'super_admin';

  const queryFilters = useMemo(() => ({
    limit: 20,
    ...(filters.status !== 'all' ? { status: filters.status } : {}),
    ...(filters.action !== 'all' ? { action: filters.action } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(role === 'owner' && activeShop?._id ? { shopId: activeShop._id } : {}),
  }), [filters.status, filters.action, debouncedSearch, role, activeShop]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['logs', queryFilters],
    queryFn: ({ pageParam = 1 }) => logsApi.getLogs({ ...queryFilters, page: pageParam }),
    initialPageParam: 1,
getNextPageParam: (lastPage) => {
  const d = lastPage?.data?.data;

  if (!d || !d.page || !d.totalPages) {
    return undefined;
  }

  return d.page < d.totalPages ? d.page + 1 : undefined;
}
  });

 const logs =
  data?.pages?.flatMap(page => page?.data?.data?.logs || []) || [];
  
const stats = data?.pages?.[0]?.data?.data?.stats || {};
  const errorsToday = useMemo(
    () => logs.filter(log => log.status === 'error' && isToday(new Date(log.createdAt))).length,
    [logs]
  );

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-blue-600" />
            Activity Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track system actions{!isSuperAdmin && ' for this shop'}
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
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-9 pr-4 h-11 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Status</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <select
              value={filters.action}
              onChange={(e) => updateFilter('action', e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Actions</option>
              {LOG_ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 ml-auto">
            <Filter className="w-4 h-4" />
            {errorsToday > 0 && (
              <button
                onClick={() => updateFilter('status', filters.status === 'error' ? 'all' : 'error')}
                className="flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium hover:bg-red-100 transition"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                {errorsToday} error{errorsToday !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3, 4].map(i => (
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
            <div className="hidden lg:block">
              <DataTable
                columns={[
                  { key: 'createdAt', label: 'Time', render: (v) => format(new Date(v), 'HH:mm:ss') },
                  { key: 'action', label: 'Action', render: (v) => v.replace(/_/g, ' ').toLowerCase() },
                  { key: 'module', label: 'Module' },
                  { key: 'message', label: 'Message', render: (v, row) => row.status === 'error' ? <span className="font-semibold text-red-600">{v}</span> : v },
                  { key: 'status', label: 'Status', render: (v) => (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      v === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {v}
                    </span>
                  )},
                  { key: 'ipAddress', label: 'IP' },
                ]}
                data={logs}
                loading={false}
              />
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {logs.map((log) => (
                <LogCard key={log._id} log={log} />
              ))}
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
