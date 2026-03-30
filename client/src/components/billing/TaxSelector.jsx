import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const GST_PRESETS = [
  { label: 'Shop',   value: 'shop'   },
  { label: '0%',     value: 0        },
  { label: '5%',     value: 5        },
  { label: '12%',    value: 12       },
  { label: '18%',    value: 18       },
  { label: '28%',    value: 28       },
  { label: 'Custom', value: 'custom' },
];

const TaxSelector = memo(function TaxSelector({
  preset, shopTaxRate, customVal, onChange, onCustomChange,
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tax / GST</p>
      <div className="flex gap-1.5 flex-wrap">
        {GST_PRESETS.map((g) => {
          const isActive = preset === g.value;
          const displayLabel = g.value === 'shop'
            ? `Shop (${shopTaxRate}%)`
            : g.label;
          return (
            <motion.button
              key={String(g.value)}
              whileTap={{ scale: 0.93 }}
              onClick={() => onChange(g.value)}
              className={`h-7 px-3 rounded-full border-2 text-[11px] font-bold transition-all duration-150 shrink-0 ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200/50'
                  : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 bg-white'
              }`}
            >
              {displayLabel}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {preset === 'custom' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 overflow-hidden"
          >
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={customVal}
              onChange={(e) => onCustomChange(e.target.value)}
              placeholder="e.g. 5"
              className="w-24 h-8 px-3 border-2 border-blue-200 rounded-xl text-sm font-bold focus:outline-none focus:border-blue-500 transition-colors bg-blue-50/50"
            />
            <span className="text-xs font-semibold text-gray-400">% GST</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default TaxSelector;
