import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, MessageSquare, Eye, Send, ChevronRight, ChevronLeft,
  MessageCircle, Bell, Loader2, Calendar, Zap, Check,
  ExternalLink, Phone, AlertTriangle, CheckCircle2, ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { campaignsApi } from '../../api/campaigns.api';
import { customersApi } from '../../api/customers.api';
import useShopStore from '../../store/shopStore';
import MessagePreview from './MessagePreview';
import VerifyContactsStep from './VerifyContactsStep';
import { sendWhatsAppCampaign } from '../../utils/whatsapp';
import useCampaignStore, { useValidContacts, useInvalidContacts } from '../../store/campaignStore';

// ── Static data ───────────────────────────────────────────────────────────────
const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'border-green-500 bg-green-50 text-green-700' },
  { id: 'sms',      label: 'SMS',      icon: Send,          color: 'border-blue-500 bg-blue-50 text-blue-700'    },
  { id: 'push',     label: 'Push',     icon: Bell,          color: 'border-purple-500 bg-purple-50 text-purple-700' },
];

const CAMPAIGN_TYPES = [
  { id: 'DISCOUNT_OFFER',       label: '🎉 Discount Offer',   body: 'Hi {name}! 🎉 Exclusive deal at {shop} — visit us today for special discounts!' },
  { id: 'PAYMENT_REMINDER',     label: '💳 Payment Reminder', body: 'Hi {name}, you have a pending balance at {shop}. Please clear it at your convenience. Thank you! 🙏' },
  { id: 'CUSTOM_MESSAGE',       label: '✍️ Custom Message',   body: '' },
  { id: 'NEW_PRODUCT_ANNOUNCE', label: '📦 New Arrivals',     body: 'Hi {name}! 🛍️ We have exciting new products at {shop}! Come check them out.' },
];

const SEGMENTS = [
  { id: 'all',             label: 'All Customers',     desc: 'Everyone in your list',           icon: '👥' },
  { id: 'pending_dues',    label: 'Pending Dues',      desc: 'Customers with unpaid credit',     icon: '💳' },
  { id: 'recent_buyers',   label: 'Recent Buyers',     desc: 'Bought in the last 30 days',       icon: '🛒' },
  { id: 'inactive',        label: 'Inactive Customers',desc: 'No purchase in 60+ days',          icon: '😴' },
  { id: 'high_spenders',   label: 'VIP Customers',     desc: 'Spent ₹5000+',                     icon: '🌟' },
  { id: 'frequent_buyers', label: 'Loyal Customers',   desc: '5+ purchases',                     icon: '❤️' },
  { id: 'new_customers',   label: 'New Customers',     desc: 'Joined in last 7 days',            icon: '🆕' },
  { id: 'selected',        label: 'Select Manually',   desc: 'Choose specific customers',        icon: '✅' },
];

