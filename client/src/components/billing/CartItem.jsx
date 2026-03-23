import { memo } from 'react';
import { Plus, Minus, Trash2, Tag, IndianRupee } from 'lucide-react';

const CartItem = memo(function CartItem({
  item, discountMode, canEdit, onUp, onDown, onDiscount, onRemove, onUpdatePrice,
}) {
  const rawTotal  = item.price * item.quantity;
  const lineTotal = discountMode === 'flat'
    ? Math.max(0, rawTotal - item.discount)
    : rawTotal * (1 - item.discount / 100);

  return (
    <div className="flex items-center gap-4 p-4 bg-white hover:bg-blue-50/30 rounded-2xl border border-gray-200 hover:border-blue-200 transition-all">

      {/* Name + editable inputs */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{item.name}</p>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {/* Editable unit price */}
          <div className="flex items-center gap-1">
            <IndianRupee className="w-3 h-3 text-gray-400 shrink-0" />
            {canEdit ? (
              <input
                type="number"
                min="0"
                value={item.price}
                onChange={(e) => onUpdatePrice?.(e.target.value)}
                className="w-16 h-6 text-xs border border-gray-200 rounded-lg px-1.5 text-center font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50"
              />
            ) : (
              <span className="text-xs font-semibold text-gray-700">{item.price.toFixed(0)}</span>
            )}
            <span className="text-[10px] text-gray-400">each</span>
          </div>

          {/* Discount */}
          {canEdit && (
            <div className="flex items-center gap-1">
              <Tag className="w-3 h-3 text-gray-400 shrink-0" />
              <input
                type="number"
                min="0"
                max={discountMode === 'pct' ? 100 : rawTotal}
                value={item.discount}
                onChange={(e) => onDiscount(e.target.value)}
                className="w-12 h-6 text-xs border border-gray-200 rounded-lg px-1.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50"
                placeholder="0"
              />
              <span className="text-[10px] text-gray-400">{discountMode === 'pct' ? '%' : '₹'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Qty stepper — horizontal */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onDown}
          className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition active:scale-95"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="text-base font-black text-gray-900 w-7 text-center tabular-nums">{item.quantity}</span>
        <button
          onClick={onUp}
          className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-sm transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Line total + remove */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-base font-black text-blue-600 tabular-nums min-w-[3.5rem] text-right">
          ₹{lineTotal.toFixed(0)}
        </span>
        <button
          onClick={onRemove}
          className="w-8 h-8 rounded-xl text-red-400 hover:bg-red-50 flex items-center justify-center transition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

export default CartItem;
