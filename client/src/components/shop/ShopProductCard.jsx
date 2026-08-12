import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Package, Check, SlidersHorizontal, Heart, Star } from 'lucide-react';
import useWishlistStore from '../../store/wishlistStore';
import { formatDiscountPct } from '../../utils/format';

/**
 * ShopProductCard — the single product card used across the whole storefront.
 *
 * One component so grids and carousels never drift in size or style.
 *
 * No layout shift by construction:
 *   - aspect-square media reserves image space before load
 *   - the title block reserves two lines
 *   - the hover Add-to-Cart bar is absolutely positioned and translated in, so
 *     revealing it never changes the card's height
 */
const ShopProductCard = memo(function ShopProductCard({ product, slug, onAdd, inCart = 0 }) {
  const wishlisted = useWishlistStore((s) => s.ids.includes(product._id));
  const toggleWish  = useWishlistStore((s) => s.toggle);

  const discount   = product.discount || 0;
  const finalPrice = product.price * (1 - discount / 100);
  const outOfStock = product.stock < 1;
  const lowStock   = !outOfStock && product.stock <= (product.lowStockThreshold || 5);
  const detailLink = `/shop/${slug}/product/${product._id}`;

  // Variant products can't be added blind — checkout needs a concrete
  // size/colour, so these send the shopper to the detail page to choose.
  const needsChoice = (product.sizes?.length || 0) > 0 || (product.colors?.length || 0) > 0;
  const image = product.images?.[0] || product.image;

  // Rating is rendered ONLY when the API actually supplies one. The Product
  // model has no rating field today, so inventing stars here would put fake
  // social proof in front of real customers.
  const rating = Number(product.rating) || null;
  const ratingCount = Number(product.ratingCount) || 0;

  return (
    <article
      className="group relative flex flex-col h-full bg-[var(--color-card)] rounded-2xl
                 border border-[var(--color-border)] overflow-hidden
                 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5
                 hover:border-[var(--color-primary-light)]
                 focus-within:ring-2 focus-within:ring-[var(--color-primary)]/40"
    >
      {/* ── Media ── */}
      <Link to={detailLink} className="block relative" aria-label={product.name}>
        <div className="relative w-full aspect-square bg-[var(--color-bg)] overflow-hidden">
          {image ? (
            <img
              src={image}
              alt={product.name}
              width="400"
              height="400"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-10 h-10 text-[var(--color-text-disabled)]" />
            </div>
          )}

          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 items-start">
            {discount > 0 && (
              <span className="bg-[var(--color-danger)] text-white text-[11px] font-bold px-2 py-1 rounded-lg shadow-sm leading-none">
                {formatDiscountPct(discount)}% OFF
              </span>
            )}
            {product.isNewArrival && (
              <span className="bg-[var(--color-success)] text-white text-[11px] font-bold px-2 py-1 rounded-lg shadow-sm leading-none">
                NEW
              </span>
            )}
          </div>

          {lowStock && (
            <span className="absolute bottom-2.5 left-2.5 bg-[var(--color-warning)] text-white text-[11px] font-bold px-2 py-1 rounded-lg shadow-sm leading-none">
              Only {product.stock} left
            </span>
          )}

          {outOfStock && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center">
              <span className="bg-white text-gray-900 text-xs font-bold px-3 py-1.5 rounded-lg">Out of Stock</span>
            </div>
          )}

          {/* Hover-reveal action bar (desktop). Absolute + translate = no shift. */}
          {!outOfStock && (
            <div
              className="hidden md:block absolute inset-x-0 bottom-0 p-2
                         translate-y-full opacity-0 transition-all duration-300 ease-out
                         group-hover:translate-y-0 group-hover:opacity-100
                         group-focus-within:translate-y-0 group-focus-within:opacity-100"
            >
              {needsChoice ? (
                <span
                  className="w-full h-10 flex items-center justify-center gap-1.5 rounded-xl
                             bg-[var(--color-card)]/95 backdrop-blur border border-[var(--color-primary)]
                             text-[var(--color-primary)] text-xs font-bold shadow-lg"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Select Options
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); onAdd(product); }}
                  className="w-full h-10 flex items-center justify-center gap-1.5 rounded-xl
                             bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]
                             text-white text-xs font-bold shadow-lg transition active:scale-95"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  {inCart > 0 ? `In cart (${inCart}) — add more` : 'Add to Cart'}
                </button>
              )}
            </div>
          )}
        </div>
      </Link>

      {/* Wishlist — outside the Link so it never triggers navigation */}
      <button
        type="button"
        onClick={() => toggleWish(product._id)}
        aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name}`}
        aria-pressed={wishlisted}
        className="absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center rounded-full
                   bg-[var(--color-card)]/90 backdrop-blur shadow-sm
                   hover:scale-110 active:scale-90 transition"
      >
        <Heart
          className={`w-4 h-4 transition-colors ${
            wishlisted ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'
          }`}
          fill={wishlisted ? 'currentColor' : 'none'}
        />
      </button>

      {/* ── Body ── */}
      <div className="flex flex-col flex-1 p-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-primary)] truncate">
          {product.category}
        </p>

        <Link to={detailLink} className="mt-1 min-h-[2.3rem]">
          <h3 className="text-sm font-semibold leading-snug text-[var(--color-text)] line-clamp-2 hover:text-[var(--color-primary)] transition-colors">
            {product.name}
          </h3>
        </Link>

        {rating != null && (
          <div className="flex items-center gap-1 mt-1.5">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--color-success)] text-white text-[11px] font-bold">
              {rating.toFixed(1)} <Star className="w-2.5 h-2.5" fill="currentColor" />
            </span>
            {ratingCount > 0 && (
              <span className="text-[11px] text-[var(--color-text-muted)]">({ratingCount})</span>
            )}
          </div>
        )}

        {needsChoice && (
          <div className="flex flex-wrap items-center gap-1 mt-2" aria-hidden="true">
            {(product.sizes || []).slice(0, 4).map((s) => (
              <span key={s} className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)]">
                {s}
              </span>
            ))}
            {(product.colors || []).slice(0, 4).map((c) => (
              <span key={c.name} title={c.name} className="w-4 h-4 rounded-full border border-[var(--color-border)]" style={{ backgroundColor: c.hex }} />
            ))}
          </div>
        )}

        <div className="flex items-end justify-between gap-2 mt-auto pt-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[17px] font-extrabold text-[var(--color-text)] leading-tight tabular-nums">
                ₹{finalPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              {discount > 0 && (
                <span className="text-[11px] text-[var(--color-text-muted)] line-through tabular-nums">
                  ₹{product.price.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            {discount > 0 && (
              <span className="text-[11px] font-bold text-[var(--color-success)]">{formatDiscountPct(discount)}% off</span>
            )}
          </div>

          {/* Always-visible action for touch (hover bar is desktop-only) */}
          {needsChoice ? (
            <Link
              to={detailLink}
              title="Select options"
              aria-label={`Select options for ${product.name}`}
              className="md:hidden shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl
                         border border-[var(--color-primary)] text-[var(--color-primary)] active:scale-95 transition"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => !outOfStock && onAdd(product)}
              disabled={outOfStock}
              aria-label={`Add ${product.name} to cart`}
              className="md:hidden shrink-0 inline-flex items-center justify-center gap-1 w-10 h-10 rounded-xl
                         bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]
                         disabled:bg-[var(--color-text-disabled)] text-white transition active:scale-95"
            >
              {inCart > 0 ? <><Check className="w-4 h-4" /></> : <ShoppingCart className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    </article>
  );
});

export default ShopProductCard;

/** Matching skeleton — identical box model, so nothing shifts on swap-in. */
export function ShopProductCardSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <div className="w-full aspect-square bg-[var(--color-bg)] animate-pulse" />
      <div className="flex flex-col flex-1 p-2.5 gap-2">
        <div className="h-2.5 w-1/2 rounded bg-[var(--color-bg)] animate-pulse" />
        <div className="h-3 w-full rounded bg-[var(--color-bg)] animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-[var(--color-bg)] animate-pulse" />
        <div className="flex items-end justify-between mt-auto pt-3">
          <div className="h-5 w-16 rounded bg-[var(--color-bg)] animate-pulse" />
          <div className="h-10 w-10 rounded-xl bg-[var(--color-bg)] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function ShopProductGridSkeleton({ count = 10 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
      {Array.from({ length: count }, (_, i) => <ShopProductCardSkeleton key={i} />)}
    </div>
  );
}
