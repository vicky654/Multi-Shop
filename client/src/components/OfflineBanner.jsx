import { WifiOff } from 'lucide-react';
import { useOffline } from '../hooks/useOffline';

export default function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) return null;

  return (
    <div className="shrink-0 bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>You are offline — changes will not be saved until reconnected</span>
    </div>
  );
}
