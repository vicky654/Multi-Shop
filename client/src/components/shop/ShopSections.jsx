import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Package, Tag } from 'lucide-react';

/**
 * Marketplace building blocks for the storefront.
 *
 * All horizontal scrolling uses native CSS scroll-snap rather than a carousel
 * library — it is swipeable on touch, keyboard accessible, and adds no bundle
 * weight or layout thrash.
 */

// ── Promotional carousel ─────────────────────────────────────────────────────
/**
 * Slides are built from the shop's own data (banner, sale banner, top deal), so
 * nothing is invented: if a shop has no promo content, this renders nothing
 * instead of a placeholder advert.
 */
export function PromoCarousel({ shop, topDeal, slug }) {
  const slides = [];

  if (shop?.saleBanner?.enabled && shop.saleBanner.title) {
    slides.push({
      key: 'sale',
      title:    shop.saleBanner.title,
      subtitle: shop.saleBanner.subtitle || '',
      badge:    shop.saleBanner.discount || '',
      to:       `/shop/${slug}/products?discounted=1`,
      image:    shop.banner || '',
    });
  }
  if (topDeal) {
    const off = topDeal.discount || 0;
    slides.push({
      key: 'deal',
      title:    topDeal.name,
      subtitle: off > 0 ? `Save ${off}% today` : 'Featured pick',
      badge:    off > 0 ? `${off}% OFF` : 'FEATURED',
      to:       `/shop/${slug}/product/${topDeal._id}`,
      image:    topDeal.images?.[0] || topDeal.image || '',
    });
  }
  if (shop?.banner && !slides.length) {
    slides.push({
      key: 'banner',
      title:    shop.name,
      subtitle: shop.description || '',
      to:       `/shop/${slug}/products`,
      image:    shop.banner,
    });
  }

  const [index, setIndex] = useState(0);
  const trackRef = useRef(null);
  const count = slides.length;

  const goTo = useCallback((i) => {
    const next = (i + count) % count;
    setIndex(next);
    const el = trackRef.current;
    if (el) el.scrollTo({ left: el.clientWidth * next, behavior: 'smooth' });
  }, [count]);

  // Auto-advance, paused while the tab is hidden
  useEffect(() => {
    if (count < 2) return;
    const t = setInterval(() => {
      if (!document.hidden) goTo(index + 1);
    }, 5000);
    return () => clearInterval(t);
  }, [index, count, goTo]);

  if (!count) return null;

  return (
    <section className="relative">
      <div
        ref={trackRef}
        onScroll={(e) => {
          const i = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth);
          if (i !== index) setIndex(i);
        }}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none rounded-2xl"
        style={{ scrollbarWidth: 'none' }}
      >
        {slides.map((s) => (
          <Link
            key={s.key}
            to={s.to}
            className="relative shrink-0 w-full snap-center overflow-hidden
                       h-[190px] sm:h-[240px] lg:h-[300px] bg-[var(--color-bg)]"
          >
            {s.image && (
              <img src={s.image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
            <div className="relative h-full flex flex-col justify-center px-6 sm:px-10 lg:px-14 max-w-2xl">
              {s.badge && (
                <span className="self-start mb-2 px-2.5 py-1 rounded-lg bg-[var(--color-warning)] text-white text-[11px] font-black">
                  {s.badge}
                </span>
              )}
              <h2 className="text-white text-xl sm:text-3xl lg:text-4xl font-extrabold leading-tight line-clamp-2">
                {s.title}
              </h2>
              {s.subtitle && (
                <p className="text-white/85 text-sm sm:text-base mt-1.5 line-clamp-2">{s.subtitle}</p>
              )}
              <span className="self-start mt-4 h-10 px-5 inline-flex items-center rounded-xl bg-white text-[var(--color-text)] text-sm font-bold">
                Shop now
              </span>
            </div>
          </Link>
        ))}
      </div>

      {count > 1 && (
        <>
          <CarouselArrow side="left"  onClick={() => goTo(index - 1)} />
          <CarouselArrow side="right" onClick={() => goTo(index + 1)} />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.key}
                aria-label={`Slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CarouselArrow({ side, onClick }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous slide' : 'Next slide'}
      className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 ${side === 'left' ? 'left-3' : 'right-3'}
                  w-10 h-10 items-center justify-center rounded-full bg-white/90 hover:bg-white
                  text-[var(--color-text)] shadow-lg transition active:scale-90`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

// ── Category strip ───────────────────────────────────────────────────────────
/** Horizontal category navigation — the marketplace row under the header. */
export function CategoryStrip({ categories, slug, active }) {
  if (!categories.length) return null;
  return (
    <nav
      aria-label="Product categories"
      className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden"
    >
      <div>
        <ul className="flex gap-1 sm:gap-2 overflow-x-auto scrollbar-none py-2.5">
          <li>
            <Link
              to={`/shop/${slug}/products`}
              className={`shrink-0 flex flex-col items-center gap-1 px-3 sm:px-4 py-1.5 rounded-xl transition
                          ${!active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]'}`}
            >
              <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[var(--color-primary-bg)] flex items-center justify-center">
                <Package className="w-5 h-5 text-[var(--color-primary)]" />
              </span>
              <span className="text-[11px] sm:text-xs font-semibold whitespace-nowrap">All</span>
            </Link>
          </li>
          {categories.map((cat) => (
            <li key={cat}>
              <Link
                to={`/shop/${slug}/products?category=${encodeURIComponent(cat)}`}
                className={`shrink-0 flex flex-col items-center gap-1 px-3 sm:px-4 py-1.5 rounded-xl transition
                            ${active === cat ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]'}`}
              >
                <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center">
                  <Tag className="w-[18px] h-[18px]" />
                </span>
                <span className="text-[11px] sm:text-xs font-semibold whitespace-nowrap max-w-[5.5rem] truncate">
                  {cat}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

// ── Section shell ────────────────────────────────────────────────────────────
/**
 * A titled marketplace section. `rail` renders a swipeable single row (used on
 * mobile and for curated strips); otherwise a wrapping grid.
 */
export function ShopSection({ title, subtitle, seeAllTo, children, rail = false }) {
  const railRef = useRef(null);
  const nudge = (dir) => {
    const el = railRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[var(--color-border)]">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] truncate">{title}</h2>
          {subtitle && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {rail && (
            <div className="hidden sm:flex gap-1">
              <RailBtn dir={-1} onClick={() => nudge(-1)} />
              <RailBtn dir={1}  onClick={() => nudge(1)} />
            </div>
          )}
          {seeAllTo && (
            <Link
              to={seeAllTo}
              className="h-9 px-3 inline-flex items-center gap-1 rounded-lg text-xs font-bold
                         text-[var(--color-primary)] hover:bg-[var(--color-primary-bg)] transition"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </header>

      {rail ? (
        <div
          ref={railRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto snap-x scrollbar-none p-4 sm:p-5"
          style={{ scrollbarWidth: 'none' }}
        >
          {children}
        </div>
      ) : (
        <div className="p-4 sm:p-5">{children}</div>
      )}
    </section>
  );
}

function RailBtn({ dir, onClick }) {
  const Icon = dir < 0 ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={dir < 0 ? 'Scroll left' : 'Scroll right'}
      className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--color-border)]
                 text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]
                 transition active:scale-90"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
