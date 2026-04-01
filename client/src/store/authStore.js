import { create } from 'zustand';
import { authApi } from '../api/auth.api';

// localStorage keys
const TOKEN_KEY        = 'ms_token';
const OWNER_TOKEN_KEY  = 'ms_owner_token';   // saved while impersonating
const OWNER_USER_KEY   = 'ms_owner_user';    // saved while impersonating

const useAuthStore = create((set, get) => ({
  user:    null,
  token:   localStorage.getItem(TOKEN_KEY) || null,
  loading: false,
  initialized: false,

  // ── Impersonation state ────────────────────────────────────────────────────
  isImpersonating: !!localStorage.getItem(OWNER_TOKEN_KEY),
  originalOwner:   (() => {
    try { return JSON.parse(localStorage.getItem(OWNER_USER_KEY) || 'null'); }
    catch { return null; }
  })(),

  // ── Standard auth ─────────────────────────────────────────────────────────
  login: async (credentials) => {
    set({ loading: true });
    try {
      const res = await authApi.login(credentials);
      if (!res?.data?.token) throw new Error('No token received from server');
      localStorage.setItem(TOKEN_KEY, res.data.token);
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
      localStorage.setItem(TOKEN_KEY, res.data.token);
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
      const isImp = !!localStorage.getItem(OWNER_TOKEN_KEY);
      set({
        user:            res.data.user,
        initialized:     true,
        isImpersonating: isImp,
      });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      set({ user: null, token: null, initialized: true, isImpersonating: false });
    }
  },

  logout: () => {
    // If impersonating, clear impersonation state too
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(OWNER_TOKEN_KEY);
    localStorage.removeItem(OWNER_USER_KEY);
    import('./setupStore').then(({ default: useSetupStore }) => {
      useSetupStore.getState().reset();
    });
    set({ user: null, token: null, isImpersonating: false, originalOwner: null });
  },

  // ── Impersonation ──────────────────────────────────────────────────────────
  startImpersonation: async (staffId) => {
    const { user, token } = get();

    // Save owner session before switching
    localStorage.setItem(OWNER_TOKEN_KEY, token);
    localStorage.setItem(OWNER_USER_KEY, JSON.stringify(user));

    const res = await authApi.impersonate(staffId);
    const { token: staffToken, staff } = res.data;

    localStorage.setItem(TOKEN_KEY, staffToken);
    set({
      token:           staffToken,
      user:            staff,
      isImpersonating: true,
      originalOwner:   user,
    });

    return staff;
  },

  stopImpersonation: () => {
    const ownerToken = localStorage.getItem(OWNER_TOKEN_KEY);
    const ownerUser  = (() => {
      try { return JSON.parse(localStorage.getItem(OWNER_USER_KEY) || 'null'); }
      catch { return null; }
    })();

    if (!ownerToken) {
      // Fallback: no saved session — force full logout
      get().logout();
      return;
    }

    localStorage.setItem(TOKEN_KEY, ownerToken);
    localStorage.removeItem(OWNER_TOKEN_KEY);
    localStorage.removeItem(OWNER_USER_KEY);

    set({
      token:           ownerToken,
      user:            ownerUser,
      isImpersonating: false,
      originalOwner:   null,
    });
  },

  isLoggedIn: () => !!get().token,
  hasRole:    (...roles) => roles.includes(get().user?.role),
}));

export default useAuthStore;
