import api from './axios';

export const expensesApi = {
  getAll:    (params) => api.get('/expenses', { params }),
  getSummary:(params) => api.get('/expenses/summary', { params }),
  create:    (data)   => api.post('/expenses', data),
  update:    (id, d)  => api.put(`/expenses/${id}`, d),
  delete:    (id)     => api.delete(`/expenses/${id}`),

  // Tax treatment. Separate from update() because the server stamps the reviewer
  // and time from the session — those fields are not accepted from a payload.
  classify:     (id, data) => api.patch(`/expenses/${id}/classify`, data),
  classifyBulk: (data)     => api.patch('/expenses/classify-bulk', data),
};
