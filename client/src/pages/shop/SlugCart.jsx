import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ShoppingCart, Trash2, Plus, Minus, Store, ArrowLeft, Package,
  CheckCircle2, Loader2, ShieldCheck, Truck, BadgePercent,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { shopApi } from '../../api/shop.api';
import useCartStore from '../../store/cartStore';
import ShopBottomNav from '../../components/shop/ShopBottomNav';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash on delivery' },
  { value: 'upi',  label: 'UPI' },
  { value: 'card', label: 'Card' },
];

/**
 * SlugCart — cart + checkout for the slug storefront (/shop/:slug/cart).
 *
 * This route did not exist: CustomerShop and SlugProductDetail both linked to
 * `/shop/:slug/cart`, which matched no route and fell through to the catch-all
 * redirect to /login — so a shopper could fill a cart and never reach checkout.
 */
export default function SlugCart() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const items          = useCartStore((s) => s.items);
  const removeItem     = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart      = useCartStore((s) => s.clearCart);
  const cartShopId     = useCartStore((s) => s.shopId);
  const cartCount      = useCartStore((s) => s.getItemCount());

  const [name,  setName]  = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [placedOrder, setPlacedOrder] = useState(null);

  const { data: shopData } = useQuery({
    queryKey: ['public-shop-slug', slug],
    queryFn:  () => shopApi.getShopBySlug(slug),
    staleTime: 5 * 60 * 1000,
  });
  const shop = shopData?.data?.shop;

  const totals = useMemo(() => {
    const mrp      = items.reduce((a, i) => a + i.price * i.quantity, 0);
    const subtotal = items.reduce((a, i) => a + i.finalPrice * i.quantity, 0);
    return { mrp, subtotal, saved: mrp - subtotal };
  }, [items]);

  const checkoutMut = useMutation({
    mutationFn: (data) => shopApi.checkout(data),
    onSuccess: (res) => {
      setPlacedOrder(res.data.sale);
      clearCart();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (e) => toast.error(e.message || 'Could not place your order'),
  });

  const phoneOk = /^\d{10}$/.test(phone.trim());
  const canPlace = name.trim().length >= 2 && phoneOk && items.length > 0 && !checkoutMut.isPending;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canPlace) {
      if (!phoneOk) toast.error('Enter a valid 10-digit phone number');
      else if (name.trim().length < 2) toast.error('Please enter your name');
      return;
    }
    checkoutMut.mutate({
      shopId: cartShopId || shop?._id,
      customerName:  name.trim(),
      customerPhone: phone.trim(),
      customerEmail: email.trim() || undefined,
      paymentMethod,
      notes: notes.trim() || undefined,
      items: items.map((i) => ({
        productId: i.productId,
        quantity:  i.quantity,
        size:      i.size  || undefined,
        color:     i.color || undefined,
      })),
    });
  };

  // ── Order placed ───────────────────────────────────────────────────────────
  if (placedOrder) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-[var(--color-card)] rounded-3xl border border-[var(--color-border)] p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-success-bg)] flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-9 h-9 text-[var(--color-success)]" />
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--color-text)]">Order placed</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-2 leading-relaxed">
            Thanks {placedOrder.customerName?.split(' ')[0] || ''}! We'll call{' '}
            <strong className="text-[var(--color-text)]">{placedOrder.customerPhone}</strong> to confirm.
          </p>
          <div className="mt-5 py-3 px-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
            <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] font-bold">Order number</p>
            <p className="text-lg font-black text-[var(--color-text)] tabular-nums">{placedOrder.invoiceNumber}</p>
            <p className="text-sm font-bold text-[var(--color-text)] mt-1">
              ₹{Number(placedOrder.totalAmount).toLocaleString('en-IN')}
            </p>
          </div>
          <Link
            to={`/shop/${slug}`}
            className="mt-6 inline-flex w-full items-center justify-center h-12 rounded-xl
                       bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]
                       text-white font-bold transition active:scale-[0.98]"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  // ── Empty cart ─────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)]">
        <CartHeader slug={slug} shop={shop} />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 rounded-3xl bg-[var(--color-card)] border border-[var(--color-border)] flex items-center justify-center mx-auto mb-5">
            <ShoppingCart className="w-9 h-9 text-[var(--color-text-disabled)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Your cart is empty</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1.5">
            Browse the catalogue and add something you like.
          </p>
          <Link
            to={`/shop/${slug}`}
            className="mt-7 inline-flex items-center gap-2 h-12 px-6 rounded-xl
                       bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]
                       text-white font-bold transition active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" /> Start shopping
          </Link>
        </div>
        <ShopBottomNav slug={slug} cartCount={0} onSearch={() => navigate(`/shop/${slug}`)} onCategories={() => navigate(`/shop/${slug}`)} />
      </div>
    );
  }

  // ── Cart + checkout ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-40 md:pb-16">
      <CartHeader slug={slug} shop={shop} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--color-text)]">
          Your cart
          <span className="ml-2 text-sm font-semibold text-[var(--color-text-muted)]">
            {cartCount} item{cartCount === 1 ? '' : 's'}
          </span>
        </h1>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6 mt-5 items-start">
          {/* ── Items ── */}
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item._key}
                className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)]"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-[var(--color-bg)] shrink-0">
                  {item.image ? (
                    <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-7 h-7 text-[var(--color-text-disabled)]" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col">
                  <p className="text-sm font-semibold text-[var(--color-text)] line-clamp-2 leading-snug">
                    {item.name}
                  </p>
                  {(item.size || item.color) && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {[item.size, item.color].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-3 mt-auto pt-2">
                    {/* Touch-friendly 36px stepper */}
                    <div className="flex items-center border border-[var(--color-border)] rounded-xl overflow-hidden">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => updateQuantity(item._key, item.quantity - 1)}
                        className="w-9 h-9 flex items-center justify-center text-[var(--color-text-secondary)]
                                   hover:bg-[var(--color-bg)] active:scale-90 transition disabled:opacity-40"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-9 text-center text-sm font-bold tabular-nums text-[var(--color-text)]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => updateQuantity(item._key, item.quantity + 1)}
                        className="w-9 h-9 flex items-center justify-center text-[var(--color-text-secondary)]
                                   hover:bg-[var(--color-bg)] active:scale-90 transition disabled:opacity-40"
                        disabled={item.quantity >= item.stock}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-right">
                      {item.discount > 0 && (
                        <p className="text-[11px] text-[var(--color-text-muted)] line-through leading-none">
                          ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                        </p>
                      )}
                      <p className="text-sm font-extrabold text-[var(--color-text)] tabular-nums">
                        ₹{(item.finalPrice * item.quantity).toLocaleString('en-IN')}
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => removeItem(item._key)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--color-text-muted)]
                                 hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* ── Summary + checkout ── */}
          <form
            onSubmit={handleSubmit}
            className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-5 lg:sticky lg:top-24 space-y-5"
          >
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[var(--color-text-secondary)]">
                <span>Subtotal</span>
                <span className="tabular-nums">₹{totals.mrp.toLocaleString('en-IN')}</span>
              </div>
              {totals.saved > 0 && (
                <div className="flex justify-between text-[var(--color-success)] font-semibold">
                  <span className="flex items-center gap-1.5"><BadgePercent className="w-4 h-4" /> Discount</span>
                  <span className="tabular-nums">−₹{totals.saved.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-3 border-t border-[var(--color-border)]">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Total</span>
                <span className="text-2xl font-black text-[var(--color-text)] tabular-nums">
                  ₹{totals.subtotal.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Taxes are calculated by the shop when your order is confirmed.
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-[var(--color-border)]">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Your details</p>
              <Field label="Full name" required value={name} onChange={setName} placeholder="Your name" autoComplete="name" />
              <Field
                label="Phone" required value={phone} onChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile" inputMode="numeric" autoComplete="tel"
                error={phone.length > 0 && !phoneOk ? 'Must be 10 digits' : ''}
              />
              <Field label="Email" value={email} onChange={setEmail} placeholder="Optional" type="email" autoComplete="email" />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Payment</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPaymentMethod(m.value)}
                    className={`h-11 rounded-xl text-xs font-bold border transition ${
                      paymentMethod === m.value
                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-light)]'
                    }`}
                  >
                    {m.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Delivery notes (optional)"
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--color-bg)] border border-[var(--color-border)]
                         text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition resize-none"
            />

            {/* Desktop submit — mobile uses the sticky bar below */}
            <button
              type="submit"
              disabled={!canPlace}
              className="hidden md:flex w-full h-12 items-center justify-center gap-2 rounded-xl
                         bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]
                         disabled:opacity-50 disabled:cursor-not-allowed
                         text-white font-bold transition active:scale-[0.98]"
            >
              {checkoutMut.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Placing order…</>
                : <>Place order · ₹{totals.subtotal.toLocaleString('en-IN')}</>}
            </button>

            <ul className="space-y-1.5 text-[11px] text-[var(--color-text-muted)]">
              <li className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> No payment taken online — the shop confirms first</li>
              <li className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Delivery arranged directly with the shop</li>
            </ul>

            {/* Sticky mobile action bar */}
            <div
              className="md:hidden fixed bottom-16 left-0 right-0 z-30 px-4 py-3
                         bg-[var(--color-card)] border-t border-[var(--color-border)]
                         shadow-[0_-2px_12px_rgba(0,0,0,0.08)]"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
            >
              <button
                type="submit"
                disabled={!canPlace}
                className="w-full h-12 flex items-center justify-center gap-2 rounded-xl
                           bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]
                           disabled:opacity-50 text-white font-bold transition active:scale-[0.98]"
              >
                {checkoutMut.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Placing order…</>
                  : <>Place order · ₹{totals.subtotal.toLocaleString('en-IN')}</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ShopBottomNav
        slug={slug}
        cartCount={cartCount}
        onSearch={() => navigate(`/shop/${slug}`)}
        onCategories={() => navigate(`/shop/${slug}`)}
      />
    </div>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────────
function CartHeader({ slug, shop }) {
  return (
    <header className="sticky top-0 z-40 bg-[var(--color-card)]/95 backdrop-blur border-b border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
        <Link
          to={`/shop/${slug}`}
          aria-label="Back to shop"
          className="w-10 h-10 -ml-2 flex items-center justify-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        {shop?.logo ? (
          <img src={shop.logo} alt="" className="w-9 h-9 rounded-xl object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)] flex items-center justify-center">
            <Store className="w-5 h-5 text-white" />
          </div>
        )}
        <span className="font-bold text-[var(--color-text)] truncate">{shop?.name || 'Shop'}</span>
      </div>
    </header>
  );
}

function Field({ label, value, onChange, error, required, ...rest }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
        {label} {required && <span className="text-[var(--color-danger)]">*</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full h-11 px-3 rounded-xl text-sm bg-[var(--color-bg)] text-[var(--color-text)]
                    border transition focus:outline-none
                    ${error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'}`}
        {...rest}
      />
      {error && <span className="block text-[11px] font-semibold text-[var(--color-danger)] mt-1">{error}</span>}
    </label>
  );
}
