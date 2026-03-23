import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send, Clock, BarChart2, MessageCircle, Bell, RefreshCw,
  Loader2, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  Bot, Zap, LayoutDashboard,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { campaignsApi } from '../api/campaigns.api';
import useShopStore from '../store/shopStore';
import CampaignStepWizard   from '../components/campaigns/CampaignStepWizard';
import SmartSuggestions     from '../components/campaigns/SmartSuggestions';
import AutomationRules      from '../components/campaigns/AutomationRules';
import CampaignAnalyticsBar from '../components/campaigns/CampaignAnalyticsBar';

// ── Helpers ───────────────────────────────────────────────────────────────────
const channelIcon = (ch) => {
  if (ch === 'whatsapp') return <MessageCircle className="w-3.5 h-3.5 text-green-600" />;
  if (ch === 'sms')      return <Send          className="w-3.5 h-3.5 text-blue-600"  />;
  return                        <Bell          className="w-3.5 h-3.5 text-purple-600"/>;
};

const STATUS_MAP = {
  sent:      'bg-green-100 text-green-700',
  partial:   'bg-yellow-100 text-yellow-700',
  failed:    'bg-red-100 text-red-600',
  scheduled: 'bg-blue-100 text-blue-700',
  pending:   'bg-gray-100 text-gray-600',
};

