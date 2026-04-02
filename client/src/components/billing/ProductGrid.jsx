import { memo, useState, useMemo } from 'react';
import { Search, X, Package, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Product Card ──────────────────────────────────────────────────────────────
const ProductCard = memo(function ProductCard({ product, inCart, onAdd }) {
  const fp         = product.price * (1 - (product.discount || 0) / 100);
  const outOfStock = product.stock < 1;
  const isLow      = !outOfStock && product.stock <= (product.lowStockThreshold || 5);

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      whileHover={outOfStock ? undefined : { y: -3, transition: { duration: 0.12 } }}
      whileTap={outOfStock ? undefined : { scale: 0.97 }}
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      data-testid={`product-card-${product._id}`}
      data-product-name={product.name}
      data-out-of-stock={outOfStock}
      className={`group relative text-left rounded-2xl overflow-hidden transition-shadow duration-200 ${
        inCart
          ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-100/60 bg-white'
          : outOfStock
          ? 'opacity-50 cursor-not-allowed bg-white ring-1 ring-gray-200'
          : 'bg-white ring-1 ring-gray-200 hover:ring-blue-300 hover:shadow-xl hover:shadow-blue-50/80 cursor-pointer'
      }`}
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-gray-100 overflow-hidden">
        {product.images?.[0] || product.image ? (
          <img
            src={product.images?.[0] || product.image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
            <Package className="w-8 h-8 text-gray-300" />
          </div>
        )}

        {/* Discount badge */}
        {product.discount > 0 && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
            -{product.discount}%
          </span>
        )}

        {/* In-cart quantity badge */}
        <AnimatePresence>
          {inCart && (
            <motion.span
              key="qty"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="absolute top-2 right-2 min-w-[1.5rem] h-6 bg-blue-600 text-white text-xs font-black rounded-full flex items-center justify-center shadow-md px-1.5"
            >
              {inCart.quantity}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Out-of-stock overlay */}
        {outOfStock && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
            <span className="text-[11px] font-bold text-red-500 bg-white/95 px-2.5 py-1 rounded-full shadow-sm">
              Out of Stock
            </span>
          </div>
        )}

        {/* Quick-add hover button */}
        {!outOfStock && (
          <div className="absolute inset-0 flex items-end justify-end p-2 pointer-events-none">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 scale-75 group-hover:scale-100">
              <Plus className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="font-semibold text-gray-900 text-xs leading-snug line-clamp-2 min-h-[2.2rem]">{product.name}</p>
        <p className="text-[10px] text-gray-400 mt-0.5 capitalize truncate">{product.category}</p>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-baseline gap-1">
            <span className="text-blue-600 font-black text-sm tabular-nums">₹{fp.toFixed(0)}</span>
            {product.discount > 0 && (
              <span className="text-[9px] text-gray-300 line-through tabular-nums">₹{product.price.toFixed(0)}</span>
            )}
          </div>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
            outOfStock ? 'bg-red-100 text-red-600'
            : isLow    ? 'bg-amber-100 text-amber-700'
            :            'bg-emerald-100 text-emerald-600'
          }`}>
            {outOfStock ? '0' : product.stock}
          </span>
        </div>
      </div>
    </motion.button>
  );
});

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ProductSkeleton() {
  return (
    <div className="rounded-2xl ring-1 ring-gray-200 overflow-hidden animate-pulse bg-white">
      <div className="aspect-square bg-gray-100" />
      <div className="p-2.5 space-y-1.5">
        <div className="h-3 bg-gray-100 rounded-full w-4/5" />
        <div className="h-2.5 bg-gray-100 rounded-full w-1/2" />
        <div className="flex justify-between mt-1">
          <div className="h-3 bg-gray-100 rounded-full w-1/3" />
          <div className="h-3 bg-gray-100 rounded-full w-1/6" />
        </div>
      </div>
    </div>
  );
}

// ── Category tab ──────────────────────────────────────────────────────────────
const CategoryTab = memo(function CategoryTab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-all duration-150 capitalize ${
        active
          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200/60'
          : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'
      }`}
    >
      {label}
    </button>
  );
});

// ── Grid ──────────────────────────────────────────────────────────────────────
const ProductGrid = memo(function ProductGrid({
  products, cartMap, isLoading, onAdd, search, setSearch, searchRef,
}) {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))],
    [products]
  );

  const filtered = useMemo(() =>
    selectedCategory === 'all'
      ? products
      : products.filter((p) => p.category === selectedCategory),
    [products, selectedCategory]
  );

  return (
    <div className="flex flex-col gap-3">

      {/* Search */}
      <div className="relative shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products, SKU, barcode…"
          data-testid="product-search"
          className="w-full h-11 pl-11 pr-10 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 shadow-sm transition-all bg-white"
        />
        <AnimatePresence>
          {search && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
            >
              <X className="w-3 h-3 text-gray-600" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 shrink-0" style={{ scrollbarWidth: 'none' }}>
          <CategoryTab label="All" active={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')} />
          {categories.map((cat) => (
            <CategoryTab key={cat} label={cat} active={selectedCategory === cat} onClick={() => setSelectedCategory(cat)} />
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {isLoading
          ? Array.from({ length: 12 }, (_, i) => <ProductSkeleton key={i} />)
          : filtered.map((p) => (
              <ProductCard
                key={p._id}
                product={p}
                inCart={cartMap?.get(p._id)}
                onAdd={onAdd}
              />
            ))}
      </div>

      {/* Empty state */}
      {!isLoading && !filtered.length && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-gray-400"
        >
          <Package className="w-14 h-14 mb-3 opacity-20" />
          <p className="text-sm font-semibold text-gray-500">No products found</p>
          {search && <p className="text-xs text-gray-400 mt-1">Try a different search term</p>}
        </motion.div>
      )}
    </div>
  );
});

export default ProductGrid;
