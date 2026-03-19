import api from './axios';

export const aiApi = {
  summary:    (params) => api.get('/ai/summary',     { params }),
  fastMoving: (params) => api.get('/ai/fast-moving', { params }),
  restock:    (params) => api.get('/ai/restock',     { params }),
  discounts:  (params) => api.get('/ai/discounts',   { params }),
  trend:      (params) => api.get('/ai/trend',       { params }),
};