// ── Daily summary card ────────────────────────────────────────────────────────
function DailySummaryCard() {
  const { activeShop } = useShopStore();
  const shopId = activeShop?._id;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['daily-summary', shopId],
    queryFn:  () => campaignsApi.getDailySummary(shopId),
    enabled:  !!shopId,
    staleTime: 2 * 60 * 1000,
  });

  const sendMut = useMutation({
    mutationFn: () => campaignsApi.sendDailySummary(shopId),
    onSuccess: (res) => {
      qc.invalidateQueries(['campaigns', shopId]);
      const link = res.data.campaign?.whatsappLinks?.[0]?.url;
      if (link) window.open(link, '_blank', 'noopener');
      else toast.success('Daily summary sent via push!');
    },
    onError: (e) => toast.error(e.message),
  });

  const s = data?.data?.summary;
  const change = s?.salesChangePercent;
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-bold opacity-70 uppercase tracking-wide">Today's Performance</p>
          <h3 className="text-lg font-black mt-0.5">{dateStr}</h3>
        </div>
        <BarChart2 className="w-9 h-9 opacity-20" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1,2,3].map((i) => <div key={i} className="h-14 bg-white/20 rounded-xl animate-pulse" />)}
        </div>
      ) : s ? (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Sales',  val: `₹${s.totalSales.toFixed(0)}` },
              { label: 'Profit', val: `₹${s.totalProfit.toFixed(0)}` },
              { label: 'Txns',   val: s.transactionCount },
            ].map(({ label, val }) => (
              <div key={label} className="bg-white/10 backdrop-blur-sm rounded-xl py-2.5 px-3 text-center">
                <p className="text-lg font-black leading-none">{val}</p>
                <p className="text-[10px] font-semibold opacity-70 uppercase mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Yesterday comparison */}
          {change !== null && change !== undefined && (
            <div className={`flex items-center gap-1.5 text-xs font-bold mb-4 ${change >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {change >= 0
                ? <TrendingUp  className="w-3.5 h-3.5" />
                : <TrendingDown className="w-3.5 h-3.5" />
              }
              Sales {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% vs yesterday
              {s.yesterday?.totalSales > 0 && (
                <span className="font-normal opacity-70 ml-1">
                  (₹{s.yesterday.totalSales.toFixed(0)} yesterday)
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm opacity-60 mb-4">No sales recorded today yet</p>
      )}

      <button
        onClick={() => sendMut.mutate()}
        disabled={sendMut.isPending || !s}
        className="w-full py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 border border-white/20"
      >
        {sendMut.isPending
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
          : <><Send className="w-4 h-4" /> Send Summary via WhatsApp/Push</>
        }
      </button>
    </div>
  );
}

// ── Campaign history row ──────────────────────────────────────────────────────
function CampaignRow({ c }) {
  const [open, setOpen] = useState(false);
  const date = new Date(c.createdAt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/80 transition text-left"
      >
        <div className="shrink-0">{channelIcon(c.channel)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900">
              {c.type.replace(/_/g, ' ')}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_MAP[c.status] || STATUS_MAP.pending}`}>
              {c.status}
            </span>
            {c.scheduledFor && c.status === 'scheduled' && (
              <span className="text-[10px] text-blue-600 font-semibold">
                → {new Date(c.scheduledFor).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{c.message?.slice(0, 70)}…</p>
        </div>
        <div className="shrink-0 text-right hidden sm:block">
          <p className="text-xs font-bold text-gray-700">{c.totalSent}/{c.totalTargeted} sent</p>
          <p className="text-xs text-gray-400">{date}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50/40 space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Sent',    val: c.totalSent,    cls: 'text-green-700' },
              { label: 'Failed',  val: c.totalFailed,  cls: 'text-red-600'   },
              { label: 'Skipped', val: c.totalSkipped, cls: 'text-yellow-700'},
            ].map(({ label, val, cls }) => (
              <div key={label} className="bg-white rounded-xl py-2.5 border border-gray-200">
                <p className={`text-xl font-black ${cls}`}>{val}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase">{label}</p>
              </div>
            ))}
          </div>

          {/* Full message */}
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Message</p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{c.message}</p>
          </div>

          {/* WhatsApp links */}
          {c.whatsappLinks?.length > 0 && (
            <div className="bg-white rounded-xl border border-green-200 px-4 py-3">
              <p className="text-[10px] font-bold text-green-700 uppercase mb-2">WhatsApp links</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {c.whatsappLinks.map((l, i) => (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-green-50 hover:bg-green-100 transition text-sm"
                  >
                    <span className="font-medium text-gray-800 truncate">{l.name}</span>
                    <span className="text-xs text-green-700 flex items-center gap-1 shrink-0 ml-2">
                      Open <MessageCircle className="w-3.5 h-3.5" />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Summary data */}
          {c.summaryData && (
            <div className="bg-white rounded-xl border border-blue-100 px-4 py-3">
              <p className="text-[10px] font-bold text-blue-700 uppercase mb-2">Summary — {c.summaryData.date}</p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div><p className="font-black text-gray-900">₹{c.summaryData.totalSales?.toFixed(0)}</p><p className="text-gray-400">Sales</p></div>
                <div><p className="font-black text-gray-900">₹{c.summaryData.totalProfit?.toFixed(0)}</p><p className="text-gray-400">Profit</p></div>
                <div><p className="font-black text-gray-900">{c.summaryData.transactionCount}</p><p className="text-gray-400">Txns</p></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── History tab ───────────────────────────────────────────────────────────────
function HistoryTab() {
  const { activeShop } = useShopStore();
  const shopId = activeShop?._id;
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['campaigns', shopId, page],
    queryFn:  () => campaignsApi.history({ shopId, page, limit: 10 }),
    enabled:  !!shopId,
  });

  const campaigns  = data?.data?.campaigns || [];
  const total      = data?.data?.total     || 0;
  const totalPages = Math.ceil(total / 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <p className="font-bold text-gray-900">Campaign History</p>
          {total > 0 && (
            <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{total}</span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TrendingUp className="w-12 h-12 text-gray-200 mb-3" />
          <p className="font-bold text-gray-500">No campaigns yet</p>
          <p className="text-sm text-gray-400 mt-1">Send your first campaign from the Send tab</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {campaigns.map((c) => <CampaignRow key={c._id} c={c} />)}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-xl text-sm font-bold border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition"
              >
                Prev
              </button>
              <span className="text-sm font-semibold text-gray-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-xl text-sm font-bold border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Tabs definition ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { id: 'send',        label: 'Send',        icon: Zap             },
  { id: 'history',     label: 'History',     icon: Clock           },
  { id: 'automations', label: 'Automations', icon: Bot             },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Campaigns() {
  const { activeShop } = useShopStore();
  const shopId = activeShop?._id;
  const [activeTab, setActiveTab] = useState('dashboard');
  const [wizardInit, setWizardInit] = useState(null);

  const handleSuggestionSend = (suggestion) => {
    setWizardInit({
      targetType:   suggestion.targetType,
      campaignType: suggestion.type,
      channel:      suggestion.channel,
      message:      suggestion.message,
    });
    setActiveTab('send');
  };

  const handleWizardSuccess = (tab = 'history') => {
    setWizardInit(null);
    setActiveTab(tab);
  };

  if (!shopId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Send className="w-12 h-12 mb-4 opacity-40" />
        <p className="font-bold text-gray-500">Select a shop to use campaigns</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-400 mt-0.5">Marketing automation for {activeShop.name}</p>
        </div>
        {/* Quick send button */}
        <button
          onClick={() => { setWizardInit(null); setActiveTab('send'); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-200 transition"
        >
          <Zap className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {/* Analytics bar (always visible) */}
      <CampaignAnalyticsBar />

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-lg transition border-b-2 -mb-px ${
              activeTab === id
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-5">
              <DailySummaryCard />
              <SmartSuggestions onSendNow={handleSuggestionSend} />
            </div>
            <div>
              <HistoryTab />
            </div>
          </div>
        )}

        {activeTab === 'send' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
                <Zap className="w-5 h-5 text-blue-600" />
                <div>
                  <h2 className="font-bold text-gray-900">Create Campaign</h2>
                  <p className="text-xs text-gray-400">Follow the steps to compose and send</p>
                </div>
              </div>
              <CampaignStepWizard
                key={JSON.stringify(wizardInit)}
                initialValues={wizardInit}
                onSuccess={handleWizardSuccess}
              />
            </div>
          </div>
        )}

        {activeTab === 'history' && <HistoryTab />}

        {activeTab === 'automations' && (
          <div className="max-w-2xl">
            <AutomationRules />
          </div>
        )}
      </div>
    </div>
  );
}
