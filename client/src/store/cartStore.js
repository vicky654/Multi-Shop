import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useCartStore = create(
  persist(
    (set, get) => ({
      items:  [],   // { productId, name, price, finalPrice, discount, quantity, size, color, image }
      shopId: null,

      // Add or increment item (size+color combo = unique key)
      addItem: (product, size = '', color = '') => {
        const key = `${product._id}-${size}-${color}`;
        set((state) => {
          const existing = state.items.find((i) => i._key === key);
          if (existing) {
            if (existing.quantity >= product.stock) return state;
            return {
              ...state,
              items: state.items.map((i) =>
                i._key === key ? { ...i, quantity: i.quantity + 1 } : i
              ),
            };
          }
          if (product.stock < 1) return state;
          const finalPrice = +(product.price * (1 - (product.discount || 0) / 100)).toFixed(2);
          return {
            shopId: product.shopId?._id || product.shopId || state.shopId,
            items: [
              ...state.items,
              {
                _key:       key,
                productId:  product._id,
                name:       product.name,
                price:      product.price,
                finalPrice,
                discount:   product.discount || 0,
                quantity:   1,
                stock:      product.stock,
                size,
                color,
                image:      (product.images && product.images[0]) || product.image || '',
                category:   product.category,
              },
            ],
          };
        });
      },

      removeItem: (key) =>
        set((state) => ({ items: state.items.filter((i) => i._key !== key) })),

      updateQuantity: (key, qty) =>
        set((state) => ({
          items: state.items.map((i) =>
            i._key === key
              ? { ...i, quantity: Math.max(1, Math.min(i.stock, qty)) }
              : i
          ),
        })),

      clearCart: () => set({ items: [], shopId: null }),

      getSubtotal: () =>
        get().items.reduce((acc, i) => acc + i.finalPrice * i.quantity, 0),

      getItemCount: () =>
        get().items.reduce((acc, i) => acc + i.quantity, 0),
    }),
    { name: 'multishop-cart' }
  )
);

export default useCartStore;
