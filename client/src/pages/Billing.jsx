import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, User } from 'lucide-react';
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

// ── Billing sub-components ────────────────────────────────────────────────────
import ProductGrid      from '../components/billing/ProductGrid';
import CartItem         from '../components/billing/CartItem';
import DiscountToggle   from '../components/billing/DiscountToggle';
import CustomerSearch   from '../components/billing/CustomerSearch';
import TaxSelector      from '../components/billing/TaxSelector';
import PaymentSelector  from '../components/billing/PaymentSelector';
import CreditFlow       from '../components/billing/CreditFlow';
import TotalSummary     from '../components/billing/TotalSummary';
import PayButton        from '../components/billing/PayButton';

export default function Billing() {
  const qc          = useQueryClient();
  const { activeShop } = useShopStore();
  const currentUser    = useAuthStore((s) => s.user);
  const { can }        = usePermissions();
  const shopId         = activeShop?._id;
  const beep           = useCartSound();
  const searchRef      = useRef(null);

  // ── Cart state ───────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [cart,         setCart]         = useState([]);
  const [discountMode, setDiscountMode] = useState('pct'); // 'pct' | 'flat'

  // ── GST state ────────────────────────────────────────────────────────────────
  const shopTaxRate                  = activeShop?.taxRate || 0;
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
  const [paymentMethod,  setPaymentMethod]  = useState('cash');
  const [notes,          setNotes]          = useState('');
  const [lastSale,       setLastSale]       = useState(null);
  const [showInvoice,    setShowInvoice]    = useState(false);
  const [dueAmount,      setDueAmount]      = useState('');

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
    if (!isNaN(num) && num >= 0) {
      setCart((p) => p.map((i) => i.productId === id ? { ...i, price: num } : i));
    }
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

  // ── Totals (memoised) ────────────────────────────────────────────────────────
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
      ...(paymentMethod === 'credit' && dueAmount
        ? { dueAmount: parseFloat(dueAmount) }
        : {}),
    });
  }, [shopId, cart, discountMode, customerId, paymentMethod, taxRate, notes, dueAmount, can]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (cart.length && !createSaleMut.isPending) handleCheckout();
        return;
      }
      if (e.key === 'Escape') {
        setSearch('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart, createSaleMut.isPending, handleCheckout]);

  useEffect(() => {
    if (shopId) searchRef.current?.focus();
  }, [shopId]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const products   = productData?.data || [];
  const customers  = customerData?.data || [];
  const canCreate  = can('billing', 'create');
  const canAddCust = can('customers', 'create');

  // ── No shop guard ────────────────────────────────────────────────────────────
  if (!shopId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <ShoppingCart className="w-12 h-12 mb-4 opacity-40" />
        <p className="font-medium text-gray-500">Select a shop to start billing</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">

        {/* ══ TOP — Product browser ══════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          {/* Page header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">POS Billing</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Press{' '}
                <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+↵</kbd>
                {' '}to checkout &nbsp;·&nbsp;
                <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Esc</kbd>
                {' '}to clear search
              </p>
            </div>
            {currentUser && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                <User className="w-3.5 h-3.5" />
                {currentUser.name}
              </div>
            )}
          </div>

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

        {/* ══ BOTTOM — Cart + Checkout ════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Cart — left 2 cols */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Cart header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-gray-900">Cart</span>
                {cart.length > 0 && (
                  <span className="text-xs font-bold bg-blue-600 text-white min-w-[1.5rem] h-6 rounded-full flex items-center justify-center px-1.5 shadow-sm">
                    {cart.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">Discount:</span>
                <DiscountToggle mode={discountMode} onChange={setDiscountMode} />
              </div>
            </div>

            {/* Cart items */}
            <div className="p-4 space-y-2.5 min-h-[200px] max-h-[420px] overflow-y-auto scrollbar-thin">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[180px] text-gray-300">
                  <ShoppingCart className="w-14 h-14 mb-3" />
                  <p className="text-sm text-gray-400 font-medium">Cart is empty</p>
                  <p className="text-xs text-gray-300 mt-1">Click products above to add them</p>
                </div>
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
            </div>
          </div>

          {/* Checkout — sticky right col */}
          <div className="lg:col-span-1 self-start sticky top-4 space-y-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">

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
              className="w-full h-10 text-sm border-2 border-gray-200 rounded-xl px-3 focus:outline-none focus:border-blue-500 transition-colors"
            />

            <PayButton
              isEmpty={!cart.length}
              isPending={createSaleMut.isPending}
              canCreate={canCreate}
              grandTotal={grandTotal}
              onClick={handleCheckout}
            />

            <p className="text-center text-[10px] text-gray-300 font-mono">
              Ctrl+↵ to checkout · Esc to clear
            </p>
          </div>
        </div>
      </div>

      {showInvoice && lastSale && (
        <InvoiceModal sale={lastSale} onClose={() => setShowInvoice(false)} />
      )}
    </>
  );
}
