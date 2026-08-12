/**
 * formatCompactINR — formats a number into a compact Indian currency string.
 *
 * Examples:
 *   0          → "₹0"
 *   999        → "₹999"
 *   1000       → "₹1K"       (not "₹1.0K")
 *   1500       → "₹1.5K"
 *   100000     → "₹1L"
 *   150000     → "₹1.5L"
 *   10000000   → "₹1Cr"
 *   -5000      → "-₹5K"
 */
export const formatCompactINR = (num) => {
  const n = Number(num);
  if (!isFinite(n)) return '₹0';

  const abs    = Math.abs(n);
  const prefix = n < 0 ? '-' : '';
  const fmt    = (val) => parseFloat(val.toFixed(1)); // strips trailing .0

  if (abs >= 10_000_000) return `${prefix}₹${fmt(abs / 10_000_000)}Cr`;
  if (abs >= 100_000)    return `${prefix}₹${fmt(abs / 100_000)}L`;
  if (abs >= 1_000)      return `${prefix}₹${fmt(abs / 1_000)}K`;

  return `${prefix}₹${abs}`;
};

/**
 * formatINR — full locale-formatted Indian Rupee (no abbreviation).
 *
 * Examples:
 *   1234567 → "₹12,34,567"
 */
export const formatINR = (num, decimals = 0) =>
  `₹${Number(num || 0).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

/**
 * formatDiscountPct — a discount percentage fit for a price badge.
 *
 * WHY THIS EXISTS
 *   A rupee discount is stored as its EXACT percentage equivalent so that
 *   `price * (1 - pct/100)` reproduces the intended rupee figure to the paisa.
 *   That is correct for billing and unreadable on a badge: ₹130 off ₹1,308 became
 *   "-9.9388379...%", and every card rendering `{discount}%` printed it raw.
 *
 *   Whole numbers stay whole ("10%"), and a genuinely fractional rate keeps one
 *   decimal ("9.9%") rather than being rounded into a claim the price contradicts.
 *
 * Examples:
 *   10       → "10"
 *   9.9388   → "9.9"
 *   12.5     → "12.5"
 *   0        → "0"
 */
export const formatDiscountPct = (pct) => {
  const n = Number(pct);
  if (!isFinite(n) || n <= 0) return '0';
  const rounded = Math.round(n);
  // Within a tenth of a whole number, show the whole number — this covers the
  // common "10% off" case entered as a percentage.
  if (Math.abs(n - rounded) < 0.05) return String(rounded);
  return n.toFixed(1);
};
