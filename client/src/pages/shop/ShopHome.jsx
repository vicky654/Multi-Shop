import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, ArrowRight, Tag, Flame, Sparkles, Star } from 'lucide-react';
import { shopApi } from '../../api/shop.api';
import useCartStore from '../../store/cartStore';
import toast from 'react-hot-toast';

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ product, shopId, onAddToCart }) {
  const fp = product.price * (1 - (product.discount || 0) / 100);
  const detailLink = shopId
    ? `/shop/products/${product._id}?shopId=${shopId}`
    : `/shop/products/${product._id}`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
      <Link to={detailLink} className="block relative">
        {(product.images?.[0] || product.image) ? (
          <img src={product.images[0] || product.image} alt={product.name}
            className="w-full h-52 object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-52 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <ShoppingCart className="w-10 h-10 text-blue-300" />
          </div>
        )}
        {product.discount > 0 && (
          <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
            -{product.discount}%
          </span>
        )}
        {product.isNewArrival && (
          <span className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">NEW</span>
        )}
      </Link>
      <div className="p-4">
        <p className="text-xs text-blue-500 font-medium mb-1">{product.category}{product.subCategory ? ` · ${product.subCategory}` : ''}</p>
        <Link to={detailLink}>
          <h3 className="font-semibold text-gray-900 text-sm leading-snug hover:text-blue-600 transition line-clamp-2">{product.name}</h3>
        </Link>
        <div className="flex items-center justify-between mt-3">
          <div>
            {product.discount > 0 && (
              <p className="text-xs text-gray-400 line-through">₹{product.price.toLocaleString('en-IN')}</p>
            )}
            <p className="text-lg font-bold text-gray-900">₹{fp.toLocaleString('en-IN')}</p>
          </div>
          <button
            onClick={() => onAddToCart(product)}
            disabled={product.stock < 1}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold rounded-xl transition"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            {product.stock < 1 ? 'Out' : 'Add'}
          </button>
        </div>
        {product.sizes?.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {product.sizes.slice(0, 5).map((s) => (
              <span key={s} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{s}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, color, products, shopId, onAddToCart, viewAll }) {
  return (
    <section className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          </div>
          <Link to={viewAll} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map((p) => (
            <ProductCard key={p._id} product={p} shopId={shopId} onAddToCart={onAddToCart} />
          ))}
        </div>
        {!products.length && (
          <p className="text-center text-gray-400 py-8">No products available yet</p>
        )}
      </div>
    </section>
  );
}

// ── Hero Banner ───────────────────────────────────────────────────────────────
function Hero({ shopId }) {
  const allLink = shopId ? `/shop/products?shopId=${shopId}` : '/shop/products';
  return (
    <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white rounded-full" />
        <div className="absolute -bottom-24 -left-12 w-80 h-80 bg-white rounded-full" />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 text-blue-200 text-sm font-medium mb-3">
            <Sparkles className="w-4 h-4" /> New Season Collection
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4">
            Shop the Latest<br />Trends
          </h1>
          <p className="text-blue-100 text-lg mb-8">Discover our curated collection of premium products at unbeatable prices.</p>
          <div className="flex gap-4">
            <Link to={allLink}
              className="px-6 py-3 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition shadow-lg">
              Shop Now
            </Link>
            <Link to={shopId ? `/shop/products?shopId=${shopId}&isTrending=true` : '/shop/products?isTrending=true'}
              className="px-6 py-3 border-2 border-white/50 text-white font-bold rounded-xl hover:bg-white/10 transition">
              Trending
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Category Chips ────────────────────────────────────────────────────────────
function CategoryGrid({ shopId }) {
  const [params] = useSearchParams();
  const sid = shopId || params.get('shopId');
  const cats = [
    { label: "Men's", sub: 'Mens',   emoji: '👔', color: 'from-blue-400 to-blue-600' },
    { label: "Women's", sub: 'Womens', emoji: '👗', color: 'from-pink-400 to-pink-600' },
    { label: "Kids'", sub: 'Kids',   emoji: '🧒', color: 'from-yellow-400 to-orange-500' },
    { label: 'Sale',  sale: true,    emoji: '🏷️', color: 'from-red-400 to-red-600' },
  ];
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cats.map((c) => {
          const href = sid
            ? `/shop/products?shopId=${sid}${c.sub ? `&subCategory=${c.sub}` : ''}`
            : `/shop/products${c.sub ? `?subCategory=${c.sub}` : ''}`;
          return (
            <Link key={c.label} to={href}
              className={`bg-gradient-to-br ${c.color} text-white rounded-2xl p-6 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all`}>
              <span className="text-3xl">{c.emoji}</span>
              <p className="font-bold mt-2 text-lg">{c.label}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ShopHome() {
  const [params] = useSearchParams();
  const shopId   = params.get('shopId');
  const addItem  = useCartStore((s) => s.addItem);

  const buildQuery = (extra) => ({ shopId: shopId || undefined, limit: 10, ...extra });

  const { data: trendingData }    = useQuery({ queryKey: ['pub-trending',  shopId], queryFn: () => shopApi.getProducts(buildQuery({ isTrending: 'true' })) });
  const { data: newArrivalsData } = useQuery({ queryKey: ['pub-new',       shopId], queryFn: () => shopApi.getProducts(buildQuery({ isNewArrival: 'true' })) });
  const { data: kidsData }        = useQuery({ queryKey: ['pub-kids',      shopId], queryFn: () => shopApi.getProducts(buildQuery({ subCategory: 'Kids' })) });
  const { data: mensData }        = useQuery({ queryKey: ['pub-mens',      shopId], queryFn: () => shopApi.getProducts(buildQuery({ subCategory: 'Mens' })) });
  const { data: womensData }      = useQuery({ queryKey: ['pub-womens',    shopId], queryFn: () => shopApi.getProducts(buildQuery({ subCategory: 'Womens' })) });
  const { data: dealsData }       = useQuery({ queryKey: ['pub-deals',     shopId], queryFn: () => shopApi.getProducts(buildQuery({})) });

  const handleAddToCart = (product) => {
    addItem(product);
    toast.success(`${product.name} added to cart`);
  };

  const link = (extra) => {
    const base = '/shop/products';
    const q = new URLSearchParams({ ...(shopId ? { shopId } : {}), ...extra });
    return `${base}?${q}`;
  };

  const get = (d) => d?.data || [];

  return (
    <div>
      <Hero shopId={shopId} />
      <CategoryGrid shopId={shopId} />

      <Section title="Trending Now" icon={Flame}     color="bg-orange-500" products={get(trendingData)}    shopId={shopId} onAddToCart={handleAddToCart} viewAll={link({ isTrending: 'true' })} />
      <div className="bg-white">
        <Section title="New Arrivals" icon={Sparkles}  color="bg-green-500"  products={get(newArrivalsData)} shopId={shopId} onAddToCart={handleAddToCart} viewAll={link({ isNewArrival: 'true' })} />
      </div>
      <Section title="Men's Collection" icon={Star}   color="bg-blue-500"   products={get(mensData)}        shopId={shopId} onAddToCart={handleAddToCart} viewAll={link({ subCategory: 'Mens' })} />
      <div className="bg-white">
        <Section title="Women's Collection" icon={Sparkles} color="bg-pink-500" products={get(womensData)} shopId={shopId} onAddToCart={handleAddToCart} viewAll={link({ subCategory: 'Womens' })} />
      </div>
      <Section title="Kids' Collection" icon={Star}   color="bg-yellow-500" products={get(kidsData)}        shopId={shopId} onAddToCart={handleAddToCart} viewAll={link({ subCategory: 'Kids' })} />
      <div className="bg-white">
        <Section title="Discount Deals" icon={Tag}    color="bg-red-500"    products={get(dealsData).filter((p) => p.discount > 0)} shopId={shopId} onAddToCart={handleAddToCart} viewAll={link({})} />
      </div>
    </div>
  );
}
