/**
 * Pricing engine tests — plain Node, no test framework needed.
 *   node src/utils/pricing.test.js
 *
 * The engine is pure, so every case here is deterministic and reproducible.
 */
const assert = require('node:assert');
const fs     = require('node:fs');
const path   = require('node:path');
const P = require('./pricing');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
  catch (e) { fail += 1; console.error(`  ✗ ${name}\n      ${e.message}`); }
};

console.log('\nMarkup <-> selling price');

t('markup on cost: 1000 + 30% = 1300', () => {
  assert.equal(P.sellingPriceFromMarkup(1000, 30), 1300);
});
t('markup is derived back from selling price', () => {
  assert.equal(P.markupFromSellingPrice(1000, 1300), 30);
});
t('zero cost yields 0 markup rather than Infinity', () => {
  assert.equal(P.markupFromSellingPrice(0, 500), 0);
});
t('negative inputs clamp to 0', () => {
  assert.equal(P.sellingPriceFromMarkup(-10, 30), 0);
  assert.equal(P.sellingPriceFromMarkup(1000, -5), 1000);
});
t('fractional markup rounds to paise, not rupees', () => {
  // 999 * 1.3333 = 1331.9667 → 1331.97, not 1332
  assert.equal(P.sellingPriceFromMarkup(999, 33.33), 1331.97);
});

console.log('\nDiscount normalisation');

t('percent discount passes through', () => {
  assert.equal(P.normalizeDiscountPercent({ price: 1300, discountType: 'percent', discountValue: 10 }), 10);
});
t('fixed discount converts to an exact percent', () => {
  const pct = P.normalizeDiscountPercent({ price: 1300, discountType: 'fixed', discountValue: 200 });
  // Stored unrounded so price*(1-pct/100) is paisa-exact
  assert.equal(+(1300 * (1 - pct / 100)).toFixed(2), 1100);
});
t('none yields 0', () => {
  assert.equal(P.normalizeDiscountPercent({ price: 1300, discountType: 'none', discountValue: 99 }), 0);
});
t('fixed discount larger than price clamps to 100%', () => {
  assert.equal(P.normalizeDiscountPercent({ price: 100, discountType: 'fixed', discountValue: 500 }), 100);
});
t('fixed discount on zero price yields 0 rather than NaN', () => {
  assert.equal(P.normalizeDiscountPercent({ price: 0, discountType: 'fixed', discountValue: 50 }), 0);
});
t('percent above 100 clamps', () => {
  assert.equal(P.normalizeDiscountPercent({ price: 100, discountType: 'percent', discountValue: 150 }), 100);
});
t('missing discountType is treated as none', () => {
  assert.equal(P.normalizeDiscountPercent({ price: 100 }), 0);
});

console.log('\nFull pricing summary — the spec worked example');

t('cost 1000, +30%, -10% => sells 1300, customer pays 1170, profit 170', () => {
  const r = P.computeProductPricing({
    costPrice: 1000, profitPercent: 30, discountType: 'percent', discountValue: 10,
  });
  assert.equal(r.price,          1300);
  assert.equal(r.discountAmount, 130);
  assert.equal(r.finalPrice,     1170);
  assert.equal(r.profitAmount,   170);
});
t('fixed 200 off 1300 => customer pays exactly 1100, profit 100', () => {
  const r = P.computeProductPricing({
    costPrice: 1000, profitPercent: 30, discountType: 'fixed', discountValue: 200,
  });
  assert.equal(r.finalPrice,   1100);
  assert.equal(r.profitAmount, 100);
});
t('explicit price wins over profitPercent and back-derives markup', () => {
  const r = P.computeProductPricing({ costPrice: 1000, price: 1500 });
  assert.equal(r.price, 1500);
  assert.equal(r.profitPercentOnCost, 50);
});
t('margin on sell differs from markup on cost and both are reported', () => {
  const r = P.computeProductPricing({ costPrice: 1000, price: 1300 });
  assert.equal(r.profitPercentOnCost, 30);
  assert.equal(r.marginPercentOnSell, 23);   // matches Product.profitMargin virtual
});
t('marginPercentOnSell matches the existing profitMargin virtual formula', () => {
  // Virtual: Math.round(((fp - costPrice) / fp) * 100) where fp = price*(1-discount/100)
  const price = 499, cost = 250, discount = 10;
  const fp    = price * (1 - discount / 100);
  const legacy = Math.round(((fp - cost) / fp) * 100);
  const r = P.computeProductPricing({
    costPrice: cost, price, discountType: 'percent', discountValue: discount,
  });
  assert.equal(r.marginPercentOnSell, legacy);
});
t('loss is reported as negative, not clamped', () => {
  const r = P.computeProductPricing({ costPrice: 1000, price: 800 });
  assert.equal(r.profitAmount, -200);
});
t('zero everything does not produce NaN', () => {
  const r = P.computeProductPricing({ costPrice: 0, price: 0 });
  assert.equal(r.finalPrice,          0);
  assert.equal(r.profitAmount,        0);
  assert.equal(r.marginPercentOnSell, 0);
  assert.equal(r.profitPercentOnCost, 0);
});

