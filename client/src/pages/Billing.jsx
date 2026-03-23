import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle,
  User, Tag, Receipt, Banknote, CreditCard, Smartphone, Clock,
  UserPlus, Percent, IndianRupee, X, Package, Keyboard,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi }  from '../api/products.api';
import { salesApi }     from '../api/sales.api';
import { customersApi } from '../api/customers.api';
import useShopStore     from '../store/shopStore';
import useAuthStore     from '../store/authStore';
import useSetupStore    from '../store/setupStore';
import { usePermissions } from '../hooks/usePermissions';
import LoadingSpinner   from '../components/LoadingSpinner';
import InvoiceModal     from '../components/InvoiceModal';

// ── Constants ─────────────────────────────────────────────────────────────────
const PAY_METHODS = [
  { key: 'cash',   label: 'Cash',   icon: Banknote   },
  { key: 'card',   label: 'Card',   icon: CreditCard  },
  { key: 'upi',    label: 'UPI',    icon: Smartphone  },
  { key: 'credit', label: 'Credit', icon: Clock       },
];

const GST_PRESETS = [
  { label: 'No Tax', value: 0     },
  { label: '5%',     value: 5     },
  { label: '12%',    value: 12    },
  { label: '18%',    value: 18    },
  { label: '28%',    value: 28    },
  { label: 'Custom', value: 'custom' },
];

