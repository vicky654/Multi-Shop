import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Store, Package, ShoppingCart, BarChart2,
  CheckCircle, ArrowRight, X, Sparkles,
} from 'lucide-react';
import { authApi } from '../api/auth.api';
import useAuthStore from '../store/authStore';

const STEPS = [
  {
    id: 1,
    icon: Store,
    color: 'bg-blue-500',
    title: 'Create your shop',
    description: 'Set up your first shop with name, address, currency and contact details.',
    action: 'Go to Settings',
    route: '/settings',
  },
  {
    id: 2,
    icon: Package,
    color: 'bg-purple-500',
    title: 'Add your first product',
    description: 'Add products with prices, stock quantities, images, sizes and colors.',
    action: 'Go to Inventory',
    route: '/inventory',
  },
  {
    id: 3,
    icon: ShoppingCart,
    color: 'bg-green-500',
    title: 'Create a sale',
    description: 'Use the Billing/POS screen to create your first transaction.',
    action: 'Go to Billing',
    route: '/billing',
  },
  {
    id: 4,
    icon: BarChart2,
    color: 'bg-orange-500',
    title: 'View your reports',
    description: 'Track revenue, expenses, profit and customer insights in real-time.',
    action: 'Go to Reports',
    route: '/reports',
  },
];

export default function Onboarding({ onClose }) {
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const setUser = useAuthStore((s) => s.fetchMe);

  const completeMutation = useMutation({
    mutationFn: () => authApi.completeOnboarding(),
    onSuccess: () => setUser(),
  });

  const step = STEPS[current];
  const isLast = current === STEPS.length - 1;

  const handleAction = () => {
    navigate(step.route);
    onClose?.();
  };

  const handleNext = () => {
    if (isLast) {
      setDone(true);
      completeMutation.mutate();
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const handleSkip = () => {
    completeMutation.mutate();
    onClose?.();
  };

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">You're all set!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Your shop is ready to go. Explore all the features and grow your business.
          </p>
          <button
            onClick={() => { onClose?.(); navigate('/dashboard'); }}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const Icon = step.icon;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-blue-600">Quick Setup</span>
          </div>
          <button
            onClick={handleSkip}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400"
            title="Skip onboarding"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 py-3">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`rounded-full transition-all duration-300 ${
                i === current ? 'w-6 h-2 bg-blue-500' : i < current ? 'w-2 h-2 bg-green-400' : 'w-2 h-2 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 py-6 text-center">
          <div className={`w-20 h-20 ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg`}>
            <Icon className="w-10 h-10 text-white" />
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Step {current + 1} of {STEPS.length}
          </p>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">{step.description}</p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleAction}
              className={`w-full py-3 ${step.color} text-white rounded-xl font-semibold hover:opacity-90 transition flex items-center justify-center gap-2`}
            >
              {step.action}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
            >
              {isLast ? 'Finish Setup' : 'Next Step'}
            </button>
          </div>
        </div>

        {/* Checklist */}
        <div className="border-t border-gray-100 px-6 py-4">
          <div className="grid grid-cols-4 gap-2">
            {STEPS.map((s, i) => {
              const SIcon = s.icon;
              return (
                <div key={s.id} className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    i < current ? 'bg-green-100' : i === current ? s.color : 'bg-gray-100'
                  }`}>
                    {i < current
                      ? <CheckCircle className="w-4 h-4 text-green-500" />
                      : <SIcon className={`w-4 h-4 ${i === current ? 'text-white' : 'text-gray-400'}`} />
                    }
                  </div>
                  <span className="text-[10px] text-gray-400 text-center leading-tight">{s.title.split(' ').slice(-1)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
