/**
 * CustomerNotificationPanel — simple SMS blast UI
 *
 * Calls /api/notify endpoints for:
 *   • All customers  → POST /notify/send   (customerIds: 'all')
 *   • Manual select  → POST /notify/send   (customerIds: [...])
 *   • Pending dues   → POST /notify/due-reminders
 *
 * Uses FAST2SMS_API_KEY configured on the server.
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MessageSquare, Users, AlertCircle, Send, Eye, X, CheckCircle2, Search } from 'lucide-react';
import toast from 'react-hot-toast';

import useShopStore    from '../store/shopStore';
import { customersApi } from '../api/customers.api';
import { notifyApi }    from '../api/notify.api';

// ── Constants ──────────────────────────────────────────────────────────────────
const TARGETS = [
  { key: 'all',          label: 'All Customers',  icon: Users,         color: 'blue'   },
  { key: 'selected',     label: 'Select Manually', icon: CheckCircle2,  color: 'indigo' },
  { key: 'pending_dues', label: 'Pending Dues',   icon: AlertCircle,   color: 'amber'  },
];

const PLACEHOLDERS = ['{name}', '{shop}', '{amount}', '{due}'];

const TARGET_COLORS = {
  blue:   { active: 'bg-blue-600 border-blue-600 text-white',   idle: 'bg-blue-50 border-blue-200 text-blue-700 hover:border-blue-400'   },
  indigo: { active: 'bg-indigo-600 border-indigo-600 text-white', idle: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:border-indigo-400' },
  amber:  { active: 'bg-amber-500 border-amber-500 text-white',  idle: 'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400'  },
};

// ── Preview helper ─────────────────────────────────────────────────────────────
const renderPreview = (msg, shopName) =>
  msg
    .replace(/\{name\}/gi,   'Vicky')
    .replace(/\{shop\}/gi,   shopName || 'Your Shop')
    .replace(/\{amount\}/gi, '₹2,500')
    .replace(/\{due\}/gi,    '₹500');

// ── Component ─────────────────────────────────────────────────────────────────
export default function CustomerNotificationPanel() {
  const { activeShop }   = useShopStore();
  const shopId   = activeShop?._id;
  const shopName = activeShop?.name || 'Your Shop';

  const [target,   setTarget]   = useState('all');
  const [message,  setMessage]  = useState('');
  const [selected, setSelected] = useState([]);
  const [search,   setSearch]   = useState('');

  // Fetch customers only when "selected" tab is active
  const { data: custData, isLoading: custLoading } = useQuery({
    queryKey: ['customers-notify', shopId],
    queryFn:  () => customersApi.getAll({ shopId, limit: 500 }),
    enabled:  !!shopId && target === 'selected',
  });
  const customers = custData?.data || [];
  const filtered  = customers.filter((c) =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  );

  const toggleCustomer = (id) =>
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const selectAll  = () => setSelected(filtered.map((c) => c._id));
  const clearAll   = () => setSelected([]);

  // ── Mutation ─────────────────────────────────────────────────────────────────
  const sendMut = useMutation({
    mutationFn: () => {
      if (target === 'pending_dues') {
        return notifyApi.dueReminders({ shopId });
      }
      return notifyApi.send({
        shopId,
        message,
        customerIds: target === 'all' ? 'all' : selected,
      });
    },
    onSuccess: (res) => {
      const sent = res?.data?.sent ?? 0;
      toast.success(`SMS sent to ${sent} customer${sent !== 1 ? 's' : ''}!`);
      setMessage('');
      setSelected([]);
    },
    onError: (e) => toast.error(e.message || 'SMS send failed'),
  });

  const handleSend = () => {
    if (!shopId) { toast.error('Select a shop first'); return; }
    if (target !== 'pending_dues' && !message.trim()) { toast.error('Enter a message first'); return; }
    if (target === 'selected' && !selected.length) { toast.error('Select at least one customer'); return; }
    sendMut.mutate();
  };

  const insertPlaceholder = (ph) => setMessage((m) => m + ph);

  const duePrevMsg = 'You have a pending payment at {shop}. Please visit us to settle your dues.';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm">SMS Notification</p>
          <p className="text-[11px] text-gray-400">Send via Fast2SMS · India only</p>
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* ── Target selector ────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Send to</p>
          <div className="grid grid-cols-3 gap-2">
            {TARGETS.map(({ key, label, icon: Icon, color }) => {
              const c = TARGET_COLORS[color];
              return (
                <button
                  key={key}
                  onClick={() => { setTarget(key); setSelected([]); setSearch(''); }}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-semibold transition-all active:scale-95 ${
                    target === key ? c.active : c.idle
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Customer picker (manual selection) ─────────────────────────────── */}
        {target === 'selected' && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone…"
                className="w-full h-9 pl-9 pr-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-gray-400">{filtered.length} customers</span>
              <div className="flex gap-3 text-[11px] font-semibold">
                <button onClick={selectAll}  className="text-blue-600 hover:underline">Select all</button>
                <button onClick={clearAll}   className="text-gray-400 hover:underline">Clear</button>
              </div>
            </div>

            <div className="max-h-44 overflow-y-auto scrollbar-thin border border-gray-100 rounded-xl divide-y divide-gray-50">
              {custLoading && (
                <p className="text-xs text-gray-400 text-center py-4">Loading customers…</p>
              )}
              {!custLoading && filtered.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No customers found</p>
              )}
              {filtered.map((c) => (
                <label
                  key={c._id}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50/60 cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(c._id)}
                    onChange={() => toggleCustomer(c._id)}
                    className="accent-blue-600 w-4 h-4 rounded"
                  />
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {c.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-800 flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{c.phone || '—'}</span>
                </label>
              ))}
            </div>

            {selected.length > 0 && (
              <p className="text-xs font-semibold text-blue-600">
                {selected.length} customer{selected.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        )}

        {/* ── Message input ──────────────────────────────────────────────────── */}
        {target !== 'pending_dues' ? (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Message</p>
              <div className="flex gap-1 flex-wrap justify-end">
                {PLACEHOLDERS.map((ph) => (
                  <button
                    key={ph}
                    onClick={() => insertPlaceholder(ph)}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50 font-mono transition"
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={160}
              placeholder={`Hi {name}, thanks for visiting ${shopName}! Your total was ₹{amount}. Visit again!`}
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none transition-colors"
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-[10px] text-gray-400">Placeholders are replaced before sending</span>
              <span className={`text-[10px] font-mono ${message.length > 140 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                {message.length}/160
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Auto message for pending dues:
            </p>
            <p className="text-xs text-amber-800 font-mono leading-relaxed">
              {renderPreview(duePrevMsg, shopName)}
            </p>
          </div>
        )}

        {/* ── Preview ───────────────────────────────────────────────────────── */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Eye className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Preview</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3 min-h-[2.5rem]">
            <p className="text-sm text-gray-700 leading-relaxed font-mono whitespace-pre-wrap">
              {target === 'pending_dues'
                ? renderPreview(duePrevMsg, shopName)
                : message
                ? renderPreview(message, shopName)
                : <span className="text-gray-300 not-italic">Type a message to see the preview…</span>}
            </p>
          </div>
        </div>

        {/* ── Send button ───────────────────────────────────────────────────── */}
        <button
          onClick={handleSend}
          disabled={sendMut.isPending}
          className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
            disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl
            flex items-center justify-center gap-2 text-sm transition-all
            shadow-lg shadow-blue-300/30 hover:scale-[1.01] active:scale-[0.99]"
        >
          {sendMut.isPending ? (
            <>
              <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              Sending…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              {target === 'pending_dues' ? 'Send Due Reminders' : 'Send SMS'}
            </>
          )}
        </button>

        <p className="text-center text-[10px] text-gray-300">
          Powered by Fast2SMS · Max 500 messages/day · India only
        </p>
      </div>
    </div>
  );
}
