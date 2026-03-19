import api from './axios';

export const productsApi = {
  getAll:      (params) => api.get('/products', { params }),
  getOne:      (id)     => api.get(`/products/${id}`),
  create:      (data)   => api.post('/products', data),
  update:      (id, d)  => api.put(`/products/${id}`, d),
  delete:      (id)     => api.delete(`/products/${id}`),
  categories:  (params) => api.get('/products/categories', { params }),
  lowStock:    (params) => api.get('/products/low-stock', { params }),
};
