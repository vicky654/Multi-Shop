import api from './axios';

// Public API — no auth token needed
export const shopApi = {
  // Products
  getProducts:   (params) => api.get('/products/public', { params }),
  getProduct:    (id)     => api.get(`/products/public/${id}`),
  getCategories: (params) => api.get('/products/public/categories', { params }),

  // Shops (public listing)
  getShops:      (params) => api.get('/shops/public', { params }),
  getShopById:   (id)     => api.get(`/shops/public/${id}`),
  getShopBySlug: (slug)   => api.get(`/shops/public/slug/${slug}`),

  // Checkout
  checkout: (data) => api.post('/sales/public/checkout', data),
};
