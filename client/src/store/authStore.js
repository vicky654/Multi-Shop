import { create } from 'zustand';
import { authApi } from '../api/auth.api';

const useAuthStore = create((set, get) => ({
  user:    null,
  token:   localStorage.getItem('ms_token') || null,
  loading: false,
  initialized: false,

  login: async (credentials) => {
    set({ loading: true });
    try {
      const res = await authApi.login(credentials);
  
      if (!res?.data?.token) throw new Error('No token received from server');
      localStorage.setItem('ms_token', res.data.token);
      set({ user: res.data.user, token: res.data.token, loading: false });
      return res.data;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  register: async (data) => {
    set({ loading: true });
    try {
      const res = await authApi.register(data);
      if (!res?.data?.token) throw new Error('No token received from server');
      localStorage.setItem('ms_token', res.data.token);
      set({ user: res.data.user, token: res.data.token, loading: false });
      return res.data;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  fetchMe: async () => {
    try {
      const res = await authApi.getMe();
      set({ user: res.data.user, initialized: true });
    } catch {
      localStorage.removeItem('ms_token');
      set({ user: null, token: null, initialized: true });
    }
  },

  logout: () => {
    localStorage.removeItem('ms_token');
    // Reset setup flags so the next user starts with a clean slate
    import('./setupStore').then(({ default: useSetupStore }) => {
      useSetupStore.getState().reset();
    });
    set({ user: null, token: null });
  },

  isLoggedIn: () => !!get().token,
  hasRole: (...roles) => roles.includes(get().user?.role),
}));

export default useAuthStore;
