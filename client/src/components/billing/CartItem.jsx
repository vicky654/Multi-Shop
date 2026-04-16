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
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16, transition: { duration: 0.12 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      data-testid={`cart-item-${item.productId}`}
      className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-3 py-3">
        {/* Name + price */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 truncate leading-snug">{item.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-gray-400 tabular-nums">₹{item.price.toFixed(0)} ea</span>
            {hasDiscount && (
              <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">
                -{discountMode === 'pct' ? `${item.discount}%` : `₹${item.discount}`}
              </span>
            )}
          </div>
        </div>

        {/* Quantity stepper */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onDown}
            data-testid="qty-decrement"
            className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors touch-manipulation active:scale-95"
          >
            <Minus className="w-4 h-4" />
          </button>
          <motion.span
            key={item.quantity}
            initial={{ scale: 1.25, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className="text-sm text-gray-900 w-7 text-center tabular-nums select-none"
          >
            {item.quantity}
          </motion.span>
          <button
            onClick={onUp}
            data-testid="qty-increment"
            className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors touch-manipulation active:scale-95"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Line total + actions */}
        <div className="flex items-center gap-1 shrink-0">
          <motion.span
            key={lineTotal.toFixed(0)}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            className="text-sm text-gray-800 tabular-nums min-w-[3rem] text-right"
          >
            ₹{lineTotal.toFixed(0)}
          </motion.span>

          {canEdit && (
            <button
              onClick={() => setShowDiscount((v) => !v)}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                showDiscount || hasDiscount
                  ? 'bg-green-50 text-green-600 border border-green-100'
                  : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'
              }`}
              title="Add discount"
            >
              <Tag className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={onRemove}
            data-testid="remove-item"
            className="w-7 h-7 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Discount input */}
      <AnimatePresence>
        {canEdit && showDiscount && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 pb-3">
              <Tag className="w-3.5 h-3.5 text-green-500 shrink-0" />
              <span className="text-xs text-gray-400 shrink-0">Discount:</span>
              <input
                type="number"
                min="0"
                max={discountMode === 'pct' ? 100 : rawTotal}
                value={item.discount}
                onChange={(e) => onDiscount(e.target.value)}
                data-testid="discount-input"
                className="flex-1 h-8 text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-blue-300 tabular-nums text-gray-700 text-center"
                placeholder="0"
                autoFocus
              />
              <span className="text-xs text-gray-400 shrink-0 w-4">
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