export default function Billing() {
  const qc             = useQueryClient();
  const { activeShop } = useShopStore();
  const currentUser    = useAuthStore((s) => s.user);
  const { can }        = usePermissions();
  const shopId         = activeShop?._id;

  const searchRef = useRef(null);

  // ── Cart ──────────────────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [cart,          setCart]          = useState([]);
  const [discountMode,  setDiscountMode]  = useState('pct'); // 'pct' | 'flat'

  // ── GST ───────────────────────────────────────────────────────────────────────
  // taxPreset: 0 | 5 | 12 | 18 | 28 | 'shop' | 'custom'
  const shopTaxRate    = activeShop?.taxRate || 0;
  const [taxPreset,    setTaxPreset]    = useState('shop');
  const [customTaxVal, setCustomTaxVal] = useState('');

  const taxRate = taxPreset === 'shop'   ? shopTaxRate
    : taxPreset === 'custom' ? (parseFloat(customTaxVal) || 0)
    : Number(taxPreset);

  // ── Checkout ──────────────────────────────────────────────────────────────────
  const [customerId,    setCustomerId]    = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes,         setNotes]         = useState('');
  const [lastSale,      setLastSale]      = useState(null);
  const [showInvoice,   setShowInvoice]   = useState(false);
  const [dueAmount,     setDueAmount]     = useState('');

  // ── Customer search + quick-add ──────────────────────────────────────────────
  const [customerSearch,  setCustomerSearch]  = useState('');
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [quickCustomer,   setQuickCustomer]   = useState({ name: '', phone: '' });

  // ── Queries ───────────────────────────────────────────────────────────────────
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

  // ── Mutations ─────────────────────────────────────────────────────────────────
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
      setShowAddCustomer(false);
      setShowCustomerDrop(false);
      setQuickCustomer({ name: '', phone: '' });
      toast.success(`"${c.name}" added & selected`);
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Cart helpers ──────────────────────────────────────────────────────────────
  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.productId === product._id);
      if (exists) {
        if (exists.quantity >= product.stock) { toast.error('Max stock reached'); return prev; }
        return prev.map((i) =>
          i.productId === product._id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      if (product.stock < 1) { toast.error('Out of stock'); return prev; }
      return [...prev, {
        productId: product._id,
        name:      product.name,
        price:     product.price * (1 - (product.discount || 0) / 100), // apply product-level discount upfront
        stock:     product.stock,
        quantity:  1,
        discount:  0,
      }];
    });
  }, []);

  const updateQty = (id, delta) =>
    setCart((p) => p.map((i) =>
      i.productId === id
        ? { ...i, quantity: Math.max(1, Math.min(i.stock, i.quantity + delta)) }
        : i
    ));

  const updateDiscount = (id, val) => {
    const num = Math.max(0, Number(val));
    setCart((p) => p.map((i) => {
      if (i.productId !== id) return i;
      const max = discountMode === 'flat' ? i.price * i.quantity : 100;
      return { ...i, discount: Math.min(max, num) };
    }));
  };

  const removeFromCart = (id) => setCart((p) => p.filter((i) => i.productId !== id));

  // ── Totals ────────────────────────────────────────────────────────────────────
  const totals = cart.reduce((acc, item) => {
    const rawTotal = item.price * item.quantity;
    const disc     = discountMode === 'flat'
      ? Math.min(rawTotal, item.discount)
      : rawTotal * (item.discount / 100);
    acc.subtotal  += rawTotal;
    acc.discount  += disc;
    acc.beforeTax += rawTotal - disc;
    return acc;
  }, { subtotal: 0, discount: 0, beforeTax: 0 });

  const taxAmount  = totals.beforeTax * (taxRate / 100);
  const grandTotal = totals.beforeTax + taxAmount;

  // ── Checkout ──────────────────────────────────────────────────────────────────
  const handleCheckout = useCallback(() => {
    if (!shopId)        { toast.error('Select a shop first');  return; }
    if (!cart.length)   { toast.error('Cart is empty');        return; }
    if (!can('billing', 'create')) { toast.error("You don't have permission to create sales"); return; }

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
      // Ctrl/Cmd + Enter → checkout
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (cart.length && !createSaleMut.isPending) handleCheckout();
        return;
      }
      // Escape → clear search & blur
      if (e.key === 'Escape') {
        setSearch('');
        setShowCustomerDrop(false);
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart, createSaleMut.isPending, handleCheckout]);

  // Focus search on mount
  useEffect(() => {
    if (shopId) searchRef.current?.focus();
  }, [shopId]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const products          = productData?.data || [];
  const customers         = customerData?.data || [];
  const filteredCustomers = customers.filter((c) =>
    !customerSearch ||
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone || '').includes(customerSearch)
  );

  const canCreateSale   = can('billing', 'create');
  const canAddCustomers = can('customers', 'create');

  // ── No shop ───────────────────────────────────────────────────────────────────
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
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 min-h-0">

        {/* ══════════════════════════════════════════════════════════════════════
            LEFT — Product browser
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">POS Billing</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+↵</kbd> to checkout
                &nbsp;·&nbsp;
                <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Esc</kbd> to clear search
              </p>
            </div>
            {currentUser && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                <User className="w-3.5 h-3.5" />
                {currentUser.name}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU or scan barcode…"
              className="w-full h-11 pl-10 pr-4 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Product grid */}
          {isLoading ? (
            <div className="flex justify-center py-10"><LoadingSpinner /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto scrollbar-thin max-h-[calc(100vh-280px)] pr-0.5 pb-2">
              {products.map((p) => {
                const fp      = p.price * (1 - (p.discount || 0) / 100);
                const inCart  = cart.find((i) => i.productId === p._id);
                const outOfStock = p.stock < 1;
                return (
                  <button key={p._id} onClick={() => addToCart(p)} disabled={outOfStock}
                    className={`group text-left rounded-2xl border-2 overflow-hidden transition-all duration-150
                      ${inCart
                        ? 'border-blue-500 shadow-md shadow-blue-100 bg-blue-50/30'
                        : outOfStock
                        ? 'border-gray-200 opacity-50 cursor-not-allowed bg-white'
                        : 'border-gray-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-50 bg-white hover:-translate-y-0.5'
                      }`}>
                    {/* Image */}
                    <div className="relative w-full h-28 bg-gray-100">
                      {(p.images?.[0] || p.image) ? (
                        <img src={p.images?.[0] || p.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                      {/* Badges */}
                      {p.discount > 0 && (
                        <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">
                          -{p.discount}%
                        </span>
                      )}
                      {inCart && (
                        <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                          {inCart.quantity}
                        </span>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-2.5">
                      <p className="font-semibold text-gray-900 text-sm line-clamp-1">{p.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{p.category}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-blue-600 font-bold text-sm">₹{fp.toFixed(0)}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          outOfStock
                            ? 'bg-red-100 text-red-600'
                            : p.stock <= (p.lowStockThreshold || 5)
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-600'
                        }`}>
                          {outOfStock ? 'Out' : `${p.stock} left`}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {!products.length && !isLoading && (
                <div className="col-span-3 py-16 text-center text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No products found</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            RIGHT — Cart + Checkout
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-2 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden max-h-[calc(100vh-120px)]">

          {/* Cart header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/80">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-gray-900 text-sm">Cart</span>
              {cart.length > 0 && (
                <span className="text-[10px] font-bold bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </div>
            {/* Discount mode toggle */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">Disc:</span>
              <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                {[['pct', Percent], ['flat', IndianRupee]].map(([m, Icon]) => (
                  <button key={m} onClick={() => setDiscountMode(m)}
                    className={`flex items-center gap-0.5 px-2 py-1 rounded-md text-xs font-semibold transition ${
                      discountMode === m ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    }`}>
                    <Icon className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-gray-300">
                <ShoppingCart className="w-12 h-12 mb-3" />
                <p className="text-sm text-gray-400 font-medium">Cart is empty</p>
                <p className="text-xs text-gray-300 mt-1">Click products to add them</p>
              </div>
            ) : (
              cart.map((item) => {
                const rawTotal  = item.price * item.quantity;
                const lineTotal = discountMode === 'flat'
                  ? Math.max(0, rawTotal - item.discount)
                  : rawTotal * (1 - item.discount / 100);
                return (
                  <div key={item.productId}
                    className="group flex items-start gap-3 p-3 bg-gray-50 hover:bg-blue-50/40 rounded-xl border border-gray-200 hover:border-blue-200 transition-all">
                    {/* Qty stepper */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <button onClick={() => updateQty(item.productId, 1)}
                        className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-sm transition">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-sm font-bold text-gray-900 w-7 text-center leading-none py-0.5">
                        {item.quantity}
                      </span>
                      <button onClick={() => updateQty(item.productId, -1)}
                        className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center transition">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Name + discount */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">₹{item.price.toFixed(0)} × {item.quantity}</p>
                      {can('billing', 'create') && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <Tag className="w-3 h-3 text-gray-400 shrink-0" />
                          <input type="number" min="0"
                            max={discountMode === 'pct' ? 100 : item.price * item.quantity}
                            value={item.discount}
                            onChange={(e) => updateDiscount(item.productId, e.target.value)}
                            className="w-14 h-6 text-[11px] border border-gray-200 rounded-lg px-1.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                            placeholder="0" />
                          <span className="text-[10px] text-gray-400">{discountMode === 'pct' ? '%' : '₹'} off</span>
                        </div>
                      )}
                    </div>

                    {/* Line total + remove */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-bold text-blue-600">₹{lineTotal.toFixed(0)}</span>
                      <button onClick={() => removeFromCart(item.productId)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-red-400 hover:bg-red-50 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Bottom checkout panel ── */}
          <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-white">

            {/* Customer selector */}
            <div className="relative">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setCustomerId('');
                    setShowCustomerDrop(true);
                  }}
                  onFocus={() => setShowCustomerDrop(true)}
                  placeholder="Search customer by name or phone…"
                  className="w-full h-9 pl-8 pr-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Selected badge */}
              {customerId && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 mt-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-xs font-medium text-blue-700 truncate">{customerSearch}</span>
                  </div>
                  <button onClick={() => { setCustomerId(''); setCustomerSearch(''); setShowCustomerDrop(false); }}>
                    <X className="w-3.5 h-3.5 text-blue-500 ml-1 shrink-0" />
                  </button>
                </div>
              )}

              {/* Dropdown */}
              {showCustomerDrop && !customerId && customerSearch && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                  <button onClick={() => { setCustomerId(''); setCustomerSearch(''); setShowCustomerDrop(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 border-b border-gray-100">
                    Walk-in customer
                  </button>
                  {filteredCustomers.map((c) => (
                    <button key={c._id}
                      onClick={() => {
                        setCustomerId(c._id);
                        setCustomerSearch(`${c.name}${c.phone ? ` — ${c.phone}` : ''}`);
                        setShowCustomerDrop(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between gap-2 transition">
                      <span className="text-sm font-medium text-gray-900 truncate">{c.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">{c.phone}</span>
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <p className="px-3 py-2 text-xs text-gray-400">No match — try a different name or phone</p>
                  )}
                  {canAddCustomers && (
                    <button onClick={() => { setShowAddCustomer(true); setShowCustomerDrop(false); }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 flex items-center gap-1.5 border-t border-gray-100 transition">
                      <UserPlus className="w-3.5 h-3.5" /> Add new customer
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick-add customer */}
            {showAddCustomer && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5" /> New Customer
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input value={quickCustomer.name}
                    onChange={(e) => setQuickCustomer((q) => ({ ...q, name: e.target.value }))}
                    placeholder="Full name *"
                    className="h-8 px-2.5 border border-blue-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                  <input value={quickCustomer.phone}
                    onChange={(e) => setQuickCustomer((q) => ({ ...q, phone: e.target.value }))}
                    placeholder="Phone *"
                    className="h-8 px-2.5 border border-blue-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    if (!quickCustomer.name || !quickCustomer.phone) { toast.error('Name and phone required'); return; }
                    quickAddMut.mutate({ ...quickCustomer, shopId });
                  }} disabled={quickAddMut.isPending}
                    className="flex-1 h-8 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition">
                    {quickAddMut.isPending ? 'Saving…' : 'Save & Select'}
                  </button>
                  <button onClick={() => { setShowAddCustomer(false); setQuickCustomer({ name: '', phone: '' }); }}
                    className="flex-1 h-8 bg-white border border-gray-300 text-xs text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Payment method */}
            <div className="grid grid-cols-4 gap-1.5">
              {PAY_METHODS.map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => setPaymentMethod(key)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                    paymentMethod === key
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200'
                      : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 bg-white'
                  }`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Credit → paid / due */}
            {paymentMethod === 'credit' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Credit Sale
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <p className="text-[10px] text-amber-600 mb-1">Amount Due (₹)</p>
                    <input type="number" min="0" max={grandTotal}
                      value={dueAmount}
                      onChange={(e) => setDueAmount(e.target.value)}
                      placeholder={`Max ₹${grandTotal.toFixed(0)}`}
                      className="w-full h-8 px-2.5 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
                  </div>
                  {dueAmount && parseFloat(dueAmount) > 0 && (
                    <div className="flex-1 text-right">
                      <p className="text-[10px] text-gray-500">Paid now</p>
                      <p className="text-sm font-bold text-green-600">₹{Math.max(0, grandTotal - parseFloat(dueAmount)).toFixed(0)}</p>
                      <p className="text-[10px] text-red-500 font-semibold mt-0.5">Due: ₹{parseFloat(dueAmount).toFixed(0)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* GST selector — clean dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 shrink-0">GST</span>
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => setTaxPreset('shop')}
                  className={`h-7 px-2.5 rounded-lg border text-[11px] font-semibold transition ${
                    taxPreset === 'shop' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500 hover:border-blue-300 bg-white'
                  }`}>
                  Shop ({shopTaxRate}%)
                </button>
                {GST_PRESETS.map((g) => (
                  <button key={g.value} onClick={() => setTaxPreset(g.value)}
                    className={`h-7 px-2.5 rounded-lg border text-[11px] font-semibold transition ${
                      taxPreset === g.value ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500 hover:border-blue-300 bg-white'
                    }`}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            {taxPreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="100" step="0.1"
                  value={customTaxVal}
                  onChange={(e) => setCustomTaxVal(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-24 h-8 px-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-xs text-gray-400">% custom GST</span>
              </div>
            )}

            {/* Totals */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-4 text-white space-y-2 shadow-lg shadow-blue-200">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-blue-100">
                  <span>Subtotal</span>
                  <span>₹{totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-green-300">
                    <span>Discount</span>
                    <span>-₹{totals.discount.toFixed(2)}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-blue-200 text-xs">
                    <span>GST ({taxRate}%)</span>
                    <span>+₹{taxAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center border-t border-white/20 pt-2">
                <span className="text-lg font-bold">Total</span>
                <span className="text-2xl font-black tracking-tight">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Notes */}
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Order notes (optional)…"
              className="w-full h-9 text-sm border border-gray-200 rounded-xl px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />

            {/* Pay button */}
            <button
              onClick={handleCheckout}
              disabled={!cart.length || createSaleMut.isPending || !canCreateSale}
              title={!canCreateSale ? "You don't have permission to create sales" : undefined}
              className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-2xl transition-all flex items-center justify-center gap-3 text-lg shadow-xl shadow-blue-300 hover:shadow-blue-400 hover:scale-[1.01] active:scale-[0.99]"
            >
              {createSaleMut.isPending ? (
                <>
                  <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                  Processing…
                </>
              ) : (
                <>
                  <Receipt className="w-5 h-5" />
                  Pay ₹{grandTotal.toFixed(2)}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showInvoice && lastSale && (
        <InvoiceModal sale={lastSale} onClose={() => setShowInvoice(false)} />
      )}
    </>
  );
}
