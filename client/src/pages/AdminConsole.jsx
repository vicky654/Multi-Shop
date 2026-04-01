import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Terminal, RefreshCcw, ArrowLeft, Shield, CircleDot,
  ChevronDown, X, Search, AlertCircle, CheckCircle2,
  User, UserCheck, Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/authStore';
import { adminApi } from '../api/admin.api';

// ── Design tokens (terminal dark theme) ──────────────────────────────────────
// bg: #0A0F1A  surface: #111827  border: #1F2937  text: #D1D5DB  muted: #6B7280

const STATUS_META = {
  success: { label: 'OK',  cls: 'text-emerald-400', dot: 'bg-emerald-400' },
  error:   { label: 'ERR', cls: 'text-red-400',     dot: 'bg-red-400'     },
};

// Actions that get special color treatment
const ACTION_COLORS = {
  SUPER_ADMIN_LOGIN:      '#F59E0B',
  LOGIN_SUCCESS:          '#34D399',
  LOGIN_FAILED:           '#F87171',
  ORDER_CREATE:           '#60A5FA',
  IMPERSONATE_START:      '#C084FC',
  IMPERSONATE_END:        '#C084FC',
  ADMIN_VIEW_ANALYTICS:   '#FCD34D',
  ADMIN_VIEW_CONSOLE:     '#FCD34D',
  ADMIN_TOGGLE_USER:      '#FB923C',
  ERROR:                  '#F87171',
};

function actionColor(action) {
  return ACTION_COLORS[action] || '#9CA3AF';
}

const PERIODS = [
  { label: '1d',  value: 1  },
  { label: '3d',  value: 3  },
  { label: '7d',  value: 7  },
  { label: '14d', value: 14 },
];