const STEPS = [
  { n: 1, icon: Users,        label: 'Audience' },
  { n: 2, icon: MessageSquare,label: 'Message'  },
  { n: 3, icon: Eye,          label: 'Preview'  },
  { n: 4, icon: ShieldCheck,  label: 'Verify'   },
  { n: 5, icon: Send,         label: 'Send'     },
];

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-between px-2 mb-6">
      {STEPS.map(({ n, icon: Icon, label }, i) => {
        const done   = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                done   ? 'bg-green-500 text-white'
                : active ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                : 'bg-gray-100 text-gray-400'
              }`}>
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <p className={`text-[10px] font-bold mt-1 ${active ? 'text-blue-600' : done ? 'text-green-600' : 'text-gray-400'}`}>
                {label}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 mx-1.5 rounded-full ${n < current ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Audience ──────────────────────────────────────────────────────────
function Step1Audience({ form, setForm, segmentCounts, isLoadingCounts, customers }) {
  const { targetType, targetIds } = form;

  const toggle = (id) =>
    setForm((f) => ({
      ...f,
      targetIds: f.targetIds.includes(id)
        ? f.targetIds.filter((x) => x !== id)
        : [...f.targetIds, id],
    }));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-gray-900 mb-0.5">Who should receive this message?</p>
        <p className="text-xs text-gray-400">Choose a customer segment</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SEGMENTS.map(({ id, label, desc, icon }) => {
          const count  = segmentCounts?.[id];
          const active = targetType === id;
          return (
            <button
              key={id}
              onClick={() => setForm((f) => ({ ...f, targetType: id, targetIds: [] }))}
              className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-lg leading-none">{icon}</span>
                {isLoadingCounts ? (
                  <div className="w-6 h-4 bg-gray-100 rounded animate-pulse" />
                ) : count !== undefined ? (
                  <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {count}
                  </span>
                ) : null}
              </div>
              <p className={`text-xs font-bold mt-1.5 ${active ? 'text-blue-700' : 'text-gray-800'}`}>{label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{desc}</p>
            </button>
          );
        })}
      </div>

      {/* Manual selection */}
      {targetType === 'selected' && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-700">
              {targetIds.length ? `${targetIds.length} selected` : 'Choose customers'}
            </p>
            {targetIds.length > 0 && (
              <button
                onClick={() => setForm((f) => ({ ...f, targetIds: [] }))}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-44 overflow-y-auto divide-y divide-gray-50">
            {customers.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-400">No customers</p>
            ) : customers.map((c) => (
              <label key={c._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={targetIds.includes(c._id)}
                  onChange={() => toggle(c._id)}
                  className="rounded accent-blue-600 w-4 h-4"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.phone || 'No phone'}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 2: Message ───────────────────────────────────────────────────────────
function Step2Message({ form, setForm }) {
  const { channel, campaignType, message, subject } = form;

  const handleTypeChange = (id) => {
    const tpl = CAMPAIGN_TYPES.find((t) => t.id === id);
    setForm((f) => ({ ...f, campaignType: id, message: tpl?.body || '' }));
  };

  return (
    <div className="space-y-4">
      {/* Channel */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Send via</p>
        <div className="flex gap-2">
          {CHANNELS.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => setForm((f) => ({ ...f, channel: id }))}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-xs font-bold transition ${
                channel === id ? color : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign type */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Campaign type</p>
        <div className="grid grid-cols-2 gap-2">
          {CAMPAIGN_TYPES.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleTypeChange(id)}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold border-2 text-left transition ${
                campaignType === id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-700 hover:border-indigo-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Subject (push only) */}
      {channel === 'push' && (
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Notification title</label>
          <input
            value={subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder="e.g. Special offer just for you!"
            className="mt-1.5 w-full h-9 text-sm border border-gray-200 rounded-xl px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Message body */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Message</label>
          <span className="text-[10px] text-gray-400">{message.length} chars</span>
        </div>
        <textarea
          value={message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          rows={5}
          placeholder="Write your message… use {name}, {shop}, {due}, {amount}"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
        />
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          {['{name}', '{shop}', '{due}', '{amount}'].map((p) => (
            <button
              key={p}
              onClick={() => setForm((f) => ({ ...f, message: f.message + p }))}
              className="text-[10px] font-mono px-2 py-0.5 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-md transition text-gray-600"
            >
              {p}
            </button>
          ))}
          <span className="text-[10px] text-gray-400 ml-1">click to insert</span>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Preview ───────────────────────────────────────────────────────────
function Step3Preview({ form, shopName }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-900 mb-0.5">Message Preview</p>
        <p className="text-xs text-gray-400">How recipients will see your message</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-700">
          {CHANNELS.find((c) => c.id === form.channel)?.label || form.channel}
        </span>
        <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-700">
          {SEGMENTS.find((s) => s.id === form.targetType)?.label || form.targetType}
        </span>
        <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-700">
          {CAMPAIGN_TYPES.find((t) => t.id === form.campaignType)?.label?.replace(/^[^ ]+ /, '') || form.campaignType}
        </span>
      </div>

      <MessagePreview
        channel={form.channel}
        message={form.message}
        subject={form.subject}
        shopName={shopName}
      />
    </div>
  );
}

// ── Step 4: Send — WhatsApp panel ─────────────────────────────────────────────
function Step4WhatsApp({ form, segmentCounts, validContacts, waLoading }) {
  const { targetType } = form;
  const segCount = segmentCounts?.[targetType] ?? '?';
  const phoneCount = validContacts.length;
  const estimatedSeconds = ((phoneCount - 1) * 0.5).toFixed(1);

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-4 space-y-2.5">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm font-bold text-green-800">WhatsApp Campaign Ready</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500">Segment</span>
          <span className="text-sm font-bold text-gray-900">
            {SEGMENTS.find((s) => s.id === form.targetType)?.label || form.targetType}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500">Campaign type</span>
          <span className="text-sm font-bold text-gray-900">
            {CAMPAIGN_TYPES.find((t) => t.id === form.campaignType)?.label?.replace(/^[^ ]+ /, '') || '—'}
          </span>
        </div>
        <div className="border-t border-green-200 pt-2">
          <p className="text-[11px] text-gray-500 truncate italic">"{form.message.slice(0, 70)}{form.message.length > 70 ? '…' : ''}"</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-green-50 border-2 border-green-200 rounded-2xl p-4">
        <span className="text-2xl leading-none">💬</span>
        <div>
          <p className="font-bold text-green-800 text-sm">Messages will open in browser tabs</p>
          <p className="text-xs text-green-700 mt-1 leading-relaxed">
            One WhatsApp chat tab per customer, staggered 0.5s apart.
            Keep <strong>WhatsApp Web</strong> open before clicking.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
          {waLoading ? (
            <div className="h-8 bg-gray-200 rounded-lg animate-pulse mx-4 mb-1" />
          ) : (
            <p className="text-3xl font-black text-gray-900 tabular-nums">{phoneCount}</p>
          )}
          <p className="text-xs text-gray-500 font-semibold mt-0.5">Will receive</p>
          <p className="text-[10px] text-gray-400">(have phone numbers)</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-3xl font-black text-blue-600 tabular-nums">{segCount}</p>
          <p className="text-xs text-gray-500 font-semibold mt-0.5">In segment</p>
          <p className="text-[10px] text-gray-400">(total matched)</p>
        </div>
      </div>

      {/* Popup blocker warning */}
      {phoneCount > 0 && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed space-y-0.5">
            <p className="font-semibold">Before clicking:</p>
            <p>1. Allow <strong>pop-ups</strong> for this site in your browser</p>
            <p>2. Have <strong>WhatsApp Web</strong> open in another tab</p>
            <p>3. Estimated time: ~{estimatedSeconds}s for {phoneCount} message{phoneCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {phoneCount === 0 && !waLoading && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3 text-sm text-red-700">
          <Phone className="w-4 h-4 shrink-0" />
          No customers in this segment have phone numbers saved ({phoneCount}).
        </div>
      )}
    </div>
  );
}

// ── Step 4: Send — SMS / Push panel ──────────────────────────────────────────
function Step4Send({ form, setForm, segmentCounts }) {
  const { sendNow, scheduledFor, targetType, channel } = form;
  const count = segmentCounts?.[targetType] ?? '?';

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-gray-900 mb-0.5">Ready to send?</p>
        <p className="text-xs text-gray-400">Review details and choose when to deliver</p>
      </div>

      {/* Summary card */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-blue-200 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500">Recipients</span>
          <span className="text-sm font-black text-blue-700">{count} customers</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500">Channel</span>
          <span className="text-sm font-bold text-gray-900 capitalize">{channel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500">Type</span>
          <span className="text-sm font-bold text-gray-900">
            {CAMPAIGN_TYPES.find((t) => t.id === form.campaignType)?.label?.replace(/^[^ ]+ /, '') || '—'}
          </span>
        </div>
        <div className="border-t border-blue-200 pt-2">
          <p className="text-[11px] text-gray-500 truncate">"{form.message.slice(0, 60)}{form.message.length > 60 ? '…' : ''}"</p>
        </div>
      </div>

      {/* Timing */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">When to send</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setForm((f) => ({ ...f, sendNow: true, scheduledFor: '' }))}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition ${
              sendNow
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-600 hover:border-green-400'
            }`}
          >
            <Zap className="w-4 h-4" />
            Send Now
          </button>
          <button
            onClick={() => setForm((f) => ({ ...f, sendNow: false }))}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition ${
              !sendNow
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:border-blue-400'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Schedule
          </button>
        </div>

        {!sendNow && (
          <div className="mt-3">
            <label className="text-xs font-semibold text-gray-500">Schedule for</label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setForm((f) => ({ ...f, scheduledFor: e.target.value }))}
              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
              className="mt-1 w-full h-10 text-sm border border-gray-200 rounded-xl px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Safety note */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
        <span className="text-lg leading-none">⚠️</span>
        <p className="text-[11px] text-amber-800 leading-relaxed">
          Customers without valid phone numbers will be skipped automatically.
          Daily limit: 500 messages.
        </p>
      </div>
    </div>
  );
}

// ── WhatsApp links modal ──────────────────────────────────────────────────────
function WhatsAppLinksModal({ links, onDone }) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <p className="font-bold text-gray-900 text-lg">
          {links.length} WhatsApp Chat{links.length !== 1 ? 's' : ''} Opened
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Tabs opened with 0.5s delay. Click any link below if a tab was blocked.
        </p>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin pr-0.5">
        {links.map((l, i) => (
          <a
            key={i}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl transition group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center text-green-800 font-black text-sm shrink-0">
                {l.name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{l.name}</p>
                <p className="text-xs text-gray-400">{l.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-green-600 font-semibold text-xs shrink-0 group-hover:gap-2.5 transition-all">
              Open <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </a>
        ))}
      </div>

      <button
        onClick={onDone}
        className="w-full py-3 rounded-2xl bg-gray-900 text-white font-bold text-sm hover:bg-gray-800 transition"
      >
        Done — View History
      </button>
    </div>
  );
}

// ── Default form ──────────────────────────────────────────────────────────────
const DEFAULT_FORM = {
  channel:      'whatsapp',
  campaignType: 'DISCOUNT_OFFER',
  targetType:   'all',
  targetIds:    [],
  message:      'Hi {name}! 🎉 Exclusive deal at {shop} — visit us today for special discounts!',
  subject:      '',
  sendNow:      true,
  scheduledFor: '',
};

// ── Main Wizard ───────────────────────────────────────────────────────────────
export default function CampaignStepWizard({ initialValues = null, onSuccess }) {
  const qc             = useQueryClient();
  const { activeShop } = useShopStore();
  const shopId         = activeShop?._id;
  const shopName       = activeShop?.name || '';

  const [step,    setStep]    = useState(1);
  const [form,    setForm]    = useState(() => ({ ...DEFAULT_FORM, ...initialValues }));
  const [waLinks, setWaLinks] = useState(null);

  // ── Campaign store (contact verification) ─────────────────────────────────
  const validContacts   = useValidContacts();
  const invalidContacts = useInvalidContacts();
  const invalidCount    = invalidContacts.length;

  // Apply initial values when they change (from Smart Suggestions)
  useEffect(() => {
    if (initialValues) {
      setForm((f) => ({ ...f, ...initialValues }));
      setStep(3);
    }
  }, [initialValues]);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: segData, isLoading: isLoadingCounts } = useQuery({
    queryKey: ['campaign-segments', shopId],
    queryFn:  () => campaignsApi.getSegments(shopId),
    enabled:  !!shopId,
    staleTime: 3 * 60 * 1000,
  });
  const segmentCounts = segData?.data?.segments || segData?.segments;

  const { data: custData } = useQuery({
    queryKey: ['customers-wizard', shopId],
    queryFn:  () => customersApi.getAll({ shopId, limit: 200 }),
    enabled:  !!shopId && form.targetType === 'selected',
  });
  const customers = custData?.data || [];

  // Fetch all segment contacts starting at step 4 (Verify step)
  const { data: segCustData, isLoading: segCustLoading } = useQuery({
    queryKey: ['segment-customers', shopId, form.targetType, JSON.stringify(form.targetIds)],
    queryFn:  () => campaignsApi.getSegmentCustomers(shopId, form.targetType, form.targetIds),
    enabled:  !!shopId && step >= 4,
    staleTime: 60 * 1000,
  });

  // Populate campaignStore whenever segment data arrives or channel changes
  useEffect(() => {
    if (!segCustData) return;
    const raw = segCustData?.customers || segCustData?.data?.customers || [];
    useCampaignStore.getState().setContacts(raw, form.channel);
  }, [segCustData, form.channel]);

  // Reset store when audience or channel changes (so stale validated contacts are cleared)
  useEffect(() => {
    useCampaignStore.getState().reset();
  }, [form.targetType, form.channel]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const sendMut = useMutation({
    mutationFn: (data) => campaignsApi.send(data),
    onSuccess: (res) => {
      qc.invalidateQueries(['campaigns', shopId]);
      qc.invalidateQueries(['campaign-stats', shopId]);
      const c = res.campaign || res.data?.campaign;
      if (c?.status === 'scheduled') {
        toast.success('Campaign scheduled!');
        reset();
        onSuccess?.('history');
        return;
      }
      toast.success(`Campaign sent — ${c?.totalSent ?? 0} delivered`);
      reset();
      onSuccess?.('history');
    },
    onError: (e) => toast.error(e.message),
  });

  const reset = () => {
    setForm({ ...DEFAULT_FORM });
    setStep(1);
  };

  // ── WhatsApp send (client-side, no API wait) ──────────────────────────────
  const handleWhatsAppSend = useCallback(() => {
    if (!shopId) { toast.error('Select a shop first'); return; }
    if (!validContacts.length) {
      toast.error('No customers with phone numbers in this segment');
      return;
    }

    // Generate and open tabs
    const links = sendWhatsAppCampaign(validContacts, form.message, shopName);

    if (!links.length) {
      toast.error('No customers have valid phone numbers');
      return;
    }

    toast.success(`Opening ${links.length} WhatsApp chat${links.length !== 1 ? 's' : ''}…`);
    setWaLinks(links);

    // Save to server for analytics / history (fire-and-forget — do not block UI)
    campaignsApi.send({
      shopId,
      type:        form.campaignType,
      channel:     'whatsapp',
      subject:     form.subject,
      message:     form.message,
      targetType:  form.targetType,
      targetIds:   form.targetIds,
      scheduledFor: null,
    })
      .then(() => {
        qc.invalidateQueries(['campaigns', shopId]);
        qc.invalidateQueries(['campaign-stats', shopId]);
      })
      .catch((e) => console.warn('[WA Campaign] History save failed:', e.message));
  }, [shopId, validContacts, form, shopName, qc]);

  // ── SMS / Push send (server-side) ─────────────────────────────────────────
  const handleServerSend = useCallback(() => {
    if (!shopId) { toast.error('Select a shop first'); return; }
    if (!form.sendNow && !form.scheduledFor) { toast.error('Please choose a schedule time'); return; }

    sendMut.mutate({
      shopId,
      type:         form.campaignType,
      channel:      form.channel,
      subject:      form.subject,
      message:      form.message,
      targetType:   form.targetType,
      targetIds:    form.targetIds,
      scheduledFor: form.sendNow ? null : form.scheduledFor,
    });
  }, [shopId, form, sendMut]);

  // ── Unified final send dispatch ───────────────────────────────────────────
  const handleSend = useCallback(() => {
    if (form.channel === 'whatsapp') {
      handleWhatsAppSend();
    } else {
      handleServerSend();
    }
  }, [form.channel, handleWhatsAppSend, handleServerSend]);

  const canNext = useCallback(() => {
    if (step === 1) return form.targetType !== 'selected' || form.targetIds.length > 0;
    if (step === 2) return form.message.trim().length > 0;
    return true; // steps 3 and 4: always allow advance
  }, [step, form]);

  // ── WhatsApp links result view ────────────────────────────────────────────
  if (waLinks) {
    return (
      <WhatsAppLinksModal
        links={waLinks}
        onDone={() => { setWaLinks(null); reset(); onSuccess?.('history'); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <StepIndicator current={step} />

      {/* Step content */}
      <div className="min-h-[320px]">
        {step === 1 && (
          <Step1Audience
            form={form}
            setForm={setForm}
            segmentCounts={segmentCounts}
            isLoadingCounts={isLoadingCounts}
            customers={customers}
          />
        )}
        {step === 2 && <Step2Message form={form} setForm={setForm} />}
        {step === 3 && <Step3Preview form={form} shopName={shopName} />}
        {step === 4 && (
          <VerifyContactsStep channel={form.channel} isLoading={segCustLoading} />
        )}
        {step === 5 && form.channel === 'whatsapp' && (
          <Step4WhatsApp
            form={form}
            segmentCounts={segmentCounts}
            validContacts={validContacts}
            waLoading={segCustLoading}
          />
        )}
        {step === 5 && form.channel !== 'whatsapp' && (
          <Step4Send form={form} setForm={setForm} segmentCounts={segmentCounts} />
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        {step > 1 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
        <div className="flex-1" />

        {step < 5 ? (
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition disabled:opacity-40 shadow-md shadow-blue-200"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
            {/* Warn at verify step if issues exist but still let user advance */}
            {step === 4 && invalidCount > 0 && (
              <p className="text-[11px] text-amber-600 font-semibold">
                {invalidCount} issue{invalidCount !== 1 ? 's' : ''} — fix before sending
              </p>
            )}
          </div>

        ) : form.channel === 'whatsapp' ? (
          /* ── WhatsApp: Open tabs button ── */
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={handleSend}
              disabled={segCustLoading || validContacts.length === 0 || invalidCount > 0}
              className="flex items-center gap-2 px-6 py-3 rounded-xl
                bg-gradient-to-r from-green-500 to-emerald-600
                hover:from-green-600 hover:to-emerald-700
                text-white text-sm font-bold transition
                disabled:opacity-50 disabled:cursor-not-allowed
                shadow-lg shadow-green-300/40"
            >
              {segCustLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Loading customers…</>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" />
                  Open WhatsApp Messages
                  {validContacts.length > 0 && (
                    <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-xs font-black ml-0.5">
                      {validContacts.length}
                    </span>
                  )}
                </>
              )}
            </button>
            {invalidCount > 0 && (
              <p className="text-[11px] text-red-600 font-semibold">
                {invalidCount} contact{invalidCount !== 1 ? 's' : ''} need attention — go back to Verify
              </p>
            )}
          </div>

        ) : (
          /* ── SMS / Push: Server send button ── */
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={handleSend}
              disabled={sendMut.isPending || invalidCount > 0}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold transition disabled:opacity-60 shadow-lg shadow-blue-200"
            >
              {sendMut.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
              ) : form.sendNow ? (
                <><Zap className="w-4 h-4" /> Send Now</>
              ) : (
                <><Calendar className="w-4 h-4" /> Schedule</>
              )}
            </button>
            {invalidCount > 0 && (
              <p className="text-[11px] text-red-600 font-semibold">
                {invalidCount} contact{invalidCount !== 1 ? 's' : ''} need attention — go back to Verify
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
