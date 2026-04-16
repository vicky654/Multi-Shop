import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, Play, Clock, CheckCircle2, XCircle, AlertCircle,
  SkipForward, RefreshCw, ChevronDown, ChevronUp, Bot,
  Package, TrendingUp, Calendar, Users, Tag, Activity,
  ShoppingBag, Percent, Star, Archive,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { erpAutomationApi } from '../api/erpAutomation.api';
import useShopStore from '../store/shopStore';

// ── Automation metadata (label overrides, icons, descriptions) ────────────────
const META = {
  LOW_STOCK_ALERT:   { icon: Package,     color: 'orange', desc: 'Flags products at or below their reorder threshold'              },
  AUTO_REORDER:      { icon: RefreshCw,   color: 'blue',   desc: 'Identifies out-of-stock items that need purchase orders'         },
  DAILY_PROFIT:      { icon: TrendingUp,  color: 'green',  desc: 'Summarises today\'s revenue, profit and margin'                  },
  EXPIRY_ALERT:      { icon: Calendar,    color: 'red',    desc: 'Detects products expiring within 30 days'                        },
  CUSTOMER_REMINDER: { icon: Users,       color: 'purple', desc: 'Lists customers with outstanding credit balances'                },
  SMART_PRICING:     { icon: Tag,         color: 'teal',   desc: 'Suggests price increases for items with < 10% margin'            },
  INACTIVE_PRODUCT:  { icon: Activity,    color: 'yellow', desc: 'Finds in-stock products with no sales in 30 days'                },
  AUTO_DISCOUNT:     { icon: Percent,     color: 'pink',   desc: 'Suggests discounts for items in stock for 60+ days'              },
  FAST_MOVER:        { icon: Star,        color: 'amber',  desc: 'Highlights the top-selling SKUs from the past 7 days'            },
  DEAD_STOCK:        { icon: Archive,     color: 'gray',   desc: 'Detects products unsold for 90+ days to free up capital'         },
};

const COLOR = {
  orange: 'bg-orange-100 text-orange-600',
  blue:   'bg-blue-100   text-blue-600',
  green:  'bg-emerald-100 text-emerald-600',
  red:    'bg-red-100    text-red-600',
  purple: 'bg-purple-100 text-purple-600',
  teal:   'bg-teal-100   text-teal-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  pink:   'bg-pink-100   text-pink-600',
  amber:  'bg-amber-100  text-amber-600',
  gray:   'bg-gray-100   text-gray-500',
};

const intervalLabel = (ms) => {
  if (ms >= 86400000) return `${ms / 86400000}d`;
  if (ms >= 3600000)  return `${ms / 3600000}h`;
  return `${ms / 60000}m`;
};

