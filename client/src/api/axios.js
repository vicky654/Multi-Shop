import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle responses + errors globally
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ms_token');
      window.location.href = '/login';
    }
    const message =
      err.response?.data?.message || err.message || 'Something went wrong';
    // Preserve the HTTP status so callers (e.g. SystemTest) can display it
    const error = new Error(message);
    error.status   = err.response?.status;
    error.response = err.response;          // keep original response reference
    return Promise.reject(error);
  }
);

export default api;
