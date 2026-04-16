import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, Search, X, User, Calendar, EyeOff, Eye,
  PauseCircle, PlayCircle, Trash2, Package, Loader2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';

import { productsApi }  from '../api/products.api';
import { salesApi }     from '../api/sales.api';
import { customersApi } from '../api/customers.api';
import useShopStore     from '../store/shopStore';
import useAuthStore     from '../store/authStore';
import useSetupStore    from '../store/setupStore';
import { usePermissions }    from '../hooks/usePermissions';
import { useCartSound }      from '../hooks/useCartSound';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useHeldBills }      from '../hooks/useHeldBills';
import { useNetworkStatus }    from '../hooks/useNetworkStatus';
import { useSyncEngine }       from '../hooks/useSyncEngine';
import { addPendingSale, cacheProducts, getCachedProducts } from '../lib/offlineDB';
import OfflineIndicator        from '../components/OfflineIndicator';
import InvoiceModal       from '../components/InvoiceModal';

import CartItem           from '../components/billing/CartItem';
import DiscountToggle     from '../components/billing/DiscountToggle';
import CustomerSearch     from '../components/billing/CustomerSearch';
import TaxSelector        from '../components/billing/TaxSelector';
import PaymentSelector    from '../components/billing/PaymentSelector';
import CreditFlow         from '../components/billing/CreditFlow';
import TotalSummary       from '../components/billing/TotalSummary';
import PayButton          from '../components/billing/PayButton';
import BillingSuggestions from '../components/billing/BillingSuggestions';
import DailyClosingModal  from '../components/billing/DailyClosingModal';
import AutoBillSettings   from '../components/billing/AutoBillSettings';
import useBillingSettingsStore from '../store/billingSettingsStore';

