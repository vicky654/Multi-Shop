import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, Search, Calendar, ChevronDown,
  CreditCard, Banknote, Smartphone, ReceiptText,
  User, Package, ShoppingBag, SlidersHorizontal, X,
  Copy, Share2, RotateCcw, ArrowUpRight, CheckCircle2,
  Clock, AlertCircle, Check, XCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { salesApi } from '../api/sales.api';
import useShopStore from '../store/shopStore';
import InvoiceModal from '../components/InvoiceModal';
import ShareModal from '../components/ShareModal';
import { useSwipe } from '../hooks/useSwipe';
import { formatDiscountPct } from '../utils/format';

// ── Helpers ────────────────────────────────────────────────────────────────────
const METHOD_META = {
  cash:   { label: 'Cash',   Icon: Banknote,    cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  card:   { label: 'Card',   Icon: CreditCard,  cls: 'text-blue-600 dark:text-blue-400   bg-blue-400/10   border-blue-400/20'   },
  upi:    { label: 'UPI',    Icon: Smartphone,  cls: 'text-violet-600 dark:text-violet-400 bg-violet-400/10 border-violet-400/20' },
  credit: { label: 'Credit', Icon: ReceiptText, cls: 'text-amber-600 dark:text-amber-400  bg-amber-400/10  border-amber-400/20'  },
};

const STATUS_META = {
  pending:   { label: 'Pending',   cls: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' },
  accepted:  { label: 'Accepted',  cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  completed: { label: 'Completed', cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  rejected:  { label: 'Rejected',  cls: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20' },
  cancelled: { label: 'Cancelled', cls: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20' },
  refunded:  { label: 'Refunded',  cls: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20' },
  draft:     { label: 'Draft',     cls: 'text-gray-600 dark:text-gray-400 bg-gray-500/10 border-gray-500/20' },
};

const PERIODS = [
  { label: 'Today',   days: 0  },
  { label: '3 Days',  days: 3  },
  { label: '7 Days',  days: 7  },
  { label: '30 Days', days: 30 },
];

const STATUS_FILTERS = [
  { key: '',          label: 'All Status' },
  { key: 'pending',   label: 'Pending'   },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected',  label: 'Rejected'  },
  { key: 'cancelled', label: 'Cancelled' },
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
    `Invoice: ${sale.invoiceNumber || 'Pending Order'}`,
    `Date: ${new Date(sale.createdAt).toLocaleDateString('en-IN')}  ${new Date(sale.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
    ``,
    items,
    ``,
    `Total: ${fmtTotal(sale.totalAmount)}   Status: ${(sale.status || '').toUpperCase()}`,
    sale.customerName || sale.customerId?.name ? `Customer: ${sale.customerName || sale.customerId?.name}` : '',
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

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_META[status] || STATUS_META.completed;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${s.cls}`}>
      {s.label}
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
            className="w-5 h-5 border-2 border-[var(--color-border)] border-t-blue-500 rounded-full"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Skeleton card ──────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-[var(--color-surface-2)] rounded w-2/3" />
          <div className="h-2.5 bg-[var(--color-surface-2)] rounded w-1/2" />
        </div>
        <div className="w-16 h-4 bg-[var(--color-surface-2)] rounded" />
      </div>
    </div>
  );
}

// ── Order card ────────────────────────────────────────────────────────────────
function OrderCard({ sale, onInvoice, onShare, onAccept, onReject, processingId }) {
  const [open, setOpen] = useState(sale.status === 'pending');
  const navigate        = useNavigate();

  const isProcessing = processingId === sale._id;
  const itemCount    = sale.items?.length || 0;
  const subTotal     = (sale.items || []).reduce((acc, i) => {
    return acc + i.price * i.quantity * (1 - (i.discount || 0) / 100);
  }, 0);

  const customerDisplayName = sale.customerName || sale.customerId?.name || 'Walk-in Customer';
  const customerPhone       = sale.customerPhone || sale.customerId?.phone || '';

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
      productId: item.productId || item.product,
      name:      item.name,
      price:     item.price,
      stock:     9999,
      quantity:  item.quantity,
      discount:  item.discount || 0,
      size:      item.selectedSize || '',
      color:     item.selectedColor || '',
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
      className={`bg-[var(--color-card)] border rounded-2xl overflow-hidden shadow-sm ${
        sale.status === 'pending'
          ? 'border-amber-500/40 ring-1 ring-amber-500/20'
          : 'border-[var(--color-border)]'
      }`}
    >
      {/* ── Pending Order Banner (Requires Action) ── */}
      {sale.status === 'pending' && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <div>
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Pending Website Order
              </span>
              <span className="text-[11px] text-amber-700 dark:text-amber-400 block sm:inline sm:ml-2">
                Inventory unchanged until accepted
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={isProcessing}
              onClick={(e) => { e.stopPropagation(); onReject(sale); }}
              className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold transition flex items-center gap-1 disabled:opacity-50 touch-manipulation"
            >
              <X className="w-3.5 h-3.5" />
              Reject Order
            </button>
            <button
              disabled={isProcessing}
              onClick={(e) => { e.stopPropagation(); onAccept(sale); }}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-50 touch-manipulation"
            >
              {isProcessing ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              Accept Order
            </button>
          </div>
        </div>
      )}

      {/* ── Header row ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left active:bg-[var(--color-surface-2)] transition-colors touch-manipulation select-none"
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
          <ShoppingBag className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
        </div>

        {/* Left info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[var(--color-text)] font-semibold text-sm font-mono leading-tight">
              {sale.invoiceNumber || 'PENDING ORDER'}
            </span>
            {sale.isOnlineOrder && (
              <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
                WEBSITE ORDER
              </span>
            )}
            {sale.isPrivate && (
              <span className="text-[9px] font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded-full">
                PRIVATE
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--color-text-muted)] flex-wrap">
            <span>{fmtDate(sale.createdAt)}</span>
            <span>·</span>
            <span>{fmtTime(sale.createdAt)}</span>
            {customerDisplayName && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5 text-[var(--color-text-secondary)] font-medium">
                  <User className="w-2.5 h-2.5" />
                  {customerDisplayName} {customerPhone ? `(${customerPhone})` : ''}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right info */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[var(--color-text)] font-semibold text-sm tabular-nums">
            {fmtTotal(sale.totalAmount)}
          </span>
          <div className="flex items-center gap-1.5">
            <StatusBadge status={sale.status} />
            <PayBadge method={sale.paymentMethod} />
          </div>
        </div>

        {/* Chevron */}
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-1 shrink-0"
        >
          <ChevronDown className="w-4 h-4 text-[var(--color-text-disabled)]" />
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
            <div className="border-t border-[var(--color-border)] px-4 py-4 space-y-4">
              {/* Items */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Order Items ({itemCount})
                </p>
                {(sale.items || []).map((item, i) => {
                  const lineTotal = item.price * item.quantity * (1 - (item.discount || 0) / 100);
                  const hasVariant = !!(item.selectedSize || item.selectedColor);
                  return (
                    <div key={i} className="flex items-center justify-between text-xs bg-[var(--color-surface-2)]/50 p-2.5 rounded-xl border border-[var(--color-border)]">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-[var(--color-text-secondary)] font-semibold">{item.name}</span>
                        {hasVariant && (
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                            {[item.selectedSize && `Size ${item.selectedSize}`, item.selectedColor && `Color ${item.selectedColor}`].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        <span className="text-[var(--color-text-muted)] font-medium">×{item.quantity}</span>
                        {item.discount > 0 && (
                          <span className="text-emerald-500 font-bold text-[10px]">
                            -{formatDiscountPct(item.discount)}%
                          </span>
                        )}
                      </div>
                      <span className="text-[var(--color-text)] font-semibold tabular-nums shrink-0 ml-4">
                        ₹{lineTotal.toFixed(0)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Totals breakdown */}
              <div className="border-t border-[var(--color-border)] pt-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Subtotal</span>
                  <span className="text-[var(--color-text-secondary)] tabular-nums">₹{subTotal.toFixed(0)}</span>
                </div>
                {sale.taxRate > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">GST ({sale.taxRate}%)</span>
                    <span className="text-[var(--color-text-secondary)] tabular-nums">
                      ₹{((sale.totalAmount / (1 + sale.taxRate / 100)) * (sale.taxRate / 100)).toFixed(0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-1 border-t border-[var(--color-border)]">
                  <span className="text-[var(--color-text-secondary)] font-medium">Total</span>
                  <span className="text-[var(--color-text)] font-semibold tabular-nums">{fmtTotal(sale.totalAmount)}</span>
                </div>
                {sale.rejectionReason && (
                  <div className="flex justify-between text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                    <span className="text-rose-600 dark:text-rose-400 font-medium">Rejection Reason</span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">{sale.rejectionReason}</span>
                  </div>
                )}
              </div>

              {sale.notes && (
                <p className="text-[10px] text-[var(--color-text-muted)] italic border-l-2 border-[var(--color-border)] pl-2">
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
                  className="flex items-center justify-center gap-2 h-11 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-2-hover)] active:bg-[var(--color-card)] rounded-2xl text-[var(--color-text)] font-medium text-xs transition-colors touch-manipulation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Repeat Order
                </button>
                <button
                  onClick={() => onShare(sale)}
                  className="flex items-center justify-center gap-2 h-11 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-2-hover)] rounded-2xl text-[var(--color-text)] font-medium text-xs transition-colors touch-manipulation"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-2 h-11 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-2-hover)] rounded-2xl text-[var(--color-text-secondary)] font-medium text-xs transition-colors touch-manipulation"
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
  const [statusFilter, setStatusFilter] = useState('');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [showFilters,  setShowFilters]  = useState(false);
  const [invoiceSale,  setInvoiceSale]  = useState(null);
  const [shareSale,    setShareSale]    = useState(null);
  const [refreshing,   setRefreshing]   = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const startDate = useMemo(() => getStartDate(PERIODS[periodIdx].days), [periodIdx]);
  const LIMIT = 20;

  // Primary sales list
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['orders', shopId, startDate, methodFilter, statusFilter, page],
    queryFn:  () => salesApi.getAll({
      shopId,
      startDate: statusFilter === 'pending' ? undefined : startDate,
      paymentMethod: methodFilter || undefined,
      status: statusFilter || undefined,
      page,
      limit: LIMIT,
    }),
    enabled:          !!shopId,
    keepPreviousData: true,
  });

  // Query specifically for pending website orders to show high-priority banner
  const { data: pendingData } = useQuery({
    queryKey: ['orders-pending', shopId],
    queryFn:  () => salesApi.getAll({ shopId, status: 'pending', limit: 50 }),
    enabled:  !!shopId,
    refetchInterval: 10000,
  });

  const sales         = data?.data || [];
  const pendingOrders = pendingData?.data || [];
  const total         = data?.total || 0;
  const hasMore       = page * LIMIT < total;

  // Accept Order Handler
  const handleAcceptOrder = async (sale) => {
    setProcessingId(sale._id);
    try {
      await salesApi.acceptOrder(sale._id);
      toast.success(`Order ${sale.invoiceNumber || ''} accepted! Stock automatically updated.`, { icon: '✅' });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders-pending'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Could not accept order';
      toast.error(msg, { duration: 5000 });
    } finally {
      setProcessingId(null);
    }
  };

  // Reject Order Handler
  const handleRejectOrder = async (sale) => {
    const reason = window.prompt('Enter reason for rejecting this order (optional):', 'Out of stock / Cannot fulfill');
    if (reason === null) return;

    setProcessingId(sale._id);
    try {
      await salesApi.rejectOrder(sale._id, reason);
      toast.success(`Order ${sale.invoiceNumber || ''} rejected. Stock unchanged.`, { icon: '❌' });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders-pending'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Could not reject order';
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  // Pull to refresh
  const handlePullRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), qc.invalidateQueries({ queryKey: ['orders-pending'] })]);
    setTimeout(() => setRefreshing(false), 600);
  }, [refetch, qc]);

  const swipeHandlers = useSwipe({ onSwipeDown: handlePullRefresh });

  // Client-side search
  const filtered = useMemo(() => {
    if (!search.trim()) return sales;
    const q = search.toLowerCase();
    return sales.filter((s) =>
      s.invoiceNumber?.toLowerCase().includes(q) ||
      s.customerName?.toLowerCase().includes(q) ||
      s.customerId?.name?.toLowerCase().includes(q) ||
      s.items?.some((i) => i.name?.toLowerCase().includes(q))
    );
  }, [sales, search]);

  // Stats
  const stats = useMemo(() => ({
    revenue: sales.filter((s) => s.status === 'completed' || s.status === 'accepted').reduce((s, o) => s + (o.totalAmount || 0), 0),
    count:   total,
  }), [sales, total]);

  if (!shopId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] rounded-3xl bg-[var(--color-bg)]">
        <ClipboardList className="w-12 h-12 mb-4 text-[var(--color-text-disabled)]" />
        <p className="text-[var(--color-text-secondary)] font-medium">Select a shop to view orders</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen -mx-4 -mt-4 sm:-mx-6 px-4 pt-5 pb-24 sm:pb-8 overflow-y-auto bg-[var(--color-bg)]"
      {...swipeHandlers}
    >
      <div className=" mx-auto space-y-4">

        {/* Pull-to-refresh indicator */}
        <RefreshIndicator visible={refreshing} />

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[var(--color-text)] font-semibold text-xl flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Orders & Sales
            </h1>
            <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
              {activeShop?.name}
            </p>
          </div>

          {/* Stats pill */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[var(--color-text)] font-semibold text-sm tabular-nums">{fmtTotal(stats.revenue)}</p>
              <p className="text-[var(--color-text-muted)] text-[10px]">{stats.count} order{stats.count !== 1 ? 's' : ''}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* ── Pending Website Orders Alert Banner ── */}
        {pendingOrders.length > 0 && statusFilter !== 'pending' && (
          <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border border-amber-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold shrink-0">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  {pendingOrders.length} Website Order{pendingOrders.length !== 1 ? 's' : ''} Pending Attention
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Review customer details and stock. Inventory is reserved upon acceptance.
                </p>
              </div>
            </div>
            <button
              onClick={() => { setStatusFilter('pending'); setPage(1); }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold text-xs rounded-xl transition shadow-sm whitespace-nowrap touch-manipulation"
            >
              Review Pending Orders →
            </button>
          </div>
        )}

        {/* ── Status filter tabs ── */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.key}
              onClick={() => { setStatusFilter(s.key); setPage(1); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap touch-manipulation flex items-center gap-1.5 ${
                statusFilter === s.key
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-900/30'
                  : 'bg-[var(--color-card)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-surface-2-hover)] hover:text-[var(--color-text)]'
              }`}
            >
              {s.label}
              {s.key === 'pending' && pendingOrders.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-black">
                  {pendingOrders.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Period tabs ── */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => { setPeriodIdx(i); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all whitespace-nowrap touch-manipulation ${
                periodIdx === i
                  ? 'bg-[var(--color-surface-2)] text-[var(--color-text)] border-[var(--color-border)] font-bold'
                  : 'bg-[var(--color-card)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text-secondary)]'
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-disabled)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice, customer, product…"
              className="w-full h-10 pl-9 pr-8 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-blue-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 touch-manipulation"
              >
                <X className="w-3.5 h-3.5 text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors touch-manipulation ${
              methodFilter
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-[var(--color-card)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-2-hover)]'
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
                {[{ key: '', label: 'All Payments' }, ...Object.entries(METHOD_META).map(([k, v]) => ({ key: k, label: v.label }))].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setMethodFilter(key); setPage(1); }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all touch-manipulation ${
                      methodFilter === key
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-[var(--color-card)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-surface-2-hover)]'
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
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-card)] border border-[var(--color-border)] flex items-center justify-center mb-4">
              <ClipboardList className="w-8 h-8 text-[var(--color-text-disabled)]" />
            </div>
            <p className="text-[var(--color-text-secondary)] font-medium text-base">No orders found</p>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">Try a different status, date range, or search</p>
            <button
              onClick={() => navigate('/billing')}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-medium text-sm transition-colors touch-manipulation"
            >
              <ShoppingBag className="w-4 h-4" />
              Start Billing
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {filtered.map((sale) => (
                <OrderCard
                  key={sale._id}
                  sale={sale}
                  onInvoice={setInvoiceSale}
                  onShare={setShareSale}
                  onAccept={handleAcceptOrder}
                  onReject={handleRejectOrder}
                  processingId={processingId}
                />
              ))}
            </AnimatePresence>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2 pb-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2.5 text-xs font-medium rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] bg-[var(--color-card)] hover:bg-[var(--color-surface-2)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
              >
                ← Previous
              </button>
              <span className="text-xs text-[var(--color-text-disabled)]">
                {filtered.length} shown · pg {page}
              </span>
              <button
                disabled={!hasMore || isFetching}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2.5 text-xs font-medium rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] bg-[var(--color-card)] hover:bg-[var(--color-surface-2)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
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
