import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, ArrowLeft, Check, Package } from 'lucide-react';
import { shopApi } from '../../api/shop.api';
import useCartStore from '../../store/cartStore';
import toast from 'react-hot-toast';

export default function ShopProductDetail() {
  const { id }    = useParams();
  const [params]  = useSearchParams();
  const shopId    = params.get('shopId');
  const addItem   = useCartStore((s) => s.addItem);

  const [selectedSize,   setSelectedSize]   = useState('');
  const [selectedColor,  setSelectedColor]  = useState('');
  const [activeImage,    setActiveImage]     = useState(0);
  const [added,          setAdded]           = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pub-product', id],
    queryFn:  () => shopApi.getProduct(id),
  });

  const product = data?.data?.product;

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

  const back = shopId ? `/shop/products?shopId=${shopId}` : '/shop/products';
  const cartLink = shopId ? `/shop/cart?shopId=${shopId}` : '/shop/cart';

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-pulse">
          <div className="aspect-square bg-gray-200 rounded-2xl" />
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/2" />
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-5 bg-gray-200 rounded w-1/4" />
            <div className="h-24 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Package className="w-12 h-12 mb-3" />
        <p className="font-medium">Product not found</p>
        <Link to={back} className="mt-3 text-sm text-blue-600 hover:underline">← Back to products</Link>
      </div>
    );
  }

  const images  = product.images?.length > 0 ? product.images : product.image ? [product.image] : [];
  const fp      = product.price * (1 - (product.discount || 0) / 100);
  const savings = product.price - fp;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <Link to={back} className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Back to products
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* ── Image gallery ── */}
        <div>
          <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 aspect-square">
            {images.length > 0 ? (
              <img src={images[activeImage]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <Package className="w-16 h-16" />
              </div>
            )}
          </div>
          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 mt-3">
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImage(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition ${activeImage === i ? 'border-blue-600' : 'border-transparent hover:border-gray-300'}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Product info ── */}
        <div className="space-y-5">
          {/* Category + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{product.category}</span>
            {product.subCategory && <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">{product.subCategory}</span>}
            {product.isNewArrival && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">New Arrival</span>}
            {product.isTrending  && <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">Trending</span>}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">{product.name}</h1>

          {/* Price */}
          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-gray-900">₹{fp.toLocaleString('en-IN')}</span>
              {product.discount > 0 && (
                <>
                  <span className="text-lg text-gray-400 line-through">₹{product.price.toLocaleString('en-IN')}</span>
                  <span className="px-2.5 py-0.5 bg-red-100 text-red-600 text-sm font-bold rounded-full">{product.discount}% off</span>
                </>
              )}
            </div>
            {savings > 0 && <p className="text-sm text-green-600 mt-1 font-medium">You save ₹{savings.toLocaleString('en-IN')}</p>}
          </div>

          {/* Stock */}
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2.5 h-2.5 rounded-full ${product.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={product.stock > 0 ? 'text-green-700' : 'text-red-600'}>
              {product.stock > 0 ? `In Stock (${product.stock} ${product.unit || 'pcs'} available)` : 'Out of Stock'}
            </span>
          </div>

          {/* Sizes */}
          {product.sizes?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Select Size *</p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button key={s} onClick={() => setSelectedSize(s)}
                    className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition ${
                      selectedSize === s
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-200 text-gray-700 hover:border-blue-400'
                    }`}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* Colors */}
          {product.colors?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Select Color{selectedColor ? `: ${JSON.parse(selectedColor)?.name}` : ''}
              </p>
              <div className="flex gap-3 flex-wrap">
                {product.colors.map((c) => {
                  const val    = JSON.stringify(c);
                  const active = selectedColor === val;
                  return (
                    <button key={c.hex} title={c.name} onClick={() => setSelectedColor(active ? '' : val)}
                      className={`w-8 h-8 rounded-full border-4 transition ${active ? 'border-blue-600 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: c.hex }} />
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div className="prose prose-sm max-w-none">
              <p className="text-sm font-semibold text-gray-700 mb-1">Description</p>
              <p className="text-gray-600 text-sm leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Add to cart */}
          <div className="flex gap-3 pt-2">
            <button onClick={handleAddToCart} disabled={product.stock < 1}
              className={`flex-1 py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition shadow-md ${
                added
                  ? 'bg-green-500 text-white'
                  : product.stock < 1
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}>
              {added ? <><Check className="w-5 h-5" /> Added!</> : <><ShoppingCart className="w-5 h-5" /> Add to Cart</>}
            </button>
            {added && (
              <Link to={cartLink}
                className="px-6 py-4 border-2 border-blue-600 text-blue-600 font-bold rounded-2xl hover:bg-blue-50 transition text-sm">
                View Cart
              </Link>
            )}
          </div>

          {/* Meta info */}
          {(product.sku || product.barcode) && (
            <div className="text-xs text-gray-400 space-y-0.5">
              {product.sku     && <p>SKU: {product.sku}</p>}
              {product.barcode && <p>Barcode: {product.barcode}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
