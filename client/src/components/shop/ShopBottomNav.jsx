import { Link, useLocation } from 'react-router-dom';
import { Home, Search, LayoutGrid, ShoppingCart } from 'lucide-react';

/**
 * ShopBottomNav — app-like bottom navigation for the storefront on mobile.
 *
 * Replaces the old floating cart FAB, which sat on top of the footer and page
 * content. A fixed bar with safe-area padding is what a shopper expects on a
 * phone, and it keeps the cart reachable from every screen.
 *
 * Hidden on md+ where the sticky header already carries search and the cart.
 */
export default function ShopBottomNav({ slug, cartCount = 0, onSearch, onCategories }) {
  const { pathname } = useLocation();
  const home = `/shop/${slug}`;
  const cart = `/shop/${slug}/cart`;

  const isHome = pathname === home;
  const isCart = pathname === cart;

  const itemBase =
    'flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-0 ' +
    'text-[11px] font-semibold transition-colors active:scale-95 select-none';
  const active   = 'text-[var(--color-primary)]';
  const inactive = 'text-[var(--color-text-muted)]';

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16
                 bg-[var(--color-card)] border-t border-[var(--color-border)]
                 flex items-stretch shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Shop navigation"
    >
      <Link to={home} className={`${itemBase} ${isHome ? active : inactive}`}>
        <Home className="w-5 h-5" />
        Home
      </Link>

      <button type="button" onClick={onSearch} className={`${itemBase} ${inactive}`}>
        <Search className="w-5 h-5" />
        Search
      </button>

      <button type="button" onClick={onCategories} className={`${itemBase} ${inactive}`}>
        <LayoutGrid className="w-5 h-5" />
        Browse
      </button>

      <Link to={cart} className={`${itemBase} ${isCart ? active : inactive}`}>
        <span className="relative">
          <ShoppingCart className="w-5 h-5" />
          {cartCount > 0 && (
            <span
              className="absolute -top-1.5 -right-2 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full
                         bg-[var(--color-danger)] text-white text-[10px] font-black
                         flex items-center justify-center"
            >
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </span>
        Cart
      </Link>
    </nav>
  );
}
