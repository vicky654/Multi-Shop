/**
 * GSTIN validation — mirror of server/src/utils/gst.js.
 * Keep the two in sync: the client gives immediate feedback, the server is the
 * authority and re-validates before anything is persisted.
 */
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function checksumValid(gstin) {
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const v = CHARSET.indexOf(gstin[i]);
    if (v < 0) return false;
    let p = v * (i % 2 === 0 ? 1 : 2);
    p = Math.floor(p / 36) + (p % 36);
    sum += p;
  }
  return CHARSET[(36 - (sum % 36)) % 36] === gstin[14];
}

export const isValidGstin = (g) => {
  if (typeof g !== 'string') return false;
  const s = g.trim().toUpperCase();
  return GSTIN_REGEX.test(s) && checksumValid(s);
};

export const stateCodeOf = (g) => (isValidGstin(g) ? g.trim().slice(0, 2) : null);

/**
 * GST state codes, mirrored from server/src/utils/gst.js so Settings can show the
 * state a GSTIN belongs to while the user types. The server re-validates and is
 * the authority; this exists purely so the UI can name the state instead of
 * showing a bare two-digit code.
 */
export const STATE_CODES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', 10: 'Bihar', 11: 'Sikkim',
  12: 'Arunachal Pradesh', 13: 'Nagaland', 14: 'Manipur', 15: 'Mizoram',
  16: 'Tripura', 17: 'Meghalaya', 18: 'Assam', 19: 'West Bengal',
  20: 'Jharkhand', 21: 'Odisha', 22: 'Chhattisgarh', 23: 'Madhya Pradesh',
  24: 'Gujarat', 26: 'Dadra and Nagar Haveli and Daman and Diu',
  27: 'Maharashtra', 29: 'Karnataka', 30: 'Goa', 31: 'Lakshadweep',
  32: 'Kerala', 33: 'Tamil Nadu', 34: 'Puducherry', 35: 'Andaman and Nicobar Islands',
  36: 'Telangana', 37: 'Andhra Pradesh', 38: 'Ladakh', 97: 'Other Territory',
};

export const stateNameOf = (code) => STATE_CODES[String(code).padStart(2, '0')] || STATE_CODES[code] || null;
