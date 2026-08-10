/**
 * UPI helpers — VPA validation and `upi://pay` URI construction.
 *
 * The URI format follows the NPCI UPI Linking Specification, which is what
 * Google Pay / PhonePe / Paytm / BHIM all parse from a scanned QR code.
 *
 *   upi://pay?pa=<vpa>&pn=<payee name>&am=<amount>&cu=INR&tn=<note>&tr=<ref>
 *
 * Keep this file dependency-free — it is mirrored on the client
 * (client/src/utils/upi.js) so QR generation and validation stay in sync.
 */

// A VPA looks like `name@bank`: 2–256 chars of [alphanumeric . _ - ] before
// the @, then a 2–64 char alphabetic handle. Deliberately strict — a typo here
// silently sends a customer's money to the wrong person.
const VPA_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,254}[a-zA-Z0-9])?@[a-zA-Z]{2,64}$/;

const isValidVpa = (vpa) => typeof vpa === 'string' && VPA_REGEX.test(vpa.trim());

/**
 * Build a scannable `upi://pay` URI for an exact amount.
 * Returns null when the config is unusable, so callers never render a QR
 * that would fail or — worse — resolve to the wrong payee.
 */
const buildUpiUri = ({ vpa, merchantName, amount, note, refId }) => {
  if (!isValidVpa(vpa)) return null;

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return null;

  const params = new URLSearchParams();
  params.set('pa', vpa.trim());
  params.set('pn', (merchantName || 'Merchant').trim().slice(0, 99));
  // UPI requires exactly two decimal places for a fixed-amount request
  params.set('am', amt.toFixed(2));
  params.set('cu', 'INR');
  if (refId) params.set('tr', String(refId).slice(0, 35));
  if (note)  params.set('tn', String(note).replace(/[^\w\s.-]/g, '').slice(0, 50));

  return `upi://pay?${params.toString()}`;
};

/**
 * A UTR / UPI reference is 12 digits, but PSP-supplied transaction ids vary,
 * so accept any 6–35 char alphanumeric reference. The point is that the
 * cashier must have *seen* a reference — not merely clicked a button.
 */
const isValidTxnRef = (ref) =>
  typeof ref === 'string' && /^[a-zA-Z0-9-]{6,35}$/.test(ref.trim());

module.exports = { VPA_REGEX, isValidVpa, buildUpiUri, isValidTxnRef };
