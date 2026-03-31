import api from './axios';

export const reportsApi = {
  getSummary:       (params) => api.get('/reports/summary',          { params }),
  dashboard:        (params) => api.get('/reports/dashboard',         { params }),
  salesTrend:       (params) => api.get('/reports/sales-trend',       { params }),
  bestSellers:      (params) => api.get('/reports/best-sellers',      { params }),
  profitLoss:       (params) => api.get('/reports/profit-loss',       { params }),
  paymentBreakdown: (params) => api.get('/reports/payment-breakdown', { params }),
  dailyClosing:     (params) => api.get('/reports/daily-closing',     { params }),
  simpleReport:     (params) => api.get('/reports/simple',            { params }),
};
