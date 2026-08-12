import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, Users,
  Receipt, BarChart2, Settings, X, Store, ExternalLink,
  Zap, FlaskConical, UserCog, UserCheck, Shield, CheckCircle, Circle,
  ChevronRight, ChevronLeft, Sparkles, BookOpen, Megaphone, Activity, PanelLeftClose, PanelLeftOpen,
  ClipboardList, Bot,
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import useShopStore  from '../store/shopStore';
import useAuthStore  from '../store/authStore';
import useSetupStore from '../store/setupStore';
import useThemeStore from '../store/themeStore';
import ShopSwitcher from './ShopSwitcher';
import AppFlowGuide from './AppFlowGuide';

// ── Navigation items ───────────────────────────────────────────────────────────
const NAV = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard',   perm: 'dashboard'  },
  { to: '/inventory',   icon: Package,         label: 'Inventory',   perm: 'inventory',  tour: 'nav-inventory' },
  { to: '/billing',     icon: ShoppingCart,    label: 'Billing',     perm: 'billing',    tour: 'nav-billing'   },
  { to: '/orders',      icon: ClipboardList,   label: 'Orders',      perm: 'billing'    },
  { to: '/customers',   icon: Users,           label: 'Customers',   perm: 'customers'  },
  { to: '/expenses',    icon: Receipt,         label: 'Expenses',    perm: 'expenses'   },
  { to: '/reports',     icon: BarChart2,       label: 'Reports',     perm: 'reports',    tour: 'nav-reports'   },
  { to: '/ai-insights', icon: Zap,             label: 'AI Insights', perm: 'ai',         tour: 'nav-ai'        },
  { to: '/campaigns',   icon: Megaphone,       label: 'Campaigns',   perm: 'customers'  },
  { to: '/automations', icon: Bot,             label: 'Automations', perm: 'inventory'  },
  { to: '/roles',       icon: UserCog,         label: 'Roles',       perm: 'roles'      },
  { to: '/users',       icon: UserCheck,       label: 'Staff',       perm: 'staff'      },
{ to: '/admin',       icon: Shield,          label: 'Admin',       perm: null, superAdminOnly: true },
  { to: '/logs',        icon: Activity,         label: 'Logs',        perm: null, superAdminOnly: false },  // owner + super_admin
  { to: '/settings',    icon: Settings,        label: 'Settings',    perm: 'settings'   },
  { to: '/system-test', icon: FlaskConical,    label: 'System Test', perm: 'settings'   },
];

// ── Setup step definitions ─────────────────────────────────────────────────────
const SETUP_STEPS = [
  { key: 'shop',     label: 'Create your shop',     route: '/settings',  hint: 'Name, currency, address'  },
  { key: 'product',  label: 'Add a product',         route: '/inventory', hint: 'Price, stock, variants'   },
  { key: 'customer', label: 'Add a customer',        route: '/customers', hint: 'Name, phone, contacts'    },
  { key: 'sale',     label: 'Make your first sale',  route: '/billing',   hint: 'POS billing screen'       },
];

