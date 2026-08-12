import { Plus, Minus, Trash2, Copy, Percent, IndianRupee } from 'lucide-react';
import NumberInput from '../ui/NumberInput';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export default function CartTable({
  cart,
  discountMode,
  taxRate,
  onIncrementQty,
  onDecrementQty,
  onUpdateQty,
  onUpdatePrice,
  onUpdateDiscount,
  onRemoveFromCart,
  onDuplicateItem,
  selectedCartItemId,
  setSelectedCartItemId,
}) {
  // Branch in JS, not with `md:hidden`. Hiding one tree with CSS leaves BOTH in
  // the DOM, so every data-testid here (cart-item-*, qty-increment, discount-input)
  // would match twice and the E2E specs would fail on "expected 1 element".
  const isWide = useMediaQuery('(min-width: 768px)');

  const getLineTotal = (item) => {
    const rawTotal = item.price * item.quantity;
    return discountMode === 'flat'
      ? Math.max(0, rawTotal - item.discount)
      : rawTotal * (1 - item.discount / 100);
  };

  const itemCount = cart.length;
  const unitCount = cart.reduce((n, i) => n + (Number(i.quantity) || 0), 0);
  const cartTotal = cart.reduce((sum, i) => sum + getLineTotal(i), 0);

  return (
    <div className="h-full flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Cart header — item count and running total, always visible */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 select-none">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Current Bill</span>
          <span
            className="min-w-[1.4rem] h-5 px-1.5 inline-flex items-center justify-center rounded-full
                       bg-blue-600 text-white text-[11px] font-black tabular-nums"
            data-testid="cart-count"
            title={`${itemCount} line item(s), ${unitCount} unit(s)`}
          >
            {itemCount}
          </span>
          {unitCount !== itemCount && (
            <span className="text-[10px] font-bold text-gray-400">{unitCount} units</span>
          )}
        </div>
        <span className="text-sm font-black text-gray-900 tabular-nums" data-testid="cart-running-total">
          ₹{cartTotal.toFixed(2)}
        </span>
      </div>

      {/* ── Mobile: card per line ────────────────────────────────────────────
          The table below is min-w-[500px], so on a phone it forced a horizontal
          scroll and squeezed every column to a sliver. A cart line is the thing a
          cashier edits most, so on small screens each one becomes a card with
          full-size controls. Every capability of the table row is kept: quantity
          stepper, price, discount, duplicate and remove. */}
      {!isWide ? (
      <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-gray-100">
        {cart.length === 0 ? (
          <p className="py-16 px-6 text-center text-gray-400 italic select-none text-sm">
            Cart is empty. Scan a barcode or search products above to start.
          </p>
        ) : (
          cart.map((item) => {
            const lineTotal = getLineTotal(item);
            const isSelected = selectedCartItemId === item.cartItemId;
            return (
              <div
                key={item.cartItemId}
                data-testid={`cart-item-${item.productId}`}
                onClick={() => setSelectedCartItemId(item.cartItemId)}
                className={`p-3 transition-colors ${isSelected ? 'bg-blue-50/70' : 'active:bg-gray-50'}`}
              >
                {/* Name + line total */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm leading-snug">{item.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      Stock: {item.stock} · GST {taxRate}%
                    </p>
                  </div>
                  <p className="text-base font-black text-gray-900 tabular-nums shrink-0">
                    ₹{lineTotal.toFixed(2)}
                  </p>
                </div>

                {/* Controls: 44px targets, so they are actually tappable */}
                <div className="flex items-center gap-2 mt-2.5">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      data-testid="qty-decrement"
                      onClick={(e) => { e.stopPropagation(); onDecrementQty(item.cartItemId); }}
                      aria-label="Decrease quantity"
                      className="w-10 h-10 rounded-lg bg-gray-100 active:bg-gray-200 text-gray-600 flex items-center justify-center transition touch-manipulation"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <NumberInput
                      min="1"
                      max={item.stock}
                      value={item.quantity}
                      onClick={(e) => e.stopPropagation()}
                      onCommit={(v) => onUpdateQty(item.cartItemId, v)}
                      className="w-12 h-10 text-sm text-center border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-white font-bold tabular-nums"
                    />
                    <button
                      type="button"
                      data-testid="qty-increment"
                      onClick={(e) => { e.stopPropagation(); onIncrementQty(item.cartItemId); }}
                      aria-label="Increase quantity"
                      className="w-10 h-10 rounded-lg bg-blue-600 active:bg-blue-700 text-white flex items-center justify-center transition touch-manipulation"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <label className="flex-1 min-w-0 relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 pointer-events-none">₹</span>
                    <NumberInput
                      min="0"
                      step="0.01"
                      value={item.price}
                      onClick={(e) => e.stopPropagation()}
                      onCommit={(v) => onUpdatePrice(item.cartItemId, v)}
                      className="w-full h-10 pl-5 pr-2 text-sm text-center border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-white font-semibold tabular-nums"
                    />
                  </label>

                  <label className="w-20 shrink-0 relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      {discountMode === 'pct' ? <Percent className="w-3 h-3" /> : <IndianRupee className="w-3 h-3" />}
                    </span>
                    <NumberInput
                      min="0"
                      value={item.discount}
                      data-testid="discount-input"
                      id={isSelected ? 'discount-input-active' : undefined}
                      onClick={(e) => e.stopPropagation()}
                      onCommit={(v) => onUpdateDiscount(item.cartItemId, v)}
                      className="w-full h-10 pl-6 pr-1.5 text-sm text-center border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-white font-semibold tabular-nums"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDuplicateItem(item.cartItemId); }}
                    aria-label="Duplicate item"
                    className="w-10 h-10 rounded-lg text-gray-400 active:bg-blue-50 active:text-blue-600 flex items-center justify-center transition shrink-0 touch-manipulation"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemoveFromCart(item.cartItemId); }}
                    aria-label="Remove item"
                    className="w-10 h-10 rounded-lg text-gray-400 active:bg-red-50 active:text-red-500 flex items-center justify-center transition shrink-0 touch-manipulation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      ) : (
      /* ── Desktop: the table ── */
      <div className="overflow-x-auto flex-1 scrollbar-thin">
        <table className="w-full text-left text-sm border-collapse min-w-[500px]">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider select-none z-10">
            <tr>
              <th className="py-3 px-4">Product</th>
              <th className="py-3 px-2 w-32 text-center">Qty</th>
              <th className="py-3 px-2 w-28 text-center">Price (₹)</th>
              <th className="py-3 px-2 w-28 text-center">Discount</th>
              <th className="py-3 px-2 w-20 text-center">GST (%)</th>
              <th className="py-3 px-4 w-28 text-right">Total (₹)</th>
              <th className="py-3 px-2 w-20 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {cart.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-16 text-center text-gray-400 italic select-none">
                  Cart is empty. Scan barcodes or search products above to start.
                </td>
              </tr>
            ) : (
              cart.map((item) => {
                const lineTotal = getLineTotal(item);
                const isSelected = selectedCartItemId === item.cartItemId;

                return (
                  <tr
                    key={item.cartItemId}
                    data-testid={`cart-item-${item.productId}`}
                    onClick={() => setSelectedCartItemId(item.cartItemId)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected ? 'bg-blue-50/70 hover:bg-blue-100/70 font-semibold' : 'hover:bg-gray-50/50'
                    }`}
                  >
                    {/* Product Name */}
                    <td className="py-3.5 px-4 max-w-[200px] truncate leading-tight">
                      <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">Stock: {item.stock}</p>
                    </td>

                    {/* Qty Stepper */}
                    <td className="py-3.5 px-2">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          data-testid="qty-decrement"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDecrementQty(item.cartItemId);
                          }}
                          className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors active:scale-95 shrink-0"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <NumberInput
                          min="1"
                          max={item.stock}
                          value={item.quantity}
                          onClick={(e) => e.stopPropagation()}
                          onCommit={(v) => onUpdateQty(item.cartItemId, v)}
                          className="w-12 h-7 text-xs text-center border border-gray-200 rounded outline-none focus:border-blue-400 bg-white font-semibold tabular-nums"
                        />
                        <button
                          type="button"
                          data-testid="qty-increment"
                          onClick={(e) => {
                            e.stopPropagation();
                            onIncrementQty(item.cartItemId);
                          }}
                          className="w-7 h-7 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors active:scale-95 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Price Input */}
                    <td className="py-3.5 px-2">
                      <div className="relative">
                        <NumberInput
                          min="0"
                          step="0.01"
                          value={item.price}
                          onClick={(e) => e.stopPropagation()}
                          onCommit={(v) => onUpdatePrice(item.cartItemId, v)}
                          className="w-full h-7 text-xs text-center border border-gray-200 rounded outline-none focus:border-blue-400 bg-white font-semibold tabular-nums"
                        />
                      </div>
                    </td>

                    {/* Discount Input */}
                    <td className="py-3.5 px-2">
                      <div className="flex items-center justify-center gap-1">
                        <NumberInput
                          min="0"
                          value={item.discount}
                          data-testid="discount-input"
                          id={isSelected ? 'discount-input-active' : undefined}
                          onClick={(e) => e.stopPropagation()}
                          onCommit={(v) => onUpdateDiscount(item.cartItemId, v)}
                          className="w-14 h-7 text-xs text-center border border-gray-200 rounded outline-none focus:border-blue-400 bg-white font-semibold tabular-nums"
                        />
                        <span className="text-[10px] text-gray-400">
                          {discountMode === 'pct' ? <Percent className="w-3 h-3" /> : <IndianRupee className="w-3 h-3" />}
                        </span>
                      </div>
                    </td>

                    {/* GST Rate */}
                    <td className="py-3.5 px-2 text-center text-xs text-gray-500 tabular-nums">
                      {taxRate}%
                    </td>

                    {/* Line Total */}
                    <td className="py-3.5 px-4 text-right font-bold text-gray-800 tabular-nums">
                      ₹{lineTotal.toFixed(2)}
                    </td>

                    {/* Row Actions */}
                    <td className="py-3.5 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateItem(item.cartItemId);
                          }}
                          title="Duplicate item"
                          className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveFromCart(item.cartItemId);
                          }}
                          title="Delete item"
                          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
