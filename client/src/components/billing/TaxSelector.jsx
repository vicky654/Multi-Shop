import { memo } from 'react';

const GST_PRESETS = [
  { label: 'No Tax', value: 0       },
  { label: '5%',     value: 5       },
  { label: '12%',    value: 12      },
  { label: '18%',    value: 18      },
  { label: '28%',    value: 28      },
  { label: 'Custom', value: 'custom'},
];

const TaxSelector = memo(function TaxSelector({
  preset, shopTaxRate, customVal, onChange, onCustomChange,
}) {
  const pill = (active) =>
    `h-8 px-3.5 rounded-full border-2 text-xs font-semibold transition-all shrink-0 ${
      active
        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
        : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 bg-white'
    }`;

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tax / GST</p>
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => onChange('shop')} className={pill(preset === 'shop')}>
          Shop ({shopTaxRate}%)
        </button>
        {GST_PRESETS.map((g) => (
          <button key={g.value} onClick={() => onChange(g.value)} className={pill(preset === g.value)}>
            {g.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={customVal}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder="e.g. 5"
            className="w-28 h-9 px-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
          <span className="text-sm text-gray-400">% GST</span>
        </div>
      )}
    </div>
  );
});

export default TaxSelector;
