import api from './axios';

export const erpAutomationApi = {
  /** GET /api/erp-automations?shopId= — list all automations + current state */
  list: (shopId) => api.get('/erp-automations', { params: { shopId } }),

  /** PATCH /api/erp-automations/:type/toggle — enable/disable one automation */
  toggle: (type, shopId, enabled) =>
    api.patch(`/erp-automations/${type}/toggle`, { shopId, enabled }),

  /** POST /api/erp-automations/:type/run — trigger immediately */
  runNow: (type, shopId) =>
    api.post(`/erp-automations/${type}/run`, { shopId }),

  /** GET /api/erp-automations/logs?shopId=&type=&limit= — fetch run logs */
  logs: (shopId, type = null, limit = 50) =>
    api.get('/erp-automations/logs', { params: { shopId, ...(type && { type }), limit } }),
};
