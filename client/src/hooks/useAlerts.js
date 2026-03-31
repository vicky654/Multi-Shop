import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { alertsApi } from '../api/alerts.api';
import useShopStore from '../store/shopStore';
import useAuthStore from '../store/authStore';

const DISMISSED_KEY = 'ms_dismissed_alerts';

const getDismissed = () => {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'); }
  catch { return []; }
};

export const dismissAlert = (id) => {
  const current = getDismissed();
  if (!current.includes(id)) {
    // Keep only last 50 dismissed IDs to avoid bloat
    const updated = [...current, id].slice(-50);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(updated));
  }
};

export const clearDismissed = () => localStorage.removeItem(DISMISSED_KEY);

export function useAlerts() {
  const { activeShop } = useShopStore();
  const user = useAuthStore((s) => s.user);

  // Only fetch for owner and super_admin
  const enabled = !!user && (user.role === 'owner' || user.role === 'super_admin');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['alerts', activeShop?._id],
    queryFn: () => alertsApi.getAlerts(activeShop?._id || null),
    enabled,
    staleTime: 5 * 60 * 1000,  // 5 min — alerts don't need to be real-time
    gcTime:    10 * 60 * 1000,
  });

  const allAlerts = data?.data?.data?.alerts || [];

  const visibleAlerts = useMemo(() => {
    const dismissed = getDismissed();
    return allAlerts.filter((a) => !dismissed.includes(a.id));
  }, [allAlerts]);

  return { alerts: visibleAlerts, isLoading, refetch, total: allAlerts.length };
}
