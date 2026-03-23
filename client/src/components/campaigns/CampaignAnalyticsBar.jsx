import { useQuery } from '@tanstack/react-query';
import { Send, CheckCircle, XCircle, BarChart2, TrendingUp } from 'lucide-react';
import { campaignsApi } from '../../api/campaigns.api';
import useShopStore from '../../store/shopStore';

export default function CampaignAnalyticsBar() {
  const { activeShop } = useShopStore();
  const shopId = activeShop?._id;

  const { data, isLoading } = useQuery({
    queryKey: ['campaign-stats', shopId],
    queryFn:  () => campaignsApi.getStats(shopId),
    enabled:  !!shopId,
    staleTime: 2 * 60 * 1000,
  });

  const s = data?.data?.stats;

  const cards = [
    {
      label: 'Campaigns (this month)',
      value: s?.totalCampaigns ?? '—',
      icon:  BarChart2,
      color: 'text-purple-600',
      bg:    'bg-purple-50',
    },
    {
      label: 'Messages sent',
      value: s?.totalSent ?? '—',
      icon:  Send,
      color: 'text-blue-600',
      bg:    'bg-blue-50',
    },
    {
      label: 'Successfully delivered',
      value: s ? (s.totalSent - s.totalFailed) : '—',
      icon:  CheckCircle,
      color: 'text-green-600',
      bg:    'bg-green-50',
    },
    {
      label: 'Success rate',
      value: s ? `${s.successRate}%` : '—',
      icon:  TrendingUp,
      color: 'text-indigo-600',
      bg:    'bg-indigo-50',
      highlight: s?.successRate >= 90,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon: Icon, color, bg, highlight }) => (
        <div
          key={label}
          className={`bg-white rounded-2xl border ${highlight ? 'border-green-200 shadow-green-100 shadow-sm' : 'border-gray-200'} p-4`}
        >
          <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-2.5`}>
            <Icon className={`w-4.5 h-4.5 ${color} w-[18px] h-[18px]`} />
          </div>
          {isLoading ? (
            <div className="h-7 w-16 bg-gray-100 rounded-lg animate-pulse mb-1" />
          ) : (
            <p className={`text-2xl font-black ${highlight ? 'text-green-600' : 'text-gray-900'}`}>{value}</p>
          )}
          <p className="text-[11px] font-medium text-gray-400 leading-tight">{label}</p>
        </div>
      ))}
    </div>
  );
}
