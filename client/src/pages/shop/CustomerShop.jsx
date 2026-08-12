import { useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart, Store, Search, X, Phone, Mail, MapPin,
  ArrowLeft, Package, User, ChevronRight, Heart, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { shopApi } from '../../api/shop.api';
import useCartStore from '../../store/cartStore';
import ShopProductCard, { ShopProductGridSkeleton, ShopProductCardSkeleton } from '../../components/shop/ShopProductCard';
import ShopBottomNav from '../../components/shop/ShopBottomNav';
import { PromoCarousel, CategoryStrip, ShopSection } from '../../components/shop/ShopSections';
import { FlashSaleSection, TabbedSection, PromoStrip } from '../../components/shop/FlashAndTabs';
import useWishlistStore from '../../store/wishlistStore';
import FootwearShop from './FootwearShop';

/**
 * Shop types that get the brand-led editorial storefront instead of the generic
 * marketplace grid. A footwear range is browsed by collection, colour and size
 * rather than searched, so the layout differs enough to warrant its own page.
 */
const EDITORIAL_TYPES = new Set(['shoes']);

const GRID = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4';
/** Rail cards need an explicit width — they sit in a horizontal flex scroller. */
const RAIL_ITEM = 'shrink-0 w-[45%] sm:w-[30%] lg:w-[19%] xl:w-[16%] snap-start';

/**
 * CustomerShop — marketplace home for /shop/:slug
 *
 * Structure: Header+Search → Categories → Promo carousel → Deals → New arrivals
 * → Category sections → Recommended → Footer.
 *
 * Search and category taps route to /shop/:slug/products (the listing step) so
 * filtering/sorting lives in exactly one place instead of being duplicated here.
 */
export default function CustomerShop() {
  const { slug }  = useParams();
  const navigate  = useNavigate();
  const addItem   = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const cartCount = useCartStore((s) => s.getItemCount());

  const wishCount = useWishlistStore((s) => s.ids.length);

  const [searchInput, setSearchInput] = useState('');
  const [headerCategory, setHeaderCategory] = useState('');

  const { data: shopData, isLoading: shopLoading, isError: shopError } = useQuery({
    queryKey: ['public-shop-slug', slug],
    queryFn:  () => shopApi.getShopBySlug(slug),
    staleTime: 5 * 60 * 1000,
  });

  const shop   = shopData?.data?.shop;
  const shopId = shop?._id;

  const { data: productData, isLoading: productsLoading } = useQuery({
    queryKey: ['public-shop-products', shopId, '', ''],
    queryFn:  () => shopApi.getProducts({ shopId, limit: 200 }),
    enabled: !!shopId,
    staleTime: 3 * 60 * 1000,
  });

  const all = productData?.data || [];

  // Other public shops for the "Explore stores" section — real data only.
  const { data: shopsData } = useQuery({
    queryKey: ['public-shops-all'],
    queryFn:  () => shopApi.getShops(),
    staleTime: 10 * 60 * 1000,
  });
  const otherShops = useMemo(
    () => (shopsData?.data?.shops || []).filter((s) => s.slug && s.slug !== slug).slice(0, 8),
    [shopsData, slug]
  );

  const categories = useMemo(() => {
    const s = new Set();
    all.forEach((p) => p.category && s.add(p.category));
    return [...s].sort();
  }, [all]);

  const deals       = useMemo(() => all.filter((p) => (p.discount || 0) > 0)
                        .sort((a, b) => b.discount - a.discount).slice(0, 12), [all]);
  const newArrivals = useMemo(() => all.filter((p) => p.isNewArrival).slice(0, 12), [all]);
  const trending    = useMemo(() => all.filter((p) => p.isTrending).slice(0, 12), [all]);

  /** Recommended = in-stock items not already surfaced above, newest first. */
  const recommended = useMemo(() => {
    const shown = new Set([...deals, ...newArrivals, ...trending].map((p) => p._id));
    return all
      .filter((p) => p.stock > 0 && !shown.has(p._id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 12);
  }, [all, deals, newArrivals, trending]);

  /** Per-category strips, biggest categories first. */
  const categorySections = useMemo(() => {
    const byCat = {};
    all.forEach((p) => {
      if (!p.category) return;
      (byCat[p.category] ||= []).push(p);
    });
    return Object.entries(byCat)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4)
      .map(([name, items]) => ({ name, items: items.slice(0, 12) }));
  }, [all]);

  /** Best sellers: no sales-per-product field is exposed publicly, so this uses
   *  the shop-curated isFeatured flag rather than inventing popularity data. */
  const bestSellers = useMemo(() => all.filter((p) => p.isFeatured).slice(0, 12), [all]);

  const cartQty = useMemo(() => {
    const m = {};
    cartItems.forEach((i) => { m[i.productId] = (m[i.productId] || 0) + i.quantity; });
    return m;
  }, [cartItems]);

  const handleAdd = useCallback((p) => {
    addItem(p);
    toast.success(`${p.name} added to cart`, { duration: 1400 });
  }, [addItem]);

  const submitSearch = (e) => {
    e.preventDefault();
    const term = searchInput.trim();
    navigate(term ? `/shop/${slug}/products?q=${encodeURIComponent(term)}` : `/shop/${slug}/products`);
  };

  if (shopLoading) return <ShopBootSkeleton />;

  if (shopError || !shop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg)] p-6 text-center">
        <Store className="w-16 h-16 text-[var(--color-text-disabled)] mb-4" />
        <h1 className="text-xl font-bold text-[var(--color-text)]">Shop not found</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1.5 max-w-sm">
          “{slug}” doesn’t exist or is no longer active.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-6 inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-[var(--color-border)]
                     text-[var(--color-text-secondary)] font-semibold hover:bg-[var(--color-card)] transition"
        >
          <ArrowLeft className="w-4 h-4" /> Go back
        </button>
      </div>
    );
  }

  // A shoe shop gets the editorial storefront. Delegated after the shop has
  // loaded (its `type` is what decides) and after the not-found guard, so both
  // layouts share one fetch, one error path and one loading skeleton.
  if (EDITORIAL_TYPES.has(shop.type)) {
    return (
      <FootwearShop
        shop={shop}
        slug={slug}
        products={all}
        productsLoading={productsLoading}
      />
    );
  }

  const rail = (items) => items.map((p) => (
    <div key={p._id} className={RAIL_ITEM}>
      <ShopProductCard product={p} slug={slug} onAdd={handleAdd} inCart={cartQty[p._id] || 0} />
    </div>
  ));

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-16 md:pb-0">
      {/* ── Header — compact light e-commerce bar (not a coloured SaaS band) ── */}
      <header className="sticky top-0 z-40 bg-[var(--color-card)] border-b border-[var(--color-border)] shadow-sm">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="h-14 sm:h-16 flex items-center gap-2 sm:gap-4">
            <Link to={`/shop/${slug}`} className="flex items-center gap-2 shrink-0 min-w-0">
              {shop.logo ? (
                <img src={shop.logo} alt="" className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg object-cover" />
              ) : (
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
                  <Store className="w-[18px] h-[18px] text-white" />
                </div>
              )}
              <span className="font-extrabold text-[15px] sm:text-base text-[var(--color-text)] truncate max-w-[100px] sm:max-w-[180px]">
                {shop.name}
              </span>
            </Link>

            {/* Search cluster: category dropdown + large input, as in the reference */}
            <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-3xl items-stretch">
              <div className="relative shrink-0">
                <select
                  value={headerCategory}
                  onChange={(e) => {
                    const c = e.target.value;
                    setHeaderCategory(c);
                    navigate(c ? `/shop/${slug}/products?category=${encodeURIComponent(c)}` : `/shop/${slug}/products`);
                  }}
                  aria-label="Filter by category"
                  className="h-11 pl-3.5 pr-8 rounded-l-xl text-sm font-semibold appearance-none cursor-pointer
                             bg-[var(--color-bg)] text-[var(--color-text-secondary)]
                             border border-r-0 border-[var(--color-border)] focus:outline-none"
                >
                  <option value="">All Category</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search product or brand here…"
                  aria-label="Search products"
                  className="w-full h-11 pl-10 pr-24 rounded-r-xl text-sm bg-[var(--color-bg)] text-[var(--color-text)]
                             border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)] transition"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1.5 h-8 px-4 rounded-lg bg-[var(--color-primary)] text-white text-xs font-bold
                             hover:bg-[var(--color-primary-hover)] transition"
                >
                  Search
                </button>
              </div>
            </form>

            <div className="flex items-center gap-0.5 sm:gap-1 ml-auto shrink-0">
              <Link to="/login"
                className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3 rounded-lg text-sm font-semibold
                           text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] transition">
                <User className="w-4 h-4" /> Login
              </Link>
              <Link to={`/shop/${slug}/products`} aria-label={`Wishlist, ${wishCount} saved`} title="Saved items"
                className="relative inline-flex items-center h-10 px-2.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] transition">
                <Heart className="w-5 h-5" />
                {wishCount > 0 && (
                  <span className="absolute top-1 right-0.5 min-w-[1.05rem] h-[1.05rem] px-1 rounded-full bg-[var(--color-danger)] text-white text-[10px] font-black flex items-center justify-center">
                    {wishCount > 99 ? '99+' : wishCount}
                  </span>
                )}
              </Link>
              <Link to={`/shop/${slug}/cart`} aria-label={`Cart, ${cartCount} items`}
                className="relative inline-flex items-center gap-1.5 h-10 px-2.5 sm:px-3 rounded-lg text-sm font-semibold
                           text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] transition">
                <span className="relative">
                  <ShoppingCart className="w-5 h-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[1.05rem] h-[1.05rem] px-1 rounded-full bg-[var(--color-danger)] text-white text-[10px] font-black flex items-center justify-center">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </span>
                <span className="hidden lg:inline">Cart</span>
              </Link>
            </div>
          </div>

          {/* Mobile search row */}
          <form onSubmit={submitSearch} className="md:hidden pb-2.5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              className="w-full h-10 pl-10 pr-9 rounded-xl text-sm bg-[var(--color-bg)] text-[var(--color-text)]
                         border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
            />
            {searchInput && (
              <button type="button" onClick={() => setSearchInput('')} aria-label="Clear"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>
      </header>

      {/* ── Body: banner first, then category icons (reference order) ── */}
      <main className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-4 sm:pb-6 space-y-3 sm:space-y-4">
        <PromoCarousel shop={shop} topDeal={deals[0]} slug={slug} />
        <CategoryStrip categories={categories} slug={slug} />

        {productsLoading ? (
          <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-4 sm:p-5">
            <ShopProductGridSkeleton count={10} />
          </div>
        ) : all.length === 0 ? (
          <div className="py-24 text-center bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)]">
            <Package className="w-14 h-14 mx-auto text-[var(--color-text-disabled)] mb-3" />
            <p className="font-bold text-[var(--color-text)]">No products yet</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">This shop hasn’t added anything. Check back soon.</p>
          </div>
        ) : (
          <>
            {/* 4 — Flash sale with live countdown (when the shop set an end date) */}
            <FlashSaleSection
              products={deals}
              slug={slug}
              renderCard={(p) => (
                <div key={p._id} className={RAIL_ITEM}>
                  <ShopProductCard product={p} slug={slug} onAdd={handleAdd} inCart={cartQty[p._id] || 0} />
                </div>
              )}
              saleEndsAt={shop.saleBanner?.enabled ? shop.saleBanner?.endDate : null}
            />

            {/* 5 — Today's For You, with filter tabs */}
            <TabbedSection
              title="Today’s For You"
              slug={slug}
              gridClass={GRID}
              tabs={[
                { label: 'Best Sellers', items: bestSellers,  seeAllTo: `/shop/${slug}/products` },
                { label: 'New Arrivals', items: newArrivals,  seeAllTo: `/shop/${slug}/products?sort=newest` },
                { label: 'Discounts',    items: deals,        seeAllTo: `/shop/${slug}/products?discounted=1&sort=discount` },
                { label: 'Trending',     items: trending,     seeAllTo: `/shop/${slug}/products` },
                { label: 'Recommended',  items: recommended,  seeAllTo: `/shop/${slug}/products` },
              ]}
              renderCard={(p) => (
                <ShopProductCard key={p._id} product={p} slug={slug} onAdd={handleAdd} inCart={cartQty[p._id] || 0} />
              )}
            />

            {/* 8 — promotional banner between sections */}
            <PromoStrip shop={shop} slug={slug} />

            {/* 6 — category sections as horizontal carousels */}
            {categorySections.map(({ name, items }) => (
              <ShopSection
                key={name}
                title={name}
                subtitle={`${items.length} item${items.length === 1 ? '' : 's'}`}
                rail
                seeAllTo={`/shop/${slug}/products?category=${encodeURIComponent(name)}`}
              >
                {rail(items)}
              </ShopSection>
            ))}

            {/* 7 — featured / best selling highlights */}
            {bestSellers.length > 0 && (
              <ShopSection title="Featured by the store" subtitle="Hand-picked selections" rail
                seeAllTo={`/shop/${slug}/products`}>
                {rail(bestSellers)}
              </ShopSection>
            )}

            {recommended.length > 0 && (
              <ShopSection title="Recommended for you" seeAllTo={`/shop/${slug}/products`}>
                <div className={GRID}>
                  {recommended.map((p) => (
                    <ShopProductCard key={p._id} product={p} slug={slug} onAdd={handleAdd} inCart={cartQty[p._id] || 0} />
                  ))}
                </div>
              </ShopSection>
            )}

            {/* Stores section — real shops from /shops/public. Titled "Explore
                stores" rather than "Best selling" because no cross-shop sales
                ranking is exposed publicly and inventing one would be fiction. */}
            {otherShops.length > 0 && (
              <ShopSection title="Explore stores" subtitle="More shops on MultiShop">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {otherShops.map((s) => (
                    <Link
                      key={s._id}
                      to={`/shop/${s.slug}`}
                      className="group flex items-center gap-3 p-3.5 rounded-xl border border-[var(--color-border)]
                                 bg-[var(--color-bg)] hover:border-[var(--color-primary)] hover:shadow-md transition"
                    >
                      {s.logo ? (
                        <img src={s.logo} alt="" loading="lazy" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[var(--color-primary-bg)] flex items-center justify-center shrink-0">
                          <Store className="w-5 h-5 text-[var(--color-primary)]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--color-text)] truncate group-hover:text-[var(--color-primary)] transition-colors">
                          {s.name}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] capitalize truncate">
                          {s.type ? `${s.type} store` : 'Store'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] ml-auto shrink-0" />
                    </Link>
                  ))}
                </div>
              </ShopSection>
            )}

            {/* Full-width dark promotional band */}
            <section className="relative overflow-hidden rounded-2xl bg-[var(--color-text)] px-6 sm:px-10 py-10 sm:py-14 text-center">
              <h2 className="text-white text-xl sm:text-3xl font-extrabold tracking-tight">
                “Shop {shop.name} with confidence”
              </h2>
              <p className="text-white/60 text-sm mt-2 max-w-xl mx-auto">
                {shop.description || 'Browse the full catalogue and order in a few taps.'}
              </p>
              <Link
                to={`/shop/${slug}/products`}
                className="mt-6 inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-white text-[var(--color-text)] font-bold
                           hover:scale-105 transition active:scale-95"
              >
                Browse all products <ChevronRight className="w-4 h-4" />
              </Link>
            </section>

            <Link
              to={`/shop/${slug}/products`}
              className="flex items-center justify-center gap-2 h-14 rounded-2xl bg-[var(--color-card)]
                         border border-[var(--color-border)] font-bold text-[var(--color-primary)]
                         hover:border-[var(--color-primary)] transition"
            >
              Browse all {all.length} products <ChevronRight className="w-4 h-4" />
            </Link>
          </>
        )}
      </main>

      <Footer shop={shop} />

      <ShopBottomNav
        slug={slug}
        cartCount={cartCount}
        onSearch={() => document.querySelector('input[aria-label="Search products"]')?.focus()}
        onCategories={() => navigate(`/shop/${slug}/products`)}
      />
    </div>
  );
}

function Footer({ shop }) {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-card)] mt-6">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
        {shop.logo ? (
          <img src={shop.logo} alt="" className="w-11 h-11 rounded-xl object-cover mx-auto mb-3" />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-3">
            <Store className="w-5 h-5 text-white" />
          </div>
        )}
        <p className="font-bold text-[var(--color-text)]">{shop.name}</p>
        {shop.description && (
          <p className="text-sm text-[var(--color-text-muted)] mt-1.5 max-w-xl mx-auto">{shop.description}</p>
        )}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-4 text-sm text-[var(--color-text-secondary)]">
          {shop.phone && (
            <a href={`tel:${shop.phone}`} className="flex items-center gap-1.5 hover:text-[var(--color-primary)] transition">
              <Phone className="w-4 h-4" /> {shop.phone}
            </a>
          )}
          {shop.email && (
            <a href={`mailto:${shop.email}`} className="flex items-center gap-1.5 hover:text-[var(--color-primary)] transition">
              <Mail className="w-4 h-4" /> {shop.email}
            </a>
          )}
          {shop.address && (
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {shop.address}</span>
          )}
        </div>
        <p className="text-xs text-[var(--color-text-disabled)] mt-6">Powered by MultiShop</p>
      </div>
    </footer>
  );
}

/** Boot skeleton mirroring the marketplace layout — no jump when data lands. */
function ShopBootSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="h-14 sm:h-16 bg-[var(--color-card)] border-b border-[var(--color-border)]" />
      <div className="h-[86px] bg-[var(--color-card)] border-b border-[var(--color-border)]" />
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
        <div className="h-40 sm:h-56 lg:h-72 rounded-2xl bg-[var(--color-border-light)] animate-pulse" />
        <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
            <div className="h-4 w-40 rounded bg-[var(--color-bg)] animate-pulse" />
          </div>
          <div className="flex gap-4 p-5 overflow-hidden">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="shrink-0 w-[45%] sm:w-[30%] lg:w-[19%] xl:w-[16%]">
                <ShopProductCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
