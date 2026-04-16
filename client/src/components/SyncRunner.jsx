import { useSyncEngine } from '../hooks/useSyncEngine';

/**
 * Invisible component that mounts the sync engine at the app root.
 * Ensures background sync runs even when the user is not on the Billing page.
 * Drop this inside QueryClientProvider in main.jsx.
 */
export default function SyncRunner() {
  useSyncEngine(); // side-effects only — no render
  return null;
}
