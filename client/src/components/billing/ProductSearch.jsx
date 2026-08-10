import { useRef, useEffect, useState } from 'react';
import { Search, Loader2, Package, X, Sparkles, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProductSearch({
  search,
  setSearch,
  products,
  isLoading,
  onAddToCart,
  cartMap,
  productTags,
}) {
  const inputRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  // Auto-focus logic: always keep focused or refocus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e) => {
    if (showDropdown && products.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, products.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = activeIdx >= 0 ? products[activeIdx] : products[0];
        if (selected && selected.stock > 0) {
          onAddToCart(selected);
          setSearch('');
          setShowDropdown(false);
          setActiveIdx(-1);
        }
      }
    }
  };

  return (
    <div className="relative">
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          id="product-search-input"
          data-testid="product-search"
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowDropdown(!!e.target.value);
            setActiveIdx(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => search && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="Search products (F1)..."
          autoComplete="off"
          className="ui-input h-11 pl-11 pr-20 text-base shadow-sm focus:ring-2 focus:ring-blue-100"
        />
        <div className="absolute right-3.5 flex items-center gap-1.5">
          <Mic className="w-4 h-4 text-gray-400 hover:text-blue-500 cursor-pointer" title="Voice search (future)" />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setShowDropdown(false);
              }}
              className="text-gray-300 hover:text-gray-500 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto scrollbar-thin">
              {isLoading ? (
                <div className="flex items-center justify-center py-6 text-gray-400 text-sm gap-2">
                  <Loader2 className="w-4.5 h-4.5 animate-spin text-blue-500" />
                  Searching products...
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400 text-sm gap-1">
                  <Package className="w-7 h-7 opacity-25" />
                  No products found
                </div>
              ) : (
                products.map((p, idx) => {
                  const outOfStock = p.stock < 1;
                  const inCart = cartMap.get(p._id);
                  const isLow = p.stock <= (p.lowStockThreshold || 10);

                  return (
                    <button
                      key={p._id}
                      data-testid={`product-card-${p._id}`}
                      data-out-of-stock={outOfStock}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!outOfStock) {
                          onAddToCart(p);
                          setSearch('');
                          setShowDropdown(false);
                        }
                      }}
                      disabled={outOfStock}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-left border-b border-gray-50 last:border-0 transition-colors ${
                        idx === activeIdx ? 'bg-blue-50' : 'hover:bg-gray-50'
                      } ${outOfStock ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">
                          {p.sku || 'No SKU'} · {p.category} ·{' '}
                          <span className={outOfStock ? 'text-red-500 font-medium' : isLow ? 'text-amber-500 font-medium' : 'text-gray-500'}>
                            {outOfStock ? 'Out of Stock' : `${p.stock} remaining`}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-800">₹{p.price}</span>
                        {inCart && (
                          <span className="block text-[10px] text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-1.5 mt-0.5 font-semibold">
                            ×{inCart.quantity} in cart
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Derived Suggestion Tags under Search Input */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Quick Add:</span>
        {productTags.lowStock.slice(0, 3).map((p) => (
          <button
            key={p._id}
            onClick={() => onAddToCart(p)}
            className="text-[11px] bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-semibold px-2 py-0.5 rounded-full transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-2.5 h-2.5 text-amber-500" />
            Low Stock: {p.name}
          </button>
        ))}
        {productTags.recentlyAdded.slice(0, 3).map((p) => (
          <button
            key={p._id}
            onClick={() => onAddToCart(p)}
            className="text-[11px] bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-semibold px-2 py-0.5 rounded-full transition-colors"
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
