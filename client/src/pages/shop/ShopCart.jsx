import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft, CheckCircle, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { shopApi } from '../../api/shop.api';
import useCartStore from '../../store/cartStore';

// ── Cart Item ─────────────────────────────────────────────────────────────────
function CartItem({ item }) {
  const { updateQuantity, removeItem } = useCartStore();

  return (
    <div className="flex gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
      {/* Image */}
      <div className="w-20 h-20 rounded-xl overflow-hidden border border-gray-100 shrink-0 bg-gray-50">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Package className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{item.name}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{item.category}</p>
        {(item.size || item.color) && (
          <p className="text-xs text-blue-500 mt-0.5">
            {[item.size && `Size: ${item.size}`, item.color && `Color: ${item.color}`].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <button onClick={() => updateQuantity(item._key, item.quantity - 1)}
              className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
            <button onClick={() => updateQuantity(item._key, item.quantity + 1)}
              disabled={item.quantity >= item.stock}
              className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center transition">
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="text-right">
            {item.discount > 0 && <p className="text-xs text-gray-400 line-through">₹{(item.price * item.quantity).toFixed(0)}</p>}
            <p className="font-bold text-gray-900">₹{(item.finalPrice * item.quantity).toLocaleString('en-IN')}</p>
          </div>
          <button onClick={() => removeItem(item._key)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order Success ─────────────────────────────────────────────────────────────
function OrderSuccess({ sale, onNewOrder }) {
  return (
    <div className="max-w-lg mx-auto py-16 px-4 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
        <CheckCircle className="w-10 h-10 text-green-500" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h2>
      <p className="text-gray-500 mb-1">Invoice: <span className="font-semibold text-gray-700">{sale.invoiceNumber}</span></p>
      <p className="text-gray-500 mb-6">
        Total: <span className="font-bold text-gray-900">₹{sale.totalAmount.toLocaleString('en-IN')}</span>
      </p>

      <div className="bg-gray-50 rounded-2xl p-5 text-left mb-6 space-y-2 text-sm">
        <p className="font-semibold text-gray-700 mb-3">Order Summary</p>
        {sale.items.map((item, i) => (
          <div key={i} className="flex justify-between text-gray-600">
            <span>{item.name} × {item.quantity}
              {item.selectedSize && <span className="text-gray-400"> ({item.selectedSize})</span>}
            </span>
            <span>₹{item.subtotal.toLocaleString('en-IN')}</span>
          </div>
        ))}
        <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-bold text-gray-900">
          <span>Total</span>
          <span>₹{sale.totalAmount.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        We'll contact you at <strong>{sale.customerPhone}</strong> to confirm your order.
      </p>

      <button onClick={onNewOrder}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition">
        Continue Shopping
      </button>
    </div>
  );
}

// ── Main Cart Page ────────────────────────────────────────────────────────────
export default function ShopCart() {
  const [params]       = useSearchParams();
  const shopId         = params.get('shopId');
  const { items, clearCart, getSubtotal, shopId: cartShopId } = useCartStore();

  const [name,          setName]          = useState('');
  const [phone,         setPhone]         = useState('');
  const [email,         setEmail]         = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes,         setNotes]         = useState('');
  const [completedSale, setCompletedSale] = useState(null);

  const effectiveShopId = shopId || cartShopId;

  const checkoutMut = useMutation({
    mutationFn: (data) => shopApi.checkout(data),
    onSuccess: (res) => {
      setCompletedSale(res.data.sale);
      clearCart();
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const subtotal = getSubtotal();
  const back     = shopId ? `/shop/products?shopId=${shopId}` : '/shop/products';

  const handleCheckout = (e) => {
    e.preventDefault();
    if (!name.trim())  { toast.error('Please enter your name');  return; }
    if (!phone.trim()) { toast.error('Please enter your phone'); return; }
    if (phone.length < 10) { toast.error('Enter a valid phone number'); return; }
    if (!effectiveShopId) { toast.error('Shop not found. Please go back and try again.'); return; }

    checkoutMut.mutate({
      shopId:       effectiveShopId,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      customerEmail: email.trim() || undefined,
      paymentMethod,
      notes: notes.trim() || undefined,
      items: items.map((i) => ({
        productId:     i.productId,
        quantity:      i.quantity,
        selectedSize:  i.size  || '',
        selectedColor: i.color || '',
      })),
    });
  };

  if (completedSale) {
    return (
      <OrderSuccess
        sale={completedSale}
        onNewOrder={() => { setCompletedSale(null); window.location.href = shopId ? `/shop?shopId=${shopId}` : '/shop'; }}
      />
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400 px-4">
        <ShoppingCart className="w-16 h-16 mb-4 opacity-40" />
        <h2 className="font-bold text-xl text-gray-700 mb-2">Your cart is empty</h2>
        <p className="text-gray-400 mb-6">Add some products to get started</p>
        <Link to={back}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition">
          Shop Now
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link to={back} className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Continue Shopping
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Cart <span className="text-base font-normal text-gray-400">({items.length} item{items.length !== 1 ? 's' : ''})</span>
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Cart items ── */}
        <div className="lg:col-span-3 space-y-3">
          {items.map((item) => <CartItem key={item._key} item={item} />)}
        </div>

        {/* ── Order summary + checkout ── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sticky top-20">
            <h2 className="font-bold text-gray-900 text-lg mb-5">Order Summary</h2>

            <div className="space-y-2 text-sm mb-5">
              {items.map((item) => (
                <div key={item._key} className="flex justify-between text-gray-600">
                  <span className="truncate mr-2">{item.name} ×{item.quantity}</span>
                  <span className="shrink-0 font-medium">₹{(item.finalPrice * item.quantity).toFixed(0)}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-3 mt-3 flex justify-between font-bold text-gray-900 text-base">
                <span>Subtotal</span>
                <span>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-xs text-gray-400">Tax (if applicable) calculated at checkout</p>
            </div>

            {/* ── Checkout form ── */}
            <form onSubmit={handleCheckout} className="space-y-3">
              <p className="font-semibold text-gray-800 text-sm">Your Details</p>
              <input required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Full Name *"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input required value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone Number *" type="tel" maxLength={15}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional)" type="email"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

              <p className="font-semibold text-gray-800 text-sm pt-1">Payment Method</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'cash',   label: '💵 Cash' },
                  { value: 'upi',    label: '📱 UPI' },
                  { value: 'card',   label: '💳 Card' },
                  { value: 'credit', label: '⏰ Credit' },
                ].map((m) => (
                  <button key={m.value} type="button" onClick={() => setPaymentMethod(m.value)}
                    className={`py-2 rounded-xl text-xs font-semibold border transition ${
                      paymentMethod === m.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 text-gray-600 hover:border-blue-400'
                    }`}>{m.label}</button>
                ))}
              </div>

              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions (optional)…" rows={2}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />

              <button type="submit" disabled={checkoutMut.isPending}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white font-bold rounded-2xl transition flex items-center justify-center gap-2 text-base shadow-lg mt-2">
                {checkoutMut.isPending
                  ? <><span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> Placing Order…</>
                  : `Place Order · ₹${subtotal.toLocaleString('en-IN')}`
                }
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
