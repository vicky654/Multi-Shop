import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * useGlobalShortcuts — app-wide keyboard shortcuts, mounted once in
 * DashboardLayout so they work from every screen.
 *
 *   Ctrl/Cmd + B → jump to POS Billing (new bill)
 *
 * Deliberately narrow: the Billing page owns its own F1–F7 / Ctrl+Enter map
 * (see useKeyboardShortcuts). Ctrl+B is not used there, and this handler
 * no-ops while already on /billing so it can never disturb an open bill.
 */
export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() !== 'b') return;

      // Don't hijack the browser's own bookmark bar toggle inside a text field,
      // and never fire while the cashier is already billing.
      if (location.pathname.startsWith('/billing')) return;

      e.preventDefault();
      navigate('/billing');
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, location.pathname]);
}
