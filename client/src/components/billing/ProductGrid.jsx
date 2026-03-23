import { memo, useState, useMemo } from 'react';
import { Search, X, Package } from 'lucide-react';

// ── Individual card ────────────────────────────────────────────────────────────
const ProductCard = memo(function ProductCard({ product, inCart, onAdd }) {
  const fp         = product.price * (1 - (product.discount || 0) / 100);
  const outOfStock = product.stock < 1;

  return (
    <button
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      className={`group text-left rounded-2xl border-2 overflow-hidden transition-all duration-150 ${
        inCart
          ? 'border-blue-500 shadow-md shadow-blue-100 bg-blue-50/30'
          : outOfStock
          ? 'border-gray-200 opacity-50 cursor-not-allowed bg-white'
          : 'border-gray-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-50 bg-white hover:-translate-y-0.5'
      }`}
    >
      {/* Image */}
      <div className="relative w-full h-36 bg-gray-100">
        {product.images?.[0] || product.image ? (
          <img
            src={product.images?.[0] || product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-10 h-10 text-gray-300" />
          </div>
        )}
        {product.discount > 0 && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
            -{product.discount}%
          </span>
        )}
        {inCart && (
          <span className="absolute top-2 right-2 min-w-[1.4rem] h-6 bg-blue-600 text-white text-xs font-black rounded-full flex items-center justify-center shadow px-1.5">
            {inCart.quantity}
          </span>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="text-[11px] font-bold text-red-500 bg-white/90 px-2 py-0.5 rounded-full">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-semibold text-gray-900 text-sm line-clamp-1 leading-tight">{product.name}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 truncate capitalize">{product.category}</p>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-baseline gap-1">
            <span className="text-blue-600 font-black text-base">₹{fp.toFixed(0)}</span>
            {product.discount > 0 && (
              <span className="text-[10px] text-gray-300 line-through">₹{product.price.toFixed(0)}</span>
            )}
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            outOfStock
              ? 'bg-red-100 text-red-600'
              : product.stock <= (product.lowStockThreshold || 5)
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-green-100 text-green-600'
          }`}>
            {outOfStock ? '—' : `${product.stock}`}
          </span>
        </div>
      </div>
    </button>
  );
});

// ── Skeleton loader ────────────────────────────────────────────────────────────
function ProductSkeleton() {
  return (
    <div className="rounded-2xl border-2 border-gray-100 overflow-hidden animate-pulse">
      <div className="w-full h-36 bg-gray-100" />
      <div className="p-3 space-y-2">
        <div className="h-3.5 bg-gray-100 rounded w-3/4" />
        <div className="h-2.5 bg-gray-100 rounded w-1/2" />
        <div className="flex justify-between mt-2">
          <div className="h-4 bg-gray-100 rounded w-1/3" />
          <div className="h-4 bg-gray-100 rounded w-1/5" />
        </div>
      </div>
    </div>
  );
}

// ── Grid ──────────────────────────────────────────────────────────────────────
const ProductGrid = memo(function ProductGrid({
  products, cart, isLoading, onAdd, search, setSearch, searchRef,
}) {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))],
    [products]
  );

  const filtered = useMemo(
    () => selectedCategory === 'all' ? products : products.filter((p) => p.category === selectedCategory),
    [products, selectedCategory]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, SKU or scan barcode…"
          className="w-full h-12 pl-12 pr-4 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-blue-500 shadow-sm transition-colors bg-gray-50 focus:bg-white"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category filter tabs */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-all capitalize ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 overflow-y-auto scrollbar-thin max-h-[370px] pr-0.5 pb-1">
        {isLoading
          ? Array.from({ length: 10 }, (_, i) => <ProductSkeleton key={i} />)
          : filtered.map((p) => (
              <ProductCard
                key={p._id}
                product={p}
                inCart={cart.find((i) => i.productId === p._id)}
                onAdd={onAdd}
              />
            ))}
        {!isLoading && !filtered.length && (
          <div className="col-span-5 py-14 text-center text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-25" />
            <p className="text-sm font-medium">No products found</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default ProductGrid;
