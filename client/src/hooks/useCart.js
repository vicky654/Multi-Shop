import { useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * @param {number}  shopTaxRate  default GST % for the shop
 * @param {boolean} roundOff     mirror the shop's invoiceRoundOff setting.
 *   The server rounds the final payable to the nearest rupee (utils/gst.js), so
 *   the POS must preview the SAME figure — otherwise the pay button shows
 *   ₹157.50 while the bill and UPI QR charge ₹158, and the cashier collects the
 *   wrong amount. This is display+validation only; the server remains the
 *   authority and recomputes everything.
 */
export function useCart(shopTaxRate = 0, roundOff = true) {
  const [cart, setCart] = useState([]);
  const [discountMode, setDiscountMode] = useState('pct'); // 'pct' | 'flat'
  const [taxPreset, setTaxPreset] = useState('shop'); // 'shop' | 'custom' | number string
  const [customTaxVal, setCustomTaxVal] = useState('');

  const taxRate = useMemo(() => {
    if (taxPreset === 'shop') return shopTaxRate;
    if (taxPreset === 'custom') return parseFloat(customTaxVal) || 0;
    return Number(taxPreset) || 0;
  }, [taxPreset, shopTaxRate, customTaxVal]);

  const addToCart = useCallback((product) => {
    // 1. Expiry Check
    if (product.trackExpiry && product.expiryDate) {
      const isExpired = new Date(product.expiryDate) < new Date();
      if (isExpired) {
        toast.error(`"${product.name}" is expired (${new Date(product.expiryDate).toLocaleDateString()}) and cannot be sold.`);
        return;
      }
    }

    // 2. Out of Stock Check
    if (product.stock < 1) {
      toast.error(`"${product.name}" is out of stock.`);
      return;
    }

    setCart((prev) => {
      // Find standard match by productId to auto-increment qty
      const exists = prev.find((i) => i.productId === product._id);
      if (exists) {
        if (exists.quantity >= product.stock) {
          toast.error(`Cannot add more. Max stock (${product.stock}) reached for "${product.name}".`);
          return prev;
        }
        return prev.map((i) =>
          i.productId === product._id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }

      // Add a fresh item with a unique cartItemId
      const finalPrice = product.price * (1 - (product.discount || 0) / 100);
      return [
        ...prev,
        {
          cartItemId: crypto.randomUUID(),
          productId: product._id,
          name: product.name,
          price: finalPrice,
          costPrice: product.costPrice || 0,
          stock: product.stock,
          quantity: 1,
          discount: 0,
        },
      ];
    });
  }, []);

  const incrementQty = useCallback((cartItemId) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.cartItemId !== cartItemId) return i;
        if (i.quantity >= i.stock) {
          toast.error(`Max stock (${i.stock}) reached.`);
          return i;
        }
        return { ...i, quantity: i.quantity + 1 };
      })
    );
  }, []);

  const decrementQty = useCallback((cartItemId) => {
    setCart((prev) =>
      prev.map((i) =>
        i.cartItemId === cartItemId
          ? { ...i, quantity: Math.max(1, i.quantity - 1) }
          : i
      )
    );
  }, []);

  const updateQty = useCallback((cartItemId, qty) => {
    const num = parseInt(qty) || 1;
    setCart((prev) =>
      prev.map((i) => {
        if (i.cartItemId !== cartItemId) return i;
        const validQty = Math.max(1, Math.min(i.stock, num));
        if (num > i.stock) {
          toast.error(`Max stock (${i.stock}) reached.`);
        }
        return { ...i, quantity: validQty };
      })
    );
  }, []);

  const updatePrice = useCallback((cartItemId, price) => {
    const num = parseFloat(price);
    if (!isNaN(num) && num >= 0) {
      setCart((prev) =>
        prev.map((i) => (i.cartItemId === cartItemId ? { ...i, price: num } : i))
      );
    }
  }, []);

  const updateDiscount = useCallback((cartItemId, discount) => {
    const num = Math.max(0, parseFloat(discount) || 0);
    setCart((prev) =>
      prev.map((i) => {
        if (i.cartItemId !== cartItemId) return i;
        const maxDisc = discountMode === 'flat' ? i.price * i.quantity : 100;
        const finalDisc = Math.min(maxDisc, num);
        if (num > maxDisc) {
          toast.error(`Discount cannot exceed maximum value (₹${maxDisc.toFixed(0)} or 100%).`);
        }
        return { ...i, discount: finalDisc };
      })
    );
  }, [discountMode]);

  const removeFromCart = useCallback((cartItemId) => {
    setCart((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
  }, []);

  const duplicateItem = useCallback((cartItemId) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.cartItemId === cartItemId);
      if (idx === -1) return prev;
      const clone = {
        ...prev[idx],
        cartItemId: crypto.randomUUID(),
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone); // insert directly below duplicated row
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const totals = useMemo(() => {
    return cart.reduce(
      (acc, item) => {
        const rawTotal = item.price * item.quantity;
        const disc =
          discountMode === 'flat'
            ? Math.min(rawTotal, item.discount)
            : rawTotal * (item.discount / 100);

        acc.subtotal += rawTotal;
        acc.discount += disc;
        acc.beforeTax += rawTotal - disc;
        return acc;
      },
      { subtotal: 0, discount: 0, beforeTax: 0 }
    );
  }, [cart, discountMode]);

  const taxAmount = useMemo(() => {
    return totals.beforeTax * (taxRate / 100);
  }, [totals.beforeTax, taxRate]);

  // Matches the server's statutory round-off so the previewed total, the pay
  // button, the UPI QR amount and the final invoice all agree to the paisa.
  const grandTotal = useMemo(() => {
    const exact = totals.beforeTax + taxAmount;
    return roundOff ? Math.round(exact) : exact;
  }, [totals.beforeTax, taxAmount, roundOff]);

  /** Signed difference the round-off introduced, for display next to the total. */
  const roundOffAmount = useMemo(() => {
    const exact = totals.beforeTax + taxAmount;
    return roundOff ? +(Math.round(exact) - exact).toFixed(2) : 0;
  }, [totals.beforeTax, taxAmount, roundOff]);

  return {
    cart,
    discountMode,
    setDiscountMode,
    taxPreset,
    setTaxPreset,
    customTaxVal,
    setCustomTaxVal,
    taxRate,
    addToCart,
    incrementQty,
    decrementQty,
    updateQty,
    updatePrice,
    updateDiscount,
    removeFromCart,
    duplicateItem,
    clearCart,
    setCart,
    totals,
    taxAmount,
    grandTotal,
    roundOffAmount,
  };
}
