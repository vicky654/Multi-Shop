import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Search, X, Phone, Mail, MapPin, User, Heart,
  Store, ChevronRight, Menu,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore from '../../store/cartStore';
import useWishlistStore from '../../store/wishlistStore';
import ShopBottomNav from '../../components/shop/ShopBottomNav';
import FootwearProductCard, { FootwearCardSkeleton } from '../../components/shop/footwear/FootwearProductCard';
import {
  AnnounceBar, FootwearHero, StyleRail, TrustStrip, TRUST_ICONS,
  BrandStory, SeriesGrid, ProductRail, EditorialBand, useSizeRange,
} from '../../components/shop/footwear/FootwearSections';

/**
 * FootwearShop — brand-led storefront for shops whose type is 'shoes'.
 *
 * Rendered by CustomerShop instead of the generic marketplace layout. A footwear
 * shop sells a curated range where colour, size availability and collection
 * matter more than search-and-filter, so the page is editorial: hero → styles →
 * collections → curated rails, rather than a dense results grid.
 *
 * Everything is driven by the shop's own record and its live catalogue. Where the
 * reference D2C sites show ratings, testimonials and headline claims, this system
 * holds no such data and none is invented — see FootwearSections.jsx.
 */
export default function FootwearShop({ shop, slug, products, productsLoading }) {
  const navigate  = useNavigate();
  const addItem   = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const cartCount = useCartStore((s) => s.getItemCount());
  const wishCount = useWishlistStore((s) => s.ids.length);

  const [searchInput, setSearchInput] = useState('');
  const [navOpen, setNavOpen] = useState(false);

  const all = products;
  const inStock = useMemo(() => all.filter((p) => p.stock > 0), [all]);

  // ── Catalogue slices ───────────────────────────────────────────────────────
  const withImage = useCallback((list) => list.find((p) => p.images?.[0] || p.image), []);

  const categories = useMemo(() => {
    const map = new Map();
    for (const p of all) {
      if (!p.category) continue;
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category).push(p);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, items]) => ({
        name,
        count: items.length,
        image: (withImage(items)?.images?.[0]) || withImage(items)?.image || null,
      }));
  }, [all, withImage]);

  const brands = useMemo(() => {
    const map = new Map();
    for (const p of all) {
      const b = (p.brand || '').trim();
      if (!b) continue;
      if (!map.has(b)) map.set(b, []);
      map.get(b).push(p);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [all]);

  const newArrivals = useMemo(() => all.filter((p) => p.isNewArrival).slice(0, 12), [all]);
  const featured    = useMemo(() => all.filter((p) => p.isFeatured).slice(0, 12), [all]);
  const deals       = useMemo(
    () => all.filter((p) => (p.discount || 0) > 0).sort((a, b) => b.discount - a.discount).slice(0, 12),
    [all]
  );
  const trending    = useMemo(() => all.filter((p) => p.isTrending).slice(0, 12), [all]);

  /** Anything not already surfaced, newest first — so the page never looks thin. */
  const more = useMemo(() => {
    const shown = new Set([...newArrivals, ...featured, ...deals, ...trending].map((p) => p._id));
    return inStock
      .filter((p) => !shown.has(p._id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 12);
  }, [inStock, newArrivals, featured, deals, trending]);

  const sizeRange = useSizeRange(all);

  const colourCount = useMemo(() => {
    const s = new Set();
    all.forEach((p) => (p.colors || []).forEach((c) => c.name && s.add(c.name.toLowerCase())));
    return s.size;
  }, [all]);

  // ── Hero slides, from real content only ────────────────────────────────────
  const heroSlides = useMemo(() => {
    const slides = [];

    if (shop.banner) {
      slides.push({
        image: shop.banner,
        eyebrow: shop.saleBanner?.enabled ? shop.saleBanner.title : 'Now in store',
        title: shop.name,
        subtitle: shop.description || 'Step into the new season.',
        cta: 'Shop the collection',
        to: `/shop/${slug}/products`,
      });
    }

    const heroDeal = deals[0];
    if (heroDeal) {
      slides.push({
        image: heroDeal.images?.[0] || heroDeal.image,
        eyebrow: `${Math.round(heroDeal.discount)}% off`,
        title: heroDeal.name,
        subtitle: heroDeal.description || 'Limited stock at this price.',
        cta: 'Grab the deal',
        to: `/shop/${slug}/product/${heroDeal._id}`,
      });
    }

    const heroNew = newArrivals[0] || featured[0];
    if (heroNew && heroNew._id !== heroDeal?._id) {
      slides.push({
        image: heroNew.images?.[0] || heroNew.image,
        eyebrow: heroNew.isNewArrival ? 'Just landed' : 'Store favourite',
        title: heroNew.name,
        subtitle: heroNew.description || 'Built for everyday comfort.',
        cta: 'Shop now',
        to: `/shop/${slug}/product/${heroNew._id}`,
      });
    }

    return slides.filter((s) => s.image).slice(0, 4);
  }, [shop, slug, deals, newArrivals, featured]);

  /**
   * Trust strip — verifiable facts only.
   * Style count, the real in-stock size range, colour variety and the payment
   * methods the shop has actually configured. No invented customer numbers.
   */
  const trustFacts = useMemo(() => {
    const facts = [];

    if (inStock.length > 0) {
      facts.push({
        icon: TRUST_ICONS.Package,
        title: `${inStock.length} styles in stock`,
        subtitle: categories.length > 1 ? `across ${categories.length} categories` : null,
      });
    }
    if (sizeRange.length > 1) {
      facts.push({
        icon: TRUST_ICONS.Ruler,
        title: `Sizes ${sizeRange[0]}–${sizeRange[sizeRange.length - 1]}`,
        subtitle: `${sizeRange.length} sizes available`,
      });
    }
    if (colourCount > 1) {
      facts.push({
        icon: TRUST_ICONS.Palette,
        title: `${colourCount} colours`,
        subtitle: 'across the range',
      });
    }
    if (shop.upiSettings?.enabled) {
      facts.push({
        icon: TRUST_ICONS.Smartphone,
        title: 'UPI accepted',
        subtitle: 'Pay by scanning at checkout',
      });
    }
    if (facts.length < 4 && shop.phone) {
      facts.push({
        icon: TRUST_ICONS.Store,
        title: 'Order over the phone',
        subtitle: shop.phone,
      });
    }
    return facts.slice(0, 4);
  }, [inStock.length, categories.length, sizeRange, colourCount, shop]);

  /** Collection tiles: brands when the shop uses them, else categories. */
  const series = useMemo(() => {
    const source = brands.length >= 2
      ? brands.map(([name, items]) => ({
          name, count: items.length,
          image: withImage(items)?.images?.[0] || withImage(items)?.image || null,
          to: `/shop/${slug}/products?q=${encodeURIComponent(name)}`,
        }))
      : categories.map((c) => ({
          name: c.name, count: c.count, image: c.image,
          to: `/shop/${slug}/products?category=${encodeURIComponent(c.name)}`,
        }));
    return source.slice(0, 4);
  }, [brands, categories, slug, withImage]);

  const cartQty = useMemo(() => {
    const m = {};
    cartItems.forEach((i) => { m[i.productId] = (m[i.productId] || 0) + i.quantity; });
    return m;
  }, [cartItems]);

  const handleAdd = useCallback((p) => {
    addItem(p);
    toast.success(`${p.name} added to bag`, { duration: 1400 });
  }, [addItem]);

  const submitSearch = (e) => {
    e.preventDefault();
    const term = searchInput.trim();
    navigate(term ? `/shop/${slug}/products?q=${encodeURIComponent(term)}` : `/shop/${slug}/products`);
  };

  const card = (p) => (
    <FootwearProductCard product={p} slug={slug} onAdd={handleAdd} inCart={cartQty[p._id] || 0} />
  );

  // Nav links built from the catalogue, so they always lead somewhere real.
  const navLinks = useMemo(() => [
    { label: 'New', to: `/shop/${slug}/products?sort=newest` },
    ...categories.slice(0, 3).map((c) => ({
      label: c.name,
      to: `/shop/${slug}/products?category=${encodeURIComponent(c.name)}`,
    })),
    ...(deals.length ? [{ label: 'Offers', to: `/shop/${slug}/products?discounted=1&sort=discount` }] : []),
  ], [categories, deals.length, slug]);

  return (
    <div className="min-h-screen bg-white pb-16 md:pb-0">
      <AnnounceBar shop={shop} />

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="h-14 sm:h-16 flex items-center gap-3">
            <button
              onClick={() => setNavOpen((v) => !v)}
              aria-label="Menu"
              className="lg:hidden p-2 -ml-2 text-gray-700"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link to={`/shop/${slug}`} className="flex items-center gap-2 shrink-0 min-w-0">
              {shop.logo
                ? <img src={shop.logo} alt="" className="h-8 w-8 rounded object-cover" />
                : <div className="h-8 w-8 rounded bg-gray-900 flex items-center justify-center">
                    <Store className="w-4 h-4 text-white" />
                  </div>}
              <span className="font-black text-sm sm:text-base uppercase tracking-[0.12em] text-gray-900 truncate max-w-[120px] sm:max-w-none">
                {shop.name}
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-6 ml-8">
              {navLinks.map((l) => (
                <Link
                  key={l.label}
                  to={l.to}
                  className="text-[13px] font-bold uppercase tracking-wide text-gray-700 hover:text-gray-900 transition"
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            <form onSubmit={submitSearch} className="hidden md:block relative ml-auto w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search styles…"
                aria-label="Search products"
                className="w-full h-9 pl-9 pr-3 rounded-full text-sm bg-gray-50 border border-gray-200
                           focus:outline-none focus:border-gray-900 transition"
              />
            </form>

            <div className="flex items-center gap-1 ml-auto md:ml-0 shrink-0">
              <Link to="/login" aria-label="Account"
                className="hidden sm:flex flex-col items-center px-2.5 py-1 text-gray-700 hover:text-gray-900 transition">
                <User className="w-[18px] h-[18px]" />
                <span className="text-[9px] font-bold uppercase tracking-wide mt-0.5">Account</span>
              </Link>
              <Link to={`/shop/${slug}/products`} aria-label={`Wishlist, ${wishCount} saved`}
                className="relative flex flex-col items-center px-2.5 py-1 text-gray-700 hover:text-gray-900 transition">
                <Heart className="w-[18px] h-[18px]" />
                <span className="hidden sm:block text-[9px] font-bold uppercase tracking-wide mt-0.5">Saved</span>
                {wishCount > 0 && (
                  <span className="absolute top-0 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                    {wishCount > 99 ? '99+' : wishCount}
                  </span>
                )}
              </Link>
              <Link to={`/shop/${slug}/cart`} aria-label={`Bag, ${cartCount} items`}
                className="relative flex flex-col items-center px-2.5 py-1 text-gray-700 hover:text-gray-900 transition">
                <ShoppingCart className="w-[18px] h-[18px]" />
                <span className="hidden sm:block text-[9px] font-bold uppercase tracking-wide mt-0.5">Bag</span>
                {cartCount > 0 && (
                  <span className="absolute top-0 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Mobile: nav drawer + search */}
          {navOpen && (
            <nav className="lg:hidden pb-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
              {navLinks.map((l) => (
                <Link
                  key={l.label}
                  to={l.to}
                  onClick={() => setNavOpen(false)}
                  className="px-3 h-9 inline-flex items-center rounded-full bg-gray-50 border border-gray-200
                             text-xs font-bold uppercase tracking-wide text-gray-700"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          )}

          <form onSubmit={submitSearch} className="md:hidden pb-2.5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search styles…"
              aria-label="Search products"
              className="w-full h-10 pl-9 pr-9 rounded-full text-sm bg-gray-50 border border-gray-200 focus:outline-none focus:border-gray-900"
            />
            {searchInput && (
              <button type="button" onClick={() => setSearchInput('')} aria-label="Clear"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>
      </header>

      <StyleRail items={categories.slice(0, 12)} slug={slug} />

      {productsLoading ? (
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-8">
          <div className="h-[300px] sm:h-[420px] rounded-xl bg-gray-100 animate-pulse mb-8" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }, (_, i) => <FootwearCardSkeleton key={i} />)}
          </div>
        </div>
      ) : all.length === 0 ? (
        <div className="py-28 text-center">
          <Store className="w-14 h-14 mx-auto text-gray-200 mb-4" />
          <p className="font-bold text-gray-900">The shelves are being stocked</p>
          <p className="text-sm text-gray-500 mt-1">{shop.name} hasn’t listed anything yet. Check back soon.</p>
        </div>
      ) : (
        <>
          <FootwearHero shop={shop} slides={heroSlides} slug={slug} />
          <TrustStrip facts={trustFacts} />
          <BrandStory shop={shop} />

          <SeriesGrid
            title={brands.length >= 2 ? 'Shop by Brand' : 'Our Collections'}
            series={series}
            slug={slug}
            seeAllTo={`/shop/${slug}/products`}
          />

          <ProductRail
            title="New Launches"
            subtitle="Fresh off the shelf"
            products={newArrivals.length ? newArrivals : more}
            renderCard={card}
            seeAllTo={`/shop/${slug}/products?sort=newest`}
            tone="mint"
          />

          <EditorialBand product={featured[0] || trending[0] || newArrivals[0]} shop={shop} slug={slug} />

          <ProductRail
            title="Best Sellers"
            subtitle="Picked by the store"
            products={featured.length ? featured : trending}
            renderCard={card}
            seeAllTo={`/shop/${slug}/products`}
            tone="sand"
          />

          {deals.length > 0 && (
            <ProductRail
              title="Price Drops"
              subtitle="Biggest savings right now"
              products={deals}
              renderCard={card}
              seeAllTo={`/shop/${slug}/products?discounted=1&sort=discount`}
            />
          )}

          {more.length > 0 && (
            <section className="bg-white py-9 sm:py-12">
              <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8">
                <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-5">More to explore</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {more.map((p) => <div key={p._id}>{card(p)}</div>)}
                </div>
              </div>
            </section>
          )}

          {/* Size guide from the catalogue's real, purchasable sizes. */}
          {sizeRange.length > 2 && (
            <section className="bg-gray-900 py-10 sm:py-12">
              <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h2 className="text-white text-lg sm:text-xl font-bold">Find your size</h2>
                <p className="text-white/50 text-xs sm:text-sm mt-1">
                  Every size below is in stock right now
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-5">
                  {sizeRange.map((s) => (
                    <Link
                      key={s}
                      to={`/shop/${slug}/products?size=${encodeURIComponent(s)}`}
                      className="min-w-[3rem] h-11 px-3 inline-flex items-center justify-center rounded
                                 border border-white/25 text-white text-sm font-bold hover:bg-white hover:text-gray-900 transition"
                    >
                      {s}
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          <div className="bg-white py-10 text-center">
            <Link
              to={`/shop/${slug}/products`}
              className="inline-flex items-center gap-2 h-12 px-8 bg-gray-900 hover:bg-black text-white
                         text-xs font-bold uppercase tracking-wider transition rounded"
            >
              Browse all {all.length} styles <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </>
      )}

      <FootwearFooter shop={shop} slug={slug} categories={categories} />

      <ShopBottomNav
        slug={slug}
        cartCount={cartCount}
        onSearch={() => document.querySelector('input[aria-label="Search products"]')?.focus()}
        onCategories={() => navigate(`/shop/${slug}/products`)}
      />
    </div>
  );
}

function FootwearFooter({ shop, slug, categories }) {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              {shop.logo
                ? <img src={shop.logo} alt="" className="h-9 w-9 rounded object-cover" />
                : <div className="h-9 w-9 rounded bg-white/10 flex items-center justify-center">
                    <Store className="w-4 h-4 text-white" />
                  </div>}
              <span className="font-black uppercase tracking-[0.12em] text-sm">{shop.name}</span>
            </div>
            {shop.description && (
              <p className="text-white/50 text-xs leading-relaxed max-w-xs">{shop.description}</p>
            )}
          </div>

          {categories.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-3">Shop</p>
              <ul className="space-y-2">
                {categories.slice(0, 5).map((c) => (
                  <li key={c.name}>
                    <Link
                      to={`/shop/${slug}/products?category=${encodeURIComponent(c.name)}`}
                      className="text-sm text-white/70 hover:text-white transition"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-3">Reach us</p>
            <ul className="space-y-2 text-sm text-white/70">
              {shop.phone && (
                <li><a href={`tel:${shop.phone}`} className="flex items-center gap-2 hover:text-white transition">
                  <Phone className="w-3.5 h-3.5" /> {shop.phone}
                </a></li>
              )}
              {shop.email && (
                <li><a href={`mailto:${shop.email}`} className="flex items-center gap-2 hover:text-white transition">
                  <Mail className="w-3.5 h-3.5" /> {shop.email}
                </a></li>
              )}
              {shop.address && (
                <li className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {shop.address}</li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          {shop.gstNumber && (
            <p className="text-[11px] text-white/35">GSTIN: {shop.gstNumber}</p>
          )}
          <p className="text-[11px] text-white/35">Powered by MultiShop</p>
        </div>
      </div>
    </footer>
  );
}
