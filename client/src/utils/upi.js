/**
 * UPI helpers — mirror of server/src/utils/upi.js.
 * Keep the two in sync: the client validates and renders the QR, the server
 * re-validates before it will create a pending UPI bill.
 */

// `name@bank` — 2–256 chars of [alphanumeric . _ - ] then a 2–64 char handle.
export const VPA_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,254}[a-zA-Z0-9])?@[a-zA-Z]{2,64}$/;

export const isValidVpa = (vpa) => typeof vpa === 'string' && VPA_REGEX.test(vpa.trim());

/**
 * Build a scannable `upi://pay` URI for an exact amount.
 * Returns null for an unusable config so callers never render a QR that would
 * fail — or worse, pay the wrong person.
 */
export const buildUpiUri = ({ vpa, merchantName, amount, note, refId }) => {
  if (!isValidVpa(vpa)) return null;

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return null;

  const params = new URLSearchParams();
  params.set('pa', vpa.trim());
  params.set('pn', (merchantName || 'Merchant').trim().slice(0, 99));
  params.set('am', amt.toFixed(2)); // UPI wants exactly 2 decimals for fixed amounts
  params.set('cu', 'INR');
  if (refId) params.set('tr', String(refId).slice(0, 35));
  if (note)  params.set('tn', String(note).replace(/[^\w\s.-]/g, '').slice(0, 50));

  return `upi://pay?${params.toString()}`;
};

/** 6–35 alphanumeric chars — a UTR is 12 digits, PSP references vary. */
export const isValidTxnRef = (ref) =>
  typeof ref === 'string' && /^[a-zA-Z0-9-]{6,35}$/.test(ref.trim());

/** Is this shop ready to take scan-to-pay money? */
export const isUpiReady = (shop) =>
  !!shop?.upiSettings?.enabled && isValidVpa(shop?.upiSettings?.vpa);
