import { useQuery } from '@tanstack/react-query';
import { Zap, ArrowRight, Loader2, Lightbulb } from 'lucide-react';
import { campaignsApi } from '../../api/campaigns.api';
import useShopStore from '../../store/shopStore';

const PRIORITY_STYLE = {
  high:   { badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500',    glow: 'ring-1 ring-red-200' },
  medium: { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500', glow: 'ring-1 ring-yellow-200' },
  low:    { badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400',   glow: '' },
};

export default function SmartSuggestions({ onSendNow }) {
  const { activeShop } = useShopStore();
  const shopId = activeShop?._id;

  const { data, isLoading } = useQuery({
    queryKey: ['campaign-suggestions', shopId],
    queryFn:  () => campaignsApi.getSuggestions(shopId),
    enabled:  !!shopId,
    staleTime: 5 * 60 * 1000,
  });

  const suggestions = data?.data?.suggestions || [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Analysing your customers…
      </div>
    );
  }

  if (!suggestions.length) {
    return (
      <div className="flex items-center gap-3 py-5 px-4 bg-gray-50 rounded-2xl border border-gray-200">
        <Lightbulb className="w-6 h-6 text-gray-300 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-gray-500">No suggestions right now</p>
          <p className="text-xs text-gray-400">Add more customers and sales to unlock smart campaign ideas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Smart Suggestions</p>
          <p className="text-[11px] text-gray-400">Based on your customer data</p>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2.5">
        {suggestions.map((s) => {
          const style = PRIORITY_STYLE[s.priority] || PRIORITY_STYLE.low;
          return (
            <div
              key={s.id}
              className={`bg-white border border-gray-200 rounded-2xl p-4 hover:border-blue-200 transition group ${style.glow}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                    <p className="text-sm font-bold text-gray-900 leading-snug">{s.title}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${style.badge}`}>
                      {s.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 ml-4">{s.description}</p>
                </div>

                {/* Count badge */}
                <div className="shrink-0 text-center">
                  <p className="text-2xl font-black text-gray-800 leading-none">{s.count}</p>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase">customers</p>
                </div>
              </div>

              <button
                onClick={() => onSendNow?.(s)}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold transition shadow shadow-blue-200"
              >
                <Zap className="w-3.5 h-3.5" />
                Send Campaign Now
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
