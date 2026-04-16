import { memo } from 'react';
import { Banknote, CreditCard, Smartphone, Clock } from 'lucide-react';

const METHODS = [
  { key: 'cash',   label: 'Cash',   icon: Banknote   },
  { key: 'card',   label: 'Card',   icon: CreditCard },
  { key: 'upi',    label: 'UPI',    icon: Smartphone },
  { key: 'credit', label: 'Credit', icon: Clock      },
];

const PaymentSelector = memo(function PaymentSelector({ selected, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {METHODS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          data-testid={`payment-${key}`}
          aria-pressed={selected === key}
          className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-xs transition-all ${
            selected === key
              ? 'border-blue-500 bg-blue-50 text-blue-600'
              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
});

export default PaymentSelector;
