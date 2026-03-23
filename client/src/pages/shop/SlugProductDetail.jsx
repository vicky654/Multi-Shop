import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart, ArrowLeft, Check, Package,
  Phone, MessageCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { shopApi } from '../../api/shop.api';
import useCartStore from '../../store/cartStore';

export default function SlugProductDetail() {
  const { slug, id }  = useParams();
  const addItem       = useCartStore((s) => s.addItem);
  const cartCount     = useCartStore((s) => s.getItemCount());

  const [selectedSize,  setSelectedSize]  = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [activeImage,   setActiveImage]   = useState(0);
  const [added,         setAdded]         = useState(false);

  // Fetch product
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pub-product', id],
    queryFn:  () => shopApi.getProduct(id),
    staleTime: 5 * 60 * 1000,
  });

  // Also fetch shop for WhatsApp number (cached from parent page visit)
  const { data: shopData } = useQuery({
    queryKey: ['public-shop-slug', slug],
    queryFn:  () => shopApi.getShopBySlug(slug),
    staleTime: 5 * 60 * 1000,
  });

  const product = data?.data?.product;
  const shop    = shopData?.data?.shop;

  const handleAddToCart = () => {
    if (!product) return;
    if (product.sizes?.length > 0 && !selectedSize) {
      toast.error('Please select a size'); return;
    }
    addItem(product, selectedSize, selectedColor ? JSON.parse(selectedColor)?.name : '');
    setAdded(true);
    toast.success('Added to cart!');
    setTimeout(() => setAdded(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!shop?.phone) { toast.error('Shop phone not available'); return; }
    const msg = encodeURIComponent(
      `Hi! I'm interested in *${product?.name}*${selectedSize ? ` (Size: ${selectedSize})` : ''}. Is it available?`
    );
    const phone = shop.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-pulse">
            <div className="aspect-square bg-gray-200 rounded-3xl" />
            <div className="space-y-4 pt-4">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-8 bg-gray-200 rounded w-3/4" />
              <div className="h-6 bg-gray-200 rounded w-1/4" />
              <div className="h-24 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <Package className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-xl font-bold text-gray-700">Product not found</h1>
        <Link to={`/shop/${slug}`} className="mt-4 text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to shop
        </Link>
      </div>
    );
  }

  const images  = product.images?.length > 0 ? product.images : product.image ? [product.image] : [];
  const fp      = product.price * (1 - (product.discount || 0) / 100);
  const savings = product.price - fp;
  const prev    = () => setActiveImage((i) => (i - 1 + images.length) % images.length);
  const next    = () => setActiveImage((i) => (i + 1) % images.length);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mini nav */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            to={`/shop/${slug}`}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition"
          >
            <ArrowLeft className="w-4 h-4" /> {shop?.name || 'Back'}
          </Link>
          <Link
            to={`/shop/${slug}/cart`}
            className="relative p-2 text-gray-600 hover:text-blue-600"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

          {/* ── Image gallery ── */}
          <div className="space-y-3">
            <div className="relative rounded-3xl overflow-hidden border border-gray-100 bg-white aspect-square shadow-sm">
              {images.length > 0 ? (
                <img
                  src={images[activeImage]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <Package className="w-20 h-20" />
                </div>
              )}
              {images.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    onClick={next}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>
                  {/* Dot indicators */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImage(i)}
                        className={`w-2 h-2 rounded-full transition ${
                          i === activeImage ? 'bg-blue-600 w-5' : 'bg-white/70'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition ${
                      activeImage === i ? 'border-blue-600' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Product info ── */}
          <div className="space-y-5">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                {product.category}
              </span>
              {product.subCategory && (
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                  {product.subCategory}
                </span>
              )}
              {product.isNewArrival && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                  New Arrival
                </span>
              )}
              {product.isTrending && (
                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                  Trending
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug">
              {product.name}
            </h1>

            {/* Price */}
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-extrabold text-gray-900">
                  ₹{fp.toLocaleString('en-IN')}
                </span>
                {product.discount > 0 && (
                  <>
                    <span className="text-xl text-gray-400 line-through">
                      ₹{product.price.toLocaleString('en-IN')}
                    </span>
                    <span className="px-2.5 py-0.5 bg-red-100 text-red-600 text-sm font-bold rounded-full">
                      {product.discount}% off
                    </span>
                  </>
                )}
              </div>
              {savings > 0 && (
                <p className="text-sm text-green-600 mt-1 font-medium">
                  You save ₹{savings.toLocaleString('en-IN')}
                </p>
              )}
            </div>

            {/* Stock status */}
            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2.5 h-2.5 rounded-full ${product.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={product.stock > 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                {product.stock > 0
                  ? `In Stock — ${product.stock} ${product.unit || 'pcs'} available`
                  : 'Out of Stock'}
              </span>
            </div>

            {/* Size selector */}
            {product.sizes?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Select Size
                  {selectedSize && <span className="ml-2 text-blue-600">{selectedSize}</span>}
                  <span className="text-red-500 ml-1">*</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSize(s === selectedSize ? '' : s)}
                      className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition ${
                        selectedSize === s
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-200 text-gray-700 hover:border-blue-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color selector */}
            {product.colors?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Select Color
                  {selectedColor && (
                    <span className="ml-2 text-blue-600">{JSON.parse(selectedColor)?.name}</span>
                  )}
                </p>
                <div className="flex gap-3 flex-wrap">
                  {product.colors.map((c) => {
                    const val    = JSON.stringify(c);
                    const active = selectedColor === val;
                    return (
                      <button
                        key={c.hex}
                        title={c.name}
                        onClick={() => setSelectedColor(active ? '' : val)}
                        className={`w-10 h-10 rounded-full border-4 transition ${
                          active ? 'border-blue-600 scale-110 shadow-lg' : 'border-transparent hover:scale-105 hover:border-gray-300'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Description</p>
                <p className="text-gray-600 text-sm leading-relaxed">{product.description}</p>
              </div>
            )}

            {/* CTA buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAddToCart}
                disabled={product.stock < 1}
                className={`flex-1 py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition shadow-md ${
                  added
                    ? 'bg-green-500 text-white shadow-green-200'
                    : product.stock < 1
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                }`}
              >
                {added
                  ? <><Check className="w-5 h-5" /> Added!</>
                  : <><ShoppingCart className="w-5 h-5" /> Add to Cart</>
                }
              </button>
              {shop?.phone && (
                <button
                  onClick={handleWhatsApp}
                  className="flex items-center gap-2 px-5 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl transition shadow-md shadow-green-200 whitespace-nowrap text-sm"
                >
                  <MessageCircle className="w-5 h-5" />
                  WhatsApp
                </button>
              )}
            </div>

            {/* SKU / Barcode */}
            {(product.sku || product.barcode) && (
              <div className="text-xs text-gray-400 space-y-0.5 pt-2 border-t border-gray-100">
                {product.sku     && <p>SKU: {product.sku}</p>}
                {product.barcode && <p>Barcode: {product.barcode}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
