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