export default function Billing() {
  const qc             = useQueryClient();
  const { activeShop } = useShopStore();
  const currentUser    = useAuthStore((s) => s.user);
  const { can }        = usePermissions();
  const shopId         = activeShop?._id;
  const beep           = useCartSound();
  const searchRef      = useRef(null);

  // ── Fast-billing settings ────────────────────────────────────────────────────
  const {
    skipConfirmation,
    autoPaymentMode,
    autoAddFirstResult,
    autoWalkIn,
    searchDebounceMs,
  } = useBillingSettingsStore();

  // ── Cart state ───────────────────────────────────────────────────────────────
  const [search,          setSearch]          = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cart,            setCart]            = useState([]);

  // Debounce search — respects user-configured delay (default 200ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), searchDebounceMs);
    return () => clearTimeout(t);
  }, [search, searchDebounceMs]);

  // ── Dropdown state ───────────────────────────────────────────────────────────
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIdx,    setActiveIdx]    = useState(-1);

  const [discountMode, setDiscountMode] = useState('pct');

  // ── GST state ────────────────────────────────────────────────────────────────
  const shopTaxRate                     = activeShop?.taxRate || 0;
  const [taxPreset,    setTaxPreset]    = useState('shop');
  const [customTaxVal, setCustomTaxVal] = useState('');

  const taxRate = taxPreset === 'shop'
    ? shopTaxRate
    : taxPreset === 'custom'
    ? (parseFloat(customTaxVal) || 0)
    : Number(taxPreset);

  // ── Checkout state ───────────────────────────────────────────────────────────
  const [customerId,     setCustomerId]     = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [paymentMethod,  setPaymentMethod]  = useState(
    // autoPaymentMode from fast-billing settings takes priority; fall back to last saved
    () => autoPaymentMode || localStorage.getItem('ms_last_payment') || 'cash'
  );
  const [notes,          setNotes]          = useState('');
  const [lastSale,       setLastSale]       = useState(null);
  const [showInvoice,    setShowInvoice]    = useState(false);
  const [dueAmount,      setDueAmount]      = useState('');
  const [isPrivate,      setIsPrivate]      = useState(false);
  const [showDailyClose, setShowDailyClose] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showHeldBills,  setShowHeldBills]  = useState(false);

  // ── Hold / Resume bills ───────────────────────────────────────────────────────
  const { heldBills, holdBill, resumeBill, deleteBill } = useHeldBills();

  // ── Offline / sync state ──────────────────────────────────────────────────────
  const { isOnline } = useNetworkStatus();
  const { pendingCount, failedCount, isSyncing, lastSyncTime, syncNow, retryFailed, refreshCount } = useSyncEngine();

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: productData, isLoading } = useQuery({
    queryKey: ['products-billing', shopId, debouncedSearch, isOnline],
    queryFn: async () => {
      if (!isOnline) {
        const cached = await getCachedProducts(shopId).catch(() => []);
        const q = debouncedSearch.toLowerCase();
        const filtered = q
          ? cached.filter((p) => p.name?.toLowerCase().includes(q) || p.sku?.includes(q))
          : cached;
        return { data: filtered };
      }
      return productsApi.getAll({ shopId, search: debouncedSearch, limit: 40 });
    },
    enabled:   !!shopId,
    staleTime: isOnline ? 2 * 60 * 1000 : Infinity,
  });

  // Cache products in IndexedDB on full online fetch
  useEffect(() => {
    if (!isOnline || !shopId || debouncedSearch) return;
    const prods = productData?.data;
    if (Array.isArray(prods) && prods.length > 0) {
      cacheProducts(shopId, prods).catch(() => {});
    }
  }, [isOnline, shopId, productData, debouncedSearch]);

  const { data: customerData } = useQuery({
    queryKey: ['customers-billing', shopId],
    queryFn:  () => customersApi.getAll({ shopId, limit: 200 }),
    enabled:  !!shopId,
  });

  // ── Persist last payment method ───────────────────────────────────────────────
  const handlePaymentChange = useCallback((method) => {
    setPaymentMethod(method);
    localStorage.setItem('ms_last_payment', method);
  }, []);

  // ── Load repeat order from Orders page ───────────────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem('ms_repeat_order');
    if (!raw) return;
    sessionStorage.removeItem('ms_repeat_order');
    try {
      const items = JSON.parse(raw);
      if (Array.isArray(items) && items.length > 0) {
        setCart(items);
        toast.success(`${items.length} item${items.length > 1 ? 's' : ''} loaded from previous order`);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createSaleMut = useMutation({
    mutationFn: (data) => salesApi.create(data),
    onSuccess: (res) => {
      useSetupStore.getState().mark('hasSales');
      setLastSale(res.data.sale);
      setShowInvoice(true);
      setCart([]);
      setCustomerId('');
      setCustomerSearch('');
      setNotes('');
      setDueAmount('');
      setIsPrivate(false);
      setShowMobileCart(false);
      qc.invalidateQueries(['products']);
      toast.success(`Sale recorded — ${res.data.sale.invoiceNumber}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const quickAddMut = useMutation({
    mutationFn: (d) => customersApi.create(d),
    onSuccess: (res) => {
      const c = res.data.customer;
      qc.invalidateQueries(['customers-billing']);
      setCustomerId(c._id);
      setCustomerSearch(`${c.name}${c.phone ? ` — ${c.phone}` : ''}`);
      toast.success(`"${c.name}" added & selected`);
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Cart helpers ─────────────────────────────────────────────────────────────
  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.productId === product._id);
      if (exists) {
        if (exists.quantity >= product.stock) { toast.error('Max stock reached'); return prev; }
        beep();
        return prev.map((i) =>
          i.productId === product._id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      if (product.stock < 1) { toast.error('Out of stock'); return prev; }
      beep();
      return [...prev, {
        productId: product._id,
        name:      product.name,
        price:     product.price * (1 - (product.discount || 0) / 100),
        stock:     product.stock,
        quantity:  1,
        discount:  0,
      }];
    });
  }, [beep]);

  const updateQty = useCallback((id, delta) =>
    setCart((p) => p.map((i) =>
      i.productId === id
        ? { ...i, quantity: Math.max(1, Math.min(i.stock, i.quantity + delta)) }
        : i
    )), []);

  const updatePrice = useCallback((id, val) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0)
      setCart((p) => p.map((i) => i.productId === id ? { ...i, price: num } : i));
  }, []);

  const updateDiscount = useCallback((id, val) => {
    const num = Math.max(0, Number(val));
    setCart((p) => p.map((i) => {
      if (i.productId !== id) return i;
      const max = discountMode === 'flat' ? i.price * i.quantity : 100;
      return { ...i, discount: Math.min(max, num) };
    }));
  }, [discountMode]);

  const removeFromCart = useCallback(
    (id) => setCart((p) => p.filter((i) => i.productId !== id)),
    []
  );

  const addSuggestedToCart = useCallback((suggestion) => {
    const pid = String(suggestion.productId);
    const found = (productData?.data || []).find((p) => p._id === pid);
    if (found) { addToCart(found); return; }
    setCart((prev) => {
      const exists = prev.find((i) => i.productId === pid);
      if (exists) return prev.map((i) => i.productId === pid ? { ...i, quantity: i.quantity + 1 } : i);
      beep();
      return [...prev, { productId: pid, name: suggestion.name, price: suggestion.price, stock: 9999, quantity: 1, discount: 0 }];
    });
  }, [productData, addToCart, beep]);

  // ── Barcode scanner ───────────────────────────────────────────────────────────
  const handleBarcode = useCallback((code) => {
    if (!shopId) return;
    const loaded = productData?.data || [];
    const match  = loaded.find((p) => p.barcode === code || p.sku === code);
    if (match) {
      addToCart(match);
      toast.success(`Scanned: ${match.name}`, { duration: 1500 });
      return;
    }
    productsApi.getAll({ shopId, search: code, limit: 1 }).then((res) => {
      const found = res?.data?.[0];
      if (found && (found.barcode === code || found.sku === code)) {
        addToCart(found);
        toast.success(`Scanned: ${found.name}`, { duration: 1500 });
      } else {
        toast.error(`No product found for barcode: ${code}`, { duration: 2000 });
      }
    }).catch(() => { toast.error(`Scan failed for: ${code}`); });
  }, [shopId, productData, addToCart]);

  useBarcodeScanner(handleBarcode);

  // ── Hold current bill ─────────────────────────────────────────────────────────
  const handleHold = useCallback(() => {
    if (!cart.length) { toast.error('Cart is empty — nothing to hold'); return; }
    const label = customerSearch
      ? `${customerSearch.split(' — ')[0]}`
      : `Bill ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    holdBill(label, { cart, customerId, customerSearch, paymentMethod, notes, discountMode, taxPreset, customTaxVal });
    setCart([]);
    setCustomerId('');
    setCustomerSearch('');
    setNotes('');
    toast.success(`"${label}" held — cart cleared`);
  }, [cart, customerId, customerSearch, paymentMethod, notes, discountMode, taxPreset, customTaxVal, holdBill]);

  const handleResume = useCallback((id) => {
    const bill = resumeBill(id);
    if (!bill) return;
    setCart(bill.cart || []);
    setCustomerId(bill.customerId || '');
    setCustomerSearch(bill.customerSearch || '');
    setPaymentMethod(bill.paymentMethod || 'cash');
    setNotes(bill.notes || '');
    setDiscountMode(bill.discountMode || 'pct');
    setTaxPreset(bill.taxPreset || 'shop');
    setCustomTaxVal(bill.customTaxVal || '');
    setShowHeldBills(false);
    toast.success(`"${bill.label}" resumed`);
  }, [resumeBill]);

  // ── Totals ───────────────────────────────────────────────────────────────────
  const totals = useMemo(() =>
    cart.reduce((acc, item) => {
      const rawTotal = item.price * item.quantity;
      const disc = discountMode === 'flat'
        ? Math.min(rawTotal, item.discount)
        : rawTotal * (item.discount / 100);
      acc.subtotal  += rawTotal;
      acc.discount  += disc;
      acc.beforeTax += rawTotal - disc;
      return acc;
    }, { subtotal: 0, discount: 0, beforeTax: 0 }),
    [cart, discountMode]
  );

  const taxAmount  = totals.beforeTax * (taxRate / 100);
  const grandTotal = totals.beforeTax + taxAmount;

  // ── Checkout ─────────────────────────────────────────────────────────────────
  const handleCheckout = useCallback(() => {
    if (!shopId)      { toast.error('Select a shop first'); return; }
    if (!cart.length) { toast.error('Cart is empty');       return; }
    if (!can('billing', 'create')) {
      toast.error("You don't have permission to create sales"); return;
    }

    const normalizedItems = cart.map((item) => {
      if (discountMode !== 'flat') return item;
      const rawTotal = item.price * item.quantity;
      const discPct  = rawTotal > 0 ? Math.min(100, (item.discount / rawTotal) * 100) : 0;
      return { ...item, discount: +discPct.toFixed(4) };
    });

    const payload = {
      shopId,
      items:         normalizedItems,
      customerId:    customerId || undefined,
      paymentMethod,
      taxRate,
      notes,
      isPrivate,
      ...(paymentMethod === 'credit' && dueAmount ? { dueAmount: parseFloat(dueAmount) } : {}),
    };

    if (!isOnline) {
      const offlineId = crypto.randomUUID();
      addPendingSale({
        offlineId,
        ...payload,
        totalAmount: grandTotal,
        syncStatus:  'pending',
        attempts:    0,
        createdAt:   new Date().toISOString(),
      })
        .then(() => {
          refreshCount();
          setCart([]);
          setCustomerId('');
          setCustomerSearch('');
          setNotes('');
          setDueAmount('');
          setIsPrivate(false);
          setShowMobileCart(false);
          toast.success('Sale saved offline — will sync when connected', { duration: 4000, icon: '📴' });
        })
        .catch(() => toast.error('Failed to save sale locally — please try again'));
      return;
    }

    createSaleMut.mutate(payload);
  }, [shopId, cart, discountMode, customerId, paymentMethod, taxRate, notes, dueAmount,
      isPrivate, can, isOnline, grandTotal, refreshCount]);

  // ── Keyboard shortcut: Ctrl+Enter → checkout ─────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (cart.length && !createSaleMut.isPending) handleCheckout();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart, createSaleMut.isPending, handleCheckout]);

  // ── Auto-focus on shop select ────────────────────────────────────────────────
  useEffect(() => {
    if (shopId) searchRef.current?.focus();
  }, [shopId]);

  // ── Sync dropdown with search value ─────────────────────────────────────────
  useEffect(() => {
    setShowDropdown(!!search);
    if (!search) setActiveIdx(-1);
  }, [search]);

  // ── Search input keyboard: Arrow navigation + Enter ──────────────────────────
  const handleSearchKey = useCallback((e) => {
    const list = productData?.data || [];
    if (showDropdown && list.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, list.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        // autoAddFirstResult: pick index 0 without requiring arrow-down first
        const idx = activeIdx >= 0 ? activeIdx : (autoAddFirstResult ? 0 : -1);
        const p   = idx >= 0 ? list[idx] : null;
        if (p) {
          addToCart(p);
          setSearch('');
          setShowDropdown(false);
          setActiveIdx(-1);
          searchRef.current?.focus();
        }
        return;
      }
    }
    if (e.key === 'Escape') {
      setSearch('');
      setShowDropdown(false);
      setActiveIdx(-1);
      searchRef.current?.blur();
    }
  }, [showDropdown, productData, activeIdx, addToCart, autoAddFirstResult]);

  const products  = productData?.data || [];
  const customers = customerData?.data || [];

  const cartMap = useMemo(
    () => new Map(cart.map((i) => [i.productId, i])),
    [cart]
  );
  const canCreate  = can('billing', 'create');
  const canAddCust = can('customers', 'create');

  // ── No shop guard ─────────────────────────────────────────────────────────────
  if (!shopId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
        <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-5">
          <ShoppingCart className="w-10 h-10 opacity-40" />
        </div>
        <p className="text-gray-500 text-lg">Select a shop to start billing</p>
        <p className="text-sm text-gray-400 mt-1">Choose your active shop from the top bar</p>
      </div>
    );
  }

  // ── Checkout scrollable — customer, tax, notes (scrolls with cart items) ────
  const checkoutScrollable = (
    <div className="space-y-2 px-3 pt-2 pb-1">
      {/* autoWalkIn skips customer search — anonymous walk-in customer assumed */}
      {!autoWalkIn && <CustomerSearch
        customers={customers}
        customerId={customerId}
        customerSearch={customerSearch}
        onChange={(v) => { setCustomerSearch(v); setCustomerId(''); }}
        onSelect={(c) => {
          setCustomerId(c._id);
          setCustomerSearch(`${c.name}${c.phone ? ` — ${c.phone}` : ''}`);
        }}
        onDeselect={() => { setCustomerId(''); setCustomerSearch(''); }}
        canAdd={canAddCust}
        onQuickAdd={(data, onDone) => {
          quickAddMut.mutate({ ...data, shopId }, { onSuccess: () => onDone?.() });
        }}
        isAdding={quickAddMut.isPending}
      />}

      <TaxSelector
        preset={taxPreset}
        shopTaxRate={shopTaxRate}
        customVal={customTaxVal}
        onChange={setTaxPreset}
        onCustomChange={setCustomTaxVal}
      />

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)…"
        data-testid="order-notes"
        className="w-full h-8 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50 focus:bg-white transition-all"
      />

      <button
        type="button"
        onClick={() => setIsPrivate((p) => !p)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all ${
          isPrivate
            ? 'bg-gray-900 border-gray-700 text-gray-100'
            : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center gap-2">
          {isPrivate ? <EyeOff className="w-3 h-3 text-gray-400" /> : <Eye className="w-3 h-3" />}
          <span>{isPrivate ? 'Private — hidden from reports' : 'Record in reports'}</span>
        </div>
        <div className={`w-7 h-3.5 rounded-full relative transition-colors ${isPrivate ? 'bg-gray-600' : 'bg-gray-300'}`}>
          <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-transform ${isPrivate ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
        </div>
      </button>
    </div>
  );

  // ── Checkout fixed bottom — payment, total, pay (always visible) ─────────────
  const checkoutFixed = (
    <div className="shrink-0 border-t border-gray-100 bg-white px-3 py-3 space-y-2.5">
      <PaymentSelector selected={paymentMethod} onChange={handlePaymentChange} />

      {paymentMethod === 'credit' && (
        <CreditFlow grandTotal={grandTotal} dueAmount={dueAmount} onChange={setDueAmount} />
      )}

      <TotalSummary
        totals={totals}
        taxRate={taxRate}
        taxAmount={taxAmount}
        grandTotal={grandTotal}
      />

      <PayButton
        isEmpty={!cart.length}
        isPending={createSaleMut.isPending}
        canCreate={canCreate}
        grandTotal={grandTotal}
        onClick={handleCheckout}
      />
    </div>
  );

  return (
    <>
      {/* Offline / sync indicator */}
      <OfflineIndicator
        isOnline={isOnline}
        pendingCount={pendingCount}
        failedCount={failedCount}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        onSyncNow={syncNow}
        onRetryFailed={retryFailed}
        shopId={shopId}
      />

      {/* Full-height two-panel layout */}
      <div className="flex h-[calc(100vh-4rem)] -mx-4 -mt-4 sm:-mx-6 lg:-mx-8 overflow-hidden bg-[#f6f8fb]">

        {/* ══ LEFT — Search panel ═════════════════════════════════════════════ */}
        <div className="flex flex-col flex-1 min-w-0">

          {/* Top bar */}
          <div className="shrink-0 flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">POS Billing</span>
              <span className="text-gray-200 select-none">|</span>
              <span className="text-sm text-gray-400">{activeShop?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDailyClose(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Close Day</span>
              </button>
              {currentUser && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                  <User className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{currentUser.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Search — pinned, never scrolls */}
          <div className="shrink-0 px-4 py-3 border-b border-gray-100 bg-[#f6f8fb]">
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setActiveIdx(-1); }}
                onKeyDown={handleSearchKey}
                onFocus={() => search && setShowDropdown(true)}
                onBlur={() => setTimeout(() => { setShowDropdown(false); setActiveIdx(-1); }, 150)}
                placeholder="Search product name, SKU, or barcode…"
                data-testid="product-search"
                autoComplete="off"
                className="w-full h-11 pl-10 pr-9 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all placeholder-gray-300"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setShowDropdown(false); setActiveIdx(-1); searchRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Search results dropdown */}
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    key="dropdown"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.1 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
                  >
                    <div className="max-h-72 overflow-y-auto scrollbar-thin">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Searching…
                        </div>
                      ) : products.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-400 text-sm gap-2">
                          <Package className="w-7 h-7 opacity-30" />
                          No products found
                        </div>
                      ) : (
                        products.map((p, i) => {
                          const fp         = p.price * (1 - (p.discount || 0) / 100);
                          const outOfStock = p.stock < 1;
                          const inCart     = cartMap.get(p._id);
                          return (
                            <button
                              key={p._id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                if (!outOfStock) {
                                  addToCart(p);
                                  setSearch('');
                                  setShowDropdown(false);
                                  setActiveIdx(-1);
                                  searchRef.current?.focus();
                                }
                              }}
                              disabled={outOfStock}
                              data-testid={`product-result-${p._id}`}
                              data-product-name={p.name}
                              className={`w-full flex items-center justify-between px-4 py-2.5 text-left border-b border-gray-50 last:border-0 transition-colors ${
                                i === activeIdx ? 'bg-blue-50' : 'hover:bg-gray-50'
                              } ${outOfStock ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-800 truncate">{p.name}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {p.category}
                                  {p.sku ? ` · ${p.sku}` : ''}
                                  {outOfStock
                                    ? ' · Out of stock'
                                    : p.stock <= (p.lowStockThreshold || 5)
                                    ? ` · Low: ${p.stock}`
                                    : ` · ${p.stock} in stock`}
                                </p>
                              </div>
                              <div className="shrink-0 ml-4 text-right">
                                {inCart && (
                                  <span className="inline-block mb-0.5 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full border border-blue-100">
                                    ×{inCart.quantity}
                                  </span>
                                )}
                                <p className="text-sm text-gray-800">₹{fp.toFixed(0)}</p>
                                {p.discount > 0 && (
                                  <p className="text-[10px] text-gray-400 line-through">₹{p.price.toFixed(0)}</p>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Quick items grid — scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 scrollbar-thin">
            <div className="max-w-2xl mx-auto flex flex-col gap-4">

              {/* Quick add grid */}
              {products.length > 0 && (
                <div>
                  <p className="text-[11px] text-gray-400 mb-2.5 uppercase tracking-wide">Quick Add</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                    {products.slice(0, 20).map((p) => {
                      const fp         = p.price * (1 - (p.discount || 0) / 100);
                      const outOfStock = p.stock < 1;
                      const inCart     = cartMap.get(p._id);
                      return (
                        <button
                          key={p._id}
                          onClick={() => !outOfStock && addToCart(p)}
                          disabled={outOfStock}
                          data-testid={`product-card-${p._id}`}
                          data-product-name={p.name}
                          className={`relative flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border text-left transition-all ${
                            inCart
                              ? 'border-blue-300 bg-blue-50'
                              : outOfStock
                              ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                              : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                          }`}
                        >
                          {inCart && (
                            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-600 text-white text-[9px] rounded-full flex items-center justify-center">
                              {inCart.quantity}
                            </span>
                          )}
                          <p className="text-xs text-gray-700 leading-snug line-clamp-2 pr-4">{p.name}</p>
                          <p className="text-sm text-gray-900 tabular-nums">₹{fp.toFixed(0)}</p>
                          {outOfStock && <p className="text-[10px] text-red-400">Out of stock</p>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {products.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center py-16 text-center select-none">
                  <Search className="w-8 h-8 mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">Type to search products</p>
                  <p className="text-xs text-gray-300 mt-1">Or scan a barcode</p>
                </div>
              )}

              {/* AI suggestions */}
              <BillingSuggestions cart={cart} shopId={shopId} onAdd={addSuggestedToCart} />

              {/* Keyboard hints */}
              <div className="flex items-center gap-4 text-xs text-gray-300 select-none pb-2">
                <span><kbd className="px-1 py-0.5 bg-white border border-gray-100 rounded font-mono text-[10px]">↑↓</kbd> navigate</span>
                <span><kbd className="px-1 py-0.5 bg-white border border-gray-100 rounded font-mono text-[10px]">↵</kbd> add</span>
                <span><kbd className="px-1 py-0.5 bg-white border border-gray-100 rounded font-mono text-[10px]">Ctrl+↵</kbd> checkout</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══ RIGHT — Cart + Checkout ════════════════════════════════════════ */}
        <div className="hidden md:flex w-[360px] xl:w-[400px] shrink-0 flex-col bg-white border-l border-gray-100">

          {/* Cart header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">Cart</span>
              <AnimatePresence>
                {cart.length > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="min-w-[1.25rem] h-5 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center px-1.5"
                  >
                    {cart.length}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleHold}
                disabled={!cart.length}
                title="Hold bill"
                data-testid="hold-bill-btn"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-amber-600 border border-amber-200 hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <PauseCircle className="w-3 h-3" />
                Hold
              </button>
              {heldBills.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHeldBills((p) => !p)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-green-600 border border-green-200 hover:bg-green-50 transition"
                >
                  <PlayCircle className="w-3 h-3" />
                  {heldBills.length}
                </button>
              )}
              <DiscountToggle mode={discountMode} onChange={setDiscountMode} />
            </div>
          </div>

          {/* Held bills dropdown */}
          <AnimatePresence>
            {showHeldBills && heldBills.length > 0 && (
              <motion.div
                key="held"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-gray-100"
              >
                <p className="px-4 py-2 text-[10px] text-gray-400 uppercase tracking-wider">Held Bills</p>
                <div className="px-3 pb-3 space-y-1">
                  {heldBills.map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                      <div>
                        <p className="text-xs text-gray-700">{bill.label}</p>
                        <p className="text-[10px] text-gray-400">{bill.cart?.length || 0} item(s)</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleResume(bill.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-green-600 border border-green-200 hover:bg-green-50 transition"
                        >
                          <PlayCircle className="w-3 h-3" />
                          Resume
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBill(bill.id)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cart items + customer/tax/notes — scrollable middle zone */}
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
            <div className="px-3 py-2 space-y-1.5">
              <AnimatePresence initial={false}>
                {cart.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-36 text-gray-300 select-none"
                  >
                    <ShoppingCart className="w-9 h-9 mb-2.5 opacity-20" />
                    <p className="text-sm text-gray-400">Cart is empty</p>
                    <p className="text-xs text-gray-300 mt-0.5">Search and add products on the left</p>
                  </motion.div>
                ) : (
                  cart.map((item) => (
                    <CartItem
                      key={item.productId}
                      item={item}
                      discountMode={discountMode}
                      canEdit={canCreate}
                      onUp={() => updateQty(item.productId, 1)}
                      onDown={() => updateQty(item.productId, -1)}
                      onDiscount={(v) => updateDiscount(item.productId, v)}
                      onRemove={() => removeFromCart(item.productId)}
                      onUpdatePrice={(v) => updatePrice(item.productId, v)}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
            {/* Customer, tax, notes, private — scroll with cart */}
            {checkoutScrollable}

            {/* Fast-billing settings — collapsible, bottom of scroll zone */}
            <div className="px-3 pb-3">
              <AutoBillSettings />
            </div>
          </div>

          {/* Payment + Total + Pay — always visible at bottom */}
          {checkoutFixed}
        </div>
      </div>

      {/* ── Mobile floating cart button ──────────────────────────────────────── */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            className="fixed bottom-4 right-4 md:hidden z-40"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <button
              onClick={() => setShowMobileCart(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-2xl shadow-lg text-sm"
            >
              <ShoppingCart className="w-4 h-4" />
              {cart.length} · ₹{Math.round(grandTotal).toLocaleString('en-IN')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile cart bottom sheet ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showMobileCart && (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileCart(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl flex flex-col"
              style={{ maxHeight: '92vh' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-8 h-1 rounded-full bg-gray-200" />
              </div>

              {/* Mobile cart header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <ShoppingCart className="w-4 h-4 text-blue-500" />
                  Cart ({cart.length})
                </div>
                <DiscountToggle mode={discountMode} onChange={setDiscountMode} />
              </div>

              {/* Mobile — cart items + customer/tax/notes — scrollable */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="px-3 py-2 space-y-1.5">
                  <AnimatePresence initial={false}>
                    {cart.map((item) => (
                      <CartItem
                        key={item.productId}
                        item={item}
                        discountMode={discountMode}
                        canEdit={canCreate}
                        onUp={() => updateQty(item.productId, 1)}
                        onDown={() => updateQty(item.productId, -1)}
                        onDiscount={(v) => updateDiscount(item.productId, v)}
                        onRemove={() => removeFromCart(item.productId)}
                        onUpdatePrice={(v) => updatePrice(item.productId, v)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
                {checkoutScrollable}
              </div>

              {/* Mobile — payment + total + pay — fixed at bottom */}
              {checkoutFixed}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      {showInvoice && lastSale && (
        <InvoiceModal sale={lastSale} onClose={() => setShowInvoice(false)} />
      )}

      <DailyClosingModal
        open={showDailyClose}
        onClose={() => setShowDailyClose(false)}
        shopId={shopId}
      />
    </>
  );
}
