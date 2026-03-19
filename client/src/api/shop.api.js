import axios from './axios';

// Public API — no auth token needed
export const shopApi = {
  // Products
  getProducts:   (params) => axios.get('/api/products/public', { params }),
  getProduct:    (id)     => axios.get(`/api/products/public/${id}`),
  getCategories: (params) => axios.get('/api/products/public/categories', { params }),

  // Shops (public listing)
  getShops: (params) => axios.get('/api/shops/public', { params }),

  // Checkout
  checkout: (data) => axios.post('/api/sales/public/checkout', data),
};
