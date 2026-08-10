import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * wishlistStore — client-side saved items for the customer shop.
 *
 * Local-only by design: the public storefront has no customer login, so there is
 * no account to sync against. Persisted so a shopper's saved items survive a
 * reload, and keyed by product id only (variants are chosen at the detail step).
 */
const useWishlistStore = create(
  persist(
    (set, get) => ({
      ids: [],

      toggle: (productId) =>
        set((s) => ({
          ids: s.ids.includes(productId)
            ? s.ids.filter((id) => id !== productId)
            : [...s.ids, productId],
        })),

      has: (productId) => get().ids.includes(productId),
      clear: () => set({ ids: [] }),
      count: () => get().ids.length,
    }),
    { name: 'multishop-wishlist' }
  )
);

export default useWishlistStore;
