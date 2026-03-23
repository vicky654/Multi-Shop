import api from './axios';

export const campaignsApi = {
  send:             (data)     => api.post('/campaigns', data),
  history:          (params)   => api.get('/campaigns', { params }),
  sendReceipt:      (data)     => api.post('/campaigns/receipt', data),
  getDailySummary:  (shopId)   => api.get('/campaigns/daily-summary', { params: { shopId } }),
  sendDailySummary: (shopId)   => api.post('/campaigns/daily-summary', { shopId }),
  getSegments:      (shopId)   => api.get('/campaigns/segments',    { params: { shopId } }),
  getSuggestions:   (shopId)   => api.get('/campaigns/suggestions', { params: { shopId } }),
  getStats:         (shopId)   => api.get('/campaigns/stats',       { params: { shopId } }),
  /**
   * Fetch resolved customers (name + phone) for a target segment.
   * Used for client-side WhatsApp link generation.
   * @param {string}   shopId
   * @param {string}   targetType  — 'all' | 'pending_dues' | 'inactive' | …
   * @param {string[]} targetIds   — only for 'selected' target type
   */
  getSegmentCustomers: (shopId, targetType = 'all', targetIds = []) =>
    api.get('/campaigns/segment-customers', {
      params: { shopId, targetType, targetIds: JSON.stringify(targetIds) },
    }),
};

export const automationsApi = {
  getAll:  (shopId) => api.get('/automations', { params: { shopId } }),
  create:  (data)   => api.post('/automations', data),
  update:  (id, d)  => api.patch(`/automations/${id}`, d),
  toggle:  (id)     => api.patch(`/automations/${id}/toggle`),
  remove:  (id)     => api.delete(`/automations/${id}`),
};
