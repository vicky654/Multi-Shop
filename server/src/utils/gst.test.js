/**
 * GST engine tests — plain Node, no test framework needed.
 *   node src/utils/gst.test.js
 *
 * The engine is pure, so every case here is deterministic and reproducible.
 */
const assert = require('node:assert');
const { computeInvoice, isValidGstin, stateCodeOf, stateNameOf } = require('./gst');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
  catch (e) { fail += 1; console.error(`  ✗ ${name}\n      ${e.message}`); }
};

console.log('\nGSTIN validation');

// Real-format GSTINs with valid check digits
t('accepts a valid GSTIN', () => {
  assert.equal(isValidGstin('27AAPFU0939F1ZV'), true);
});
t('accepts lowercase + whitespace', () => {
  assert.equal(isValidGstin('  27aapfu0939f1zv '), true);
});
t('rejects a wrong check digit', () => {
  // Same GSTIN with the last character changed — format is fine, checksum is not
  assert.equal(isValidGstin('27AAPFU0939F1ZA'), false);
});
t('rejects wrong length', () => {
  assert.equal(isValidGstin('27AAPFU0939F1Z'), false);
});
t('rejects a malformed pattern', () => {
  assert.equal(isValidGstin('AA27PFU0939F1ZV'), false);
});
t('rejects empty / non-string', () => {
  assert.equal(isValidGstin(''), false);
  assert.equal(isValidGstin(null), false);
  assert.equal(isValidGstin(12345), false);
});
t('extracts the state code', () => {
  assert.equal(stateCodeOf('27AAPFU0939F1ZV'), '27');
  assert.equal(stateNameOf('27'), 'Maharashtra');
  assert.equal(stateCodeOf('not-a-gstin'), null);
});

console.log('\nIntra-state: CGST + SGST');

t('splits 18% into 9% CGST + 9% SGST', () => {
  const r = computeInvoice({
    lines: [{ price: 1000, quantity: 1, taxRate: 18 }],
    sellerStateCode: '27', placeOfSupplyCode: '27',
  });
  assert.equal(r.interState, false);
  assert.equal(r.taxableAmount, 1000);
  assert.equal(r.cgstAmount, 90);
  assert.equal(r.sgstAmount, 90);
  assert.equal(r.igstAmount, 0);
  assert.equal(r.grandTotal, 1180);
});

t('cgst + sgst always equals total tax (odd paisa case)', () => {
  // 5% of 100.05 = 5.0025 → 5.00; halves must still sum exactly
  const r = computeInvoice({
    lines: [{ price: 100.05, quantity: 1, taxRate: 5 }],
    sellerStateCode: '27', placeOfSupplyCode: '27',
  });
  assert.equal(+(r.cgstAmount + r.sgstAmount).toFixed(2), r.totalTax);
});

console.log('\nInter-state: IGST');

t('charges IGST when place of supply differs', () => {
  const r = computeInvoice({
    lines: [{ price: 1000, quantity: 1, taxRate: 18 }],
    sellerStateCode: '27', placeOfSupplyCode: '29',
  });
  assert.equal(r.interState, true);
  assert.equal(r.igstAmount, 180);
  assert.equal(r.cgstAmount, 0);
  assert.equal(r.sgstAmount, 0);
  assert.equal(r.grandTotal, 1180);
});

console.log('\nInclusive vs exclusive pricing');

t('exclusive adds tax on top', () => {
  const r = computeInvoice({
    lines: [{ price: 100, quantity: 1, taxRate: 12 }],
    gstMode: 'exclusive', sellerStateCode: '27', placeOfSupplyCode: '27', roundOff: false,
  });
  assert.equal(r.taxableAmount, 100);
  assert.equal(r.totalTax, 12);
  assert.equal(r.grandTotal, 112);
});

t('inclusive backs tax out of the price', () => {
  const r = computeInvoice({
    lines: [{ price: 112, quantity: 1, taxRate: 12 }],
    gstMode: 'inclusive', sellerStateCode: '27', placeOfSupplyCode: '27', roundOff: false,
  });
  assert.equal(r.taxableAmount, 100);
  assert.equal(r.totalTax, 12);
  // The customer still pays exactly the shelf price
  assert.equal(r.grandTotal, 112);
});

