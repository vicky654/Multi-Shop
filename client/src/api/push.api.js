import api from './axios';

export const pushApi = {
  /** Register / refresh this device's FCM token for the current user */
  registerToken: (token)  => api.post('/push/register', { token }),

  /** Remove token on logout so stale tokens don't accumulate */
  removeToken:   (token)  => api.post('/push/unregister', { token }),

  /** (Admin) manually send a push to a user — used in testing */
  sendTest: (userId, payload) => api.post('/push/send-test', { userId, ...payload }),
};
