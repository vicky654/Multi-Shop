import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, Users,
  Receipt, BarChart2, Settings, X, Store, ExternalLink,
  Zap, FlaskConical, UserCog, Bell,
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import useShopStore from '../store/shopStore';
import ShopSwitcher from './ShopSwitcher';

const NAV = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard',   perm: 'dashboard'  },
  { to: '/inventory',   icon: Package,         label: 'Inventory',   perm: 'inventory'  },
  { to: '/billing',     icon: ShoppingCart,    label: 'Billing',     perm: 'billing'    },
  { to: '/customers',   icon: Users,           label: 'Customers',   perm: 'customers'  },
  { to: '/expenses',    icon: Receipt,         label: 'Expenses',    perm: 'expenses'   },
  { to: '/reports',     icon: BarChart2,       label: 'Reports',     perm: 'reports'    },
  { to: '/ai-insights', icon: Zap,             label: 'AI Insights', perm: 'ai'         },
  { to: '/roles',       icon: UserCog,         label: 'Roles',       perm: 'roles'      },
  { to: '/settings',    icon: Settings,        label: 'Settings',    perm: 'settings'   },
  { to: '/system-test', icon: FlaskConical,    label: 'System Test', perm: 'settings'   },
];

export default function Sidebar({ open, onClose }) {
  const { can }       = usePermissions();
  const { activeShop } = useShopStore();
  const shopId        = activeShop?._id;

  return (
    <aside className={[
      'fixed inset-y-0 left-0 z-30 w-64 bg-gray-900 text-white flex flex-col',
      'transform transition-transform duration-300',
      open ? 'translate-x-0' : '-translate-x-full',
      'lg:relative lg:translate-x-0 lg:h-full lg:shrink-0',
    ].join(' ')}>

      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Store className="w-4 h-4" />
          </div>
          <span className="font-bold text-lg tracking-tight">MultiShop</span>
        </div>
        <button onClick={onClose} className="lg:hidden p-1 rounded text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Shop switcher */}
      <div className="px-3 py-3 border-b border-gray-700/60">
        <ShopSwitcher />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-1">
        {NAV.filter(({ perm }) => can(perm)).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) => [
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              isActive
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800',
            ].join(' ')}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Customer shop preview link */}
      {shopId && (
        <div className="px-3 pb-3">
          <a
            href={`/shop?shopId=${shopId}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 transition-all"
          >
            <Store className="w-4 h-4 shrink-0" />
            <span>Customer Shop</span>
            <ExternalLink className="w-3 h-3 ml-auto opacity-60" />
          </a>
        </div>
      )}

      {/* Version */}
      <div className="px-5 py-3 border-t border-gray-700/60">
        <p className="text-xs text-gray-500">MultiShop v3.0</p>
      </div>
    </aside>
  );
}
