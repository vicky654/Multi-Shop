import api from './axios';

export const demoApi = {
  seed:  (shopId) => api.post('/demo/seed',  { shopId }),
  clear: (shopId) => api.delete('/demo/clear', { data: { shopId } }),
};
