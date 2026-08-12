/**
 * Product payload normalisation tests — plain Node, no test framework needed.
 *   node src/modules/products/product.normalize.test.js
 *
 * These guard the invariant billing depends on:
 *     product.stock === sum(product.variantStock[].stock)
 */
const assert = require('node:assert');
const { normalizeProductPayload } = require('./product.normalize');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
  catch (e) { fail += 1; console.error(`  ✗ ${name}\n      ${e.message}`); }
};
const rejects = (fn, re) => assert.throws(fn, (e) => {
  assert.equal(e.status, 400, `expected status 400, got ${e.status}`);
  assert.match(e.message, re);
  return true;
});

console.log('\nThe stock === sum(variantStock) invariant');

t('stock is forced to the matrix total, ignoring what the client sent', () => {
  const out = normalizeProductPayload({
    trackVariantStock: true,
    stock: 999,
    variantStock: [
      { size: '7', color: 'Black', stock: 5 },
      { size: '8', color: 'Black', stock: 10 },
    ],
  });
  assert.equal(out.stock, 15);
});
t('the full 15-cell shoe matrix totals 100', () => {
  const variantStock = [];
  const grid = [[5, 10, 10, 10, 5], [5, 5, 10, 10, 5], [5, 5, 5, 5, 5]];
  ['Black', 'Brown', 'White'].forEach((color, ci) =>
    ['7', '8', '9', '10', '11'].forEach((size, si) =>
      variantStock.push({ size, color, stock: grid[ci][si] })));
  assert.equal(normalizeProductPayload({ trackVariantStock: true, variantStock }).stock, 100);
});
t('a size-only matrix still drives stock', () => {
  const out = normalizeProductPayload({
    trackVariantStock: true,
    variantStock: [{ size: 'M', color: '', stock: 7 }],
  });
  assert.equal(out.stock, 7);
});
t('a color-only matrix still drives stock', () => {
  const out = normalizeProductPayload({
    trackVariantStock: true,
    variantStock: [{ size: '', color: 'Red', stock: 6 }],
  });
  assert.equal(out.stock, 6);
});
t('turning variants OFF clears the matrix and keeps the given stock', () => {
  const out = normalizeProductPayload({
    trackVariantStock: false, stock: 42,
    variantStock: [{ size: '7', color: 'Black', stock: 5 }],
  });
  assert.deepEqual(out.variantStock, []);
  assert.equal(out.stock, 42);
});
t('a simple product payload is passed through untouched', () => {
  const out = normalizeProductPayload({ name: 'Pen', stock: 10, price: 20, costPrice: 12 });
  assert.equal(out.stock, 10);
  assert.equal('trackVariantStock' in out, false);
  assert.equal('variantStock' in out, false);
});

console.log('\nVariant validation');

t('rejects a negative variant quantity', () => {
  rejects(() => normalizeProductPayload({
    trackVariantStock: true, variantStock: [{ size: '7', color: 'Black', stock: -1 }],
  }), /negative/i);
});
t('rejects a non-numeric variant quantity', () => {
  rejects(() => normalizeProductPayload({
    trackVariantStock: true, variantStock: [{ size: '7', color: 'Black', stock: 'abc' }],
  }), /negative|number/i);
});
t('rejects duplicate size/color combinations', () => {
  rejects(() => normalizeProductPayload({
    trackVariantStock: true,
    variantStock: [
      { size: '7', color: 'Black', stock: 1 },
      { size: '7', color: 'Black', stock: 2 },
    ],
  }), /duplicate/i);
});
t('the duplicate message names the offending combination', () => {
  assert.throws(() => normalizeProductPayload({
    trackVariantStock: true,
    variantStock: [{ size: '9', color: 'Brown' }, { size: '9', color: 'Brown' }],
  }), /Brown \/ 9/);
});
t('rejects variant tracking with an empty matrix', () => {
  rejects(() => normalizeProductPayload({ trackVariantStock: true, variantStock: [] }),
    /at least one variant/i);
});
t('rejects a variant with neither size nor color', () => {
  rejects(() => normalizeProductPayload({
    trackVariantStock: true, variantStock: [{ size: '', color: '', stock: 5 }],
  }), /size or a colou?r/i);
});
t('rejects a non-array variantStock', () => {
  rejects(() => normalizeProductPayload({ trackVariantStock: true, variantStock: 'nope' }),
    /must be an array/i);
});
t('coerces variant quantities to integers', () => {
  const out = normalizeProductPayload({
    trackVariantStock: true, variantStock: [{ size: '7', color: 'Black', stock: '5' }],
  });
  assert.equal(out.variantStock[0].stock, 5);
  assert.equal(out.stock, 5);
});
t('trims variant size and color so " 7 " cannot shadow "7"', () => {
  const out = normalizeProductPayload({
    trackVariantStock: true, variantStock: [{ size: ' 7 ', color: ' Black ', stock: 5 }],
  });
  assert.equal(out.variantStock[0].size,  '7');
  assert.equal(out.variantStock[0].color, 'Black');
});

