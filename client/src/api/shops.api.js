import api from './axios';

export const shopsApi = {
  getAll:   ()       => api.get('/shops'),
  getOne:   (id)     => api.get(`/shops/${id}`),
  create:   (data)   => api.post('/shops', data),
  update:   (id, d)  => api.put(`/shops/${id}`, d),
  delete:   (id)     => api.delete(`/shops/${id}`),
  addStaff: (id, d)  => api.post(`/shops/${id}/staff`, d),
};
