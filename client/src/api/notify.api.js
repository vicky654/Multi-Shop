import api from './axios';

/**
 * SMS Notification API — /api/notify
 *
 * All responses: { success, message, data }
 * (axios interceptor already unwraps res.data, so you get the body directly)
 */
export const notifyApi = {
  /**
   * Send a custom SMS blast
   * @param {{ shopId, message, customerIds: 'all' | string[] }} data
   */
  send: (data) => api.post('/notify/send', data),

  /**
   * Send due-payment reminders to all credit-sale customers
   * @param {{ shopId }} data
   */
  dueReminders: (data) => api.post('/notify/due-reminders', data),

  /**
   * Send a receipt SMS for a specific sale
   * @param {{ saleId }} data
   */
  receipt: (data) => api.post('/notify/receipt', data),
};