// ── SetupProgress ──────────────────────────────────────────────────────────────
// Receives computed steps/completed from parent — no store read inside.
function SetupProgress({ steps, completed, onOpenSetup, onClose }) {
  // Index of the first incomplete step → that step is "current"
  const currentIdx = SETUP_STEPS.findIndex((s) => !steps[s.key]);

  return (
    <div className="mx-3 my-2 rounded-xl bg-gray-800 border border-gray-700/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-xs font-bold text-white">Quick Setup</span>
        </div>
        <span className="text-[10px] font-semibold text-gray-400 bg-gray-700 px-1.5 py-0.5 rounded-full">
          {completed}/4
        </span>
      </div>

      {/* Progress bar */}
      <div className="mx-3 mb-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-700"
          style={{ width: `${(completed / 4) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <div className="px-2 pb-2 space-y-0.5">
        {SETUP_STEPS.map((step, i) => {
          const isDone    = steps[step.key];
          const isCurrent = i === currentIdx;

          return (
            <NavLink
              key={step.key}
              to={step.route}
              onClick={onClose}
              title={step.hint}
              className={[
                'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all group',
                isDone
                  ? 'text-green-400 opacity-60'
                  : isCurrent
                  ? 'text-white bg-gray-700/70 font-semibold'
                  : 'text-gray-500 hover:text-gray-300',
              ].join(' ')}
            >
              {isDone ? (
                <CheckCircle className="w-3.5 h-3.5 shrink-0 text-green-400" />
              ) : isCurrent ? (
                <ChevronRight className="w-3.5 h-3.5 shrink-0 text-blue-400 group-hover:translate-x-0.5 transition-transform" />
              ) : (
                <Circle className="w-3.5 h-3.5 shrink-0 text-gray-600" />
              )}
              <span className={isDone ? 'line-through' : ''}>{step.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* CTA */}
      <div className="px-3 pb-3">
        <button
          onClick={onOpenSetup}
          className="w-full py-1.5 text-xs font-semibold text-blue-400 hover:text-white bg-gray-700/50 hover:bg-blue-600 rounded-lg transition-all flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-3 h-3" />
          Open Setup Guide
        </button>
      </div>
    </div>
  );
}


// ── HorizontalNav ──────────────────────────────────────────────────────────────
/**
 * The top/bottom navigation bar, desktop only.
 *
 * A horizontal bar cannot carry everything the vertical rail does — the setup
 * stepper and shop switcher are tall, column-shaped things. Rather than drop
 * those features, they collapse to icon buttons here so nothing becomes
 * unreachable: Setup opens the same guide modal, and the shop switcher stays as
 * a compact control on the right.
 */
function HorizontalNav({
  role, can, showSetup, nextRoute, onOpenSetup, onToggleGuide, shopSlug, shopId,
}) {
  const items = NAV.filter(({ perm, superAdminOnly }) =>
    superAdminOnly ? role === 'super_admin' : can(perm));

  return (
    <nav className="hidden lg:flex shrink-0 items-center gap-2 bg-gray-900 text-white
                    border-b border-gray-700/60 px-4 h-14">
      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0 pr-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-inner">
          <Store className="w-4 h-4" />
        </div>
        <span className="font-bold tracking-tight">MultiShop</span>
      </div>

      {/* Links — scroll horizontally rather than wrap, so the bar keeps its height */}
      <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {items.map(({ to, icon: Icon, label, tour }) => {
          const isNext = showSetup && to === nextRoute;
          return (
            <NavLink
              key={to}
              to={to}
              title={label}
              {...(tour ? { 'data-tour': tour } : {})}
              className={({ isActive }) => [
                'shrink-0 flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800',
              ].join(' ')}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
              {isNext && (
                <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                  NEXT
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Right cluster — the rail's extras, compacted to icons */}
      <div className="flex items-center gap-1 shrink-0 pl-2 border-l border-gray-700/60">
        {showSetup && (
          <button
            onClick={onOpenSetup}
            title="Open setup guide"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-blue-400 hover:text-white hover:bg-blue-600 transition"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onToggleGuide}
          title="How it works"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition"
        >
          <BookOpen className="w-4 h-4" />
        </button>
        {shopId && (
          <a
            href={shopSlug ? `/shop/${shopSlug}` : `/shop?shopId=${shopId}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Customer Shop"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 transition"
          >
            <Store className="w-4 h-4" />
          </a>
        )}
        <div className="w-48 pl-1">
          <ShopSwitcher />
        </div>
      </div>
    </nav>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
export default function Sidebar({ open, onClose, onOpenSetup }) {
  // Position is an appearance preference like theme/accent, so it lives in the
  // same store. Only honoured from lg: upward — see SIDEBAR_POSITIONS.
  const sidebarPosition = useThemeStore((s) => s.sidebarPosition);
  const isHorizontal = sidebarPosition === 'top' || sidebarPosition === 'bottom';
  const isRight      = sidebarPosition === 'right';

  const [showGuide, setShowGuide] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );

  const toggleCollapse = () => {
    setCollapsed((v) => {
      localStorage.setItem('sidebar_collapsed', String(!v));
      return !v;
    });
  };

  const { can, role }  = usePermissions();
  const { activeShop } = useShopStore();
  const user           = useAuthStore((s) => s.user);
  const getProgress    = useSetupStore((s) => s.getProgress);
  const shopId         = activeShop?._id;

  // Compute full progress (all 4 flags + activeShop)
  const { steps, completed, isComplete } = getProgress(activeShop);
  const showSetup = !!user && !isComplete;

  // Determine which nav item should get the "NEXT" badge
  const nextRoute = !steps.shop     ? '/settings'
    : !steps.product  ? '/inventory'
    : !steps.customer ? '/customers'
    : !steps.sale     ? '/billing'
    : null;

  return (
    <>
      <aside className={[
        'fixed inset-y-0 z-30 bg-gray-900 text-white flex flex-col',
        'transform transition-all duration-300',
        // The drawer slides in from whichever edge it is anchored to.
        isRight ? 'right-0' : 'left-0',
        open ? 'translate-x-0' : (isRight ? 'translate-x-full' : '-translate-x-full'),
        'lg:relative lg:translate-x-0 lg:h-full lg:shrink-0',
        // Top/bottom get a horizontal bar at lg+, but keep this vertical drawer
        // on small screens: re-anchoring the drawer would break navigation on
        // phones to serve a preference that only applies to large screens.
        isHorizontal ? 'lg:hidden' : '',
        collapsed ? 'w-16' : 'w-64',
      ].join(' ')}>

        {/* Logo */}
        <div className={`flex items-center border-b border-gray-700/60 ${collapsed ? 'justify-center px-0 py-4' : 'justify-between px-5 py-4'}`}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-inner">
                <Store className="w-4 h-4" />
              </div>
              <span className="font-bold text-lg tracking-tight">MultiShop</span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-inner">
              <Store className="w-4 h-4" />
            </div>
          )}
          {/* Mobile close / Desktop collapse toggle */}
          <button onClick={onClose} className="lg:hidden p-1 rounded text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex p-1 rounded text-gray-400 hover:text-white transition"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Shop switcher */}
        {!collapsed && (
          <div className="px-3 py-3 border-b border-gray-700/60">
            <ShopSwitcher />
          </div>
        )}

        {/* Onboarding stepper — shown until all 4 steps complete */}
        {showSetup && !collapsed && (
          <SetupProgress
            steps={steps}
            completed={completed}
            onOpenSetup={() => { onOpenSetup?.(); onClose?.(); }}
            onClose={onClose}
          />
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-4 space-y-0.5">
          {NAV.filter(({ perm, superAdminOnly }) => superAdminOnly ? role === 'super_admin' : can(perm)).map(({ to, icon: Icon, label, tour }) => {
            const isNext = showSetup && to === nextRoute;

            return (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                title={collapsed ? label : (isNext ? `Next step → ${label}` : undefined)}
                {...(tour ? { 'data-tour': tour } : {})}
                className={({ isActive }) => [
                  'flex items-center rounded-lg text-sm font-medium transition-all',
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800',
                ].join(' ')}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="flex-1">{label}</span>}
                {!collapsed && isNext && (
                  <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                    NEXT
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* App Flow Guide toggle */}
        {!collapsed && (
          <div className="px-3 pb-2">
            <button
              onClick={() => setShowGuide((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-left">How it works</span>
              <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${showGuide ? 'rotate-90' : ''}`} />
            </button>
          </div>
        )}

        {/* Customer shop preview link */}
        {shopId && (
          <div className="px-2 pb-3">
            <a
              // Prefer the slug storefront: it is the maintained one, and it is
              // what adapts to the shop's type (a shoe shop gets the footwear
              // layout). `?shopId=` is the legacy page and only used by shops old
              // enough to predate slug auto-generation.
              href={activeShop?.slug ? `/shop/${activeShop.slug}` : `/shop?shopId=${shopId}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              title={collapsed ? 'Customer Shop' : undefined}
              className={[
                'flex items-center rounded-lg text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 transition-all',
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
              ].join(' ')}
            >
              <Store className="w-4 h-4 shrink-0" />
              {!collapsed && <><span>Customer Shop</span><ExternalLink className="w-3 h-3 ml-auto opacity-60" /></>}
            </a>
          </div>
        )}

        {/* Version */}
        {!collapsed && (
          <div className="px-5 py-3 border-t border-gray-700/60">
            <p className="text-xs text-gray-500">MultiShop v3.0</p>
          </div>
        )}
      </aside>

      {/* Horizontal bar for top/bottom, desktop only. The drawer above still
          serves small screens, so the two are never visible at once. */}
      {isHorizontal && (
        <HorizontalNav
          role={role}
          can={can}
          showSetup={showSetup}
          nextRoute={nextRoute}
          onOpenSetup={onOpenSetup}
          onToggleGuide={() => setShowGuide((v) => !v)}
          shopSlug={activeShop?.slug}
          shopId={shopId}
        />
      )}

      {/* App Flow Guide — slides in from left, above the sidebar overlay */}
      {showGuide && (
        <AppFlowGuide onClose={() => setShowGuide(false)} onNavigate={onClose} />
      )}
    </>
  );
}
