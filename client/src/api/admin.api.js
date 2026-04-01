import api from './axios';

export const adminApi = {
  getOverview:    ()       => api.get('/admin/overview'),
  getOwners:      ()       => api.get('/admin/owners'),
  getShops:       ()       => api.get('/admin/shops'),
  createOwner:    (data)   => api.post('/admin/owners', data),
  toggleUser:     (id)     => api.patch(`/admin/users/${id}/toggle`),

  // Analytics + Console
  getAnalytics:   (params) => api.get('/admin/analytics',    { params }),
  getConsoleLogs: (params) => api.get('/admin/console-logs', { params }),
};
