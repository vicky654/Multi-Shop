/**
 * Pricing engine — mirror of server/src/utils/pricing.js.
 *
 * The wizard needs these calculations live in the browser so nothing has to be
 * calculated by hand; the server is the authority and re-derives everything
 * before persisting. Do NOT edit one copy alone — server/src/utils/pricing.test.js
 * loads this file, strips the ESM syntax and asserts identical output across a
 * table of vectors, so drift fails the test run.
 *
 * See the server copy for the full rationale. The rules that matter most:
 *   - integer paise arithmetic, never floating-point rupees
 *   - "profit %" is markup on cost (1000 + 30% = 1300)
 *   - a fixed rupee discount becomes an UNROUNDED equivalent percent
 *   - gstRate null means "unset" and is not the same as 0
 */

const toPaise  = (rupees) => Math.round((Number(rupees) || 0) * 100);
const toRupees = (paise)  => +(paise / 100).toFixed(2);
const clamp    = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const nonNeg   = (n) => Math.max(0, Number(n) || 0);

// Selling price from cost + desired markup. 1000 + 30% => 1300.
export function sellingPriceFromMarkup(costPrice, profitPercent) {
  const costP = toPaise(nonNeg(costPrice));
  const pct   = nonNeg(profitPercent);
  return toRupees(Math.round(costP * (1 + pct / 100)));
}

// Inverse of the above, so editing the selling price updates the profit %.
export function markupFromSellingPrice(costPrice, price) {
  const cost = nonNeg(costPrice);
  if (cost === 0) return 0;                 // undefined markup, not Infinity
  return +(((nonNeg(price) - cost) / cost) * 100).toFixed(4);
}

// Collapse the user's discount choice into the canonical percent billing reads.
export function normalizeDiscountPercent({ price, discountType, discountValue } = {}) {
  const value = nonNeg(discountValue);
  if (discountType === 'percent') return clamp(value, 0, 100);
  if (discountType === 'fixed') {
    const p = nonNeg(price);
    if (p === 0) return 0;                  // avoid NaN / Infinity
    return clamp((value / p) * 100, 0, 100);
  }
  return 0;                                 // 'none', missing, or unknown
}

// Read a rate that distinguishes "unset" from "zero".
export function readOptionalRate(rate) {
  if (rate === null || rate === undefined || rate === '') return null;
  return clamp(Number(rate) || 0, 0, 100);
}

export function computeProductPricing({
  costPrice = 0,
  price,
  profitPercent,
  discountType = 'none',
  discountValue = 0,
  gstRate = null,
  gstMode = 'exclusive',
} = {}) {
  const cost = nonNeg(costPrice);

  // An explicit price always wins; otherwise derive it from the desired markup.
  const listPrice = price !== undefined && price !== null && price !== ''
    ? nonNeg(price)
    : sellingPriceFromMarkup(cost, profitPercent);

  const discountPercent = normalizeDiscountPercent({
    price: listPrice, discountType, discountValue,
  });

  const listP  = toPaise(listPrice);
  const finalP = Math.round(listP * (1 - discountPercent / 100));
  const costP  = toPaise(cost);

  // Tax sits on the discounted price — that is what the customer is charged on.
  const rate = readOptionalRate(gstRate);

  let taxP = 0, withTaxP = finalP;
  if (rate !== null && rate > 0) {
    if (gstMode === 'inclusive') {
      // The price already contains the tax, so back it out rather than adding.
      const taxableP = Math.round((finalP * 10000) / (10000 + rate * 100));
      taxP     = finalP - taxableP;
      withTaxP = finalP;
    } else {
      taxP     = Math.round((finalP * rate) / 100);
      withTaxP = finalP + taxP;
    }
  }

  const profitP    = finalP - costP;
  const finalPrice = toRupees(finalP);

  return {
    costPrice:      toRupees(costP),
    price:          toRupees(listP),
    discountPercent,
    discountAmount: toRupees(listP - finalP),
    finalPrice,
    profitAmount:   toRupees(profitP),
    profitPercentOnCost: markupFromSellingPrice(cost, finalPrice),
    marginPercentOnSell: finalP > 0 ? Math.round((profitP / finalP) * 100) : 0,
    gstRate:      rate,
    taxAmount:    toRupees(taxP),
    priceWithTax: toRupees(withTaxP),
  };
}
