import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, ToggleLeft, ToggleRight, Loader2, Bot,
  MessageCircle, Send, Bell, Clock, Zap, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { automationsApi } from '../../api/campaigns.api';
import useShopStore from '../../store/shopStore';

// ── Static metadata ───────────────────────────────────────────────────────────
const TRIGGERS = [
  { id: 'DUE_PAYMENT',      label: 'Payment Due',        desc: 'Runs daily — notifies customers with pending credit balances', icon: '💳', scheduled: true  },
  { id: 'INACTIVE_CUSTOMER',label: 'Inactive Customers', desc: 'Runs daily — reaches out to customers with no purchase in 60+ days', icon: '😴', scheduled: true  },
  { id: 'DAILY_SUMMARY',    label: 'Daily Summary',      desc: 'Runs at your chosen hour — sends sales summary to your WhatsApp/Push', icon: '📊', scheduled: true  },
  { id: 'NEW_CUSTOMER',     label: 'New Customer',       desc: 'Runs daily — welcomes customers who joined in the last 7 days', icon: '🆕', scheduled: true  },
  { id: 'LOW_STOCK',        label: 'Low Stock Alert',    desc: 'Runs daily — notifies when product stock drops below your threshold', icon: '📦', scheduled: true  },
  { id: 'NEW_PRODUCT',      label: 'New Product Added',  desc: 'Runs daily — announces products added in the last 24 hours to all customers', icon: '🛍️', scheduled: true },
];