const timeAgo = (date) => {
  if (!date) return 'Never';
  const secs = Math.floor((Date.now() - new Date(date)) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    success: { icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50',  label: 'Success' },
    failed:  { icon: XCircle,      cls: 'text-red-600    bg-red-50',       label: 'Failed'  },
    skipped: { icon: SkipForward,  cls: 'text-gray-500   bg-gray-50',      label: 'Skipped' },
  };
  const { icon: Icon, cls, label } = map[status] || map.skipped;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ── Toggle pill ───────────────────────────────────────────────────────────────
function Toggle({ enabled, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${enabled ? 'bg-blue-500' : 'bg-gray-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

// ── Log row ───────────────────────────────────────────────────────────────────
function LogRow({ log }) {
  const [open, setOpen] = useState(false);
  const hasData = log.data && Object.keys(log.data).length > 0;

  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        type="button"
        onClick={() => hasData && setOpen((v) => !v)}
        className={`w-full flex items-start gap-3 px-4 py-3 text-left ${hasData ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
      >
        <StatusBadge status={log.status} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-700 leading-snug">{log.message}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {log.type.replace(/_/g, ' ')} · {new Date(log.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {hasData && (
          open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
               : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
        )}
      </button>
      {open && hasData && (
        <div className="px-4 pb-3">
          <pre className="text-[10px] bg-gray-50 rounded-lg p-3 overflow-x-auto text-gray-600 leading-relaxed">
            {JSON.stringify(log.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Automation card ───────────────────────────────────────────────────────────
function AutomationCard({ automation, shopId, onToggle, onRunNow, runningType }) {
  const { type, label, enabled, lastRunAt, intervalMs } = automation;
  const meta  = META[type] || { icon: Bot, color: 'gray', desc: '' };
  const Icon  = meta.icon;
  const isRunning = runningType === type;

  return (
    <div className={`bg-white rounded-xl border transition-all ${enabled ? 'border-gray-200 shadow-sm' : 'border-gray-100 opacity-70'}`}>
      <div className="flex items-center gap-3 p-4">
        {/* Icon */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${COLOR[meta.color] || COLOR.gray}`}>
          <Icon className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 leading-none">{label}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{meta.desc}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              every {intervalLabel(intervalMs)}
            </span>
            {lastRunAt && (
              <span className="text-[10px] text-gray-400">
                last: {timeAgo(lastRunAt)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={!enabled || isRunning}
            onClick={() => onRunNow(type)}
            className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-all
              ${enabled && !isRunning
                ? 'border-blue-200 text-blue-600 hover:bg-blue-50'
                : 'border-gray-100 text-gray-300 cursor-not-allowed'}`}
          >
            {isRunning
              ? <RefreshCw className="w-3 h-3 animate-spin" />
              : <Play className="w-3 h-3" />}
            {isRunning ? 'Running' : 'Run'}
          </button>
          <Toggle enabled={enabled} onChange={(val) => onToggle(type, val)} />
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Automations() {
  const { activeShop } = useShopStore();
  const shopId = activeShop?._id;
  const qc     = useQueryClient();

  const [activeLog, setActiveLog] = useState(null);   // null = all, else type
  const [runningType, setRunningType] = useState(null);

  // ── Fetch automations list ─────────────────────────────────────────────────
  const { data: listData, isLoading } = useQuery({
    queryKey: ['erp-automations', shopId],
    queryFn:  () => erpAutomationApi.list(shopId),
    enabled:  !!shopId,
    refetchInterval: 30_000,
  });

  // ── Fetch logs ─────────────────────────────────────────────────────────────
  const { data: logsData, isFetching: logsFetching } = useQuery({
    queryKey: ['erp-automation-logs', shopId, activeLog],
    queryFn:  () => erpAutomationApi.logs(shopId, activeLog, 100),
    enabled:  !!shopId,
    refetchInterval: 60_000,
  });

  // ── Toggle ─────────────────────────────────────────────────────────────────
  const toggleMut = useMutation({
    mutationFn: ({ type, enabled }) => erpAutomationApi.toggle(type, shopId, enabled),
    onSuccess: () => qc.invalidateQueries(['erp-automations', shopId]),
    onError:   (e) => toast.error(e.response?.data?.message || e.message),
  });

  // ── Run now ────────────────────────────────────────────────────────────────
  const runMut = useMutation({
    mutationFn: (type) => erpAutomationApi.runNow(type, shopId),
    onMutate:   (type) => setRunningType(type),
    onSuccess:  (res, type) => {
      setRunningType(null);
      toast.success(`${type.replace(/_/g, ' ')} completed`);
      qc.invalidateQueries(['erp-automations', shopId]);
      qc.invalidateQueries(['erp-automation-logs', shopId]);
    },
    onError: (e, type) => {
      setRunningType(null);
      toast.error(e.response?.data?.message || e.message);
    },
  });

  const automations = listData?.data?.data?.automations || [];
  const logs        = logsData?.data?.data?.logs || [];

  if (!shopId) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400 text-sm">
        Select a shop to view automations.
      </div>
    );
  }

  // Group automations by category for display
  const enabled  = automations.filter((a) => a.enabled);
  const disabled = automations.filter((a) => !a.enabled);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-100">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">ERP Automations</h1>
          <p className="text-sm text-gray-500">
            {enabled.length} of {automations.length} automations active
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            qc.invalidateQueries(['erp-automations', shopId]);
            qc.invalidateQueries(['erp-automation-logs', shopId]);
          }}
          className="ml-auto p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats bar */}
      {automations.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Active"
            value={enabled.length}
            color="bg-blue-50 text-blue-700"
          />
          <StatCard
            label="Paused"
            value={disabled.length}
            color="bg-gray-50 text-gray-600"
          />
          <StatCard
            label="Total Runs"
            value={logs.length}
            color="bg-emerald-50 text-emerald-700"
          />
        </div>
      )}

      {/* Automations grid */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Bot className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No automations found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {automations.map((auto) => (
            <AutomationCard
              key={auto.type}
              automation={auto}
              shopId={shopId}
              runningType={runningType}
              onToggle={(type, val) => toggleMut.mutate({ type, enabled: val })}
              onRunNow={(type) => runMut.mutate(type)}
            />
          ))}
        </div>
      )}

      {/* Logs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Logs header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Run History</span>
            {logsFetching && <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />}
          </div>

          {/* Filter by type */}
          <select
            value={activeLog || ''}
            onChange={(e) => setActiveLog(e.target.value || null)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white outline-none"
          >
            <option value="">All types</option>
            {automations.map((a) => (
              <option key={a.type} value={a.type}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        {/* Log rows */}
        {logs.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-xs">
            No run history yet — automations log here after each execution.
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <LogRow key={log._id} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${color}`}>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-xs mt-1 opacity-80">{label}</p>
    </div>
  );
}
