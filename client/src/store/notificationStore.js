import { create } from 'zustand';
import { notificationsApi } from '../api/notifications.api';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  lastFetched: null,

  fetch: async (params = {}) => {
    set({ loading: true });
    try {
      const res = await notificationsApi.getAll(params);
      const data = res.data;
      const list = data.notifications || data || [];
      const unread = list.filter((n) => !n.read).length;
      set({ notifications: list, unreadCount: unread, loading: false, lastFetched: Date.now() });
    } catch {
      set({ loading: false });
    }
  },

  markRead: async (ids) => {
    await notificationsApi.markRead(ids);
    set((s) => ({
      notifications: s.notifications.map((n) =>
        ids.includes(n._id) ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - ids.filter((id) =>
        s.notifications.find((n) => n._id === id && !n.read)
      ).length),
    }));
  },

  markAllRead: async () => {
    await notificationsApi.markAllRead();
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  remove: async (id) => {
    await notificationsApi.delete(id);
    set((s) => {
      const n = s.notifications.find((n) => n._id === id);
      return {
        notifications: s.notifications.filter((n) => n._id !== id),
        unreadCount: n && !n.read ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
      };
    });
  },

  clearAll: async () => {
    await notificationsApi.clearAll();
    set({ notifications: [], unreadCount: 0 });
  },

  // Optimistic unread count bump (called when server pushes new notification)
  addOne: (notification) => {
    set((s) => ({
      notifications: [notification, ...s.notifications],
      unreadCount: s.unreadCount + 1,
    }));
  },
}));

export default useNotificationStore;
