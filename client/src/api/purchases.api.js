import api from './axios';

export const purchasesApi = {
  getAll:    (params) => api.get('/purchases', { params }),
  create:    (data)   => api.post('/purchases', data),
  update:    (id, d)  => api.put(`/purchases/${id}`, d),
  // Posting MOVES INVENTORY. Cancel reverses the recorded movement.
  post:      (id)     => api.patch(`/purchases/${id}/post`),
  cancel:    (id, d)  => api.patch(`/purchases/${id}/cancel`, d),
  valuation: (params) => api.get('/purchases/valuation', { params }),
  // Records the current inventory valuation as this FY's opening stock.
  openingSnapshot: (data) => api.post('/purchases/opening-snapshot', data),
};
