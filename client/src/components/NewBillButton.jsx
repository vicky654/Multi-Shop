import { useNavigate, useLocation } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import useHeldBillsStore from '../store/heldBillsStore';

/**
 * NewBillButton — always-available shortcut into the POS.
 *
 * Rendered in DashboardLayout so billing is one click (or Ctrl+B) away from
 * every screen. Shows a badge when bills are parked, so a cashier can never
 * forget a held bill. Hidden on the Billing page itself and for users without
 * permission to create sales.
 */
export default function NewBillButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { can }  = usePermissions();
  const heldCount = useHeldBillsStore((s) => s.bills.length);

  if (!can('billing', 'create')) return null;
  if (location.pathname.startsWith('/billing')) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/billing')}
      data-testid="global-new-bill"
      title="New Bill — POS Billing (Ctrl+B)"
      className="nav-fab fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-30 flex items-center gap-2 pl-4 pr-5 py-3
                 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-2xl
                 shadow-lg shadow-blue-600/30 font-bold text-sm transition"
    >
      <Receipt className="w-4 h-4" />
      New Bill
      <kbd className="hidden lg:inline text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded">
        Ctrl+B
      </kbd>
      {heldCount > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-[1.4rem] h-6 px-1.5 flex items-center justify-center
                     rounded-full bg-amber-500 text-white text-[11px] font-black border-2 border-white"
          title={`${heldCount} bill(s) on hold`}
        >
          {heldCount}
        </span>
      )}
    </button>
  );
}
