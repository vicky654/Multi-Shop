import api from './axios';

/**
 * Tax & Profit module.
 *
 * Read endpoints are owner/manager only and write is owner only, enforced
 * server-side — this client is a convenience, not the boundary.
 */
export const taxApi = {
  // Dashboard for a financial year, e.g. '2026-27'. Omit to use the current one.
  summary: (params) => api.get('/tax/summary', { params }),

  // Expenses whose deduction or ITC treatment a human has not confirmed. These
  // are EXCLUDED from every estimate until decided.
  review:  (params) => api.get('/tax/review', { params }),

  // Per-shop scheme + the accountant-confirmed rate sets, plus the blank template
  // showing which fields still need filling.
  getConfig: (params) => api.get('/tax/config', { params }),
  saveConfig: (data)  => api.put('/tax/config', data),
};
