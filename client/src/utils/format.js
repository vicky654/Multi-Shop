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
