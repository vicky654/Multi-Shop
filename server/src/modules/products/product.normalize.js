/**
 * Product payload normalisation — the gatekeeper for every write to a Product.
 *
 * WHY THIS EXISTS
 *   createProduct/updateProduct hand the request body straight to Mongoose. That
 *   was harmless while the UI could only produce simple products, but the variant
 *   matrix introduces an invariant that billing silently depends on:
 *
 *       product.stock === sum(product.variantStock[].stock)
 *
 *   sale.service.js decrements the matching variant cell AND root stock in one
 *   atomic update precisely so root never drifts. If a write ever lands where
 *   those two disagree, every subsequent sale, refund and low-stock alert for
 *   that product is wrong, and nothing surfaces an error. So the matrix is
 *   authoritative and this module makes it true on the way in.
 *
 * THE PARTIAL-UPDATE RULE
 *   Every decision is gated on hasOwnProperty, never on truthiness. updateProduct
 *   does `Object.assign(product, normalized)`, so writing a key we were not asked
 *   about is how a `{price: 1500}` PUT would wipe a 15-cell matrix. If the caller
 *   did not send it, it does not appear in the output.
 */
const {
  normalizeDiscountPercent,
  sellingPriceFromMarkup,
  markupFromSellingPrice,
  readOptionalRate,
} = require('../../utils/pricing');
const { findDuplicateCombos, sumVariantStock } = require('../../utils/variantMatrix');

const PRICING_KEYS = ['costPrice', 'price', 'discount', 'discountType', 'discountValue'];

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
const bad = (message) => Object.assign(new Error(message), { status: 400 });

// A quantity must be a whole, non-negative number. '' and null are rejected
// rather than coerced to 0 — silently storing 0 for a typo loses real stock.
const parseQty = (raw, label) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw bad(`${label} cannot be negative or a non-number`);
  return Math.floor(n);
};

const parseMoney = (raw, label) => {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw bad(`${label} cannot be negative or a non-number`);
  return n;
};

/**
 * Clean one variant cell.
 *
 * `withPricing` false nulls every pricing field: the user turned per-variant
 * pricing off, and leaving stale prices behind would make billing charge them
 * anyway via `variant?.price ?? product.price`.
 */
const normalizeVariant = (raw, { withPricing, productPrice }) => {
  const size  = String(raw?.size  ?? '').trim();
  const color = String(raw?.color ?? '').trim();

  // A cell with neither axis is indistinguishable from the product itself and
  // would never be matched at the counter (the cart only sends '' for an axis
  // the product does not have, and then trackVariantStock is false anyway).
  if (!size && !color) throw bad('Each variant needs a size or a colour');

  const out = {
    size,
    color,
    stock: parseQty(raw?.stock ?? 0, `Variant "${color || size}" quantity`),
    costPrice: null, price: null, discount: null, discountType: null, discountValue: null,
  };

  if (!withPricing) return out;

  const label = `Variant "${[color, size].filter(Boolean).join(' / ')}"`;
  out.costPrice = parseMoney(raw?.costPrice, `${label} cost price`);
  out.price     = parseMoney(raw?.price,     `${label} price`);

  // A variant discount is measured against the variant's own price when it has
  // one, otherwise against the product's — same fallback billing uses.
  if (has(raw, 'discountType') && raw.discountType) {
    out.discountType  = raw.discountType;
    out.discountValue = parseMoney(raw?.discountValue, `${label} discount`) ?? 0;
    out.discount = normalizeDiscountPercent({
      price: out.price ?? productPrice ?? 0,
      discountType:  out.discountType,
      discountValue: out.discountValue,
    });
  } else if (has(raw, 'discount') && raw.discount !== null && raw.discount !== '') {
    // Legacy / direct API callers may send a bare percent.
    out.discount = parseMoney(raw.discount, `${label} discount`);
  }

  return out;
};

/**
 * @param {object} data      the request body
 * @param {object} [existing] the current document (as a plain object), for updates
 * @returns {object} a payload safe to Object.assign onto a Product
 */
function normalizeProductPayload(data, existing = null) {
  const out = { ...(data || {}) };

  // What variant tracking will be AFTER this write.
  const tracking = has(out, 'trackVariantStock')
    ? !!out.trackVariantStock
    : !!existing?.trackVariantStock;

  const withPricing = has(out, 'hasVariantPricing')
    ? !!out.hasVariantPricing
    : !!existing?.hasVariantPricing;

  // ── Pricing: resolve the effective price first, since discounts measure
  //    against it and profitPercent derives from it. ──────────────────────────
  const effectiveCost = has(out, 'costPrice')
    ? Number(out.costPrice) || 0
    : Number(existing?.costPrice) || 0;

  if (has(out, 'profitPercent') && !has(out, 'price')) {
    // The user typed a markup and no explicit price — derive the price.
    out.price = sellingPriceFromMarkup(effectiveCost, out.profitPercent);
  } else if (has(out, 'price')) {
    // The user typed a price — keep the equivalent markup so the wizard reopens
    // showing what they meant rather than re-deriving it every time.
    out.profitPercent = markupFromSellingPrice(effectiveCost, out.price);
  }

  const effectivePrice = has(out, 'price')
    ? Number(out.price) || 0
    : Number(existing?.price) || 0;

  // Only touch `discount` when the caller expressed an intent via discountType.
  // A legacy payload sending a bare `discount` percent keeps working untouched.
  if (has(out, 'discountType')) {
    out.discount = normalizeDiscountPercent({
      price: effectivePrice,
      discountType:  out.discountType,
      discountValue: has(out, 'discountValue') ? out.discountValue : existing?.discountValue,
    });
  }

  if (has(out, 'gstRate')) out.gstRate = readOptionalRate(out.gstRate);

  // ── Variants ───────────────────────────────────────────────────────────────
  if (has(out, 'variantStock')) {
    if (!Array.isArray(out.variantStock)) throw bad('variantStock must be an array');

    if (tracking) {
      if (out.variantStock.length === 0) throw bad('A variant product needs at least one variant');

      out.variantStock = out.variantStock.map((v) =>
        normalizeVariant(v, { withPricing, productPrice: effectivePrice }));

      const dupes = findDuplicateCombos(out.variantStock);
      if (dupes.length) throw bad(`Duplicate variant combinations: ${dupes.join(', ')}`);

      // The matrix is authoritative. Whatever `stock` the client sent is ignored.
      out.stock = sumVariantStock(out.variantStock);
    } else {
      // Variants explicitly off — drop the matrix and honour the given stock.
      out.variantStock = [];
    }
  } else if (tracking && has(out, 'stock')) {
    // Root stock on a variant product is derived, so a direct write would break
    // the invariant. Refuse loudly and point at the two supported routes.
    throw bad(
      'Cannot set stock directly on a variant product — update the variant matrix, '
      + 'or adjust a specific size/color via the stock adjustment endpoint'
    );
  }

  if (tracking === false && has(out, 'trackVariantStock') && !has(out, 'variantStock')) {
    // Switching a variant product back to simple must clear the stale matrix,
    // otherwise sale.service keeps routing sales through cells nobody maintains.
    out.variantStock = [];
  }

  return out;
}

module.exports = { normalizeProductPayload, PRICING_KEYS };
