import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Package, Truck, ShieldCheck,
  Smartphone, Ruler, Palette, Store, ArrowRight,
} from 'lucide-react';

/**
 * Building blocks for the footwear storefront.
 *
 * A NOTE ON WHAT IS *NOT* HERE
 *   Reference D2C shoe sites lean on star ratings, customer testimonials with
 *   photos, and headline claims ("4M+ happy customers", "3.75L bottles
 *   recycled"). None of that exists in this system as data. Rendering it would
 *   mean fabricating social proof and brand claims that real shoppers would read
 *   as fact, so those blocks are omitted rather than faked. Everything below is
 *   derived from the shop's own record and its live catalogue.
 */

// ── Announcement bar ──────────────────────────────────────────────────────────
function useCountdown(endsAt) {
  const [left, setLeft] = useState(() => (endsAt ? new Date(endsAt) - Date.now() : 0));

  useEffect(() => {
    if (!endsAt) return undefined;
    const id = setInterval(() => setLeft(new Date(endsAt) - Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!endsAt || left <= 0) return null;
  const s = Math.floor(left / 1000);
  return {
    days:  Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins:  Math.floor((s % 3600) / 60),
    secs:  s % 60,
  };
}

/**
 * Top strip. Renders only when the shop has actually configured a sale banner,
 * so a shop with nothing on offer doesn't get a permanent empty promo bar.
 */
export function AnnounceBar({ shop }) {
  const banner = shop.saleBanner;
  const t = useCountdown(banner?.enabled ? banner?.endDate : null);

  if (!banner?.enabled) return null;

  const headline = [banner.title, banner.discount].filter(Boolean).join(' · ')
    || 'Limited time offer';

  return (
    <div className="bg-gray-900 text-white">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">{headline}</span>
        {banner.subtitle && (
          <span className="hidden sm:inline text-[11px] text-white/60">{banner.subtitle}</span>
        )}
        {t && (
          <span className="flex items-center gap-1">
            <span className="text-[10px] text-white/60 uppercase tracking-wide mr-0.5">Ends in</span>
            {[
              [t.days, 'D'], [t.hours, 'H'], [t.mins, 'M'], [t.secs, 'S'],
            ].map(([v, l]) => (
              <span key={l} className="min-w-[1.6rem] px-1 py-0.5 rounded bg-white/15 text-[11px] font-bold tabular-nums text-center">
                {String(v).padStart(2, '0')}<span className="text-[9px] text-white/50">{l}</span>
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
/**
 * Full-bleed hero. Slides come from the shop's own banner plus its most
 * discounted / newest styles, so there is always something real to show without
 * shipping stock photography.
 */
export function FootwearHero({ shop, slides, slug }) {
  const [idx, setIdx] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count < 2) return undefined;
    const id = setInterval(() => setIdx((i) => (i + 1) % count), 6000);
    return () => clearInterval(id);
  }, [count]);

  if (count === 0) return null;
  const s = slides[idx];

  return (
    <section className="relative overflow-hidden bg-[#e8e4dc]">
      <div className="relative h-[300px] sm:h-[420px] lg:h-[520px]">
        {s.image ? (
          <img
            src={s.image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            // The first slide is the largest thing above the fold, so it loads
            // eagerly while the rest stay lazy.
            loading={idx === 0 ? 'eager' : 'lazy'}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
        )}
        {/* Readability scrim — copy over a photo needs guaranteed contrast. */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />

        <div className="relative h-full max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-12 flex flex-col justify-center">
          <div className="max-w-lg">
            {s.eyebrow && (
              <p className="text-white/80 text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] mb-2">
                {s.eyebrow}
              </p>
            )}
            <h1 className="text-white text-3xl sm:text-5xl lg:text-6xl font-black uppercase leading-[0.95] tracking-tight">
              {s.title}
            </h1>
            {s.subtitle && (
              <p className="text-white/85 text-sm sm:text-lg mt-3 sm:mt-4 max-w-md">{s.subtitle}</p>
            )}
            <Link
              to={s.to || `/shop/${slug}/products`}
              className="mt-5 sm:mt-7 inline-flex items-center gap-2 h-11 sm:h-12 px-6 sm:px-8 bg-white text-gray-900
                         text-xs sm:text-sm font-bold uppercase tracking-wider hover:bg-gray-100 transition"
            >
              {s.cta || 'Shop Now'} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {count > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <button
              onClick={() => setIdx((i) => (i - 1 + count) % count)}
              aria-label="Previous slide"
              className="w-8 h-8 rounded-full bg-white/25 hover:bg-white/40 backdrop-blur flex items-center justify-center transition"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <div className="flex gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? 'w-7 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setIdx((i) => (i + 1) % count)}
              aria-label="Next slide"
              className="w-8 h-8 rounded-full bg-white/25 hover:bg-white/40 backdrop-blur flex items-center justify-center transition"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Shop-by-style rail ────────────────────────────────────────────────────────
/**
 * The circular category rail. Each pill uses a real product photo from that
 * category, so it reflects actual stock rather than generic icons.
 */
export function StyleRail({ items, slug }) {
  if (items.length === 0) return null;

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex gap-4 sm:gap-7 overflow-x-auto no-scrollbar py-3.5 snap-x">
          {items.map((c) => (
            <Link
              key={c.name}
              to={`/shop/${slug}/products?category=${encodeURIComponent(c.name)}`}
              className="group shrink-0 flex flex-col items-center gap-1.5 snap-start w-[68px] sm:w-[80px]"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-[#f4f2ee]
                              ring-1 ring-gray-200 group-hover:ring-gray-900 transition-all">
                {c.image ? (
                  <img src={c.image} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-5 h-5 text-gray-300" />
                  </div>
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] font-semibold text-gray-700 text-center leading-tight line-clamp-2">
                {c.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Trust strip ───────────────────────────────────────────────────────────────
/**
 * USP strip.
 *
 * Every item here is a FACT derived from the shop's own record or its live
 * catalogue — style count, the real size range in stock, colour count, the
 * payment methods actually configured. The reference site's numbers ("4M+ happy
 * customers") are marketing claims this system has no basis for, so they are not
 * reproduced.
 */
export function TrustStrip({ facts }) {
  if (facts.length === 0) return null;

  return (
    <section className="bg-gray-900">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {facts.map(({ icon: Icon, title, subtitle }) => (
            <div key={title} className="flex flex-col items-center text-center gap-1.5">
              <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white/70" strokeWidth={1.5} />
              <p className="text-white text-xs sm:text-sm font-bold">{title}</p>
              {subtitle && <p className="text-white/50 text-[10px] sm:text-xs">{subtitle}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const TRUST_ICONS = { Truck, ShieldCheck, Smartphone, Ruler, Palette, Package, Store };

// ── Brand story ───────────────────────────────────────────────────────────────
export function BrandStory({ shop }) {
  if (!shop.description) return null;
  return (
    <section className="bg-[#f4f2ee] py-12 sm:py-16">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <div className="w-11 h-11 rounded-full bg-white ring-1 ring-gray-200 flex items-center justify-center mx-auto mb-5">
          <Store className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
          Why shop at {shop.name}?
        </h2>
        <p className="text-sm sm:text-[15px] text-gray-600 mt-3 leading-relaxed">{shop.description}</p>
      </div>
    </section>
  );
}

// ── Collection tiles ("Our Exclusive Series") ─────────────────────────────────
/**
 * Editorial collection grid. Each tile is a real category or brand from the
 * catalogue, fronted by one of its own product photos.
 */
export function SeriesGrid({ title, series, slug, seeAllTo }) {
  if (series.length === 0) return null;

  return (
    <section className="bg-white py-10 sm:py-14">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8">
        <h2 className="text-center text-xl sm:text-2xl font-bold text-gray-900 mb-6 sm:mb-8">{title}</h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {series.map((s) => (
            <Link
              key={s.name}
              to={s.to}
              className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-[#f4f2ee]"
            >
              {s.image ? (
                <img
                  src={s.image}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package className="w-10 h-10 text-gray-300" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                <p className="text-white text-xs sm:text-sm font-bold uppercase tracking-wider leading-tight">
                  {s.name}
                </p>
                <p className="text-white/70 text-[10px] sm:text-xs mt-0.5">
                  {s.count} style{s.count === 1 ? '' : 's'}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {seeAllTo && (
          <div className="text-center mt-7">
            <Link
              to={seeAllTo}
              className="inline-flex items-center gap-2 h-10 px-6 rounded-full border border-gray-300
                         text-xs font-bold uppercase tracking-wider text-gray-800 hover:border-gray-900 transition"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Product rail with arrows ──────────────────────────────────────────────────
export function ProductRail({ title, subtitle, products, renderCard, seeAllTo, tone = 'light' }) {
  const scroller = useRef(null);
  if (products.length === 0) return null;

  const nudge = (dir) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const bg = tone === 'sand' ? 'bg-[#f6ecd9]' : tone === 'mint' ? 'bg-[#e9efe6]' : 'bg-white';

  return (
    <section className={`${bg} py-9 sm:py-12`}>
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <div className="hidden sm:flex gap-2 shrink-0">
            {[[-1, ChevronLeft, 'Scroll left'], [1, ChevronRight, 'Scroll right']].map(([d, Icon, label]) => (
              <button
                key={label}
                onClick={() => nudge(d)}
                aria-label={label}
                className="w-9 h-9 rounded-full border border-gray-300 bg-white/70 hover:bg-white
                           hover:border-gray-900 flex items-center justify-center transition"
              >
                <Icon className="w-4 h-4 text-gray-700" />
              </button>
            ))}
          </div>
        </div>

        <div
          ref={scroller}
          className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar snap-x pb-1"
        >
          {products.map((p) => (
            <div key={p._id} className="shrink-0 w-[46%] sm:w-[31%] lg:w-[23.5%] snap-start">
              {renderCard(p)}
            </div>
          ))}
        </div>

        {seeAllTo && (
          <div className="text-center mt-7">
            <Link
              to={seeAllTo}
              className="inline-flex items-center gap-2 h-10 px-6 rounded-full border border-gray-300
                         text-xs font-bold uppercase tracking-wider text-gray-800 hover:border-gray-900 transition"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Editorial split band ──────────────────────────────────────────────────────
/** Image-and-copy feature block, fronted by a real featured product. */
export function EditorialBand({ product, shop, slug }) {
  if (!product) return null;
  const image = product.images?.[0] || product.image;
  const discount = product.discount || 0;
  const finalPrice = product.price * (1 - discount / 100);

  return (
    <section className="bg-[#f4f2ee] py-10 sm:py-14">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 items-center">
          <Link
            to={`/shop/${slug}/product/${product._id}`}
            className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#e8e4dc] group"
          >
            {image ? (
              <img src={image} alt={product.name} loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-12 h-12 text-gray-300" />
              </div>
            )}
          </Link>

          <div className="text-center lg:text-left">
            {product.brand && (
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-2">
                {product.brand}
              </p>
            )}
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">{product.name}</h2>
            {product.description && (
              <p className="text-sm text-gray-600 mt-3 line-clamp-3 max-w-md mx-auto lg:mx-0">
                {product.description}
              </p>
            )}
            <div className="flex items-baseline gap-2.5 mt-4 justify-center lg:justify-start">
              <span className="text-xl font-bold text-gray-900 tabular-nums">
                ₹{Math.round(finalPrice).toLocaleString('en-IN')}
              </span>
              {discount > 0 && (
                <>
                  <span className="text-sm text-gray-400 line-through tabular-nums">
                    ₹{product.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-sm font-bold text-emerald-700">{Math.round(discount)}% off</span>
                </>
              )}
            </div>
            <Link
              to={`/shop/${slug}/product/${product._id}`}
              className="mt-6 inline-flex items-center gap-2 h-11 px-7 bg-gray-900 hover:bg-black text-white
                         text-xs font-bold uppercase tracking-wider transition rounded"
            >
              Shop Now <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Sizes actually purchasable across the whole catalogue, naturally ordered. */
export function useSizeRange(products) {
  return useMemo(() => {
    const set = new Set();
    for (const p of products) {
      if (p.trackVariantStock && p.variantStock?.length) {
        p.variantStock.forEach((v) => { if (v.stock > 0 && v.size) set.add(String(v.size)); });
      } else {
        (p.sizes || []).forEach((s) => set.add(String(s)));
      }
    }
    // Numeric shoe sizes must sort numerically; lettered apparel sizes fall back
    // to a known order so "S, M, L" never renders as "L, M, S".
    const LETTER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    return [...set].sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      const ia = LETTER.indexOf(a.toUpperCase()), ib = LETTER.indexOf(b.toUpperCase());
      if (ia !== -1 && ib !== -1) return ia - ib;
      return a.localeCompare(b);
    });
  }, [products]);
}
