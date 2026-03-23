/**
 * VerifyContactsStep.jsx — Step 4 of CampaignStepWizard
 *
 * Shows all contacts in the selected segment, lets the user fix
 * missing / invalid phone numbers (or emails for non-whatsapp channels)
 * inline, and saves changes back to the server before sending.
 */

import { useState, useRef, useCallback, memo } from 'react';
import { CheckCircle2, AlertCircle, XCircle, ShieldCheck, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

import { customersApi } from '../../api/customers.api';
import useCampaignStore, {
  useContacts,
  useValidContacts,
  useInvalidContacts,
  useDirtyContacts,
} from '../../store/campaignStore';

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (status === 'valid') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
        <CheckCircle2 className="w-3 h-3" /> Valid
      </span>
    );
  }
  if (status === 'missing') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
        <XCircle className="w-3 h-3" /> Missing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
      <AlertCircle className="w-3 h-3" /> Invalid
    </span>
  );
}

// ── Contact row (memoised — only re-renders when contact object changes) ──────

const ContactRow = memo(function ContactRow({ contact, channel }) {
  const updateContact = useCampaignStore((s) => s.updateContact);

  const [localPhone, setLocalPhone] = useState(contact.phone || '');
  const [localEmail, setLocalEmail] = useState(contact.email || '');

  const phoneTimer = useRef(null);
  const emailTimer = useRef(null);

  const handlePhoneChange = useCallback(
    (e) => {
      const val = e.target.value;
      setLocalPhone(val);
      clearTimeout(phoneTimer.current);
      phoneTimer.current = setTimeout(() => updateContact(contact._id, 'phone', val), 300);
    },
    [contact._id, updateContact],
  );

  const handleEmailChange = useCallback(
    (e) => {
      const val = e.target.value;
      setLocalEmail(val);
      clearTimeout(emailTimer.current);
      emailTimer.current = setTimeout(() => updateContact(contact._id, 'email', val), 300);
    },
    [contact._id, updateContact],
  );

  const showEmail = channel !== 'whatsapp' && channel !== 'sms';

  const rowBg =
    contact._status === 'valid'
      ? 'border-gray-200 bg-white'
      : contact._status === 'missing'
      ? 'border-red-200 bg-red-50/40'
      : 'border-amber-200 bg-amber-50/40';

  return (
    <div
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-colors ${rowBg} ${
        contact._dirty ? 'ring-1 ring-blue-400' : ''
      }`}
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0 select-none">
        {contact.name?.[0]?.toUpperCase() || '?'}
      </div>

      {/* Name + inputs */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-900 truncate mb-1">{contact.name}</p>
        <div className="flex gap-1.5 flex-wrap">
          <input
            value={localPhone}
            onChange={handlePhoneChange}
            placeholder="10-digit phone"
            className="w-32 h-6 text-[11px] border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          />
          {showEmail && (
            <input
              value={localEmail}
              onChange={handleEmailChange}
              placeholder="Email address"
              className="min-w-[120px] flex-1 h-6 text-[11px] border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            />
          )}
        </div>
      </div>

      <StatusBadge status={contact._status} />
    </div>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

export default function VerifyContactsStep({ channel, isLoading }) {
  const contacts        = useContacts();
  const validContacts   = useValidContacts();
  const invalidContacts = useInvalidContacts();
  const dirtyContacts   = useDirtyContacts();

  const [filter,  setFilter]  = useState('all');
  const [saving,  setSaving]  = useState(false);

  // ── Push channel bypass ─────────────────────────────────────────────────────
  if (channel === 'push') {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center space-y-3">
        <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldCheck className="w-7 h-7 text-purple-500" />
        </div>
        <p className="font-bold text-gray-800">No Verification Needed</p>
        <p className="text-sm text-gray-500 max-w-[260px] leading-relaxed">
          Push notifications are delivered to the app — no phone or email required.
        </p>
      </div>
    );
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (isLoading || contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm font-medium">Loading contacts…</p>
      </div>
    );
  }

  // ── Derived counts ──────────────────────────────────────────────────────────
  const missingCount = contacts.filter((c) => c._status === 'missing').length;
  const invalidCount = contacts.filter((c) => c._status === 'invalid').length;
  const issueCount   = invalidContacts.length;
  const dirtyCount   = dirtyContacts.length;

  const filtered = contacts.filter((c) => {
    if (filter === 'missing') return c._status === 'missing';
    if (filter === 'invalid') return c._status === 'invalid';
    return true;
  });

  // ── Save dirty contacts ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!dirtyCount) return;
    setSaving(true);
    try {
      await Promise.all(
        dirtyContacts.map((c) =>
          customersApi.update(c._id, {
            ...(c.phone ? { phone: c.phone } : {}),
            ...(c.email ? { email: c.email } : {}),
          }),
        ),
      );
      useCampaignStore.getState().markAllSaved();
      toast.success(`${dirtyCount} contact${dirtyCount !== 1 ? 's' : ''} saved`);
    } catch {
      toast.error('Failed to save some contacts — please try again');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <p className="text-sm font-bold text-gray-900 mb-0.5">Verify Contact Details</p>
        <p className="text-xs text-gray-400">
          Fix missing or invalid contact info before sending.
          Changes are saved to the customer record.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-black text-gray-900 tabular-nums">{contacts.length}</p>
          <p className="text-[10px] font-semibold text-gray-500 mt-0.5">Total</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-3 text-center">
          <p className="text-2xl font-black text-green-700 tabular-nums">{validContacts.length}</p>
          <p className="text-[10px] font-semibold text-green-600 mt-0.5">Valid</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${issueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-2xl font-black tabular-nums ${issueCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {issueCount}
          </p>
          <p className={`text-[10px] font-semibold mt-0.5 ${issueCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>
            Issues
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {[
          { key: 'all',     label: `All (${contacts.length})`     },
          { key: 'missing', label: `Missing (${missingCount})`    },
          { key: 'invalid', label: `Invalid (${invalidCount})`    },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filter === key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Contact list */}
      <div className="space-y-1.5 max-h-[260px] overflow-y-auto scrollbar-thin pr-0.5">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-sm text-green-600 font-semibold gap-2">
            <CheckCircle2 className="w-5 h-5" />
            No contacts match this filter
          </div>
        ) : (
          filtered.map((c) => (
            <ContactRow key={c._id} contact={c} channel={channel} />
          ))
        )}
      </div>

      {/* Save button — only shown when edits are pending */}
      {dirtyCount > 0 && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes ({dirtyCount})
        </button>
      )}

      {/* Issue summary — shown when contacts still have problems */}
      {issueCount > 0 && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3">
          <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 leading-relaxed">
            <span className="font-bold">{issueCount} contact{issueCount !== 1 ? 's' : ''}</span> need
            attention before sending. Edit their phone numbers above, then click{' '}
            <span className="font-semibold">Save Changes</span>.
          </p>
        </div>
      )}

      {/* All good banner */}
      {issueCount === 0 && contacts.length > 0 && (
        <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-xl px-3.5 py-3">
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          <p className="text-xs text-green-700 font-semibold">
            All {contacts.length} contacts are ready — proceed to Send!
          </p>
        </div>
      )}
    </div>
  );
}
