import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useShopStore = create(
  persist(
    (set, get) => ({
      activeShop: null,
      shops: [],

      setShops: (shops) => {
        const current = get().activeShop;
        // Keep active shop if it's still in the list, otherwise pick first
        const stillValid = current && shops.some((s) => s._id === current._id);
        set({
          shops,
          activeShop: stillValid ? current : (shops[0] || null),
        });
      },

      setActiveShop: (shop) => set({ activeShop: shop }),

      clearShops: () => set({ activeShop: null, shops: [] }),
    }),
    {
      name: 'ms_shop',
      partialize: (state) => ({ activeShop: state.activeShop }),
    }
  )
);

export default useShopStore;
