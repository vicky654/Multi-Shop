import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, Search, Calendar, ChevronDown,
  CreditCard, Banknote, Smartphone, ReceiptText, RefreshCcw,
  User, Package, ShoppingBag, SlidersHorizontal, X,
  Copy, Share2, RotateCcw, ArrowUpRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { salesApi } from '../api/sales.api';
import useShopStore from '../store/shopStore';
import InvoiceModal from '../components/InvoiceModal';
import ShareModal from '../components/ShareModal';
import { useSwipe } from '../hooks/useSwipe';

// ── Design tokens (dark surface, used throughout this page) ───────────────────
// bg:   #0F172A  card: #1E293B  border: #334155  text: #E2E8F0  muted: #94A3B8

// ── Helpers ────────────────────────────────────────────────────────────────────
const METHOD_META = {
  cash:   { label: 'Cash',   Icon: Banknote,    cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  card:   { label: 'Card',   Icon: CreditCard,  cls: 'text-blue-400   bg-blue-400/10   border-blue-400/20'   },
  upi:    { label: 'UPI',    Icon: Smartphone,  cls: 'text-violet-400 bg-violet-400/10 border-violet-400/20' },
  credit: { label: 'Credit', Icon: ReceiptText, cls: 'text-amber-400  bg-amber-400/10  border-amber-400/20'  },
};

const PERIODS = [
  { label: 'Today',   days: 0  },
  { label: '3 Days',  days: 3  },
  { label: '7 Days',  days: 7  },
  { label: '30 Days', days: 30 },
];

function getStartDate(days) {
  const d = new Date();
  if (days === 0) { d.setHours(0, 0, 0, 0); return d.toISOString(); }
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtTotal(n) {
  return `₹${(n || 0).toLocaleString('en-IN')}`;
}

function buildCopyText(sale) {
  const items = (sale.items || [])
    .map((i) => `  ${i.name} ×${i.quantity}  ₹${(i.price * i.quantity * (1 - (i.discount || 0) / 100)).toFixed(0)}`)
    .join('\n');
  return [
    `Invoice: ${sale.invoiceNumber}`,
    `Date: ${new Date(sale.createdAt).toLocaleDateString('en-IN')}  ${new Date(sale.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
    ``,
    items,
    ``,
    `Total: ${fmtTotal(sale.totalAmount)}   Payment: ${(sale.paymentMethod || '').toUpperCase()}`,
    sale.customerId?.name ? `Customer: ${sale.customerId.name}` : '',
  ].filter(Boolean).join('\n');
}

// ── Payment badge ──────────────────────────────────────────────────────────────
function PayBadge({ method }) {
  const m = METHOD_META[method] || METHOD_META.cash;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${m.cls}`}>
      <m.Icon className="w-2.5 h-2.5" />
      {m.label}
    </span>
  );
}

// ── Pull-to-refresh indicator ──────────────────────────────────────────────────
function RefreshIndicator({ visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="flex items-center justify-center py-3"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
            className="w-5 h-5 border-2 border-[#334155] border-t-blue-500 rounded-full"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Skeleton card ──────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#334155] shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-[#334155] rounded w-2/3" />
          <div className="h-2.5 bg-[#334155] rounded w-1/2" />
        </div>
        <div className="w-16 h-4 bg-[#334155] rounded" />
      </div>
    </div>
  );
}

// ── Order card ────────────────────────────────────────────────────────────────
function OrderCard({ sale, onInvoice, onShare }) {
  const [open, setOpen] = useState(false);
  const navigate        = useNavigate();

  const itemCount = sale.items?.length || 0;
  const subTotal  = (sale.items || []).reduce((acc, i) => {
    return acc + i.price * i.quantity * (1 - (i.discount || 0) / 100);
  }, 0);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildCopyText(sale));
      toast.success('Order details copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const handleRepeat = () => {
    const cartItems = (sale.items || []).map((item) => ({
      productId: item.productId,
      name:      item.name,
      price:     item.price,
      stock:     9999,
      quantity:  item.quantity,
      discount:  item.discount || 0,
    }));
    try {
      sessionStorage.setItem('ms_repeat_order', JSON.stringify(cartItems));
      toast.success('Cart loaded — opening billing…');
      navigate('/billing');
    } catch {
      toast.error('Could not repeat order');
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="bg-[#1E293B] border border-[#334155] rounded-2xl overflow-hidden shadow-sm"
    >
      {/* ── Header row ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left active:bg-[#334155]/40 transition-colors touch-manipulation select-none"
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
          <ShoppingBag className="w-4.5 h-4.5 text-blue-400" />
        </div>

        {/* Left info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#E2E8F0] font-semibold text-sm font-mono leading-tight">
              {sale.invoiceNumber || '—'}
            </span>
            {sale.isPrivate && (
              <span className="text-[9px] font-medium text-[#64748B] bg-[#334155] px-1.5 py-0.5 rounded-full">
                PRIVATE
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#64748B] flex-wrap">
            <span>{fmtDate(sale.createdAt)}</span>
            <span>·</span>
            <span>{fmtTime(sale.createdAt)}</span>
            {sale.customerId?.name && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5 text-[#94A3B8]">
                  <User className="w-2.5 h-2.5" />
                  {sale.customerId.name}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right info */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[#E2E8F0] font-semibold text-sm tabular-nums">
            {fmtTotal(sale.totalAmount)}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#64748B]">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
            <PayBadge method={sale.paymentMethod} />
          </div>
        </div>

        {/* Chevron */}
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-1 shrink-0"
        >
          <ChevronDown className="w-4 h-4 text-[#475569]" />
        </motion.div>
      </button>

      {/* ── Expanded detail ── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#334155] px-4 py-4 space-y-4">
              {/* Items */}
              <div className="space-y-2">
                {(sale.items || []).map((item, i) => {
                  const lineTotal = item.price * item.quantity * (1 - (item.discount || 0) / 100);
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#475569] shrink-0" />
                        <span className="text-[#94A3B8] truncate">{item.name}</span>
                        <span className="text-[#64748B] shrink-0">×{item.quantity}</span>
                        {item.discount > 0 && (
                          <span className="text-emerald-500 shrink-0 text-[10px]">
                            -{item.discount}%
                          </span>
                        )}
                      </div>
                      <span className="text-[#E2E8F0] font-medium tabular-nums shrink-0 ml-4">
                        ₹{lineTotal.toFixed(0)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Totals breakdown */}
              <div className="border-t border-[#334155]/60 pt-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#64748B]">Subtotal</span>
                  <span className="text-[#94A3B8] tabular-nums">₹{subTotal.toFixed(0)}</span>
                </div>
                {sale.taxRate > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">GST ({sale.taxRate}%)</span>
                    <span className="text-[#94A3B8] tabular-nums">
                      ₹{((sale.totalAmount / (1 + sale.taxRate / 100)) * (sale.taxRate / 100)).toFixed(0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-1 border-t border-[#334155]/60">
                  <span className="text-[#94A3B8] font-medium">Total</span>
                  <span className="text-[#E2E8F0] font-semibold tabular-nums">{fmtTotal(sale.totalAmount)}</span>
                </div>
                {sale.dueAmount > 0 && (
                  <div className="flex justify-between text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                    <span className="text-amber-400 font-medium">Due Amount</span>
                    <span className="text-amber-400 font-semibold tabular-nums">{fmtTotal(sale.dueAmount)}</span>
                  </div>
                )}
              </div>

              {sale.notes && (
                <p className="text-[10px] text-[#64748B] italic border-l-2 border-[#334155] pl-2">
                  "{sale.notes}"
                </p>
              )}

              {/* Action grid */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => onInvoice(sale)}
                  className="flex items-center justify-center gap-2 h-11 bg-blue-600/90 hover:bg-blue-500 active:bg-blue-700 rounded-2xl text-white font-medium text-xs transition-colors touch-manipulation"
                >
                  <ReceiptText className="w-3.5 h-3.5" />
                  View Invoice
                </button>
                <button
                  onClick={handleRepeat}
                  className="flex items-center justify-center gap-2 h-11 bg-[#334155] hover:bg-[#475569] active:bg-[#1E293B] rounded-2xl text-[#E2E8F0] font-medium text-xs transition-colors touch-manipulation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Repeat Order
                </button>
                <button
                  onClick={() => onShare(sale)}
                  className="flex items-center justify-center gap-2 h-11 bg-[#334155] hover:bg-[#475569] rounded-2xl text-[#E2E8F0] font-medium text-xs transition-colors touch-manipulation"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-2 h-11 bg-[#334155] hover:bg-[#475569] rounded-2xl text-[#94A3B8] font-medium text-xs transition-colors touch-manipulation"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Details
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Orders Page ───────────────────────────────────────────────────────────────
export default function Orders() {
  const navigate       = useNavigate();
  const qc             = useQueryClient();
  const { activeShop } = useShopStore();
  const shopId         = activeShop?._id;

  const [periodIdx,    setPeriodIdx]    = useState(1);
  const [methodFilter, setMethodFilter] = useState('');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [showFilters,  setShowFilters]  = useState(false);
  const [invoiceSale,  setInvoiceSale]  = useState(null);
  const [shareSale,    setShareSale]    = useState(null);
  const [refreshing,   setRefreshing]   = useState(false);

  const startDate = useMemo(() => getStartDate(PERIODS[periodIdx].days), [periodIdx]);
  const LIMIT = 20;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['orders', shopId, startDate, methodFilter, page],
    queryFn:  () => salesApi.getAll({
      shopId,
      startDate,
      paymentMethod: methodFilter || undefined,
      page,
      limit: LIMIT,
    }),
    enabled:          !!shopId,
    keepPreviousData: true,
  });

  const sales   = data?.data || [];
  const total   = data?.total || 0;
  const hasMore = page * LIMIT < total;

  // Pull to refresh
  const handlePullRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 600);
  }, [refetch]);

  const swipeHandlers = useSwipe({ onSwipeDown: handlePullRefresh });

  // Client-side search
  const filtered = useMemo(() => {
    if (!search.trim()) return sales;
    const q = search.toLowerCase();
    return sales.filter((s) =>
      s.invoiceNumber?.toLowerCase().includes(q) ||
      s.customerId?.name?.toLowerCase().includes(q) ||
      s.items?.some((i) => i.name?.toLowerCase().includes(q))
    );
  }, [sales, search]);

  // Stats
  const stats = useMemo(() => ({
    revenue: sales.reduce((s, o) => s + (o.totalAmount || 0), 0),
    count:   total,
  }), [sales, total]);

  if (!shopId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]" style={{ background: '#0F172A', borderRadius: '1.5rem' }}>
        <ClipboardList className="w-12 h-12 mb-4 text-[#334155]" />
        <p className="text-[#94A3B8] font-medium">Select a shop to view orders</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen -mx-4 -mt-4 sm:-mx-6 px-4 pt-5 pb-24 sm:pb-8 overflow-y-auto"
      style={{ background: '#0F172A' }}
      {...swipeHandlers}
    >
      <div className=" mx-auto space-y-4">

        {/* Pull-to-refresh indicator */}
        <RefreshIndicator visible={refreshing} />

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[#E2E8F0] font-semibold text-xl flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-400" />
              Orders
            </h1>
            <p className="text-[#64748B] text-xs mt-0.5">
              {activeShop?.name}
            </p>
          </div>

          {/* Stats pill */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[#E2E8F0] font-semibold text-sm tabular-nums">{fmtTotal(stats.revenue)}</p>
              <p className="text-[#64748B] text-[10px]">{stats.count} order{stats.count !== 1 ? 's' : ''}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-blue-400" />
            </div>
          </div>
        </div>

        {/* ── Period tabs ── */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => { setPeriodIdx(i); setPage(1); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap touch-manipulation ${
                periodIdx === i
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-900/40'
                  : 'bg-[#1E293B] text-[#94A3B8] border-[#334155] hover:border-[#475569] hover:text-[#E2E8F0]'
              }`}
            >
              <Calendar className="w-3 h-3" />
              {p.label}
            </button>
          ))}
        </div>

        {/* ── Search + filter row ── */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Invoice, customer, product…"
              className="w-full h-10 pl-9 pr-8 text-sm rounded-xl border border-[#334155] bg-[#1E293B] text-[#E2E8F0] placeholder:text-[#475569] focus:outline-none focus:border-blue-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 touch-manipulation"
              >
                <X className="w-3.5 h-3.5 text-[#475569] hover:text-[#94A3B8]" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors touch-manipulation ${
              methodFilter
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:border-[#475569]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Payment filter (slides down) */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 flex-wrap pb-1">
                {[{ key: '', label: 'All' }, ...Object.entries(METHOD_META).map(([k, v]) => ({ key: k, label: v.label }))].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setMethodFilter(key); setPage(1); }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all touch-manipulation ${
                      methodFilter === key
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-[#1E293B] text-[#94A3B8] border-[#334155] hover:border-[#475569]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── List ── */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#1E293B] border border-[#334155] flex items-center justify-center mb-4">
              <ClipboardList className="w-8 h-8 text-[#334155]" />
            </div>
            <p className="text-[#94A3B8] font-medium text-base">No orders found</p>
            <p className="text-[#64748B] text-sm mt-1">Try a different date range or filter</p>
            <button
              onClick={() => navigate('/billing')}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-medium text-sm transition-colors touch-manipulation"
            >
              <ShoppingBag className="w-4 h-4" />
              Start Billing
            </button>
          </motion.div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {filtered.map((sale) => (
                <OrderCard
                  key={sale._id}
                  sale={sale}
                  onInvoice={setInvoiceSale}
                  onShare={setShareSale}
                />
              ))}
            </AnimatePresence>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2 pb-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2.5 text-xs font-medium rounded-xl border border-[#334155] text-[#94A3B8] bg-[#1E293B] hover:bg-[#334155] disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
              >
                ← Previous
              </button>
              <span className="text-xs text-[#475569]">
                {filtered.length} shown · pg {page}
              </span>
              <button
                disabled={!hasMore || isFetching}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2.5 text-xs font-medium rounded-xl border border-[#334155] text-[#94A3B8] bg-[#1E293B] hover:bg-[#334155] disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {invoiceSale && (
        <InvoiceModal
          sale={invoiceSale}
          onClose={() => setInvoiceSale(null)}
          onUpdated={(updated) => { setInvoiceSale(updated); refetch(); }}
        />
      )}
      {shareSale && (
        <ShareModal sale={shareSale} onClose={() => setShareSale(null)} />
      )}
    </div>
  );
}
