import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart, Store, Search, X, Phone, Mail, MapPin,
  Flame, Tag, Sparkles, Star, Menu, ChevronRight, Package,
  ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { shopApi } from '../../api/shop.api';
import useCartStore from '../../store/cartStore';

// ── Debounce hook ──────────────────────────────────────────────────────────────
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Product Card ──────────────────────────────────────────────────────────────
const ProductCard = memo(function ProductCard({ product, slug, onAdd }) {
  const fp         = product.price * (1 - (product.discount || 0) / 100);
  const outOfStock = product.stock < 1;
  const detailLink = `/shop/${slug}/product/${product._id}`;

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
      <Link to={detailLink} className="block relative">
        <div className="relative w-full aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
          {product.images?.[0] || product.image ? (
            <img
              src={product.images?.[0] || product.image}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-10 h-10 text-gray-300" />
            </div>
          )}
          {product.discount > 0 && (
            <span className="absolute top-2.5 left-2.5 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
              -{product.discount}%
            </span>
          )}
          {product.isNewArrival && (
            <span className="absolute top-2.5 right-2.5 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
              NEW
            </span>
          )}
          {outOfStock && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="bg-white text-gray-700 text-xs font-bold px-3 py-1 rounded-full">
                Out of Stock
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="p-3">
        <p className="text-[11px] text-blue-500 font-semibold mb-0.5 truncate">
          {product.category}
          {product.subCategory ? ` · ${product.subCategory}` : ''}
        </p>
        <Link to={detailLink}>
          <h3 className="font-semibold text-gray-900 text-sm leading-snug hover:text-blue-600 transition line-clamp-2">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-end justify-between mt-2.5">
          <div>
            {product.discount > 0 && (
              <p className="text-[10px] text-gray-400 line-through leading-none">
                ₹{product.price.toLocaleString('en-IN')}
              </p>
            )}
            <p className="text-base font-extrabold text-gray-900 leading-snug">
              ₹{fp.toLocaleString('en-IN')}
            </p>
          </div>
          <button
            onClick={() => !outOfStock && onAdd(product)}
            disabled={outOfStock}
            className="flex items-center justify-center w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white rounded-xl transition active:scale-90 shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>

        {product.sizes?.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {product.sizes.slice(0, 4).map((s) => (
              <span key={s} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, iconColor, products, slug, onAdd }) {
  if (!products.length) return null;
  return (
    <section className="py-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconColor}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {products.slice(0, 10).map((p) => (
          <ProductCard key={p._id} product={p} slug={slug} onAdd={onAdd} />
        ))}
      </div>
    </section>
  );
}

// ── Category Tab ──────────────────────────────────────────────────────────────
function CategoryTabs({ categories, active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
      <button
        onClick={() => onChange('')}
        className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition ${
          !active
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat === active ? '' : cat)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition ${
            active === cat
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ shop }) {
  return (
    <div
      className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden"
      style={shop.banner ? { backgroundImage: `url(${shop.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
    >
      {shop.banner && <div className="absolute inset-0 bg-blue-900/70" />}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute -top-16 -right-16 w-80 h-80 bg-white rounded-full" />
        <div className="absolute -bottom-24 -left-12 w-96 h-96 bg-white rounded-full" />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="flex items-center gap-4 mb-4">
          {shop.logo ? (
            <img src={shop.logo} alt="" className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-white/30" />
          ) : (
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border-2 border-white/30">
              <Store className="w-8 h-8 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">{shop.name}</h1>
            {shop.type && (
              <p className="text-blue-200 text-sm font-medium capitalize mt-0.5">
                {shop.type} store
              </p>
            )}
          </div>
        </div>
        {shop.description && (
          <p className="text-blue-100 text-base max-w-xl mb-5">{shop.description}</p>
        )}
        <div className="flex flex-wrap gap-4 text-sm">
          {shop.phone && (
            <a href={`tel:${shop.phone}`} className="flex items-center gap-1.5 text-blue-200 hover:text-white transition">
              <Phone className="w-4 h-4" /> {shop.phone}
            </a>
          )}
          {shop.email && (
            <a href={`mailto:${shop.email}`} className="flex items-center gap-1.5 text-blue-200 hover:text-white transition">
              <Mail className="w-4 h-4" /> {shop.email}
            </a>
          )}
          {shop.address && (
            <span className="flex items-center gap-1.5 text-blue-200">
              <MapPin className="w-4 h-4" /> {shop.address}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Cart FAB ──────────────────────────────────────────────────────────────────
function CartFAB({ slug, count }) {
  if (!count) return null;
  return (
    <Link
      to={`/shop/${slug}/cart`}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-3.5 rounded-2xl shadow-2xl shadow-blue-500/40 transition active:scale-95"
    >
      <ShoppingCart className="w-5 h-5" />
      <span>Cart</span>
      <span className="bg-white text-blue-700 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center">
        {count > 9 ? '9+' : count}
      </span>
    </Link>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CustomerShop() {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const addItem    = useCartStore((s) => s.addItem);
  const cartCount  = useCartStore((s) => s.getItemCount());

  const [searchInput,    setSearchInput]    = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [menuOpen,       setMenuOpen]       = useState(false);
  const debouncedSearch = useDebounce(searchInput);

  // ── Fetch shop by slug ────────────────────────────────────────────────────
  const { data: shopData, isLoading: shopLoading, isError: shopError } = useQuery({
    queryKey: ['public-shop-slug', slug],
    queryFn:  () => shopApi.getShopBySlug(slug),
    staleTime: 5 * 60 * 1000,
  });

  const shop   = shopData?.data?.shop;
  const shopId = shop?._id;

  // ── Fetch all products for this shop ─────────────────────────────────────
  const { data: productData, isLoading: productsLoading } = useQuery({
    queryKey: ['public-shop-products', shopId, debouncedSearch, activeCategory],
    queryFn:  () => shopApi.getProducts({
      shopId,
      search:   debouncedSearch || undefined,
      category: activeCategory  || undefined,
      limit:    100,
    }),
    enabled: !!shopId,
    staleTime: 3 * 60 * 1000,
  });

  const allProducts = productData?.data || [];

  // ── Derived lists ─────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const seen = new Set();
    allProducts.forEach((p) => p.category && seen.add(p.category));
    return [...seen].sort();
  }, [allProducts]);

  const newArrivals = useMemo(
    () => allProducts.filter((p) => p.isNewArrival).slice(0, 10),
    [allProducts]
  );
  const discounted = useMemo(
    () => allProducts.filter((p) => p.discount > 0).slice(0, 10),
    [allProducts]
  );
  const trending = useMemo(
    () => allProducts.filter((p) => p.isTrending).slice(0, 10),
    [allProducts]
  );

  const handleAdd = useCallback((product) => {
    addItem(product);
    toast.success(`${product.name} added!`, { duration: 1500 });
  }, [addItem]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (shopLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading shop…</p>
        </div>
      </div>
    );
  }

  if (shopError || !shop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <Store className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-xl font-bold text-gray-700">Shop not found</h1>
        <p className="text-gray-400 mt-1">The shop "{slug}" doesn't exist or has been deactivated.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-6 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" /> Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Sticky Navbar ── */}
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo + name */}
            <Link to={`/shop/${slug}`} className="flex items-center gap-2.5 shrink-0">
              {shop.logo ? (
                <img src={shop.logo} alt="" className="h-9 w-9 rounded-xl object-cover shadow-sm" />
              ) : (
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                  <Store className="w-5 h-5 text-white" />
                </div>
              )}
              <span className="font-bold text-lg text-gray-900 hidden sm:block truncate max-w-[180px]">
                {shop.name}
              </span>
            </Link>

            {/* Desktop search */}
            <div className="hidden md:flex flex-1 max-w-md mx-6 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products…"
                className="w-full h-10 pl-9 pr-9 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Cart icon */}
              <Link
                to={`/shop/${slug}/cart`}
                className="relative p-2 text-gray-600 hover:text-blue-600 transition"
              >
                <ShoppingCart className="w-6 h-6" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>
              {/* Mobile menu */}
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="md:hidden p-2 text-gray-600"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-3 space-y-2">
            {/* Mobile search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products…"
                className="w-full h-10 pl-9 pr-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <Hero shop={shop} />

      {/* ── Main content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Category tabs */}
        {categories.length > 0 && (
          <CategoryTabs
            categories={categories}
            active={activeCategory}
            onChange={setActiveCategory}
          />
        )}

        {/* Search or filtered view */}
        {debouncedSearch || activeCategory ? (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {debouncedSearch ? `Results for "${debouncedSearch}"` : activeCategory}
                <span className="ml-2 text-sm font-normal text-gray-400">
                  ({allProducts.length} products)
                </span>
              </h2>
              <button
                onClick={() => { setSearchInput(''); setActiveCategory(''); }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
            {productsLoading ? (
              <ProductSkeletonGrid />
            ) : allProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {allProducts.map((p) => (
                  <ProductCard key={p._id} product={p} slug={slug} onAdd={handleAdd} />
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No products found</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Sections */}
            {trending.length > 0 && (
              <Section
                title="Trending Now"
                icon={Flame}
                iconColor="bg-orange-500"
                products={trending}
                slug={slug}
                onAdd={handleAdd}
              />
            )}
            {newArrivals.length > 0 && (
              <Section
                title="New Arrivals"
                icon={Sparkles}
                iconColor="bg-green-500"
                products={newArrivals}
                slug={slug}
                onAdd={handleAdd}
              />
            )}
            {discounted.length > 0 && (
              <Section
                title="Deals & Discounts"
                icon={Tag}
                iconColor="bg-red-500"
                products={discounted}
                slug={slug}
                onAdd={handleAdd}
              />
            )}
            {/* All products */}
            {allProducts.length > 0 && (
              <Section
                title="All Products"
                icon={Star}
                iconColor="bg-blue-500"
                products={allProducts}
                slug={slug}
                onAdd={handleAdd}
              />
            )}
            {!productsLoading && allProducts.length === 0 && (
              <div className="py-24 text-center text-gray-400">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No products yet</p>
                <p className="text-sm mt-1">Check back soon!</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-gray-400 py-10 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          {shop.logo ? (
            <img src={shop.logo} alt="" className="w-10 h-10 rounded-xl object-cover mx-auto mb-3" />
          ) : (
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Store className="w-5 h-5 text-white" />
            </div>
          )}
          <p className="font-semibold text-white text-lg">{shop.name}</p>
          {shop.address && <p className="text-sm mt-1">{shop.address}</p>}
          {shop.phone   && <p className="text-sm">{shop.phone}</p>}
          {shop.email   && <p className="text-sm">{shop.email}</p>}
          <p className="text-xs text-gray-600 mt-6">Powered by MultiShop</p>
        </div>
      </footer>

      {/* ── Cart FAB (mobile) ── */}
      <div className="md:hidden">
        <CartFAB slug={slug} count={cartCount} />
      </div>
    </div>
  );
}

// ── Skeleton grid ─────────────────────────────────────────────────────────────
function ProductSkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
          <div className="aspect-square bg-gray-100" />
          <div className="p-3 space-y-2">
            <div className="h-2.5 bg-gray-100 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-4 bg-gray-100 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