console.log('\nGST');

t('null gstRate produces no tax', () => {
  const r = P.computeProductPricing({ costPrice: 1000, price: 1300, gstRate: null });
  assert.equal(r.taxAmount,    0);
  assert.equal(r.priceWithTax, 1300);
  assert.equal(r.gstRate,      null);
});
t('an empty-string gstRate is treated as unset, not 0%', () => {
  assert.equal(P.computeProductPricing({ costPrice: 1, price: 2, gstRate: '' }).gstRate, null);
});
t('gstRate 0 is a real zero rate, distinct from unset', () => {
  const r = P.computeProductPricing({ costPrice: 1000, price: 1300, gstRate: 0 });
  assert.equal(r.gstRate,   0);
  assert.equal(r.taxAmount, 0);
});
t('exclusive GST adds on top of the discounted price', () => {
  const r = P.computeProductPricing({
    costPrice: 1000, price: 1300, discountType: 'percent', discountValue: 10, gstRate: 18,
  });
  assert.equal(r.finalPrice,   1170);
  assert.equal(r.taxAmount,    210.6);
  assert.equal(r.priceWithTax, 1380.6);
});
t('inclusive GST backs tax out of the discounted price', () => {
  const r = P.computeProductPricing({
    costPrice: 1000, price: 1180, gstRate: 18, gstMode: 'inclusive',
  });
  assert.equal(r.priceWithTax, 1180);
  assert.equal(r.taxAmount,    180);
});
t('gstRate above 100 clamps', () => {
  assert.equal(P.computeProductPricing({ costPrice: 1, price: 2, gstRate: 150 }).gstRate, 100);
});

console.log('\nClient mirror drift guard');

// The client keeps its own ESM copy so the wizard can calculate live. A comment
// asking future editors to "keep these in sync" is not a guarantee — this test
// is. It loads the client copy, strips ESM syntax, and asserts identical output.
const loadClientMirror = (relPath, names) => {
  const file = path.join(__dirname, '../../../client/src/utils', relPath);
  const src  = fs.readFileSync(file, 'utf8')
    .replace(/^export\s+(const|function|let)\s/gm, '$1 ')
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
  // eslint-disable-next-line no-new-func
  return new Function(`${src}\n;return { ${names.join(', ')} };`)();
};

const VECTORS = [
  { costPrice: 1000, profitPercent: 30, discountType: 'percent', discountValue: 10 },
  { costPrice: 1000, profitPercent: 30, discountType: 'fixed',   discountValue: 200 },
  { costPrice: 250,  price: 499,        discountType: 'none',    discountValue: 0, gstRate: 12 },
  { costPrice: 0,    price: 0 },
  { costPrice: 1000, price: 800,        gstRate: 18, gstMode: 'inclusive' },
  { costPrice: 999,  profitPercent: 33.33, discountType: 'fixed', discountValue: 1, gstRate: 5 },
  { costPrice: 1,    price: 1,          gstRate: 0 },
];

t('client pricing mirror matches server on every vector', () => {
  const C = loadClientMirror('pricing.js', [
    'sellingPriceFromMarkup', 'markupFromSellingPrice',
    'normalizeDiscountPercent', 'computeProductPricing',
  ]);
  for (const v of VECTORS) {
    assert.deepEqual(C.computeProductPricing(v), P.computeProductPricing(v),
      `mirror drift on ${JSON.stringify(v)}`);
  }
  assert.equal(C.sellingPriceFromMarkup(1000, 30), P.sellingPriceFromMarkup(1000, 30));
  assert.equal(C.markupFromSellingPrice(1000, 1300), P.markupFromSellingPrice(1000, 1300));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
