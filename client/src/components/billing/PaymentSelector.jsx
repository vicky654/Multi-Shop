import { memo } from 'react';
import { Banknote, CreditCard, Smartphone, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const METHODS = [
  { key: 'cash',   label: 'Cash',   icon: Banknote,   active: 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200/60', idle: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-400' },
  { key: 'card',   label: 'Card',   icon: CreditCard, active: 'bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-200/60',   idle: 'bg-violet-50 border-violet-200 text-violet-700 hover:border-violet-400'   },
  { key: 'upi',    label: 'UPI',    icon: Smartphone, active: 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200/60',   idle: 'bg-orange-50 border-orange-200 text-orange-700 hover:border-orange-400'   },
  { key: 'credit', label: 'Credit', icon: Clock,       active: 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200/60',     idle: 'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400'       },
];

const PaymentSelector = memo(function PaymentSelector({ selected, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {METHODS.map(({ key, label, icon: Icon, active, idle }) => (
        <motion.button
          key={key}
          type="button"
          whileTap={{ scale: 0.93 }}
          onClick={() => onChange(key)}
          className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 font-semibold transition-all duration-150 ${
            selected === key ? active : idle
          }`}
        >
          <Icon className="w-4.5 h-4.5" style={{ width: '1.1rem', height: '1.1rem' }} />
          <span className="text-[11px] leading-none">{label}</span>
        </motion.button>
      ))}
    </div>
  );
});

export default PaymentSelector;
