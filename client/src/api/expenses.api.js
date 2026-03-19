import api from './axios';

export const expensesApi = {
  getAll:    (params) => api.get('/expenses', { params }),
  getSummary:(params) => api.get('/expenses/summary', { params }),
  create:    (data)   => api.post('/expenses', data),
  update:    (id, d)  => api.put(`/expenses/${id}`, d),
  delete:    (id)     => api.delete(`/expenses/${id}`),
};
