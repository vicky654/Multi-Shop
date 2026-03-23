/**
 * users.api.js — wraps the /auth/staff endpoints.
 *
 * Backend routes (auth.routes.js):
 *   GET    /api/auth/staff        → getStaff    → { data: { staff: [...] } }
 *   POST   /api/auth/staff        → createStaff → { data: { user, token } }
 *   PUT    /api/auth/staff/:id    → updateStaff → { data: { staff } }
 *   DELETE /api/auth/staff/:id    → deleteStaff → { data: {} }
 */
import api from './axios';

export const usersApi = {
  getAll:  ()           => api.get('/auth/staff'),
  create:  (data)       => api.post('/auth/staff', data),
  update:  (id, data)   => api.put(`/auth/staff/${id}`, data),
  delete:  (id)         => api.delete(`/auth/staff/${id}`),
};
