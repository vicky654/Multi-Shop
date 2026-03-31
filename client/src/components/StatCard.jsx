/**
 * StatCard — KPI stat card with compact number formatting + hover tooltip.
 *
 * Props:
 *   rawValue  {number}  — raw number; displays compact (₹1.5L) + shows full value tooltip on hover
 *   value     {any}     — display value when rawValue is not a number (counts, strings)
 *   label, sub, color, trend, icon
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCompactINR, formatINR } from '../utils/format';

const COLOR_MAP = {
  blue:   { card: 'bg-blue-50 border-blue-200',     icon: 'bg-blue-100 text-blue-600',     val: 'text-blue-700'   },
  green:  { card: 'bg-green-50 border-green-200',   icon: 'bg-green-100 text-green-600',   val: 'text-green-700'  },
  orange: { card: 'bg-orange-50 border-orange-200', icon: 'bg-orange-100 text-orange-600', val: 'text-orange-700' },
  red:    { card: 'bg-red-50 border-red-200',       icon: 'bg-red-100 text-red-600',       val: 'text-red-700'    },
  purple: { card: 'bg-purple-50 border-purple-200', icon: 'bg-purple-100 text-purple-600', val: 'text-purple-700' },
};

export default function StatCard({ icon: Icon, label, value, rawValue, sub, color = 'blue', trend }) {
  const [tip, setTip] = useState(false);

  const c         = COLOR_MAP[color] || COLOR_MAP.blue;
  const hasRaw    = rawValue !== undefined && rawValue !== null && isFinite(Number(rawValue));
  const display   = hasRaw ? formatCompactINR(rawValue) : value;
  const fullValue = hasRaw ? formatINR(rawValue) : null;
  // Shrink font when compact string is still long (e.g. ₹99.9Cr)
  const fontSize  = String(display).length > 7 ? 'text-xl' : 'text-2xl';

  return (
    <div className={`rounded-2xl border p-4 flex items-start gap-3 ${c.card}`}>
      {Icon && (
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-none mb-1">
          {label}
        </p>

        {/* Value + full-value tooltip on hover */}
        <div className="relative inline-block max-w-full">
          <p
            className={`font-semibold leading-tight truncate ${fontSize} ${c.val} ${hasRaw ? 'cursor-help select-none' : ''}`}
            onMouseEnter={() => hasRaw && setTip(true)}
            onMouseLeave={() => setTip(false)}
          >
            {display}
          </p>

          <AnimatePresence>
            {tip && fullValue && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1   }}
                exit={{   opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.12 }}
                className="absolute bottom-full left-0 mb-2 z-50 pointer-events-none"
              >
                <div className="bg-gray-900 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xl whitespace-nowrap">
                  {fullValue}
                </div>
                <span className="block w-0 h-0 ml-4 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {sub && <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>}

        {trend !== undefined && (
          <p className={`text-xs font-semibold mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last period
          </p>
        )}
      </div>
    </div>
  );
}
