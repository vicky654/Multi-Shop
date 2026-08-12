import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Receipt, Wallet, X, Zap } from 'lucide-react';

const ACTIONS = [
  { label: 'Add Product', icon: Package, color: 'bg-purple-500', route: '/inventory', search: '?add=true' },
  { label: 'New Bill',    icon: Receipt,  color: 'bg-blue-500',   route: '/billing'   },
  { label: 'Add Expense', icon: Wallet,   color: 'bg-orange-500', route: '/expenses', search: '?add=true' },
];

export default function QuickActions() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleAction = (action) => {
    setOpen(false);
    navigate(action.route + (action.search || ''));
  };

  return (
    <div className="nav-fab fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-3">
      {/* Action buttons (shown when open) */}
      {open && (
        <div className="flex flex-col items-end gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => handleAction(a)}
              className="flex items-center gap-2.5 bg-white shadow-lg border border-gray-200 rounded-full pl-3 pr-4 py-2.5 text-sm font-medium text-gray-800 hover:shadow-xl transition-all active:scale-95"
            >
              <span className={`${a.color} w-7 h-7 rounded-full flex items-center justify-center`}>
                <a.icon className="w-3.5 h-3.5 text-white" />
              </span>
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* Toggle FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all active:scale-95 ${
          open
            ? 'bg-gray-700 rotate-45'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
        aria-label="Quick actions"
      >
        {open
          ? <X    className="w-6 h-6 text-white" />
          : <Plus className="w-6 h-6 text-white" />
        }
      </button>

      {/* Label (desktop only) */}
      {!open && (
        <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500 bg-white/80 px-2 py-0.5 rounded-full shadow-sm">
          <Zap className="w-3 h-3 text-blue-500" /> Quick Actions
        </span>
      )}
    </div>
  );
}
