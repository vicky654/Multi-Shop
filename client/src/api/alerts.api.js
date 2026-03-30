import axios from './axios';

export const alertsApi = {
  getAlerts: (shopId = null) => {
    const params = shopId ? `?shopId=${shopId}` : '';
    return axios.get(`/alerts${params}`);
  }
};

