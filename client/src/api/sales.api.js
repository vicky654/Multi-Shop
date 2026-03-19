import api from './axios';

export const salesApi = {
  getAll:  (params) => api.get('/sales', { params }),
  getOne:  (id)     => api.get(`/sales/${id}`),
  create:  (data)   => api.post('/sales', data),
  refund:  (id)     => api.patch(`/sales/${id}/refund`),
};
