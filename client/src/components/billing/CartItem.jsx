import { memo, useState } from 'react';
import { Plus, Minus, Trash2, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CartItem = memo(function CartItem({
  item, discountMode, canEdit, onUp, onDown, onDiscount, onRemove,
}) {
  const [showDiscount, setShowDiscount] = useState(false);

  const rawTotal  = item.price * item.quantity;
  const lineTotal = discountMode === 'flat'
    ? Math.max(0, rawTotal - item.discount)
    : rawTotal * (1 - item.discount / 100);

  const hasDiscount = item.discount > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      data-testid={`cart-item-${item.productId}`}
      className="bg-white rounded-2xl border border-gray-100 hover:border-blue-100 transition-colors group"
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Name + price */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-900 truncate leading-snug">{item.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-gray-500 tabular-nums">₹{item.price.toFixed(0)} ea</span>
            {hasDiscount && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                -{discountMode === 'pct' ? `${item.discount}%` : `₹${item.discount}`}
              </span>
            )}
          </div>
        </div>

        {/* Quantity stepper — larger for mobile touch */}
        <div className="flex items-center gap-2 shrink-0">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onDown}
            data-testid="qty-decrement"
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors touch-manipulation"
          >
            <Minus className="w-3.5 h-3.5" />
          </motion.button>
          <motion.span
            key={item.quantity}
            initial={{ scale: 1.3, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className="text-sm font-black text-gray-900 w-7 text-center tabular-nums select-none"
          >
            {item.quantity}
          </motion.span>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onUp}
            data-testid="qty-increment"
            className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-sm shadow-blue-200 transition-colors touch-manipulation"
          >
            <Plus className="w-3.5 h-3.5" />
          </motion.button>
        </div>

        {/* Line total + actions */}
        <div className="flex items-center gap-1 shrink-0">
          <motion.span
            key={lineTotal.toFixed(0)}
            initial={{ opacity: 0.5, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-sm font-black text-blue-600 tabular-nums min-w-[2.8rem] text-right"
          >
            ₹{lineTotal.toFixed(0)}
          </motion.span>

          {/* Discount toggle button */}
          {canEdit && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => setShowDiscount((v) => !v)}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                showDiscount || hasDiscount
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
              }`}
              title="Add discount"
            >
              <Tag className="w-3 h-3" />
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onRemove}
            data-testid="remove-item"
            className="w-7 h-7 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      {/* Discount input — slides in on tag tap */}
      <AnimatePresence>
        {canEdit && showDiscount && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 pb-2.5">
              <Tag className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-[11px] text-gray-500 shrink-0">Discount:</span>
              <input
                type="number"
                min="0"
                max={discountMode === 'pct' ? 100 : rawTotal}
                value={item.discount}
                onChange={(e) => onDiscount(e.target.value)}
                data-testid="discount-input"
                className="flex-1 h-8 text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 tabular-nums text-gray-700 text-center"
                placeholder="0"
                autoFocus
              />
              <span className="text-[11px] text-gray-400 shrink-0 font-semibold w-4">
                {discountMode === 'pct' ? '%' : '₹'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default CartItem;
