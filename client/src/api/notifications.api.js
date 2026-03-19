import api from './axios';

export const notificationsApi = {
  getAll:          (params) => api.get('/notifications', { params }),
  markRead:        (ids)    => api.put('/notifications/read', { ids }),
  markAllRead:     ()       => api.put('/notifications/read-all'),
  delete:          (id)     => api.delete(`/notifications/${id}`),
  clearAll:        ()       => api.delete('/notifications/clear-all'),
  triggerLowStock: ()       => api.post('/notifications/trigger-low-stock'),
};
