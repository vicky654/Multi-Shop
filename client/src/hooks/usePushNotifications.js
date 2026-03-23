/**
 * usePushNotifications
 *
 * Initialises Capacitor push notifications on native Android/iOS.
 * On web this hook does nothing — all guards use Capacitor.isNativePlatform().
 *
 * Prerequisites (run once in client/):
 *   npm install @capacitor/core @capacitor/push-notifications
 *   npx cap sync
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useNotificationStore from '../store/notificationStore';
import { pushApi } from '../api/push.api';

export function usePushNotifications() {
  const initialized = useRef(false);
  const user        = useAuthStore((s) => s.user);
  const navigate    = useNavigate();
  const { addOne, fetch: fetchNotifications } = useNotificationStore();

  useEffect(() => {
    // Only run on Capacitor native builds; ignore web
    let Capacitor;
    try {
      Capacitor = require('@capacitor/core').Capacitor;
    } catch {
      return; // @capacitor/core not installed
    }
    if (!Capacitor.isNativePlatform() || !user || initialized.current) return;

    initialized.current = true;
    const listeners = [];

    const init = async () => {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      // ── 1. Request permission ───────────────────────────────────────────────
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') {
        console.warn('[Push] Permission denied');
        return;
      }

      // ── 2. Register with FCM / APNs ─────────────────────────────────────────
      await PushNotifications.register();

      // ── 3. Token received → send to backend ─────────────────────────────────
      listeners.push(
        await PushNotifications.addListener('registration', async (token) => {
          try {
            await pushApi.registerToken(token.value);
          } catch (err) {
            console.warn('[Push] Token registration failed:', err.message);
          }
        })
      );

      // ── 4. Notification while app is open ───────────────────────────────────
      listeners.push(
        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          const { title, body, data = {} } = notification;

          // Add to local store so the bell updates immediately
          addOne({
            _id:       `push-${Date.now()}`,
            type:      data.type || 'info',
            title:     title || 'Notification',
            message:   body  || '',
            read:      false,
            link:      data.link || null,
            createdAt: new Date().toISOString(),
          });
        })
      );

      // ── 5. Notification tapped (app was backgrounded / closed) ──────────────
      listeners.push(
        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          // Refresh from server so nothing is missed
          fetchNotifications({ limit: 20 });
          // Deep-link to the page specified in the notification payload
          const link = action.notification?.data?.link;
          if (link) navigate(link);
        })
      );

      // ── 6. Registration error ────────────────────────────────────────────────
      listeners.push(
        await PushNotifications.addListener('registrationError', (err) => {
          console.error('[Push] Registration error:', err.error);
        })
      );
    };

    init().catch((err) => console.error('[Push] Init error:', err));

    return () => {
      listeners.forEach((l) => l?.remove?.());
    };
  }, [user?._id]); // re-run if user changes (login / logout)
}
