import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, User, Zap, Calendar, EyeOff, Eye, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';

import { productsApi }  from '../api/products.api';
import { salesApi }     from '../api/sales.api';
import { customersApi } from '../api/customers.api';
import useShopStore     from '../store/shopStore';
import useAuthStore     from '../store/authStore';
import useSetupStore    from '../store/setupStore';
import { usePermissions } from '../hooks/usePermissions';
import { useCartSound }   from '../hooks/useCartSound';
import InvoiceModal       from '../components/InvoiceModal';

import ProductGrid        from '../components/billing/ProductGrid';
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

export default function Billing() {
  const qc             = useQueryClient();
  const { activeShop } = useShopStore();
  const currentUser    = useAuthStore((s) => s.user);
  const { can }        = usePermissions();
  const shopId         = activeShop?._id;
  const beep           = useCartSound();
  const searchRef      = useRef(null);

  // ── Cart state ───────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [cart,         setCart]         = useState([]);
  const [discountMode, setDiscountMode] = useState('pct');

  // ── GST state ────────────────────────────────────────────────────────────────
  const shopTaxRate                    = activeShop?.taxRate || 0;
  const [taxPreset,    setTaxPreset]   = useState('shop');
  const [customTaxVal, setCustomTaxVal]= useState('');

  const taxRate = taxPreset === 'shop'
    ? shopTaxRate
    : taxPreset === 'custom'
    ? (parseFloat(customTaxVal) || 0)
    : Number(taxPreset);

  // ── Checkout state ───────────────────────────────────────────────────────────
  const [customerId,     setCustomerId]     = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [paymentMethod,  setPaymentMethod]  = useState('cash');
  const [notes,          setNotes]          = useState('');
  const [lastSale,       setLastSale]       = useState(null);
  const [showInvoice,    setShowInvoice]    = useState(false);
  const [dueAmount,      setDueAmount]      = useState('');
  const [isPrivate,      setIsPrivate]      = useState(false);
  const [showDailyClose, setShowDailyClose] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: productData, isLoading } = useQuery({
    queryKey: ['products-billing', shopId, search],
    queryFn:  () => productsApi.getAll({ shopId, search, limit: 40 }),
    enabled:  !!shopId,
  });

  const { data: customerData } = useQuery({
    queryKey: ['customers-billing', shopId],
    queryFn:  () => customersApi.getAll({ shopId, limit: 200 }),
    enabled:  !!shopId,
  });

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

  // Add a suggested product — look up in loaded products first, fall back to suggestion data
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
    createSaleMut.mutate({
      shopId,
      items:         normalizedItems,
      customerId:    customerId || undefined,
      paymentMethod,
      taxRate,
      notes,
      isPrivate,
      ...(paymentMethod === 'credit' && dueAmount
        ? { dueAmount: parseFloat(dueAmount) }
        : {}),
    });
  }, [shopId, cart, discountMode, customerId, paymentMethod, taxRate, notes, dueAmount, isPrivate, can]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (cart.length && !createSaleMut.isPending) handleCheckout();
        return;
      }
      if (e.key === 'Escape') { setSearch(''); searchRef.current?.blur(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart, createSaleMut.isPending, handleCheckout]);

  useEffect(() => {
    if (shopId) searchRef.current?.focus();
  }, [shopId]);

  const products  = productData?.data || [];
  const customers = customerData?.data || [];
  const canCreate = can('billing', 'create');
  const canAddCust= can('customers', 'create');

  // ── No shop guard ─────────────────────────────────────────────────────────────
  if (!shopId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
        <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-5">
          <ShoppingCart className="w-10 h-10 opacity-40" />
        </div>
        <p className="font-semibold text-gray-500 text-lg">Select a shop to start billing</p>
        <p className="text-sm text-gray-400 mt-1">Choose your active shop from the top bar</p>
      </div>
    );
  }

  return (
    <>
      {/*
        Full-height two-panel POS layout.
        Negative margins escape the page padding so the panels sit flush.
        LEFT  = product browser  |  RIGHT = cart + checkout
      */}
      <div className="flex h-[calc(100vh-4rem)] -mx-4 -mt-4 sm:-mx-6 lg:-mx-8 overflow-hidden">

        {/* ══ LEFT — Product browser ══════════════════════════════════════════ */}
        <div className="flex flex-col flex-1 min-w-0 bg-gray-50 border-r border-gray-200">

          {/* Top bar */}
          <div className="shrink-0 flex items-center justify-between px-5 py-3.5 bg-white border-b border-gray-200 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-gray-900 leading-tight">POS Billing</h1>
                <p className="text-[11px] text-gray-400 leading-tight">
                  {activeShop?.name} &nbsp;·&nbsp;
                  <kbd className="px-1 bg-gray-100 rounded text-[10px] font-mono">Ctrl+↵</kbd> to checkout
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDailyClose(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-full text-xs font-semibold transition"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Close Day</span>
              </button>
              {currentUser && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                  <User className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{currentUser.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Scrollable product grid */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            <ProductGrid
              products={products}
              cart={cart}
              isLoading={isLoading}
              onAdd={addToCart}
              search={search}
              setSearch={setSearch}
              searchRef={searchRef}
            />
          </div>

          {/* Suggestions strip */}
          <div className="shrink-0 px-4 border-t border-gray-100 bg-gray-50">
            <BillingSuggestions cart={cart} shopId={shopId} onAdd={addSuggestedToCart} />
          </div>
        </div>

        {/* ══ RIGHT — Cart + Checkout ═════════════════════════════════════════ */}
        <div className="hidden md:flex w-[360px] xl:w-[400px] shrink-0 flex-col bg-white shadow-2xl shadow-black/5">

          {/* Cart header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4.5 h-4.5 text-blue-600" />
              <span className="font-semibold text-gray-900 text-sm">Cart</span>
              <AnimatePresence>
                {cart.length > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="min-w-[1.4rem] h-5 bg-blue-600 text-white text-[11px] font-black rounded-full flex items-center justify-center px-1.5 shadow-sm"
                  >
                    {cart.length}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400 font-medium">Discount:</span>
              <DiscountToggle mode={discountMode} onChange={setDiscountMode} />
            </div>
          </div>

          {/* Cart items — scrollable */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0 scrollbar-thin">
            <AnimatePresence initial={false}>
              {cart.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-44 text-gray-300 select-none"
                >
                  <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm font-semibold text-gray-400">Cart is empty</p>
                  <p className="text-xs text-gray-300 mt-0.5">Click products on the left to add</p>
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

          {/* Checkout panel */}
          <div className="shrink-0 border-t border-gray-100 overflow-y-auto max-h-[56vh] scrollbar-thin">
            <div className="px-4 py-3 space-y-3">
              <CustomerSearch
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
              />

              <PaymentSelector selected={paymentMethod} onChange={setPaymentMethod} />

              {paymentMethod === 'credit' && (
                <CreditFlow grandTotal={grandTotal} dueAmount={dueAmount} onChange={setDueAmount} />
              )}

              <TaxSelector
                preset={taxPreset}
                shopTaxRate={shopTaxRate}
                customVal={customTaxVal}
                onChange={setTaxPreset}
                onCustomChange={setCustomTaxVal}
              />

              <TotalSummary
                totals={totals}
                taxRate={taxRate}
                taxAmount={taxAmount}
                grandTotal={grandTotal}
              />

              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Order notes (optional)…"
                className="w-full h-9 text-sm border border-gray-200 rounded-xl px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-gray-50 focus:bg-white"
              />

              {/* Private sale toggle */}
              <button
                type="button"
                onClick={() => setIsPrivate((p) => !p)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  isPrivate
                    ? 'bg-gray-900 border-gray-700 text-gray-100'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isPrivate ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{isPrivate ? 'Private sale — hidden from reports' : 'Record in reports (default)'}</span>
                </div>
                <div className={`w-8 h-4 rounded-full relative transition-colors ${isPrivate ? 'bg-gray-600' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isPrivate ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </button>

              <PayButton
                isEmpty={!cart.length}
                isPending={createSaleMut.isPending}
                canCreate={canCreate}
                grandTotal={grandTotal}
                onClick={handleCheckout}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile floating cart button ──────────────────────────────────── */}
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
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-2xl shadow-xl shadow-blue-500/40 font-bold text-sm"
            >
              <ShoppingCart className="w-4.5 h-4.5" />
              {cart.length} · ₹{Math.round(grandTotal).toLocaleString('en-IN')}
              <ChevronUp className="w-4 h-4 opacity-70" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile cart bottom sheet ─────────────────────────────────────── */}
      <AnimatePresence>
        {showMobileCart && (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowMobileCart(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl flex flex-col"
              style={{ maxHeight: '92vh' }}
            >
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>

              {/* Mobile cart header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2 font-semibold text-gray-900">
                  <ShoppingCart className="w-4 h-4 text-blue-600" />
                  Cart ({cart.length})
                </div>
                <DiscountToggle mode={discountMode} onChange={setDiscountMode} />
              </div>

              {/* Mobile cart items */}
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
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

              {/* Mobile checkout panel */}
              <div className="shrink-0 border-t border-gray-100 px-4 py-3 space-y-3 overflow-y-auto" style={{ maxHeight: '55vh' }}>
                <CustomerSearch
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
                />
                <PaymentSelector selected={paymentMethod} onChange={setPaymentMethod} />
                {paymentMethod === 'credit' && (
                  <CreditFlow grandTotal={grandTotal} dueAmount={dueAmount} onChange={setDueAmount} />
                )}
                <TaxSelector
                  preset={taxPreset}
                  shopTaxRate={shopTaxRate}
                  customVal={customTaxVal}
                  onChange={setTaxPreset}
                  onCustomChange={setCustomTaxVal}
                />
                <TotalSummary totals={totals} taxRate={taxRate} taxAmount={taxAmount} grandTotal={grandTotal} />
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Order notes (optional)…"
                  className="w-full h-9 text-sm border border-gray-200 rounded-xl px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-gray-50 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setIsPrivate((p) => !p)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    isPrivate
                      ? 'bg-gray-900 border-gray-700 text-gray-100'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isPrivate ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{isPrivate ? 'Private — hidden from reports' : 'Record in reports'}</span>
                  </div>
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${isPrivate ? 'bg-gray-600' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isPrivate ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
                <PayButton
                  isEmpty={!cart.length}
                  isPending={createSaleMut.isPending}
                  canCreate={canCreate}
                  grandTotal={grandTotal}
                  onClick={handleCheckout}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
