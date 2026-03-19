import api from './axios';

export const reportsApi = {
  dashboard:        (params) => api.get('/reports/dashboard', { params }),
  salesTrend:       (params) => api.get('/reports/sales-trend', { params }),
  bestSellers:      (params) => api.get('/reports/best-sellers', { params }),
  profitLoss:       (params) => api.get('/reports/profit-loss', { params }),
  paymentBreakdown: (params) => api.get('/reports/payment-breakdown', { params }),
};