console.log('\nPartial updates must not destroy a matrix');

const EXISTING = {
  trackVariantStock: true,
  stock: 15,
  costPrice: 1000,
  price: 1300,
  variantStock: [
    { size: '7', color: 'Black', stock: 5 },
    { size: '8', color: 'Black', stock: 10 },
  ],
};

t('a price-only PUT leaves variantStock and stock alone', () => {
  const out = normalizeProductPayload({ price: 1500 }, EXISTING);
  assert.equal('variantStock' in out, false);   // never written, so Object.assign cannot clear it
  assert.equal('stock' in out, false);
});
t('a stock-only PUT on a variant product is rejected rather than silently drifting', () => {
  rejects(() => normalizeProductPayload({ stock: 99 }, EXISTING), /variant/i);
});
t('sending a new matrix on a variant product recomputes stock', () => {
  const out = normalizeProductPayload({
    variantStock: [{ size: '7', color: 'Black', stock: 1 }],
  }, EXISTING);
  assert.equal(out.stock, 1);
});
t('sending stock together with a matrix is fine — the matrix wins', () => {
  const out = normalizeProductPayload({
    stock: 500, variantStock: [{ size: '7', color: 'Black', stock: 3 }],
  }, EXISTING);
  assert.equal(out.stock, 3);
});
t('switching a variant product to simple accepts an explicit stock', () => {
  const out = normalizeProductPayload({ trackVariantStock: false, stock: 20 }, EXISTING);
  assert.deepEqual(out.variantStock, []);
  assert.equal(out.stock, 20);
});
t('a stock-only PUT on a simple product is still allowed', () => {
  const out = normalizeProductPayload({ stock: 99 }, { trackVariantStock: false, stock: 10 });
  assert.equal(out.stock, 99);
});

console.log('\nDiscount normalisation');

t('a fixed discount becomes an exact percent', () => {
  const out = normalizeProductPayload({ price: 1300, discountType: 'fixed', discountValue: 200 });
  assert.equal(+(1300 * (1 - out.discount / 100)).toFixed(2), 1100);
  assert.equal(out.discountType,  'fixed');    // preserved for round-trip edit
  assert.equal(out.discountValue, 200);
});
t('a percent discount is stored as-is', () => {
  const out = normalizeProductPayload({ price: 1300, discountType: 'percent', discountValue: 10 });
  assert.equal(out.discount, 10);
});
t("discountType 'none' zeroes the canonical discount", () => {
  const out = normalizeProductPayload({ price: 1300, discountType: 'none', discountValue: 50 });
  assert.equal(out.discount, 0);
});
t('a legacy payload with only `discount` is left alone', () => {
  const out = normalizeProductPayload({ price: 1300, discount: 15 });
  assert.equal(out.discount, 15);
  assert.equal('discountType' in out, false);
});
t('a fixed discount uses the existing price when the payload omits it', () => {
  const out = normalizeProductPayload({ discountType: 'fixed', discountValue: 130 }, EXISTING);
  assert.equal(+(1300 * (1 - out.discount / 100)).toFixed(2), 1170);
});

console.log('\nProfit percent round-trip');

