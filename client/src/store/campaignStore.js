/**
 * campaignStore.js — Zustand store for campaign contact verification
 *
 * Holds the working copy of segment customers during the Verify step.
 * Tracks inline edits (dirty state) and real-time validation status.
 */

import { create } from 'zustand';

// ── Validation helpers ────────────────────────────────────────────────────────

const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalisePhone = (p) => String(p || '').replace(/\D/g, '').slice(-10);

/**
 * Returns 'valid' | 'missing' | 'invalid' based on channel type.
 * - whatsapp / sms : requires valid 10-digit Indian phone
 * - push           : always valid (push goes to owner, not customers)
 * - fallback       : phone or email
 */
const computeStatus = (c, channel) => {
  if (channel === 'push') return 'valid';

  const phoneOk = PHONE_RE.test(normalisePhone(c.phone));
  const emailOk = EMAIL_RE.test(c.email || '');

  if (channel === 'whatsapp' || channel === 'sms') {
    if (!c.phone) return 'missing';
    return phoneOk ? 'valid' : 'invalid';
  }

  // generic fallback
  if (!c.phone && !c.email) return 'missing';
  return phoneOk || emailOk ? 'valid' : 'invalid';
};

// ── Store ─────────────────────────────────────────────────────────────────────

const useCampaignStore = create((set, get) => ({
  channel:  'whatsapp',
  contacts: [],

  /** Initialise contacts from the segment-customers API response */
  setContacts: (rawContacts, channel = 'whatsapp') =>
    set({
      channel,
      contacts: rawContacts.map((c) => ({
        ...c,
        phone:   c.phone  || '',
        email:   c.email  || '',
        _status: computeStatus(c, channel),
        _dirty:  false,
      })),
    }),

  /** Update a single field (phone | email) on a contact */
  updateContact: (id, field, value) =>
    set((state) => ({
      contacts: state.contacts.map((c) => {
        if (String(c._id) !== String(id)) return c;
        const updated = { ...c, [field]: value, _dirty: true };
        return { ...updated, _status: computeStatus(updated, state.channel) };
      }),
    })),

  /** Mark all contacts as saved (clears dirty flag after successful API save) */
  markAllSaved: () =>
    set((state) => ({
      contacts: state.contacts.map((c) => ({ ...c, _dirty: false })),
    })),

  /** Full reset — call when audience / channel changes */
  reset: () => set({ contacts: [], channel: 'whatsapp' }),
}));

export default useCampaignStore;

// ── Named selectors (stable references — avoid re-renders) ────────────────────
export const useContacts       = () => useCampaignStore((s) => s.contacts);
export const useValidContacts  = () => useCampaignStore((s) => s.contacts.filter((c) => c._status === 'valid'));
export const useInvalidContacts= () => useCampaignStore((s) => s.contacts.filter((c) => c._status !== 'valid'));
export const useDirtyContacts  = () => useCampaignStore((s) => s.contacts.filter((c) => c._dirty));
