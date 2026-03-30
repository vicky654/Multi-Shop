import api from './axios';

export const salesApi = {
  getAll:  (params) => api.get('/sales', { params }),
  getOne:  (id)     => api.get(`/sales/${id}`),
  create:  (data)   => api.post('/sales', data),
  refund:  (id)     => api.patch(`/sales/${id}/refund`),
};

// Reports helpers used in billing / daily-closing
export const reportsApi = {
  dailyClosing: (params) => api.get('/reports/daily-closing', { params }),
  dashboard:    (params) => api.get('/reports/dashboard', { params }),
};

// AI helpers used in billing suggestions
export const aiApi = {
  suggestions: (params) => api.get('/ai/suggestions', { params }),
};
