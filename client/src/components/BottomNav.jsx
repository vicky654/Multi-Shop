import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, ClipboardList,
  MoreHorizontal, X, Users, BarChart2, Zap, Megaphone,
  UserCheck, Settings, Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePermissions } from '../hooks/usePermissions';

// ── Primary bottom tabs (always shown) ────────────────────────────────────────
const PRIMARY = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Home',      perm: 'dashboard' },
  { to: '/billing',    icon: ShoppingCart,    label: 'Billing',   perm: 'billing'   },
  { to: '/inventory',  icon: Package,         label: 'Products',  perm: 'inventory' },
  { to: '/orders',     icon: ClipboardList,   label: 'Orders',    perm: 'billing'   },
];

// ── "More" overflow items ──────────────────────────────────────────────────────
const MORE_ITEMS = [
  { to: '/customers',  icon: Users,      label: 'Customers',  perm: 'customers' },
  { to: '/reports',    icon: BarChart2,  label: 'Reports',    perm: 'reports'   },
  { to: '/ai-insights',icon: Zap,        label: 'AI Insights',perm: 'ai'        },
  { to: '/campaigns',  icon: Megaphone,  label: 'Campaigns',  perm: 'customers' },
  { to: '/users',      icon: UserCheck,  label: 'Staff',      perm: 'staff'     },
  { to: '/logs',       icon: Activity,   label: 'Logs',       perm: null        },
  { to: '/settings',   icon: Settings,   label: 'Settings',   perm: 'settings'  },
];

export default function BottomNav() {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);

  const primaryVisible = PRIMARY.filter(({ perm }) => can(perm));
  const moreVisible    = MORE_ITEMS.filter(({ perm }) => can(perm));

  if (primaryVisible.length === 0) return null;

  const allTabs = [...primaryVisible, { key: '__more__' }];

  return (
    <>
      {/* ── Bottom tab bar ───────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur-md border-t border-gray-200/80 lg:hidden safe-bottom">
        <div
          className="grid h-16"
          style={{ gridTemplateColumns: `repeat(${allTabs.length}, 1fr)` }}
        >
          {primaryVisible.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => [
                'flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
                'touch-manipulation select-none active:opacity-60 transition-opacity',
                isActive ? 'text-blue-600' : 'text-gray-400',
              ].join(' ')}
            >
              {({ isActive }) => (
                <>
                  <motion.div
                    whileTap={{ scale: 0.82 }}
                    transition={{ duration: 0.1 }}
                    className={`relative p-1.5 rounded-xl transition-colors ${isActive ? 'bg-blue-50' : ''}`}
                  >
                    <Icon className="w-5 h-5" />
                    {isActive && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600"
                      />
                    )}
                  </motion.div>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setShowMore(true)}
            className={[
              'flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
              'touch-manipulation select-none active:opacity-60 transition-opacity',
              showMore ? 'text-blue-600' : 'text-gray-400',
            ].join(' ')}
          >
            <motion.div
              whileTap={{ scale: 0.82 }}
              transition={{ duration: 0.1 }}
              className={`p-1.5 rounded-xl transition-colors ${showMore ? 'bg-blue-50' : ''}`}
            >
              <MoreHorizontal className="w-5 h-5" />
            </motion.div>
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* ── More sheet overlay ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            className="fixed inset-0 z-30 flex items-end lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowMore(false)}
            />

            {/* Sheet */}
            <motion.div
              className="relative w-full bg-white rounded-t-3xl shadow-2xl z-10 safe-bottom pb-safe"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 380 }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>

              {/* Title row */}
              <div className="flex items-center justify-between px-5 pb-3">
                <span className="text-sm font-semibold text-gray-900">More</span>
                <button
                  onClick={() => setShowMore(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 touch-manipulation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grid of nav items */}
              <div className="grid grid-cols-4 gap-1 px-4 pb-6">
                {moreVisible.map(({ to, icon: Icon, label }) => (
                  <button
                    key={to}
                    onClick={() => { setShowMore(false); navigate(to); }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-2xl hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-gray-600" />
                    </div>
                    <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