const STATUSES = ['', 'success', 'error'];

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ── Log Row ───────────────────────────────────────────────────────────────────
function LogRow({ log }) {
  const [open, setOpen] = useState(false);
  const sm = STATUS_META[log.status] || STATUS_META.success;
  const color = actionColor(log.action);

  const actor = log.actorId || log.userId;
  const acting = log.actingAs;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-[#1F2937] last:border-0"
    >
      {/* Main row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#111827]/80 transition-colors font-mono text-[11px] touch-manipulation"
      >
        {/* Status dot */}
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${sm.dot}`} />

        {/* Timestamp */}
        <span className="text-[#4B5563] shrink-0 w-24 hidden sm:block">
          {fmtDate(log.createdAt)} {fmtTime(log.createdAt)}
        </span>
        <span className="text-[#4B5563] shrink-0 sm:hidden">{fmtTime(log.createdAt)}</span>

        {/* Action */}
        <span className="font-semibold shrink-0 w-48 truncate" style={{ color }}>
          {log.action}
        </span>

        {/* Module */}
        <span className="text-[#6B7280] shrink-0 w-16 hidden md:block truncate">{log.module}</span>

        {/* Message (truncated) */}
        <span className="text-[#9CA3AF] flex-1 min-w-0 truncate hidden lg:block">{log.message}</span>

        {/* User */}
        {actor && (
          <span className="text-[#60A5FA] shrink-0 hidden xl:flex items-center gap-1 w-36 truncate">
            {acting ? <UserCheck className="w-3 h-3 text-[#C084FC] shrink-0" /> : <User className="w-3 h-3 shrink-0" />}
            <span className="truncate">{actor.name || actor.email}</span>
          </span>
        )}

        <ChevronDown
          className={`w-3 h-3 text-[#4B5563] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 bg-[#0A0F1A]/60 font-mono text-[11px] space-y-1.5 border-t border-[#1F2937]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                <Row k="Action"  v={log.action}  c={color}    />
                <Row k="Module"  v={log.module}              />
                <Row k="Status"  v={log.status}  c={sm.cls}   />
                <Row k="Time"    v={`${fmtDate(log.createdAt)} ${fmtTime(log.createdAt)}`} />
                {actor  && <Row k="Actor"   v={`${actor.name} (${actor.role})`} c="#60A5FA" />}
                {acting && <Row k="As"      v={`${acting.name} (${acting.role})`} c="#C084FC" />}
                {log.ipAddress && <Row k="IP" v={log.ipAddress} />}
              </div>
              <div className="pt-1">
                <Row k="Message" v={log.message} />
              </div>
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <div className="pt-1">
                  <span className="text-[#4B5563]">metadata → </span>
                  <span className="text-[#9CA3AF] break-all">
                    {JSON.stringify(log.metadata).slice(0, 300)}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Row({ k, v, c }) {
  return (
    <div className="flex gap-2">
      <span className="text-[#4B5563] shrink-0 w-16">{k}</span>
      <span className="min-w-0 truncate" style={c ? { color: c } : { color: '#D1D5DB' }}>{v || '—'}</span>
    </div>
  );
}

// ── Guard ─────────────────────────────────────────────────────────────────────
function AccessDenied() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <Shield className="w-10 h-10 text-red-500 mb-3" />
      <p className="font-semibold text-gray-900">Access Denied</p>
      <button onClick={() => navigate('/dashboard')} className="mt-3 text-blue-600 text-sm">Back to Dashboard</button>
    </div>
  );
}

// ── AdminConsole Page ─────────────────────────────────────────────────────────
export default function AdminConsole() {
  const user     = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const listRef  = useRef(null);

  const [period,      setPeriod]      = useState(1);
  const [statusFilter,setStatusFilter]= useState('');
  const [actionFilter,setActionFilter]= useState('');
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [liveMode,    setLiveMode]    = useState(false);

  if (user?.role !== 'super_admin') return <AccessDenied />;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey:  ['admin-console', period, statusFilter, actionFilter, page],
    queryFn:   () => adminApi.getConsoleLogs({
      period,
      status: statusFilter || undefined,
      action: actionFilter || undefined,
      page,
      limit: 50,
    }),
    staleTime: liveMode ? 0 : 30_000,
    refetchInterval: liveMode ? 5000 : false,
  });

  const logs  = data?.data?.logs  || [];
  const total = data?.data?.total || 0;
  const LIMIT = 50;
  const hasMore = page * LIMIT < total;

  // Client search
  const filtered = search.trim()
    ? logs.filter((l) =>
        l.action?.toLowerCase().includes(search.toLowerCase()) ||
        l.message?.toLowerCase().includes(search.toLowerCase()) ||
        l.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
        l.userId?.email?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  // Auto-scroll to top on live mode refresh
  useEffect(() => {
    if (liveMode && listRef.current) listRef.current.scrollTop = 0;
  }, [data, liveMode]);

  return (
    <div
      className="min-h-screen -mx-4 -mt-4 sm:-mx-6 flex flex-col"
      style={{ background: '#0A0F1A' }}
    >
      {/* ── Terminal header ── */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3 border-b sticky top-0 z-10"
        style={{ background: '#0A0F1A', borderColor: '#1F2937' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: '#1F2937', color: '#9CA3AF' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-sm font-semibold text-[#D1D5DB]">
              multishop:console
            </span>
            <span className="font-mono text-xs text-[#6B7280]">
              ~  {total} entries
            </span>
          </div>
          {liveMode && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <CircleDot className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
              <span className="text-[10px] font-medium text-emerald-400">LIVE</span>
            </div>
          )}
          {isFetching && !liveMode && (
            <RefreshCcw className="w-3.5 h-3.5 text-[#6B7280] animate-spin" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLiveMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              liveMode
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'border-[#1F2937] text-[#6B7280] hover:text-[#9CA3AF]'
            }`}
          >
            <CircleDot className="w-3 h-3" />
            Live
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#1F2937] text-[#6B7280] hover:text-[#9CA3AF] transition-colors"
          >
            <RefreshCcw className="w-3 h-3" />
            Refresh
          </button>
          <button
            onClick={() => navigate('/admin/analytics')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/80 hover:bg-blue-600 text-white transition-colors"
          >
            Analytics
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div
        className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b flex-wrap"
        style={{ borderColor: '#1F2937', background: '#0D1117' }}
      >
        {/* Period */}
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => { setPeriod(p.value); setPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-colors ${
                period === p.value
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                  : 'text-[#6B7280] hover:text-[#9CA3AF] border border-transparent'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-[#1F2937]" />

        {/* Status filter */}
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <button
              key={s || 'all'}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-colors flex items-center gap-1 ${
                statusFilter === s
                  ? 'bg-[#1F2937] text-[#D1D5DB]'
                  : 'text-[#6B7280] hover:text-[#9CA3AF]'
              }`}
            >
              {s === 'success' && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />}
              {s === 'error'   && <AlertCircle  className="w-2.5 h-2.5 text-red-400"     />}
              {s || 'ALL'}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-[#1F2937]" />

        {/* Action text filter */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#4B5563]" />
          <input
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value.toUpperCase()); setPage(1); }}
            placeholder="ACTION filter…"
            className="w-full h-7 pl-7 pr-6 text-[11px] font-mono rounded-lg border focus:outline-none"
            style={{
              background: '#111827', borderColor: '#1F2937',
              color: '#D1D5DB',
            }}
          />
          {actionFilter && (
            <button onClick={() => setActionFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-[#4B5563]" />
            </button>
          )}
        </div>

        {/* Message search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#4B5563]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search message, user…"
            className="w-full h-7 pl-7 pr-6 text-[11px] font-mono rounded-lg border focus:outline-none"
            style={{
              background: '#111827', borderColor: '#1F2937',
              color: '#D1D5DB',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-[#4B5563]" />
            </button>
          )}
        </div>
      </div>

      {/* ── Column headers ── */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-1.5 border-b font-mono text-[10px] uppercase tracking-widest"
        style={{ borderColor: '#1F2937', color: '#4B5563', background: '#0D1117' }}
      >
        <div className="w-1.5 shrink-0" />
        <span className="w-24 shrink-0 hidden sm:block">Timestamp</span>
        <span className="w-48 shrink-0">Action</span>
        <span className="w-16 shrink-0 hidden md:block">Module</span>
        <span className="flex-1 hidden lg:block">Message</span>
        <span className="w-36 shrink-0 hidden xl:block">Actor</span>
        <div className="w-3 shrink-0" />
      </div>

      {/* ── Log stream ── */}
      <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-thin" style={{ minHeight: 0 }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-[#6B7280] font-mono text-sm">
              <RefreshCcw className="w-4 h-4 animate-spin" />
              Loading logs…
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Terminal className="w-10 h-10 text-[#1F2937] mb-3" />
            <p className="text-[#4B5563] font-mono text-sm">No logs found</p>
            <p className="text-[#374151] font-mono text-xs mt-1">Adjust the filters or time period</p>
          </div>
        ) : (
          <div>
            <AnimatePresence initial={false}>
              {filtered.map((log) => (
                <LogRow key={log._id} log={log} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Footer / Pagination ── */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t font-mono text-[11px]"
        style={{ borderColor: '#1F2937', background: '#0D1117', color: '#6B7280' }}
      >
        <span>{filtered.length} / {total} entries · page {page}</span>
        <div className="flex gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 rounded-lg border border-[#1F2937] hover:border-[#374151] text-[#9CA3AF] disabled:opacity-30 transition-colors"
          >
            ← prev
          </button>
          <button
            disabled={!hasMore || isFetching}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded-lg border border-[#1F2937] hover:border-[#374151] text-[#9CA3AF] disabled:opacity-30 transition-colors"
          >
            next →
          </button>
        </div>
      </div>
    </div>
  );
}
