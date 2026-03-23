import api from './axios';





export const authApi = {
  login:       (data) => api.post('/auth/login', data),
  register:    (data) => api.post('/auth/register', data),
  getMe:       ()     => api.get('/auth/me'),
  createStaff: (data) => api.post('/auth/staff', data),
  getStaff:    ()     => api.get('/auth/staff'),
  updateStaff: (id, data) => api.put(`/auth/staff/${id}`, data),
  deleteStaff:         (id)   => api.delete(`/auth/staff/${id}`),
  completeOnboarding:  ()     => api.post('/auth/onboarding/complete'),
};
