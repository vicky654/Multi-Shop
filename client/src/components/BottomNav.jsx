import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart,
  BarChart2, Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { usePermissions } from '../hooks/usePermissions';

const MAIN_NAV = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Home',      perm: 'dashboard', tour: 'bottom-home'      },
  { to: '/inventory',   icon: Package,         label: 'Products',  perm: 'inventory', tour: 'nav-inventory'    },
  { to: '/billing',     icon: ShoppingCart,    label: 'Billing',   perm: 'billing',   tour: 'nav-billing'      },
  { to: '/reports',     icon: BarChart2,       label: 'Reports',   perm: 'reports',   tour: 'nav-reports'      },
  { to: '/ai-insights', icon: Zap,             label: 'AI',        perm: 'ai',        tour: 'nav-ai'           },
];

export default function BottomNav() {
  const { can } = usePermissions();
  const visible = MAIN_NAV.filter(({ perm }) => can(perm));

  if (visible.length === 0) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur-sm border-t border-gray-200 lg:hidden safe-bottom">
      <div
        className="grid h-16"
        style={{ gridTemplateColumns: `repeat(${visible.length}, 1fr)` }}
      >
        {visible.map(({ to, icon: Icon, label, tour }) => (
          <NavLink
            key={to}
            to={to}
            data-tour={tour}
            className={({ isActive }) => [
              'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
              'touch-manipulation select-none active:opacity-70 transition-opacity',
              isActive ? 'text-blue-600' : 'text-gray-400',
            ].join(' ')}
          >
            {({ isActive }) => (
              <>
                <motion.div
                  whileTap={{ scale: 0.85 }}
                  transition={{ duration: 0.1 }}
                  className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-blue-50' : ''}`}
                >
                  <Icon className="w-5 h-5" />
                </motion.div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
