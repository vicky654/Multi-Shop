import axios from './axios';

export const logsApi = {
  getLogs: ({ page = 1, limit = 20, action, status, search, startDate, endDate, shopId, impersonatedOnly, actorId } = {}) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (action)           params.append('action',           action);
    if (status)           params.append('status',           status);
    if (shopId)           params.append('shopId',           shopId);
    if (startDate)        params.append('startDate',        startDate);
    if (endDate)          params.append('endDate',          endDate);
    if (search)           params.append('search',           search);
    if (impersonatedOnly) params.append('impersonatedOnly', 'true');
    if (actorId)          params.append('actorId',          actorId);

    return axios.get(`/logs?${params}`);
  },

  cleanupLogs: () => axios.delete('/logs/cleanup'),
};

