import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Zap, ChevronLeft, ChevronRight, Timer } from 'lucide-react';

/**
 * Countdown — ticks down to a real end time.
 *
 * The end time comes from the shop's own saleBanner.endDate when set; the caller
 * decides the fallback. We never invent an urgency timer for a sale that has no
 * configured end date — see FlashSaleSection.
 */
function Countdown({ endsAt }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, endsAt - Date.now()));

  useEffect(() => {
    const t = setInterval(() => setRemaining(Math.max(0, endsAt - Date.now())), 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  if (remaining <= 0) return null;

  const s = Math.floor(remaining / 1000);
  const parts = [
    { v: Math.floor(s / 3600), l: 'HRS' },
    { v: Math.floor((s % 3600) / 60), l: 'MIN' },
    { v: s % 60, l: 'SEC' },
  ];

  return (
    <div className="flex items-center gap-1.5" role="timer" aria-label="Sale ends in">
      <Timer className="w-3.5 h-3.5 text-[var(--color-danger)]" />
      {parts.map((p, i) => (
        <span key={p.l} className="flex items-center gap-1.5">
          <span className="px-1.5 py-1 rounded-md bg-[var(--color-text)] text-[var(--color-card)] text-[11px] font-black tabular-nums leading-none">
            {String(p.v).padStart(2, '0')}
          </span>
          {i < parts.length - 1 && <span className="text-[var(--color-text-muted)] font-bold">:</span>}
        </span>
      ))}
    </div>
  );
}

/**
 * FlashSaleSection — deals rail with an optional live countdown.
 *
 * The countdown only appears when the shop has configured a sale end date
 * (Settings → Sale Banner). Without one the section still shows the deals, just
 * without a fabricated deadline.
 */
export function FlashSaleSection({ products, slug, renderCard, saleEndsAt }) {
  const railRef = useRef(null);
  if (!products.length) return null;

  const nudge = (dir) => {
    const el = railRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const endsAt = saleEndsAt ? new Date(saleEndsAt).getTime() : null;
  const live = endsAt && endsAt > Date.now();

  return (
    <section className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-[var(--color-danger)] flex items-center justify-center shrink-0">
            <Zap className="w-[18px] h-[18px] text-white" fill="currentColor" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] truncate">Flash Sale</h2>
            <p className="text-xs text-[var(--color-text-muted)]">Biggest discounts in store</p>
          </div>
          {live && <div className="hidden sm:block ml-2"><Countdown endsAt={endsAt} /></div>}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="hidden sm:flex gap-1">
            <button onClick={() => nudge(-1)} aria-label="Scroll left"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition active:scale-90">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => nudge(1)} aria-label="Scroll right"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition active:scale-90">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <Link to={`/shop/${slug}/products?discounted=1&sort=discount`}
            className="h-9 px-3 inline-flex items-center gap-1 rounded-lg text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-bg)] transition">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {live && (
        <div className="sm:hidden px-4 py-2 border-b border-[var(--color-border)] flex items-center gap-2">
          <span className="text-xs font-bold text-[var(--color-text-secondary)]">Ends in</span>
          <Countdown endsAt={endsAt} />
        </div>
      )}

      <div ref={railRef} className="flex gap-3 sm:gap-4 overflow-x-auto snap-x scrollbar-none p-4 sm:p-5" style={{ scrollbarWidth: 'none' }}>
        {products.map(renderCard)}
      </div>
    </section>
  );
}

/**
 * TabbedSection — "Today's For You" with filter tabs.
 *
 * Tabs are derived from the catalogue, and a tab is only offered when it
 * actually has products behind it, so a shopper never lands on an empty tab.
 */
export function TabbedSection({ title, tabs, slug, renderCard, gridClass }) {
  const available = useMemo(() => tabs.filter((t) => t.items.length > 0), [tabs]);
  const [active, setActive] = useState(0);

  useEffect(() => { setActive(0); }, [available.length]);

  if (!available.length) return null;
  const current = available[Math.min(active, available.length - 1)];

  return (
    <section className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <header className="px-4 sm:px-5 py-3.5 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] truncate">{title}</h2>
          <Link to={current.seeAllTo || `/shop/${slug}/products`}
            className="h-9 px-3 shrink-0 inline-flex items-center gap-1 rounded-lg text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-bg)] transition">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div role="tablist" className="flex gap-2 overflow-x-auto scrollbar-none mt-3 -mb-0.5">
          {available.map((t, i) => (
            <button
              key={t.label}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={`shrink-0 h-9 px-3.5 rounded-lg text-xs font-bold transition ${
                i === active
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 font-medium ${i === active ? 'text-white/70' : 'text-[var(--color-text-muted)]'}`}>
                {t.items.length}
              </span>
            </button>
          ))}
        </div>
      </header>

      <div className="p-4 sm:p-5">
        <div className={gridClass}>{current.items.map(renderCard)}</div>
      </div>
    </section>
  );
}

/**
 * PromoStrip — a slim promotional banner for between sections.
 * Renders only when the shop has a sale banner configured, so no invented ads.
 */
export function PromoStrip({ shop, slug }) {
  const b = shop?.saleBanner;
  if (!b?.enabled || !b.title) return null;

  return (
    <Link
      to={`/shop/${slug}/products?discounted=1`}
      className="block relative overflow-hidden rounded-2xl bg-[var(--color-primary)] group"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]" />
      <div className="relative flex items-center justify-between gap-4 px-5 sm:px-8 py-5 sm:py-6">
        <div className="min-w-0">
          {b.discount && (
            <span className="inline-block mb-1.5 px-2 py-0.5 rounded-md bg-[var(--color-warning)] text-white text-[11px] font-black">
              {b.discount}
            </span>
          )}
          <p className="text-white font-extrabold text-lg sm:text-2xl leading-tight truncate">{b.title}</p>
          {b.subtitle && <p className="text-white/80 text-sm mt-0.5 truncate">{b.subtitle}</p>}
        </div>
        <span className="shrink-0 h-10 px-5 inline-flex items-center rounded-xl bg-white text-[var(--color-text)] text-sm font-bold group-hover:scale-105 transition">
          Shop now
        </span>
      </div>
    </Link>
  );
}
