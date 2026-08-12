/**
 * Product pricing engine — deterministic, pure, no DB and no clock.
 *
 * WHY THIS EXISTS
 *   The product wizard must show cost → profit → selling price → discount →
 *   customer price → profit instantly as the user types, and the server must
 *   store exactly what the user was shown. Duplicating that arithmetic by hand
 *   in two places is how the two drift apart, so it lives here once and the
 *   client keeps a mirror that pricing.test.js verifies vector-by-vector.
 *
 * DESIGN RULES
 *   1. Arithmetic in INTEGER PAISE. Floating-point rupees drift (0.1 + 0.2) and
 *      a wizard that displays ₹1,170 must persist exactly 117000 paise.
 *   2. "Profit %" means MARKUP ON COST (1000 + 30% = 1300) — how a shop owner
 *      actually thinks. `marginPercentOnSell` is ALSO reported because that is
 *      what the existing Product.profitMargin virtual and the Inventory table
 *      show; surfacing only one would make the two screens contradict.
 *   3. A FIXED (rupee) discount is converted to its equivalent percent and
 *      deliberately NOT rounded. Billing applies `price * (1 - discount/100)`,
 *      so an unrounded percent reproduces the exact rupee figure — rounding to
 *      2dp would drift by a few paise on every single line.
 *   4. `gstRate == null` means "no product-level rate" and yields zero tax. It
 *      is NOT the same as 0, which is a real zero-rated product. Callers rely on
 *      this distinction to decide whether to fall back to the invoice tax rate.
 */

const toPaise  = (rupees) => Math.round((Number(rupees) || 0) * 100);
const toRupees = (paise)  => +(paise / 100).toFixed(2);
const clamp    = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const nonNeg   = (n) => Math.max(0, Number(n) || 0);

// Selling price from cost + desired markup. 1000 + 30% => 1300.
function sellingPriceFromMarkup(costPrice, profitPercent) {
  const costP = toPaise(nonNeg(costPrice));
  const pct   = nonNeg(profitPercent);
  return toRupees(Math.round(costP * (1 + pct / 100)));
}

// Inverse of the above, so editing the selling price updates the profit %.
// 4dp keeps the round-trip stable without storing a 17-digit float.
function markupFromSellingPrice(costPrice, price) {
  const cost = nonNeg(costPrice);
  if (cost === 0) return 0;                 // undefined markup, not Infinity
  return +(((nonNeg(price) - cost) / cost) * 100).toFixed(4);
}

// Collapse the user's discount choice into the canonical percent that billing
// reads. Deliberately unrounded — see design rule 3.
function normalizeDiscountPercent({ price, discountType, discountValue } = {}) {
  const value = nonNeg(discountValue);
  if (discountType === 'percent') return clamp(value, 0, 100);
  if (discountType === 'fixed') {
    const p = nonNeg(price);
    if (p === 0) return 0;                  // avoid NaN / Infinity
    return clamp((value / p) * 100, 0, 100);
  }
  return 0;                                 // 'none', missing, or unknown
}

// Read a rate that distinguishes "unset" from "zero". '' / null / undefined all
// mean unset; anything else is clamped into a legal percentage.
function readOptionalRate(rate) {
  if (rate === null || rate === undefined || rate === '') return null;
  return clamp(Number(rate) || 0, 0, 100);
}

function computeProductPricing({
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
    // Markup on cost — what the user typed in the wizard.
    profitPercentOnCost: markupFromSellingPrice(cost, finalPrice),
    // Margin on the selling price — what Product.profitMargin and the Inventory
    // table display. Both are returned so the two screens agree.
    marginPercentOnSell: finalP > 0 ? Math.round((profitP / finalP) * 100) : 0,
    gstRate:      rate,
    taxAmount:    toRupees(taxP),
    priceWithTax: toRupees(withTaxP),
  };
}

module.exports = {
  sellingPriceFromMarkup,
  markupFromSellingPrice,
  normalizeDiscountPercent,
  readOptionalRate,
  computeProductPricing,
};
