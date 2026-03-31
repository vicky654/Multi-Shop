import api from './axios';

export const insightsApi = {
  restockSuggestions:  (params) => api.get('/insights/restock',              { params }),
  deadStock:           (params) => api.get('/insights/dead-stock',           { params }),
  profitPerProduct:    (params) => api.get('/insights/profit-per-product',   { params }),
  discountSuggestions: (params) => api.get('/insights/discount-suggestions', { params }),
  creditSummary:       (params) => api.get('/insights/credit-summary',       { params }),
  bulkRestock:         (data)   => api.post('/insights/restock-all',          data),
};
