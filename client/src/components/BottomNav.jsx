import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart,
  BarChart2, MoreHorizontal,
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';

const MAIN_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home',      perm: 'dashboard' },
  { to: '/inventory', icon: Package,         label: 'Inventory', perm: 'inventory' },
  { to: '/billing',   icon: ShoppingCart,    label: 'Billing',   perm: 'billing'   },
  { to: '/reports',   icon: BarChart2,       label: 'Reports',   perm: 'reports'   },
];

export default function BottomNav() {
  const { can } = usePermissions();
  const visible = MAIN_NAV.filter(({ perm }) => can(perm));

  if (visible.length === 0) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 lg:hidden safe-bottom">
      <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${visible.length + 1}, 1fr)` }}>
        {visible.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => [
              'flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
              isActive ? 'text-blue-600' : 'text-gray-500',
            ].join(' ')}
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-blue-50' : ''}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* More button — links to settings */}
        <NavLink
          to="/settings"
          className={({ isActive }) => [
            'flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
            isActive ? 'text-blue-600' : 'text-gray-500',
          ].join(' ')}
        >
          {({ isActive }) => (
            <>
              <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-blue-50' : ''}`}>
                <MoreHorizontal className="w-5 h-5" />
              </div>
              <span>More</span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}
