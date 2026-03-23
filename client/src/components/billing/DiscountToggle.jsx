import { memo } from 'react';
import { Percent, IndianRupee } from 'lucide-react';

const DiscountToggle = memo(function DiscountToggle({ mode, onChange }) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-0.5">
      {[['pct', Percent, '%'], ['flat', IndianRupee, '₹']].map(([m, Icon, label]) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          title={`Discount in ${m === 'pct' ? 'percentage' : 'fixed amount'}`}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            mode === m
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Icon className="w-3 h-3" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
});

export default DiscountToggle;
