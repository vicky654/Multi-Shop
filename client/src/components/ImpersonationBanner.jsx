import { useNavigate }  from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { UserCheck, ArrowLeftCircle, Shield } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useShopStore from '../store/shopStore';
import toast        from 'react-hot-toast';

export default function ImpersonationBanner() {
  const { isImpersonating, user, originalOwner, stopImpersonation } = useAuthStore();
  const { clearShops } = useShopStore();
  const queryClient    = useQueryClient();
  const navigate       = useNavigate();

  if (!isImpersonating) return null;

  const handleExit = () => {
    stopImpersonation();

    // Clear shop + auth caches so DashboardLayout re-fetches with owner context
    clearShops();
    queryClient.invalidateQueries({ queryKey: ['shops'] });
    queryClient.invalidateQueries({ queryKey: ['staff'] });

    toast.success(`Back to ${originalOwner?.name || 'Owner'} account`);
    navigate('/users');
  };

  const roleMeta = {
    manager:         { label: 'Manager',         color: 'text-purple-700 bg-purple-100' },
    billing_staff:   { label: 'Billing Staff',   color: 'text-green-700 bg-green-100'   },
    inventory_staff: { label: 'Inventory Staff', color: 'text-orange-700 bg-orange-100' },
  };
  const meta = roleMeta[user?.role] || { label: user?.role, color: 'text-gray-700 bg-gray-100' };

  return (
    <div className="shrink-0 bg-amber-50 border-b-2 border-amber-400 px-4 py-2.5 flex items-center justify-between gap-3 z-30">
      {/* Left: who you're acting as */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center shrink-0">
          <UserCheck className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900 leading-tight">
            Viewing as&nbsp;
            <span className="font-bold">{user?.name}</span>
          </p>
          <p className="text-xs text-amber-700 flex items-center gap-1.5">
            <Shield className="w-3 h-3 shrink-0" />
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${meta.color}`}>
              {meta.label}
            </span>
            <span className="hidden sm:inline">· Owner: {originalOwner?.name}</span>
          </p>
        </div>
      </div>

      {/* Right: exit button */}
      <button
        onClick={handleExit}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm whitespace-nowrap"
      >
        <ArrowLeftCircle className="w-3.5 h-3.5" />
        Back to Owner
      </button>
    </div>
  );
}
