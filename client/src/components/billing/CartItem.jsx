import { memo } from 'react';
import { Plus, Minus, Trash2, Tag, IndianRupee } from 'lucide-react';
import { motion } from 'framer-motion';

const CartItem = memo(function CartItem({
  item, discountMode, canEdit, onUp, onDown, onDiscount, onRemove, onUpdatePrice,
}) {
  const rawTotal  = item.price * item.quantity;
  const lineTotal = discountMode === 'flat'
    ? Math.max(0, rawTotal - item.discount)
    : rawTotal * (1 - item.discount / 100);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-blue-50/30 rounded-2xl border border-gray-100 hover:border-blue-100 transition-colors group"
    >
      {/* Name + editable inputs */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-900 truncate leading-snug">{item.name}</p>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Unit price */}
          <div className="flex items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-lg px-1.5 py-0.5">
            <IndianRupee className="w-2.5 h-2.5 text-gray-400 shrink-0" />
            {canEdit ? (
              <input
                type="number"
                min="0"
                value={item.price}
                onChange={(e) => onUpdatePrice?.(e.target.value)}
                className="w-14 text-[11px] bg-transparent text-center font-bold text-gray-800 focus:outline-none tabular-nums"
              />
            ) : (
              <span className="text-[11px] font-bold text-gray-800 tabular-nums">{item.price.toFixed(0)}</span>
            )}
            <span className="text-[9px] text-gray-400">ea</span>
          </div>

          {/* Discount */}
          {canEdit && (
            <div className="flex items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-lg px-1.5 py-0.5">
              <Tag className="w-2.5 h-2.5 text-gray-400 shrink-0" />
              <input
                type="number"
                min="0"
                max={discountMode === 'pct' ? 100 : rawTotal}
                value={item.discount}
                onChange={(e) => onDiscount(e.target.value)}
                className="w-10 text-[11px] bg-transparent text-center focus:outline-none tabular-nums text-gray-700"
                placeholder="0"
              />
              <span className="text-[9px] text-gray-400">{discountMode === 'pct' ? '%' : '₹'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quantity stepper */}
      <div className="flex items-center gap-1.5 shrink-0">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onDown}
          className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
        >
          <Minus className="w-3 h-3" />
        </motion.button>
        <motion.span
          key={item.quantity}
          initial={{ scale: 1.3, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          className="text-sm font-black text-gray-900 w-6 text-center tabular-nums select-none"
        >
          {item.quantity}
        </motion.span>
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onUp}
          className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-sm shadow-blue-200 transition-colors"
        >
          <Plus className="w-3 h-3" />
        </motion.button>
      </div>

      {/* Line total + remove */}
      <div className="flex items-center gap-1.5 shrink-0">
        <motion.span
          key={lineTotal.toFixed(0)}
          initial={{ opacity: 0.5, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-sm font-black text-blue-600 tabular-nums min-w-[2.8rem] text-right"
        >
          ₹{lineTotal.toFixed(0)}
        </motion.span>
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onRemove}
          className="w-7 h-7 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </motion.button>
      </div>
    </motion.div>
  );
});

export default CartItem;
