import { memo } from 'react';
import { Banknote, CreditCard, Smartphone, Clock } from 'lucide-react';

const METHODS = [
  { key: 'cash',   label: 'Cash',   icon: Banknote,   color: 'green'  },
  { key: 'card',   label: 'Card',   icon: CreditCard, color: 'purple' },
  { key: 'upi',    label: 'UPI',    icon: Smartphone, color: 'orange' },
  { key: 'credit', label: 'Credit', icon: Clock,      color: 'amber'  },
];

const COLORS = {
  green:  {
    active: 'bg-green-600 border-green-600 text-white shadow-md shadow-green-200',
    idle:   'bg-green-50 border-green-200 text-green-700 hover:border-green-400 hover:shadow-sm',
  },
  purple: {
    active: 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-200',
    idle:   'bg-purple-50 border-purple-200 text-purple-700 hover:border-purple-400 hover:shadow-sm',
  },
  orange: {
    active: 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-200',
    idle:   'bg-orange-50 border-orange-200 text-orange-700 hover:border-orange-400 hover:shadow-sm',
  },
  amber: {
    active: 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-200',
    idle:   'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400 hover:shadow-sm',
  },
};

const PaymentSelector = memo(function PaymentSelector({ selected, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {METHODS.map(({ key, label, icon: Icon, color }) => {
        const c = COLORS[color];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border-2 font-semibold transition-all active:scale-95 ${
              selected === key ? c.active : c.idle
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs">{label}</span>
          </button>
        );
      })}
    </div>
  );
});

export default PaymentSelector;
