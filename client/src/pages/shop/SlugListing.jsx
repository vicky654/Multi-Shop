import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, X, SlidersHorizontal, Store, ArrowLeft, ShoppingCart,
  Package, Check, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { shopApi } from '../../api/shop.api';
import useCartStore from '../../store/cartStore';
import ShopProductCard, { ShopProductGridSkeleton } from '../../components/shop/ShopProductCard';
import ShopBottomNav from '../../components/shop/ShopBottomNav';

const PAGE = 24;
const GRID = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4';

const SORTS = [
  { value: '',           label: 'Relevance'         },
  { value: 'price_asc',  label: 'Price — low to high' },
  { value: 'price_desc', label: 'Price — high to low' },
  { value: 'discount',   label: 'Discount'          },
  { value: 'newest',     label: 'Newest first'      },
];

/**
 * SlugListing — /shop/:slug/products
 *
 * The marketplace listing step that was missing from the flow: browse the full
 * catalogue with filters and sort, rather than only the curated home sections.
 * Filter state lives in the URL so a filtered view is shareable and survives
 * back/forward navigation.
 */
export default function SlugListing() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const addItem   = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const cartCount = useCartStore((s) => s.getItemCount());

  const category   = params.get('category')   || '';
  const q          = params.get('q')          || '';
  const sort       = params.get('sort')       || '';
  const maxPrice   = params.get('maxPrice')   || '';
  const size       = params.get('size')       || '';
  const discounted = params.get('discounted') === '1';
  const inStock    = params.get('inStock')    === '1';

  const [searchInput, setSearchInput] = useState(q);
  const [visible, setVisible] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => { setSearchInput(q); }, [q]);
  useEffect(() => { setVisible(PAGE); }, [category, q, sort, maxPrice, size, discounted, inStock]);
  useEffect(() => {
    document.body.style.overflow = filtersOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [filtersOpen]);

  const setParam = useCallback((key, value) => {
    const next = new URLSearchParams(params);
    if (value === '' || value == null || value === false) next.delete(key);
    else next.set(key, value === true ? '1' : value);
    setParams(next, { replace: true });
  }, [params, setParams]);

  const { data: shopData } = useQuery({
    queryKey: ['public-shop-slug', slug],
    queryFn:  () => shopApi.getShopBySlug(slug),
    staleTime: 5 * 60 * 1000,
  });
  const shop   = shopData?.data?.shop;
  const shopId = shop?._id;

  const { data, isLoading } = useQuery({
    queryKey: ['public-shop-products', shopId, q, category],
    queryFn:  () => shopApi.getProducts({
      shopId, search: q || undefined, category: category || undefined, limit: 200,
    }),
    enabled: !!shopId,
    staleTime: 3 * 60 * 1000,
    keepPreviousData: true,
  });

  const all = data?.data || [];

  const categories = useMemo(() => {
    const s = new Set();
    all.forEach((p) => p.category && s.add(p.category));
    return [...s].sort();
  }, [all]);

  const priceCeiling = useMemo(
    () => Math.max(1000, ...all.map((p) => Math.ceil(p.price))),
    [all]
  );

  const fp = (p) => p.price * (1 - (p.discount || 0) / 100);

  /** Purchasable sizes across the fetched set, numerically then alphabetically. */
  const availableSizes = useMemo(() => {
    const set = new Set();
    for (const p of all) {
      if (p.trackVariantStock && p.variantStock?.length) {
        p.variantStock.forEach((v) => { if (v.stock > 0 && v.size) set.add(String(v.size)); });
      } else {
        (p.sizes || []).forEach((s) => set.add(String(s)));
      }
    }
    const LETTER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    return [...set].sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      const ia = LETTER.indexOf(a.toUpperCase()), ib = LETTER.indexOf(b.toUpperCase());
      if (ia !== -1 && ib !== -1) return ia - ib;
      return a.localeCompare(b);
    });
  }, [all]);

  /**
   * Does this product have the requested size available to buy?
   * With per-variant stock, only cells with stock count — offering a size the
   * shopper cannot actually purchase is worse than excluding the product.
   */
  const hasSize = useCallback((p, want) => {
    const target = String(want).toLowerCase();
    if (p.trackVariantStock && p.variantStock?.length) {
      return p.variantStock.some((v) => v.stock > 0 && String(v.size).toLowerCase() === target);
    }
    return (p.sizes || []).some((s) => String(s).toLowerCase() === target);
  }, []);

  const results = useMemo(() => {
    let list = all;
    if (discounted) list = list.filter((p) => (p.discount || 0) > 0);
    if (inStock)    list = list.filter((p) => p.stock > 0);
    if (maxPrice)   list = list.filter((p) => fp(p) <= Number(maxPrice));
    if (size)       list = list.filter((p) => hasSize(p, size));

    list = [...list];
    if (sort === 'price_asc')  list.sort((a, b) => fp(a) - fp(b));
    if (sort === 'price_desc') list.sort((a, b) => fp(b) - fp(a));
    if (sort === 'discount')   list.sort((a, b) => (b.discount || 0) - (a.discount || 0));
    if (sort === 'newest')     list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list;
  }, [all, discounted, inStock, maxPrice, size, sort, hasSize]);

  const cartQty = useMemo(() => {
    const m = {};
    cartItems.forEach((i) => { m[i.productId] = (m[i.productId] || 0) + i.quantity; });
    return m;
  }, [cartItems]);

  const handleAdd = useCallback((p) => {
    addItem(p);
    toast.success(`${p.name} added to cart`, { duration: 1400 });
  }, [addItem]);

  const activeFilterCount =
    (category ? 1 : 0) + (discounted ? 1 : 0) + (inStock ? 1 : 0) + (maxPrice ? 1 : 0) + (size ? 1 : 0);

  const clearAll = () => setParams(q ? { q } : {}, { replace: true });

  const submitSearch = (e) => {
    e.preventDefault();
    setParam('q', searchInput.trim());
  };

  const FilterPanel = (
    <div className="space-y-6">
      <FilterGroup title="Category">
        <div className="space-y-1">
          <FilterRow active={!category} onClick={() => setParam('category', '')}>All categories</FilterRow>
          {categories.map((c) => (
            <FilterRow key={c} active={category === c} onClick={() => setParam('category', category === c ? '' : c)}>
              {c}
            </FilterRow>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Max price">
        <input
          type="range"
          min={0}
          max={priceCeiling}
          step={Math.max(50, Math.round(priceCeiling / 40))}
          value={maxPrice || priceCeiling}
          onChange={(e) => setParam('maxPrice', Number(e.target.value) >= priceCeiling ? '' : e.target.value)}
          className="w-full accent-[var(--color-primary)]"
          aria-label="Maximum price"
        />
        <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
          <span>₹0</span>
          <span className="font-bold text-[var(--color-text)]">
            {maxPrice ? `up to ₹${Number(maxPrice).toLocaleString('en-IN')}` : 'Any price'}
          </span>
        </div>
      </FilterGroup>

      {/* Only the sizes actually purchasable in the current result set, so the
          panel can never offer a dead filter. */}
      {availableSizes.length > 0 && (
        <FilterGroup title="Size">
          <div className="flex flex-wrap gap-2">
            {availableSizes.map((s) => (
              <button
                key={s}
                onClick={() => setParam('size', size === s ? '' : s)}
                className={`min-w-[2.75rem] h-10 px-2 rounded-lg text-sm font-bold border transition ${
                  size === s
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title="Offers">
        <FilterRow active={discounted} onClick={() => setParam('discounted', !discounted)}>
          Discounted only
        </FilterRow>
        <FilterRow active={inStock} onClick={() => setParam('inStock', !inStock)}>
          In stock only
        </FilterRow>
      </FilterGroup>

      {activeFilterCount > 0 && (
        <button
          onClick={clearAll}
          className="w-full h-11 rounded-xl border border-[var(--color-border)] text-sm font-bold
                     text-[var(--color-text-secondary)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] transition"
        >
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-16 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--color-card)]/95 backdrop-blur border-b border-[var(--color-border)]">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center gap-2 sm:gap-4">
          <Link to={`/shop/${slug}`} aria-label="Back to shop"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] transition shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Link to={`/shop/${slug}`} className="hidden sm:flex items-center gap-2 shrink-0">
            {shop?.logo ? (
              <img src={shop.logo} alt="" className="w-9 h-9 rounded-xl object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)] flex items-center justify-center">
                <Store className="w-5 h-5 text-white" />
              </div>
            )}
          </Link>

          <form onSubmit={submitSearch} className="flex-1 relative min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              className="w-full h-11 pl-10 pr-9 rounded-xl text-sm bg-[var(--color-bg)] text-[var(--color-text)]
                         border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)] transition"
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(''); setParam('q', ''); }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          <Link to={`/shop/${slug}/cart`} aria-label={`Cart, ${cartCount} items`}
            className="relative w-10 h-10 flex items-center justify-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] transition shrink-0">
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-[var(--color-danger)] text-white text-[10px] font-black flex items-center justify-center">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-5">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-[var(--color-text)] truncate">
              {q ? `Results for “${q}”` : category || 'All products'}
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {isLoading ? 'Loading…' : `${results.length} product${results.length === 1 ? '' : 's'}`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setFiltersOpen(true)}
              className="lg:hidden h-11 px-4 inline-flex items-center gap-2 rounded-xl text-sm font-bold
                         bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)]"
            >
              <SlidersHorizontal className="w-4 h-4" /> Filters
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setParam('sort', e.target.value)}
                aria-label="Sort products"
                className="h-11 pl-3.5 pr-9 rounded-xl text-sm font-semibold appearance-none cursor-pointer
                           bg-[var(--color-card)] text-[var(--color-text)] border border-[var(--color-border)]
                           focus:outline-none focus:border-[var(--color-primary)] transition"
              >
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex gap-6 items-start">
          {/* Desktop filter sidebar */}
          <aside className="hidden lg:block w-64 shrink-0 sticky top-24 bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-5">
            <h2 className="text-sm font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" /> Filters
            </h2>
            {FilterPanel}
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <ShopProductGridSkeleton count={10} />
            ) : results.length ? (
              <>
                <div className={GRID}>
                  {results.slice(0, visible).map((p) => (
                    <ShopProductCard key={p._id} product={p} slug={slug} onAdd={handleAdd} inCart={cartQty[p._id] || 0} />
                  ))}
                </div>
                {visible < results.length && (
                  <div className="flex justify-center mt-7">
                    <button
                      onClick={() => setVisible((v) => v + PAGE)}
                      className="h-12 px-7 rounded-xl font-bold text-sm border border-[var(--color-border)]
                                 bg-[var(--color-card)] text-[var(--color-text)]
                                 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition active:scale-95"
                    >
                      Load more
                      <span className="ml-1.5 font-medium text-[var(--color-text-muted)]">
                        ({results.length - visible} left)
                      </span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-20 text-center bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)]">
                <Package className="w-12 h-12 mx-auto text-[var(--color-text-disabled)] mb-3" />
                <p className="font-bold text-[var(--color-text)]">Nothing matches those filters</p>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">Try widening your search.</p>
                <button onClick={clearAll} className="mt-4 text-sm font-bold text-[var(--color-primary)]">
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter sheet */}
      {filtersOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          <button aria-label="Close filters" onClick={() => setFiltersOpen(false)}
            className="flex-1 bg-black/50 animate-[fadeIn_150ms_ease-out]" />
          <div className="bg-[var(--color-card)] rounded-t-3xl max-h-[80vh] flex flex-col animate-[slideUp_220ms_cubic-bezier(0.32,0.72,0,1)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <h3 className="font-bold text-[var(--color-text)]">Filters</h3>
              <button onClick={() => setFiltersOpen(false)} aria-label="Close"
                className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto overscroll-contain">{FilterPanel}</div>
            <div className="p-4 border-t border-[var(--color-border)]"
                 style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
              <button onClick={() => setFiltersOpen(false)}
                className="w-full h-12 rounded-xl bg-[var(--color-primary)] text-white font-bold active:scale-[0.98] transition">
                Show {results.length} product{results.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ShopBottomNav
        slug={slug}
        cartCount={cartCount}
        onSearch={() => document.querySelector('input[aria-label="Search products"]')?.focus()}
        onCategories={() => setFiltersOpen(true)}
      />
    </div>
  );
}

function FilterGroup({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">{title}</h3>
      {children}
    </div>
  );
}

function FilterRow({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`w-full h-10 px-3 flex items-center justify-between gap-2 rounded-lg text-sm font-medium text-left transition
                  ${active
                    ? 'bg-[var(--color-primary-bg)] text-[var(--color-primary)] font-bold'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]'}`}
    >
      <span className="truncate">{children}</span>
      {active && <Check className="w-4 h-4 shrink-0" />}
    </button>
  );
}
