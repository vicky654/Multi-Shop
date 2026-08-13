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
  (res) => {
    // File downloads need the whole response, not just the body. Unwrapping to
    // res.data throws away the headers — including Content-Disposition, which
    // carries the server's filename. Without it the caller has to invent one,
    // which is how exports were landing as `products-1786606512696.csv`.
    if (res.config?.responseType === 'blob') return res;
    return res.data;
  },
  (err) => {
    // Don't redirect to /login when the failing request IS the login/register call —
    // that would cause a silent page reload instead of showing the error toast.
    const isAuthEndpoint =
      err.config?.url?.includes('/auth/login') ||
      err.config?.url?.includes('/auth/register');

    if (err.response?.status === 401 && !isAuthEndpoint) {
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
