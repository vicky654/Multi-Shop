import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Package, Check, Heart } from 'lucide-react';
import useWishlistStore from '../../../store/wishlistStore';

/**
 * FootwearProductCard — the product tile for a footwear storefront.
 *
 * Differs from the generic ShopProductCard in the three things a shoe shopper
 * actually scans before tapping: which colours it comes in, which sizes are
 * genuinely in stock, and the saving against MRP.
 *
 * Everything shown is real data. There are deliberately NO star ratings or
 * review counts: the Product model has no rating field, and putting invented
 * stars in front of real customers is fake social proof, not design.
 */
const FootwearProductCard = memo(function FootwearProductCard({ product, slug, onAdd, inCart = 0 }) {
  const wishlisted = useWishlistStore((s) => s.ids.includes(product._id));
  const toggleWish = useWishlistStore((s) => s.toggle);
  const [hovered, setHovered] = useState(false);

  const discount   = product.discount || 0;
  const finalPrice = product.price * (1 - discount / 100);
  const outOfStock = product.stock < 1;
  const detailLink = `/shop/${slug}/product/${product._id}`;

  const images = product.images?.length ? product.images : (product.image ? [product.image] : []);
  // A second angle on hover is standard for footwear; falls back to the first.
  const image  = (hovered && images[1]) || images[0];

  const colors = product.colors || [];

  /**
   * Sizes worth advertising.
   * With per-variant stock, only cells that actually have stock are offered —
   * showing a size the shopper cannot buy is worse than showing none. Without
   * variant tracking, fall back to the declared size list.
   */
  const sizes = product.trackVariantStock && product.variantStock?.length
    ? [...new Set(product.variantStock.filter((v) => v.stock > 0 && v.size).map((v) => v.size))]
    : (product.sizes || []);

  // Variant products cannot be added blind — checkout needs a concrete
  // size/colour, so those route to the detail page to choose.
  const needsChoice = sizes.length > 0 || colors.length > 0;

  return (
    <article
      className="group relative flex flex-col h-full bg-white rounded-xl border border-gray-200/80
                 overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-gray-300"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link to={detailLink} className="block relative" aria-label={product.name}>
        <div className="relative w-full aspect-[4/5] bg-[#f4f2ee] overflow-hidden">
          {image ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-10 h-10 text-gray-300" />
            </div>
          )}

          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 items-start">
            {product.isNewArrival && (
              <span className="bg-white/95 text-gray-900 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide shadow-sm">
                New
              </span>
            )}
            {discount > 0 && (
              <span className="bg-emerald-700 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide shadow-sm">
                {Math.round(discount)}% Off
              </span>
            )}
            {product.isTrending && (
              <span className="bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide shadow-sm">
                Trending
              </span>
            )}
          </div>

          {outOfStock && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <span className="bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded uppercase tracking-wide">
                Sold Out
              </span>
            </div>
          )}
        </div>
      </Link>

      <button
        type="button"
        onClick={() => toggleWish(product._id)}
        aria-label={wishlisted ? 'Remove from wishlist' : 'Save for later'}
        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/95 shadow-sm
                   flex items-center justify-center transition hover:scale-110"
      >
        <Heart className={`w-4 h-4 ${wishlisted ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
      </button>

      {/* ── Body ── */}
      <div className="flex flex-col flex-1 p-3">
        {/* Colour swatches — the first thing a footwear shopper compares. */}
        {colors.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2 h-5">
            {colors.slice(0, 5).map((c) => (
              <span
                key={c.hex || c.name}
                title={c.name}
                className="w-4 h-4 rounded-full border border-black/15 shrink-0"
                style={{ backgroundColor: c.hex }}
              />
            ))}
            {colors.length > 5 && (
              <span className="text-[10px] font-semibold text-gray-400">+{colors.length - 5}</span>
            )}
          </div>
        )}

        <Link to={detailLink} className="group/link">
          {product.brand && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{product.brand}</p>
          )}
          {/* Two lines reserved so cards in a row never differ in height. */}
          <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 min-h-[2.5rem] group-hover/link:underline">
            {product.name}
          </h3>
        </Link>

        {sizes.length > 0 && (
          <p className="text-[11px] text-gray-500 mt-1 truncate">
            Sizes {sizes.slice(0, 6).join(' · ')}{sizes.length > 6 ? ' …' : ''}
          </p>
        )}

        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-base font-bold text-gray-900 tabular-nums">
            ₹{Math.round(finalPrice).toLocaleString('en-IN')}
          </span>
          {discount > 0 && (
            <>
              <span className="text-xs text-gray-400 line-through tabular-nums">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-bold text-emerald-700">
                {Math.round(discount)}% off
              </span>
            </>
          )}
        </div>

        <div className="mt-3 pt-0.5 mt-auto">
          {outOfStock ? (
            <button
              disabled
              className="w-full h-10 rounded-lg bg-gray-100 text-gray-400 text-xs font-bold uppercase tracking-wide cursor-not-allowed"
            >
              Sold Out
            </button>
          ) : needsChoice ? (
            <Link
              to={detailLink}
              className="w-full h-10 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-bold
                         uppercase tracking-wide flex items-center justify-center gap-2 transition"
            >
              Select Size
            </Link>
          ) : (
            <button
              onClick={() => onAdd(product)}
              className="w-full h-10 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-bold
                         uppercase tracking-wide flex items-center justify-center gap-2 transition"
            >
              {inCart > 0
                ? <><Check className="w-3.5 h-3.5" /> In Cart ({inCart})</>
                : <><ShoppingCart className="w-3.5 h-3.5" /> Add to Cart</>}
            </button>
          )}
        </div>
      </div>
    </article>
  );
});

export default FootwearProductCard;

export function FootwearCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 overflow-hidden">
      <div className="w-full aspect-[4/5] bg-gray-100 animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-16 rounded bg-gray-100 animate-pulse" />
        <div className="h-4 w-full rounded bg-gray-100 animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-gray-100 animate-pulse" />
        <div className="h-10 w-full rounded-lg bg-gray-100 animate-pulse" />
      </div>
    </div>
  );
}
