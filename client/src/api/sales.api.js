import api from './axios';

export const salesApi = {
  getAll:   (params) => api.get('/sales', { params }),
  getOne:   (id)     => api.get(`/sales/${id}`),
  create:   (data)   => api.post('/sales', data),
  refund:   (id)     => api.patch(`/sales/${id}/refund`),
  partialRefund: (id, refundItems) => api.patch(`/sales/${id}/partial-refund`, { refundItems }),

  /** Edit a completed bill. Requires `reason`; server appends an audit entry. */
  update:   (id, data) => api.patch(`/sales/${id}`, data),

  /** UPI QR: confirm the money arrived. `transactionId` (UTR) is mandatory. */
  verifyUpi: (id, data) => api.patch(`/sales/${id}/upi/verify`, data),

  /** UPI QR: payment failed or abandoned — restores stock, voids the bill. */
  cancelUpi: (id, data) => api.patch(`/sales/${id}/upi/cancel`, data),
  /**
   * Bulk-sync offline sales.
   * @param {Array} sales — array of sale payloads, each with offlineId
   * @returns { results: [{offlineId, success, saleId?, error?}], synced, failed }
   */
  bulkSync: (sales)  => api.post('/sales/bulk-sync', { sales }),
};

// Reports helpers used in billing / daily-closing
export const reportsApi = {
  dailyClosing: (params) => api.get('/reports/daily-closing', { params }),
  dashboard:    (params) => api.get('/reports/dashboard', { params }),
};

// AI helpers used in billing suggestions
export const aiApi = {
  suggestions: (params) => api.get('/ai/suggestions', { params }),
};
