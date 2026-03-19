import { Outlet, Link, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Store, Menu, X, Search } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { shopApi } from '../../api/shop.api';
import useCartStore from '../../store/cartStore';

export default function ShopLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [params]  = useSearchParams();
  const shopId    = params.get('shopId');

  const itemCount = useCartStore((s) => s.getItemCount());

  const { data } = useQuery({
    queryKey: ['public-shop', shopId],
    queryFn:  () => shopApi.getShops(),
    enabled:  true,
  });

  const shops = data?.data?.shops || [];
  const activeShop = shopId ? shops.find((s) => s._id === shopId) : shops[0];

  const cartLink = shopId ? `/shop/cart?shopId=${shopId}` : '/shop/cart';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to={shopId ? `/shop?shopId=${shopId}` : '/shop'} className="flex items-center gap-2.5">
              {activeShop?.logo ? (
                <img src={activeShop.logo} alt="" className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Store className="w-4 h-4 text-white" />
                </div>
              )}
              <span className="font-bold text-lg text-gray-900 hidden sm:block">
                {activeShop?.name || 'Shop'}
              </span>
            </Link>

            {/* Nav links */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link to={shopId ? `/shop?shopId=${shopId}` : '/shop'} className="text-gray-600 hover:text-blue-600 transition">Home</Link>
              <Link to={shopId ? `/shop/products?shopId=${shopId}` : '/shop/products'} className="text-gray-600 hover:text-blue-600 transition">All Products</Link>
              <Link to={shopId ? `/shop/products?shopId=${shopId}&subCategory=Mens` : '/shop/products?subCategory=Mens'} className="text-gray-600 hover:text-blue-600 transition">Men</Link>
              <Link to={shopId ? `/shop/products?shopId=${shopId}&subCategory=Womens` : '/shop/products?subCategory=Womens'} className="text-gray-600 hover:text-blue-600 transition">Women</Link>
              <Link to={shopId ? `/shop/products?shopId=${shopId}&subCategory=Kids` : '/shop/products?subCategory=Kids'} className="text-gray-600 hover:text-blue-600 transition">Kids</Link>
            </nav>

            <div className="flex items-center gap-3">
              {/* Cart icon */}
              <Link to={cartLink} className="relative p-2 text-gray-600 hover:text-blue-600 transition">
                <ShoppingCart className="w-6 h-6" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </Link>
              {/* Mobile menu toggle */}
              <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-gray-600">
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-3 space-y-2 text-sm font-medium">
            {[
              ['Home',         shopId ? `/shop?shopId=${shopId}` : '/shop'],
              ['All Products', shopId ? `/shop/products?shopId=${shopId}` : '/shop/products'],
              ['Men',          shopId ? `/shop/products?shopId=${shopId}&subCategory=Mens` : '/shop/products?subCategory=Mens'],
              ['Women',        shopId ? `/shop/products?shopId=${shopId}&subCategory=Womens` : '/shop/products?subCategory=Womens'],
              ['Kids',         shopId ? `/shop/products?shopId=${shopId}&subCategory=Kids` : '/shop/products?subCategory=Kids'],
            ].map(([label, to]) => (
              <Link key={label} to={to} onClick={() => setMenuOpen(false)} className="block py-2 text-gray-700 hover:text-blue-600">{label}</Link>
            ))}
          </div>
        )}
      </header>

      {/* ── Page content ── */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-sm mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="font-semibold text-white mb-1">{activeShop?.name || 'MultiShop'}</p>
          {activeShop?.address && <p>{activeShop.address}</p>}
          {activeShop?.phone   && <p>{activeShop.phone}</p>}
          <p className="mt-4 text-xs text-gray-600">Powered by MultiShop</p>
        </div>
      </footer>
    </div>
  );
}
