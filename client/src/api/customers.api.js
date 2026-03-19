import api from './axios';

export const customersApi = {
  getAll:  (params) => api.get('/customers', { params }),
  getOne:  (id)     => api.get(`/customers/${id}`),
  create:  (data)   => api.post('/customers', data),
  update:  (id, d)  => api.put(`/customers/${id}`, d),
  delete:  (id)     => api.delete(`/customers/${id}`),
};