t('inclusive never changes what the customer pays', () => {
  const r = computeInvoice({
    lines: [{ price: 999, quantity: 3, taxRate: 18 }],
    gstMode: 'inclusive', sellerStateCode: '27', placeOfSupplyCode: '27', roundOff: false,
  });
  assert.equal(r.grandTotal, 2997);
  assert.equal(+(r.taxableAmount + r.totalTax).toFixed(2), 2997);
});

t('rejects an invalid gstMode instead of guessing', () => {
  assert.throws(() => computeInvoice({ lines: [], gstMode: 'nonsense' }), /Invalid gstMode/);
});

console.log('\nDiscounts');

t('taxes the post-discount value, not the MRP', () => {
  const r = computeInvoice({
    lines: [{ price: 1000, quantity: 1, discountPct: 10, taxRate: 18 }],
    sellerStateCode: '27', placeOfSupplyCode: '27',
  });
  assert.equal(r.discountAmount, 100);
  assert.equal(r.taxableAmount, 900);
  assert.equal(r.totalTax, 162);      // 18% of 900, not of 1000
  assert.equal(r.grandTotal, 1062);
});

console.log('\nRound-off');

t('rounds to the nearest rupee and records the delta', () => {
  const r = computeInvoice({
    lines: [{ price: 99.49, quantity: 1, taxRate: 18 }],
    sellerStateCode: '27', placeOfSupplyCode: '27',
  });
  assert.equal(Number.isInteger(r.grandTotal), true);
  // taxable + tax + roundOff must reconcile to the grand total exactly
  assert.equal(+(r.taxableAmount + r.totalTax + r.roundOff).toFixed(2), r.grandTotal);
  assert.ok(Math.abs(r.roundOff) <= 0.5);
});

t('roundOff:false leaves the exact figure', () => {
  const r = computeInvoice({
    lines: [{ price: 99.49, quantity: 1, taxRate: 18 }],
    sellerStateCode: '27', placeOfSupplyCode: '27', roundOff: false,
  });
  assert.equal(r.roundOff, 0);
  assert.equal(+(r.taxableAmount + r.totalTax).toFixed(2), r.grandTotal);
});

console.log('\nEdge cases');

t('zero-rated items produce no tax', () => {
  const r = computeInvoice({
    lines: [{ price: 500, quantity: 2, taxRate: 0 }],
    sellerStateCode: '27', placeOfSupplyCode: '27',
  });
  assert.equal(r.totalTax, 0);
  assert.equal(r.grandTotal, 1000);
});

t('empty invoice is zero, not NaN', () => {
  const r = computeInvoice({ lines: [], sellerStateCode: '27' });
  assert.equal(r.grandTotal, 0);
  assert.equal(r.totalTax, 0);
});

t('unconfigured state falls back to intra-state and flags it', () => {
  const r = computeInvoice({ lines: [{ price: 100, quantity: 1, taxRate: 18 }] });
  assert.equal(r.stateKnown, false);
  assert.equal(r.interState, false);   // safe fallback, caller warns
});

t('mixed tax rates aggregate correctly per line', () => {
  const r = computeInvoice({
    lines: [
      { price: 100, quantity: 1, taxRate: 5 },
      { price: 100, quantity: 1, taxRate: 18 },
    ],
    sellerStateCode: '27', placeOfSupplyCode: '27', roundOff: false,
  });
  assert.equal(r.taxableAmount, 200);
  assert.equal(r.totalTax, 23);       // 5 + 18
  assert.equal(r.lines.length, 2);
});

t('fractional quantities are supported', () => {
  const r = computeInvoice({
    lines: [{ price: 200, quantity: 0.5, taxRate: 18 }],
    sellerStateCode: '27', placeOfSupplyCode: '27', roundOff: false,
  });
  assert.equal(r.taxableAmount, 100);
  assert.equal(r.totalTax, 18);
});

t('is deterministic across repeated runs', () => {
  const input = {
    lines: [{ price: 1234.56, quantity: 3, discountPct: 7.5, taxRate: 18 }],
    sellerStateCode: '27', placeOfSupplyCode: '29',
  };
  const a = JSON.stringify(computeInvoice(input));
  const b = JSON.stringify(computeInvoice(input));
  assert.equal(a, b);
});

console.log(`\n${pass} passing, ${fail} failing\n`);
process.exit(fail ? 1 : 0);
