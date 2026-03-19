import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, X, ShoppingCart, ChevronDown } from 'lucide-react';
import { shopApi } from '../../api/shop.api';
import useCartStore from '../../store/cartStore';
import toast from 'react-hot-toast';

function ProductCard({ product, shopId }) {
  const addItem = useCartStore((s) => s.addItem);
  const fp = product.price * (1 - (product.discount || 0) / 100);
  const detailLink = shopId
    ? `/shop/products/${product._id}?shopId=${shopId}`
    : `/shop/products/${product._id}`;

  const handleAdd = (e) => {
    e.preventDefault();
    addItem(product);
    toast.success(`${product.name} added!`);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
      <Link to={detailLink} className="block relative">
        {(product.images?.[0] || product.image) ? (
          <img src={product.images[0] || product.image} alt={product.name}
            className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-56 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <ShoppingCart className="w-8 h-8 text-gray-300" />
          </div>
        )}
        {product.discount > 0 && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            -{product.discount}%
          </span>
        )}
        {product.stock < 1 && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-black/70 text-white text-xs font-bold px-3 py-1 rounded-full">Out of Stock</span>
          </div>
        )}
      </Link>
      <div className="p-3">
        <p className="text-[11px] text-blue-500 font-medium">{product.category}</p>
        <Link to={detailLink}>
          <h3 className="font-semibold text-gray-900 text-sm mt-0.5 line-clamp-2 hover:text-blue-600">{product.name}</h3>
        </Link>
        {product.sizes?.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {product.sizes.slice(0, 4).map((s) => (
              <span key={s} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{s}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-2.5">
          <div>
            {product.discount > 0 && (
              <p className="text-xs text-gray-400 line-through leading-none">₹{product.price.toLocaleString('en-IN')}</p>
            )}
            <p className="font-bold text-gray-900">₹{fp.toLocaleString('en-IN')}</p>
          </div>
          <button onClick={handleAdd} disabled={product.stock < 1}
            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white rounded-xl transition">
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="w-full h-56 bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}

export default function ShopListing() {
  const [params, setParams] = useSearchParams();
  const shopId    = params.get('shopId');
  const [showFilters, setShowFilters] = useState(false);

  const [search,      setSearch]      = useState(params.get('search') || '');
  const [category,    setCategory]    = useState(params.get('category') || '');
  const [subCategory, setSubCategory] = useState(params.get('subCategory') || '');
  const [size,        setSize]        = useState(params.get('size') || '');
  const [minPrice,    setMinPrice]    = useState(params.get('minPrice') || '');
  const [maxPrice,    setMaxPrice]    = useState(params.get('maxPrice') || '');
  const [sort,        setSort]        = useState(params.get('sort') || 'newest');
  const [page,        setPage]        = useState(1);

  const searchRef = useRef(null);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams(params);
      if (search) p.set('search', search); else p.delete('search');
      setParams(p, { replace: true });
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const queryParams = {
    shopId: shopId || undefined,
    search: search || undefined,
    category: category || undefined,
    subCategory: subCategory || undefined,
    size: size || undefined,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
    sort,
    page,
    limit: 20,
    isTrending:   params.get('isTrending')   || undefined,
    isNewArrival: params.get('isNewArrival') || undefined,
  };

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['pub-products', queryParams],
    queryFn: () => shopApi.getProducts(queryParams),
    keepPreviousData: true,
  });

  const { data: catsData } = useQuery({
    queryKey: ['pub-categories', shopId],
    queryFn: () => shopApi.getCategories({ shopId: shopId || undefined }),
  });

  const products  = productsData?.data || [];
  const total     = productsData?.meta?.total || productsData?.total || 0;
  const cats      = catsData?.data?.categories || [];
  const subCats   = catsData?.data?.subCategories || [];
  const totalPages = Math.ceil(total / 20);

  const clearFilter = (key) => {
    if (key === 'category')    setCategory('');
    if (key === 'subCategory') setSubCategory('');
    if (key === 'size')        setSize('');
    if (key === 'minPrice')    { setMinPrice(''); setMaxPrice(''); }
    setPage(1);
  };

  const activeFilters = [
    category    && { key: 'category',    label: category },
    subCategory && { key: 'subCategory', label: subCategory },
    size        && { key: 'size',        label: `Size: ${size}` },
    (minPrice || maxPrice) && { key: 'minPrice', label: `₹${minPrice||0} – ₹${maxPrice||'∞'}` },
  ].filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ── Search + Sort bar ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm" />
        </div>
        <div className="relative">
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm cursor-pointer">
            <option value="newest">Newest First</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="popular">Most Popular</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition ${showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-700 hover:border-blue-400 shadow-sm'}`}>
          <SlidersHorizontal className="w-4 h-4" /> Filters
          {activeFilters.length > 0 && <span className="w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{activeFilters.length}</span>}
        </button>
      </div>

      {/* ── Active filter chips ── */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activeFilters.map((f) => (
            <span key={f.key} className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {f.label}
              <button onClick={() => clearFilter(f.key)} className="ml-0.5 hover:text-blue-900"><X className="w-3.5 h-3.5" /></button>
            </span>
          ))}
          <button onClick={() => { setCategory(''); setSubCategory(''); setSize(''); setMinPrice(''); setMaxPrice(''); setPage(1); }}
            className="text-sm text-gray-500 hover:text-red-500 underline">Clear all</button>
        </div>
      )}

      <div className="flex gap-6">
        {/* ── Sidebar Filters ── */}
        {showFilters && (
          <aside className="w-64 shrink-0 space-y-5">
            {/* Category */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="font-semibold text-gray-800 mb-3 text-sm">Category</p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="cat" checked={!category} onChange={() => { setCategory(''); setPage(1); }} className="text-blue-600" />
                  All Categories
                </label>
                {cats.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="cat" checked={category === c} onChange={() => { setCategory(c); setPage(1); }} className="text-blue-600" />
                    {c}
                  </label>
                ))}
              </div>
            </div>

            {/* Sub-Category */}
            {subCats.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="font-semibold text-gray-800 mb-3 text-sm">Collection</p>
                <div className="space-y-1.5">
                  {['', ...subCats].map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="sub" checked={subCategory === s} onChange={() => { setSubCategory(s); setPage(1); }} className="text-blue-600" />
                      {s || 'All'}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Price range */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="font-semibold text-gray-800 mb-3 text-sm">Price Range</p>
              <div className="flex gap-2">
                <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={() => setPage(1)} className="mt-2 w-full py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition">Apply</button>
            </div>

            {/* Size */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="font-semibold text-gray-800 mb-3 text-sm">Size</p>
              <div className="flex flex-wrap gap-2">
                {['', 'XS','S','M','L','XL','XXL'].map((s) => (
                  <button key={s} onClick={() => { setSize(s); setPage(1); }}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition ${size === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-400'}`}>
                    {s || 'All'}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* ── Product grid ── */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 mb-4">{total} product{total !== 1 ? 's' : ''} found</p>

          <div className={`grid gap-4 ${showFilters ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}`}>
            {isLoading
              ? Array(10).fill(0).map((_, i) => <SkeletonCard key={i} />)
              : products.map((p) => <ProductCard key={p._id} product={p} shopId={shopId} />)
            }
          </div>

          {!isLoading && !products.length && (
            <div className="text-center py-16 text-gray-400">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No products found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium disabled:opacity-40 hover:border-blue-400 transition">← Prev</button>
              <span className="px-4 py-2 text-sm text-gray-600">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium disabled:opacity-40 hover:border-blue-400 transition">Next →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