t('profitPercent derives price when price is absent', () => {
  const out = normalizeProductPayload({ costPrice: 1000, profitPercent: 30 });
  assert.equal(out.price, 1300);
});
t('an explicit price back-derives profitPercent', () => {
  const out = normalizeProductPayload({ costPrice: 1000, price: 1300 });
  assert.equal(Math.round(out.profitPercent), 30);
});
t('profitPercent uses the existing costPrice when the payload omits it', () => {
  const out = normalizeProductPayload({ profitPercent: 50 }, EXISTING);
  assert.equal(out.price, 1500);
});
t('a payload with neither price nor profitPercent touches neither', () => {
  const out = normalizeProductPayload({ name: 'Pen' });
  assert.equal('price' in out, false);
  assert.equal('profitPercent' in out, false);
});

console.log('\nVariant pricing');

t('per-variant pricing is stripped when hasVariantPricing is false', () => {
  const out = normalizeProductPayload({
    trackVariantStock: true, hasVariantPricing: false,
    variantStock: [{ size: '7', color: 'Black', stock: 5, price: 1500, costPrice: 900 }],
  });
  assert.equal(out.variantStock[0].price,     null);
  assert.equal(out.variantStock[0].costPrice, null);
});
t('per-variant pricing is kept and its discount normalised when enabled', () => {
  const out = normalizeProductPayload({
    trackVariantStock: true, hasVariantPricing: true,
    variantStock: [{
      size: '7', color: 'Black', stock: 5,
      price: 1300, costPrice: 900, discountType: 'fixed', discountValue: 200,
    }],
  });
  assert.equal(out.variantStock[0].price, 1300);
  assert.equal(+(1300 * (1 - out.variantStock[0].discount / 100)).toFixed(2), 1100);
});
t('a variant with no pricing keeps nulls, not zeros', () => {
  const out = normalizeProductPayload({
    trackVariantStock: true, hasVariantPricing: true,
    variantStock: [{ size: '7', color: 'Black', stock: 5 }],
  });
  assert.equal(out.variantStock[0].price,     null);
  assert.equal(out.variantStock[0].costPrice, null);
  assert.equal(out.variantStock[0].discount,  null);
});
t('a variant discount falls back to the product price when the variant has none', () => {
  const out = normalizeProductPayload({
    price: 1300, trackVariantStock: true, hasVariantPricing: true,
    variantStock: [{ size: '7', color: 'Black', stock: 5, discountType: 'fixed', discountValue: 130 }],
  });
  assert.equal(+(1300 * (1 - out.variantStock[0].discount / 100)).toFixed(2), 1170);
});
t('a negative variant price is rejected', () => {
  rejects(() => normalizeProductPayload({
    trackVariantStock: true, hasVariantPricing: true,
    variantStock: [{ size: '7', color: 'Black', stock: 1, price: -5 }],
  }), /negative/i);
});
t('hasVariantPricing inherited from the existing doc still strips on update', () => {
  const out = normalizeProductPayload(
    { variantStock: [{ size: '7', color: 'Black', stock: 5, price: 1500 }] },
    { ...EXISTING, hasVariantPricing: false },
  );
  assert.equal(out.variantStock[0].price, null);
});

console.log('\ngstRate safety');

t('gstRate is clamped to 0-100', () => {
  assert.equal(normalizeProductPayload({ gstRate: 150 }).gstRate, 100);
  assert.equal(normalizeProductPayload({ gstRate: -5 }).gstRate, 0);
});
t('an empty-string gstRate becomes null, not 0', () => {
  assert.equal(normalizeProductPayload({ gstRate: '' }).gstRate, null);
});
t('gstRate 0 stays 0 — a genuinely zero-rated product', () => {
  assert.equal(normalizeProductPayload({ gstRate: 0 }).gstRate, 0);
});
t('an absent gstRate is not written at all', () => {
  assert.equal('gstRate' in normalizeProductPayload({ name: 'Pen' }), false);
});

console.log('\nTenant fields are never invented here');

t('shopId and ownerId are left exactly as given', () => {
  const out = normalizeProductPayload({ shopId: 'abc', ownerId: 'def' });
  assert.equal(out.shopId,  'abc');
  assert.equal(out.ownerId, 'def');
});
t('the input object is not mutated', () => {
  const input = { trackVariantStock: true, stock: 999, variantStock: [{ size: '7', color: 'B', stock: 5 }] };
  normalizeProductPayload(input);
  assert.equal(input.stock, 999);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
