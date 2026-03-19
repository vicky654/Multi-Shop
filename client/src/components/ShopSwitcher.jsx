import { ChevronDown, Store, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useShopStore from '../store/shopStore';
import { usePermissions } from '../hooks/usePermissions';

const SHOP_ICONS = { clothes: '👗', toys: '🧸', shoes: '👟', gifts: '🎁', electronics: '📱', grocery: '🛒', other: '🏪' };

export default function ShopSwitcher() {
  const { activeShop, shops, setActiveShop } = useShopStore();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!shops.length) {
    return (
      <div className="text-xs text-gray-500 px-2 py-2">No shops found</div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition text-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span>{SHOP_ICONS[activeShop?.type] || '🏪'}</span>
          <span className="truncate font-medium">{activeShop?.name || 'Select Shop'}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="py-1 max-h-56 overflow-y-auto scrollbar-thin">
            {shops.map((shop) => (
              <button
                key={shop._id}
                onClick={() => { setActiveShop(shop); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700 transition ${
                  activeShop?._id === shop._id ? 'text-blue-400 bg-gray-700' : 'text-gray-300'
                }`}
              >
                <span>{SHOP_ICONS[shop.type] || '🏪'}</span>
                <span className="truncate">{shop.name}</span>
                {activeShop?._id === shop._id && <span className="ml-auto text-xs text-blue-400">Active</span>}
              </button>
            ))}
          </div>
          {can('settings') && (
            <div className="border-t border-gray-700">
              <button
                onClick={() => { navigate('/settings'); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700 transition"
              >
                <Plus className="w-4 h-4" />
                Add new shop
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