const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-green-600' },
  { id: 'sms',      label: 'SMS',      icon: Send,          color: 'text-blue-600'  },
  { id: 'push',     label: 'Push',     icon: Bell,          color: 'text-purple-600'},
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, '0')}:00 (${i < 12 ? `${i === 0 ? 12 : i} AM` : `${i === 12 ? 12 : i - 12} PM`})`,
}));

const TEMPLATE_HINTS = {
  DUE_PAYMENT:       'Hi {name}, you have a pending balance at {shop}. Please clear it at your convenience. 🙏',
  INACTIVE_CUSTOMER: 'Hi {name}! We miss you at {shop}! 😊 Come visit us for exclusive deals.',
  DAILY_SUMMARY:     '📊 Daily Summary for {shop} is ready. Check your MultiShop dashboard!',
  NEW_CUSTOMER:      'Welcome to {shop}, {name}! 🎉 We are glad to have you. Visit us soon!',
  LOW_STOCK:         '⚠️ Stock alert at {shop}: some products are running low. Time to reorder!',
  NEW_PRODUCT:       'Hi {name}! 🛍️ New products just arrived at {shop}. Come check them out!',
};

const EMPTY_FORM = {
  name: '', trigger: 'DUE_PAYMENT', channel: 'whatsapp', subject: '',
  messageTemplate: '', condition: { operator: 'gt', value: 0 }, runHour: 21,
};

// ── Single rule card ──────────────────────────────────────────────────────────
function RuleCard({ rule, onToggle, onDelete, isToggling, isDeleting }) {
  const [open, setOpen] = useState(false);
  const trigger = TRIGGERS.find((t) => t.id === rule.trigger);
  const ch      = CHANNELS.find((c) => c.id === rule.channel);
  const ChanIcon = ch?.icon || Send;

  const lastRun = rule.lastRunAt
    ? new Date(rule.lastRunAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${rule.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50/50 opacity-70'}`}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Trigger icon */}
        <div className="text-xl leading-none shrink-0">{trigger?.icon || '⚙️'}</div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900 truncate">{rule.name}</p>
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
              rule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
            }`}>
              {rule.enabled ? 'Active' : 'Paused'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
              <ChanIcon className={`w-3 h-3 ${ch?.color}`} />
              {ch?.label}
            </span>
            <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {`${String(rule.runHour ?? 21).padStart(2,'0')}:00`}
            </span>
            <span className="text-[11px] text-gray-400">
              Runs: {rule.runCount ?? 0}×
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggle(rule._id)}
            disabled={isToggling}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            title={rule.enabled ? 'Pause automation' : 'Enable automation'}
          >
            {isToggling
              ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              : rule.enabled
              ? <ToggleRight className="w-5 h-5 text-green-600" />
              : <ToggleLeft  className="w-5 h-5 text-gray-400" />
            }
          </button>
          <button
            onClick={() => onDelete(rule._id)}
            disabled={isDeleting}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => setOpen((v) => !v)} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-0.5 border-t border-gray-100 bg-gray-50/70 space-y-2">
          <p className="text-xs text-gray-500 mt-2"><span className="font-semibold text-gray-600">Trigger:</span> {trigger?.desc}</p>
          <div className="bg-white rounded-xl border border-gray-200 px-3 py-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Message template</p>
            <p className="text-xs text-gray-700 whitespace-pre-line">{rule.messageTemplate}</p>
          </div>
          <p className="text-[11px] text-gray-400">Last ran: {lastRun}</p>
        </div>
      )}
    </div>
  );
}

// ── Create rule modal ─────────────────────────────────────────────────────────
function CreateRuleModal({ onClose, onCreated, shopId, ownerId }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const handleTriggerChange = (t) => {
    setForm((f) => ({ ...f, trigger: t, messageTemplate: TEMPLATE_HINTS[t] || '' }));
  };

  const createMut = useMutation({
    mutationFn: (d) => automationsApi.create(d),
    onSuccess: () => { toast.success('Automation created!'); onCreated(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim())           { toast.error('Name is required'); return; }
    if (!form.messageTemplate.trim()){ toast.error('Message template is required'); return; }
    createMut.mutate({ ...form, shopId });
  };

  const selected = TRIGGERS.find((t) => t.id === form.trigger);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-900">New Automation Rule</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Rule name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Daily payment reminder"
              className="mt-1.5 w-full h-9 text-sm border border-gray-200 rounded-xl px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Trigger */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Trigger</label>
            <div className="grid grid-cols-2 gap-2">
              {TRIGGERS.map(({ id, label, icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleTriggerChange(id)}
                  className={`text-left px-3 py-2.5 rounded-xl border-2 transition ${
                    form.trigger === id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <span className="text-base">{icon}</span>
                  <p className={`text-xs font-bold mt-0.5 ${form.trigger === id ? 'text-blue-700' : 'text-gray-700'}`}>{label}</p>
                </button>
              ))}
            </div>
            {selected && (
              <p className="text-[11px] text-gray-400 mt-2 bg-gray-50 rounded-lg px-3 py-2">{selected.desc}</p>
            )}
          </div>

          {/* Channel */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Channel</label>
            <div className="flex gap-2">
              {CHANNELS.map(({ id, label, icon: Icon, color }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, channel: id }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-xs font-bold transition ${
                    form.channel === id ? `border-current ${color}` : 'border-gray-200 text-gray-500'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Run hour */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Run at (daily)</label>
            <select
              value={form.runHour}
              onChange={(e) => setForm((f) => ({ ...f, runHour: Number(e.target.value) }))}
              className="mt-1.5 w-full h-9 text-sm border border-gray-200 rounded-xl px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {HOURS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Subject (push only) */}
          {form.channel === 'push' && (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Push title</label>
              <input
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. You have a pending payment"
                className="mt-1.5 w-full h-9 text-sm border border-gray-200 rounded-xl px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Message template */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Message template</label>
            </div>
            <textarea
              required
              value={form.messageTemplate}
              onChange={(e) => setForm((f) => ({ ...f, messageTemplate: e.target.value }))}
              rows={4}
              placeholder="Use {name}, {shop}, {due}, {amount}"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex gap-1 mt-1">
              {['{name}', '{shop}', '{due}'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, messageTemplate: f.messageTemplate + p }))}
                  className="text-[10px] font-mono px-2 py-0.5 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded transition text-gray-600"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={createMut.isPending}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-60 shadow-lg shadow-blue-200"
          >
            {createMut.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
              : <><Zap className="w-4 h-4" /> Create Automation</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AutomationRules() {
  const qc             = useQueryClient();
  const { activeShop } = useShopStore();
  const shopId         = activeShop?._id;
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['automations', shopId],
    queryFn:  () => automationsApi.getAll(shopId),
    enabled:  !!shopId,
  });
  const rules = data?.data?.automations || [];

  const toggleMut = useMutation({
    mutationFn: (id) => automationsApi.toggle(id),
    onSuccess:  () => qc.invalidateQueries(['automations', shopId]),
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => automationsApi.remove(id),
    onSuccess:  () => { qc.invalidateQueries(['automations', shopId]); toast.success('Automation deleted'); },
    onError: (e) => toast.error(e.message),
  });

  const handleDelete = (id) => {
    if (window.confirm('Delete this automation?')) deleteMut.mutate(id);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-bold text-gray-900">Automation Rules</p>
              <p className="text-xs text-gray-400">Set-and-forget campaigns that run automatically</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition shadow-md shadow-blue-200"
          >
            <Plus className="w-4 h-4" /> New Rule
          </button>
        </div>

        {/* Rules list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center border-2 border-dashed border-gray-200 rounded-2xl">
            <Bot className="w-12 h-12 text-gray-200 mb-3" />
            <p className="font-bold text-gray-500">No automations yet</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">Create your first rule to automate customer messaging</p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" /> Create First Rule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <RuleCard
                key={rule._id}
                rule={rule}
                onToggle={(id) => toggleMut.mutate(id)}
                onDelete={handleDelete}
                isToggling={toggleMut.isPending && toggleMut.variables === rule._id}
                isDeleting={deleteMut.isPending && deleteMut.variables === rule._id}
              />
            ))}
          </div>
        )}

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3.5">
          <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-blue-900">How automations work</p>
            <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
              Rules run automatically every 30 minutes on the server. Each rule checks if it should execute based on the trigger type and configured run hour. Once triggered, it creates a campaign and sends messages to matching customers.
            </p>
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateRuleModal
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries(['automations', shopId])}
          shopId={shopId}
        />
      )}
    </>
  );
}
