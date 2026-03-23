/**
 * AppFlowGuide — explains the 5-step app flow in a dark overlay panel.
 *
 * Triggered from the "How it works" button in the Sidebar.
 * Each step is clickable and navigates to the relevant route.
 */
import { NavLink } from 'react-router-dom';
import {
  Store, Package, Users, ShoppingCart, BarChart2,
  X, ArrowRight, CheckCircle,
} from 'lucide-react';
import useShopStore  from '../store/shopStore';
import useSetupStore from '../store/setupStore';

const FLOW = [
  {
    n:     1,
    key:   'shop',
    icon:  Store,
    color: 'bg-blue-500',
    ring:  'ring-blue-500/40',
    label: 'Create your shop',
    desc:  'Set up your shop name, address, currency, GST, and contact info. Everything links to a shop.',
    route: '/settings',
    cta:   'Go to Settings',
  },
  {
    n:     2,
    key:   'product',
    icon:  Package,
    color: 'bg-purple-500',
    ring:  'ring-purple-500/40',
    label: 'Add your products',
    desc:  'Add inventory with prices, cost, stock levels, sizes, colors, and images. Set low-stock alerts.',
    route: '/inventory',
    cta:   'Go to Inventory',
  },
  {
    n:     3,
    key:   'customer',
    icon:  Users,
    color: 'bg-green-500',
    ring:  'ring-green-500/40',
    label: 'Add customers',
    desc:  'Build your customer database. Track purchase history, total spend, and contact details.',
    route: '/customers',
    cta:   'Go to Customers',
  },
  {
    n:     4,
    key:   'sale',
    icon:  ShoppingCart,
    color: 'bg-yellow-500',
    ring:  'ring-yellow-500/40',
    label: 'Make a sale',
    desc:  'Use the POS billing screen to select products, apply discounts, accept payments, and print receipts.',
    route: '/billing',
    cta:   'Go to Billing',
  },
  {
    n:     5,
    key:   null, // always available
    icon:  BarChart2,
    color: 'bg-orange-500',
    ring:  'ring-orange-500/40',
    label: 'View reports',
    desc:  'Track daily revenue, expenses, profit margins, top products, and customer insights in real-time.',
    route: '/reports',
    cta:   'Go to Reports',
  },
];

export default function AppFlowGuide({ onClose, onNavigate }) {
  const { activeShop } = useShopStore();
  const getProgress    = useSetupStore((s) => s.getProgress);
  const { steps }      = getProgress(activeShop);

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-start justify-start"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative w-72 h-full bg-gray-900 border-r border-gray-700/60 overflow-y-auto scrollbar-thin flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700/60 px-4 py-3 flex items-center justify-between z-10">
          <div>
            <p className="text-sm font-bold text-white">How it works</p>
            <p className="text-[11px] text-gray-400">Your 5-step guide to MultiShop</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps */}
        <div className="flex-1 px-3 py-4 space-y-1">
          {FLOW.map((step, i) => {
            const Icon    = step.icon;
            const isDone  = step.key ? steps[step.key] : false;
            const isLast  = i === FLOW.length - 1;

            return (
              <div key={step.n}>
                {/* Step card */}
                <div className={`rounded-xl p-3 border transition-all ${
                  isDone
                    ? 'bg-gray-800/40 border-gray-700/40 opacity-75'
                    : 'bg-gray-800 border-gray-700/60 hover:border-gray-600'
                }`}>
                  <div className="flex items-start gap-3">
                    {/* Step number / done ring */}
                    <div className={`relative w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${step.color} ${isDone ? 'opacity-60' : `ring-4 ${step.ring}`}`}>
                      <Icon className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" />
                      {isDone && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                          Step {step.n}
                        </span>
                        {isDone && (
                          <span className="text-[9px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">
                            Done
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white leading-tight">{step.label}</p>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{step.desc}</p>

                      {/* CTA link */}
                      <NavLink
                        to={step.route}
                        onClick={() => { onNavigate?.(); onClose(); }}
                        className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition group"
                      >
                        {step.cta}
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </NavLink>
                    </div>
                  </div>
                </div>

                {/* Connector line between steps */}
                {!isLast && (
                  <div className="flex justify-start pl-[22px] py-0.5">
                    <div className="w-px h-3 bg-gray-700" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer tip */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700/60 px-4 py-3">
          <p className="text-[11px] text-gray-500 text-center leading-relaxed">
            Click any step to jump directly to that section
          </p>
        </div>
      </div>
    </div>
  );
}
