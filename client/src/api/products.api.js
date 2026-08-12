import api from './axios';

export const productsApi = {
  getAll:      (params) => api.get('/products', { params }),
  getOne:      (id)     => api.get(`/products/${id}`),
  create:      (data)   => api.post('/products', data),
  update:      (id, d)  => api.put(`/products/${id}`, d),
  delete:      (id)     => api.delete(`/products/${id}`),
  categories:  (params) => api.get('/products/categories', { params }),
  lowStock:    (params) => api.get('/products/low-stock', { params }),

  // AI: analyze a product photo — formData must contain field "image"
  analyzeImage: (formData) =>
    api.post('/products/analyze-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Bulk CSV import — formData must contain field "file"
  importCSV: (formData, onUploadProgress) =>
    api.post('/products/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }),

  // Full server-side export — triggers browser download
  exportCSV: async (params) => {
    const res = await api.get('/products/export', {
      params,
      responseType: 'blob',
    });
    const url  = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href     = url;
    link.download = `products-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },

  // Bulk delete — ids: string[]
  bulkDelete: (ids) => api.delete('/products/bulk', { data: { ids } }),

  // Stock adjustment — delta can be negative (damage/theft) or positive (restock).
  // size/color are REQUIRED for variant-tracked products: root stock is the sum
  // of the matrix cells, so the server refuses a root-only adjustment (400).
  adjustStock: (id, { delta, reason, notes, size, color }) =>
    api.patch(`/products/${id}/adjust-stock`, { delta, reason, notes, size, color }),

  // Bulk audit — items: [{ productId, physicalCount }]
  bulkAuditAdjust: (shopId, items) =>
    api.post('/products/audit/bulk', { shopId, items }),
};
