import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle,
  User, Tag, Receipt, Banknote, CreditCard, Smartphone, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '../api/products.api';
import { salesApi }    from '../api/sales.api';
import { customersApi }from '../api/customers.api';
import useShopStore    from '../store/shopStore';
import useAuthStore    from '../store/authStore';
import LoadingSpinner  from '../components/LoadingSpinner';
import InvoiceModal    from '../components/InvoiceModal';

const PAY_ICONS = { cash: Banknote, card: CreditCard, upi: Smartphone, credit: Clock };
const PAY_LABELS = { cash: 'Cash', card: 'Card', upi: 'UPI', credit: 'Credit' };

export default function Billing() {
  const qc = useQueryClient();
  const { activeShop } = useShopStore();
  const currentUser    = useAuthStore((s) => s.user);
  const shopId         = activeShop?._id;

  const [search,        setSearch]        = useState('');
  const [cart,          setCart]          = useState([]);
  const [customerId,    setCustomerId]    = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes,         setNotes]         = useState('');
  const [applyTax,      setApplyTax]      = useState(true);
  const [lastSale,      setLastSale]      = useState(null);
  const [showInvoice,   setShowInvoice]   = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: productData, isLoading } = useQuery({
    queryKey: ['products-billing', shopId, search],
    queryFn:  () => productsApi.getAll({ shopId, search, limit: 30 }),
    enabled:  !!shopId,
  });

  const { data: customerData } = useQuery({
    queryKey: ['customers-billing', shopId],
    queryFn:  () => customersApi.getAll({ shopId, limit: 100 }),
    enabled:  !!shopId,
  });

  // ── Sale mutation ────────────────────────────────────────────────────────────
  const createSaleMut = useMutation({
    mutationFn: (data) => salesApi.create(data),
    onSuccess: (res) => {
      setLastSale(res.data.sale);
      setShowInvoice(true);
      setCart([]);
      setCustomerId('');
      setNotes('');
      qc.invalidateQueries(['products']);
      toast.success(`Sale completed — ${res.data.sale.invoiceNumber}`);
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Cart helpers ─────────────────────────────────────────────────────────────
  const addToCart = (product) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.productId === product._id);
      if (exists) {
        if (exists.quantity >= product.stock) { toast.error('Insufficient stock'); return prev; }
        return prev.map((i) => i.productId === product._id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      if (product.stock < 1) { toast.error('Out of stock'); return prev; }
      return [...prev, {
        productId: product._id,
        name:      product.name,
        price:     product.price,
        stock:     product.stock,
        quantity:  1,
        discount:  product.discount || 0,
      }];
    });
  };

  const updateQty      = (id, delta) =>
    setCart((p) => p.map((i) => i.productId === id ? { ...i, quantity: Math.max(1, Math.min(i.stock, i.quantity + delta)) } : i));

  const updateDiscount = (id, val) =>
    setCart((p) => p.map((i) => i.productId === id ? { ...i, discount: Math.min(100, Math.max(0, Number(val))) } : i));

  const removeFromCart = (id) => setCart((p) => p.filter((i) => i.productId !== id));

  // ── Totals ───────────────────────────────────────────────────────────────────
  const taxRate   = applyTax ? (activeShop?.taxRate || 0) : 0;
  const totals    = cart.reduce((acc, item) => {
    const itemDisc  = item.price * (item.discount / 100) * item.quantity;
    const sub       = item.price * item.quantity - itemDisc;
    acc.subtotal   += item.price * item.quantity;
    acc.discount   += itemDisc;
    acc.beforeTax  += sub;
    return acc;
  }, { subtotal: 0, discount: 0, beforeTax: 0 });
  const taxAmount  = totals.beforeTax * (taxRate / 100);
  const grandTotal = totals.beforeTax + taxAmount;

  // ── Checkout ─────────────────────────────────────────────────────────────────
  const handleCheckout = () => {
    if (!shopId) { toast.error('Select a shop first'); return; }
    if (!cart.length) { toast.error('Cart is empty'); return; }
    createSaleMut.mutate({
      shopId,
      items: cart,
      customerId:    customerId || undefined,
      paymentMethod,
      taxRate,
      notes,
    });
  };

  const products  = productData?.data || [];
  const customers = customerData?.data || [];

  if (!shopId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <ShoppingCart className="w-12 h-12 mb-4" />
        <p className="font-medium">Select a shop to start billing</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 h-full">
        {/* ── Left: Product grid ── */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">POS / Billing</h1>
            {currentUser && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                <User className="w-3.5 h-3.5" />
                {currentUser.name}
              </div>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products or scan barcode…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10"><LoadingSpinner /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-thin pr-1 pb-2">
              {products.map((p) => {
                const fp = p.price * (1 - (p.discount || 0) / 100);
                return (
                  <button key={p._id} onClick={() => addToCart(p)} disabled={p.stock < 1}
                    className="text-left p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group">
                    {/* Product image */}
                    {(p.images?.[0] || p.image) ? (
                      <img src={p.images?.[0] || p.image} alt="" className="w-full h-24 object-cover rounded-lg mb-2" />
                    ) : (
                      <div className="w-full h-24 bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                        <ShoppingCart className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                    {p.discount > 0 && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        -{p.discount}%
                      </span>
                    )}
                    <p className="font-medium text-gray-900 text-sm line-clamp-2">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.category}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div>
                        {p.discount > 0 && <p className="text-[10px] text-gray-400 line-through">₹{p.price}</p>}
                        <span className="text-blue-600 font-bold text-sm">₹{fp.toFixed(0)}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        p.stock <= p.lowStockThreshold ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                      }`}>{p.stock} left</span>
                    </div>
                  </button>
                );
              })}
              {!products.length && !isLoading && (
                <div className="col-span-3 py-16 text-center text-gray-400">No products found</div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Cart panel ── */}
        <div className="lg:col-span-2 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm max-h-[calc(100vh-120px)]">
          {/* Cart header */}
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              Cart
            </h2>
            <span className="text-sm text-gray-500">{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Click products to add them</p>
              </div>
            ) : (
              cart.map((item) => {
                const lineTotal = item.price * item.quantity * (1 - item.discount / 100);
                return (
                  <div key={item.productId} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate">{item.name}</p>
                      <button onClick={() => removeFromCart(item.productId)} className="text-red-400 hover:text-red-600 shrink-0 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2 gap-2">
                      {/* Qty +/- */}
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateQty(item.productId, -1)} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center text-sm font-bold">{item.quantity}</span>
                        <button onClick={() => updateQty(item.productId, 1)} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      {/* Discount */}
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-gray-400" />
                        <input type="number" min="0" max="100" value={item.discount}
                          onChange={(e) => updateDiscount(item.productId, e.target.value)}
                          className="w-14 text-xs border border-gray-300 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="0%" />
                      </div>
                      <span className="text-sm font-bold text-blue-600">₹{lineTotal.toFixed(0)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Customer + Payment + Summary */}
          <div className="p-4 border-t space-y-3">
            {/* Customer select */}
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Walk-in Customer</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name} — {c.phone}</option>)}
            </select>

            {/* Payment methods */}
            <div className="grid grid-cols-4 gap-1">
              {['cash', 'card', 'upi', 'credit'].map((m) => {
                const Icon = PAY_ICONS[m];
                return (
                  <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                    className={`flex flex-col items-center gap-0.5 py-2 rounded-xl border text-xs font-semibold transition ${
                      paymentMethod === m ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500 hover:border-blue-300'
                    }`}>
                    <Icon className="w-4 h-4" />
                    {PAY_LABELS[m]}
                  </button>
                );
              })}
            </div>

            {/* Tax toggle */}
            {activeShop?.taxRate > 0 && (
              <label className="flex items-center justify-between text-sm cursor-pointer">
                <span className="text-gray-600">Apply Tax ({activeShop.taxRate}% GST)</span>
                <div onClick={() => setApplyTax(!applyTax)}
                  className={`relative w-10 h-5 rounded-full transition cursor-pointer ${applyTax ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${applyTax ? 'left-5' : 'left-0.5'}`} />
                </div>
              </label>
            )}

            {/* Totals */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 space-y-1.5 text-sm border border-blue-100">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span></div>
              {totals.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{totals.discount.toFixed(2)}</span></div>}
              {taxAmount > 0 && <div className="flex justify-between text-gray-500 text-xs"><span>GST ({taxRate}%)</span><span>+₹{taxAmount.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-lg text-gray-900 border-t border-blue-200 pt-1.5">
                <span>Total</span>
                <span className="text-blue-700">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Notes */}
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)…"
              className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />

            {/* Checkout button */}
            <button onClick={handleCheckout}
              disabled={!cart.length || createSaleMut.isPending}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition flex items-center justify-center gap-2 text-base shadow-md">
              {createSaleMut.isPending
                ? <><span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> Processing…</>
                : <><Receipt className="w-5 h-5" /> Pay ₹{grandTotal.toFixed(2)}</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      {showInvoice && lastSale && (
        <InvoiceModal
          sale={lastSale}
          onClose={() => setShowInvoice(false)}
        />
      )}
    </>
  );
}
