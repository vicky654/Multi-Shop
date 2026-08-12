# Product Wizard with Variant Matrix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a 5-step Add/Edit Product wizard that divides received stock across a color × size matrix, with automatic pricing, while keeping existing products, billing and GST byte-identical.

**Architecture:** Extend the existing `trackVariantStock`/`variantStock` model that billing already
supports — do not build a parallel product system. Two new pure modules (`pricing`, `variantMatrix`)
are canonical on the server and mirrored to the client, following the existing `gst.js` mirror
convention plus a drift-guard test. Server-side normalization enforces
`stock === sum(variantStock)`, and the three existing stock-mutation paths that violate it are closed.

**Tech Stack:** Node 18 + Express + Mongoose 8 (CommonJS), React 18 + Vite + Tailwind + TanStack
Query + Zustand, plain-Node unit tests, Cypress 13 e2e.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-12-product-wizard-variant-matrix-design.md`
- **Invariant:** `product.stock === sum(product.variantStock[].stock)` for every variant-tracked product.
- **Never default `gstRate` or any variant pricing field to `0`** — always `null`. A `0` default zeroes tax / prices on every pre-existing product.
- `discount` (percent) stays the canonical field billing reads. `discountType`/`discountValue` exist only for round-trip editing.
- Fixed discounts store the **full-precision unrounded** equivalent percent, so `price × (1 − pct/100)` is paisa-exact.
- Profit % means **markup on cost** (`1000 + 30% = 1300`). Also display margin-on-sell, which is what the existing `profitMargin` virtual shows.
- No TypeScript in this repo. "Typecheck" = `cd client && npm run build`.
- No test runner. Unit tests are plain Node scripts using the `t()` harness from `server/src/utils/gst.test.js`.
- Additive only. Do not remove existing functionality. Existing simple products must behave exactly as before.
- Cell key format is `${color}||${size}` with `''` for an absent axis — must match `sale.service.js` lookup.
- Tenant isolation: all product routes already go through `shopAccess`. Do not bypass it.
- Commit after every task.

---

### Task 1: Pricing engine

**Files:**
- Create: `server/src/utils/pricing.js`
- Create: `client/src/utils/pricing.js`
- Create: `server/src/utils/pricing.test.js`
- Modify: `server/package.json` (add `test` script)

**Interfaces:**
- Produces: `sellingPriceFromMarkup(costPrice, profitPercent) -> number`,
  `markupFromSellingPrice(costPrice, price) -> number`,
  `normalizeDiscountPercent({ price, discountType, discountValue }) -> number`,
  `computeProductPricing({ costPrice, price, profitPercent, discountType, discountValue, gstRate, gstMode }) -> { costPrice, price, discountPercent, discountAmount, finalPrice, profitAmount, profitPercentOnCost, marginPercentOnSell, gstRate, taxAmount, priceWithTax }`

- [ ] **Step 1: Write the failing test**

Create `server/src/utils/pricing.test.js`. Mirror the harness style of `gst.test.js` exactly.

```js
/**
 * Pricing engine tests — plain Node, no test framework needed.
 *   node src/utils/pricing.test.js
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
  assert.equal(r.marginPercentOnSell, 23);   // (1300-1000)/1300 rounded, matches profitMargin virtual
});
t('loss is reported as negative, not clamped', () => {
  const r = P.computeProductPricing({ costPrice: 1000, price: 800 });
  assert.equal(r.profitAmount, -200);
});

console.log('\nGST');

t('null gstRate produces no tax', () => {
  const r = P.computeProductPricing({ costPrice: 1000, price: 1300, gstRate: null });
  assert.equal(r.taxAmount,    0);
  assert.equal(r.priceWithTax, 1300);
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
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node src/utils/pricing.test.js`
Expected: FAIL — `Cannot find module './pricing'`

- [ ] **Step 3: Write the server implementation**

Create `server/src/utils/pricing.js`. Use integer-paise arithmetic, matching `gst.js`.

```js
/**
 * Product pricing engine — deterministic, pure, no DB and no clock.
 *
 * WHY THIS EXISTS
 *   The product wizard must show cost → profit → selling price → discount →
 *   customer price → profit instantly as the user types, and the server must
 *   store exactly what the user was shown. Duplicating that arithmetic in two
 *   places by hand is how the two drift apart, so it lives here once and the
 *   client keeps a mirror that pricing.test.js verifies byte-for-byte.
 *
 * DESIGN RULES
 *   1. Arithmetic in INTEGER PAISE — floating-point rupees drift.
 *   2. "Profit %" is MARKUP ON COST (1000 + 30% = 1300), which is how a shop
 *      owner thinks. `marginPercentOnSell` is also reported because that is what
 *      the existing Product.profitMargin virtual and the Inventory table show;
 *      surfacing only one would make the two screens look contradictory.
 *   3. A FIXED (rupee) discount is converted to its equivalent percent and NOT
 *      rounded. Billing applies `price * (1 - discount/100)`, so an unrounded
 *      percent reproduces the exact rupee figure; rounding to 2dp would drift by
 *      a few paise on every line.
 *   4. `gstRate == null` means "no product-level rate" and yields zero tax —
 *      never treat a missing rate as 0% that overrides an invoice-level rate.
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
    if (p === 0) return 0;                  // avoid NaN/Infinity
    return clamp((value / p) * 100, 0, 100);
  }
  return 0;                                 // 'none' or unknown
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

  // Tax sits on the discounted price. A null rate means "not set" → no tax.
  const rate = gstRate === null || gstRate === undefined || gstRate === ''
    ? null
    : clamp(Number(gstRate) || 0, 0, 100);

  let taxP = 0, withTaxP = finalP;
  if (rate !== null && rate > 0) {
    if (gstMode === 'inclusive') {
      const taxableP = Math.round((finalP * 10000) / (10000 + rate * 100));
      taxP     = finalP - taxableP;
      withTaxP = finalP;                    // already contains the tax
    } else {
      taxP     = Math.round((finalP * rate) / 100);
      withTaxP = finalP + taxP;
    }
  }

  const profitP = finalP - costP;

  return {
    costPrice:  toRupees(costP),
    price:      toRupees(listP),
    discountPercent,
    discountAmount: toRupees(listP - finalP),
    finalPrice: toRupees(finalP),
    profitAmount: toRupees(profitP),
    profitPercentOnCost: markupFromSellingPrice(cost, toRupees(finalP)),
    // Matches Product.profitMargin: margin as a share of the selling price.
    marginPercentOnSell: finalP > 0 ? Math.round((profitP / finalP) * 100) : 0,
    gstRate: rate,
    taxAmount:    toRupees(taxP),
    priceWithTax: toRupees(withTaxP),
  };
}

module.exports = {
  sellingPriceFromMarkup,
  markupFromSellingPrice,
  normalizeDiscountPercent,
  computeProductPricing,
};
```

- [ ] **Step 4: Write the client mirror**

Create `client/src/utils/pricing.js` — identical function bodies, ESM exports, with a header
pointing at the drift guard. The bodies must match character-for-character inside the functions so
the guard passes.

```js
/**
 * Pricing engine — mirror of server/src/utils/pricing.js.
 *
 * The wizard needs these calculations live in the browser; the server is the
 * authority and re-derives everything before persisting. Do not edit one copy
 * alone: server/src/utils/pricing.test.js loads this file and asserts identical
 * output on a table of vectors, so drift fails the build.
 */
const toPaise  = (rupees) => Math.round((Number(rupees) || 0) * 100);
const toRupees = (paise)  => +(paise / 100).toFixed(2);
const clamp    = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const nonNeg   = (n) => Math.max(0, Number(n) || 0);

export function sellingPriceFromMarkup(costPrice, profitPercent) { /* same body as server */ }
export function markupFromSellingPrice(costPrice, price) { /* same body as server */ }
export function normalizeDiscountPercent({ price, discountType, discountValue } = {}) { /* same */ }
export function computeProductPricing({ /* same signature */ } = {}) { /* same body */ }
```

Copy the real bodies from the server file — the placeholder comments above mark where they go, they
are not what to write.

- [ ] **Step 5: Add the test script**

Modify `server/package.json` scripts:

```json
"test": "node src/utils/gst.test.js && node src/utils/pricing.test.js && node src/modules/sales/invoiceCounter.test.js"
```

Later tasks append their test files to this chain.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd server && npm test`
Expected: PASS — all suites, `0 failed`

- [ ] **Step 7: Commit**

```bash
git add server/src/utils/pricing.js server/src/utils/pricing.test.js client/src/utils/pricing.js server/package.json
git commit -m "feat: pricing engine with client mirror drift guard"
```

---

### Task 2: Variant matrix engine

**Files:**
- Create: `server/src/utils/variantMatrix.js`
- Create: `client/src/utils/variantMatrix.js`
- Create: `server/src/utils/variantMatrix.test.js`
- Modify: `server/package.json` (append to `test`)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `cellKey(color, size) -> string`, `buildMatrix({ colors, sizes, existing }) -> { rows, cols, cells }`,
  `matrixTotals(matrix) -> { rowTotals, colTotals, grandTotal }`,
  `toVariantStock(matrix) -> [{ size, color, stock, ...pricing }]`,
  `fromVariantStock(variantStock) -> { rows, cols, cells }`,
  `fillAll(matrix, qty)`, `distributeEvenly(matrix, total)`, `copyRow(matrix, fromRow, toRows)`,
  `clearAll(matrix)` — all return a new matrix, never mutate.
  `findDuplicateCombos(variantStock) -> string[]`

- [ ] **Step 1: Write the failing test**

Create `server/src/utils/variantMatrix.test.js` with the same `t()` harness. Cover every shape.

```js
const assert = require('node:assert');
const fs     = require('node:fs');
const path   = require('node:path');
const M = require('./variantMatrix');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
  catch (e) { fail += 1; console.error(`  ✗ ${name}\n      ${e.message}`); }
};

const SIZES  = ['7', '8', '9', '10', '11'];
const COLORS = ['Black', 'Brown', 'White'];

console.log('\nMatrix shapes');

t('color + size builds a cell per pair', () => {
  const m = M.buildMatrix({ colors: COLORS, sizes: SIZES });
  assert.equal(Object.keys(m.cells).length, 15);
  assert.equal(m.cells[M.cellKey('Black', '7')].stock, 0);
});
t('size only uses a single row keyed by empty color', () => {
  const m = M.buildMatrix({ colors: [], sizes: SIZES });
  assert.deepEqual(m.rows, ['']);
  assert.equal(Object.keys(m.cells).length, 5);
  assert.ok(M.cellKey('', '9') in m.cells);
});
t('color only uses a single column keyed by empty size', () => {
  const m = M.buildMatrix({ colors: COLORS, sizes: [] });
  assert.deepEqual(m.cols, ['']);
  assert.equal(Object.keys(m.cells).length, 3);
  assert.ok(M.cellKey('Brown', '') in m.cells);
});
t('no axes builds an empty matrix', () => {
  const m = M.buildMatrix({ colors: [], sizes: [] });
  assert.deepEqual(m.cells, {});
});

console.log('\nAxis edits preserve surviving cells');

t('adding a size keeps existing quantities', () => {
  let m = M.buildMatrix({ colors: ['Black'], sizes: ['7'] });
  m.cells[M.cellKey('Black', '7')].stock = 10;
  m = M.buildMatrix({ colors: ['Black'], sizes: ['7', '8'], existing: m.cells });
  assert.equal(m.cells[M.cellKey('Black', '7')].stock, 10);
  assert.equal(m.cells[M.cellKey('Black', '8')].stock, 0);
});
t('removing a color drops only its cells', () => {
  let m = M.buildMatrix({ colors: ['Black', 'Brown'], sizes: ['7'] });
  m.cells[M.cellKey('Black', '7')].stock = 5;
  m.cells[M.cellKey('Brown', '7')].stock = 8;
  m = M.buildMatrix({ colors: ['Black'], sizes: ['7'], existing: m.cells });
  assert.equal(Object.keys(m.cells).length, 1);
  assert.equal(m.cells[M.cellKey('Black', '7')].stock, 5);
});
t('per-variant pricing survives an axis edit', () => {
  let m = M.buildMatrix({ colors: ['Black'], sizes: ['7'] });
  m.cells[M.cellKey('Black', '7')].price = 1500;
  m = M.buildMatrix({ colors: ['Black'], sizes: ['7', '8'], existing: m.cells });
  assert.equal(m.cells[M.cellKey('Black', '7')].price, 1500);
  assert.equal(m.cells[M.cellKey('Black', '8')].price, null);
});

console.log('\nTotals — the spec example matrix');

t('row, column and grand totals match the spec table', () => {
  const m = M.buildMatrix({ colors: COLORS, sizes: SIZES });
  const set = (c, s, q) => { m.cells[M.cellKey(c, s)].stock = q; };
  [5, 10, 10, 10, 5].forEach((q, i) => set('Black', SIZES[i], q));
  [5, 5, 10, 10, 5].forEach((q, i) => set('Brown', SIZES[i], q));
  [5, 5, 5, 5, 5].forEach((q, i)  => set('White', SIZES[i], q));

  const tot = M.matrixTotals(m);
  assert.equal(tot.rowTotals.Black, 40);
  assert.equal(tot.rowTotals.Brown, 35);
  assert.equal(tot.rowTotals.White, 25);
  assert.deepEqual(SIZES.map((s) => tot.colTotals[s]), [15, 20, 25, 25, 15]);
  assert.equal(tot.grandTotal, 100);
});

console.log('\nBulk operations');

t('fillAll sets every cell', () => {
  const m = M.fillAll(M.buildMatrix({ colors: COLORS, sizes: SIZES }), 4);
  assert.equal(M.matrixTotals(m).grandTotal, 60);
});
t('distributeEvenly spreads a total and gives the remainder to the first cells', () => {
  const m = M.distributeEvenly(M.buildMatrix({ colors: ['Black'], sizes: ['7', '8', '9'] }), 100);
  assert.equal(M.matrixTotals(m).grandTotal, 100);   // 34 + 33 + 33
  assert.equal(m.cells[M.cellKey('Black', '7')].stock, 34);
  assert.equal(m.cells[M.cellKey('Black', '9')].stock, 33);
});
t('copyRow copies quantities to the named rows only', () => {
  let m = M.buildMatrix({ colors: COLORS, sizes: ['7', '8'] });
  m.cells[M.cellKey('Black', '7')].stock = 3;
  m.cells[M.cellKey('Black', '8')].stock = 4;
  m = M.copyRow(m, 'Black', ['Brown']);
  assert.equal(m.cells[M.cellKey('Brown', '8')].stock, 4);
  assert.equal(m.cells[M.cellKey('White', '8')].stock, 0);
});
t('clearAll zeroes quantities but keeps the axes', () => {
  const m = M.clearAll(M.fillAll(M.buildMatrix({ colors: COLORS, sizes: SIZES }), 9));
  assert.equal(M.matrixTotals(m).grandTotal, 0);
  assert.equal(Object.keys(m.cells).length, 15);
});
t('bulk operations do not mutate the input matrix', () => {
  const before = M.buildMatrix({ colors: ['Black'], sizes: ['7'] });
  M.fillAll(before, 7);
  assert.equal(before.cells[M.cellKey('Black', '7')].stock, 0);
});

console.log('\nRound-trip through the API shape');

t('toVariantStock emits the flat shape sale.service looks up', () => {
  const m = M.fillAll(M.buildMatrix({ colors: ['Black'], sizes: ['9'] }), 6);
  const vs = M.toVariantStock(m);
  assert.deepEqual(vs, [{ size: '9', color: 'Black', stock: 6 }]);
});
t('toVariantStock includes per-variant pricing only when set', () => {
  const m = M.buildMatrix({ colors: ['Black'], sizes: ['9'] });
  m.cells[M.cellKey('Black', '9')].stock = 2;
  m.cells[M.cellKey('Black', '9')].price = 1500;
  assert.deepEqual(M.toVariantStock(m), [{ size: '9', color: 'Black', stock: 2, price: 1500 }]);
});
t('fromVariantStock rebuilds axes and cells', () => {
  const m = M.fromVariantStock([
    { size: '7', color: 'Black', stock: 5 },
    { size: '8', color: 'Brown', stock: 3 },
  ]);
  assert.deepEqual(m.rows, ['Black', 'Brown']);
  assert.deepEqual(m.cols, ['7', '8']);
  assert.equal(m.cells[M.cellKey('Black', '7')].stock, 5);
});
t('fromVariantStock handles a size-only product', () => {
  const m = M.fromVariantStock([{ size: 'M', color: '', stock: 4 }]);
  assert.deepEqual(m.rows, ['']);
  assert.deepEqual(m.cols, ['M']);
});
t('round trip is lossless', () => {
  const vs = [{ size: '7', color: 'Black', stock: 5 }, { size: '8', color: 'Black', stock: 6 }];
  assert.deepEqual(M.toVariantStock(M.fromVariantStock(vs)), vs);
});

console.log('\nValidation helpers');

t('findDuplicateCombos flags a repeated size/color pair', () => {
  const dupes = M.findDuplicateCombos([
    { size: '7', color: 'Black', stock: 1 },
    { size: '7', color: 'Black', stock: 2 },
  ]);
  assert.deepEqual(dupes, ['Black / 7']);
});
t('findDuplicateCombos returns empty for a clean list', () => {
  assert.deepEqual(M.findDuplicateCombos([{ size: '7', color: 'Black', stock: 1 }]), []);
});

console.log('\nClient mirror drift guard');

const loadClientMirror = (relPath, names) => {
  const file = path.join(__dirname, '../../../client/src/utils', relPath);
  const src  = fs.readFileSync(file, 'utf8')
    .replace(/^export\s+(const|function|let)\s/gm, '$1 ')
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
  // eslint-disable-next-line no-new-func
  return new Function(`${src}\n;return { ${names.join(', ')} };`)();
};

t('client matrix mirror matches server', () => {
  const C = loadClientMirror('variantMatrix.js', [
    'cellKey', 'buildMatrix', 'matrixTotals', 'toVariantStock', 'fromVariantStock',
    'fillAll', 'distributeEvenly', 'copyRow', 'clearAll', 'findDuplicateCombos',
  ]);
  const args = { colors: COLORS, sizes: SIZES };
  assert.deepEqual(C.matrixTotals(C.fillAll(C.buildMatrix(args), 4)),
                   M.matrixTotals(M.fillAll(M.buildMatrix(args), 4)));
  assert.deepEqual(C.distributeEvenly(C.buildMatrix(args), 100).cells,
                   M.distributeEvenly(M.buildMatrix(args), 100).cells);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node src/utils/variantMatrix.test.js`
Expected: FAIL — `Cannot find module './variantMatrix'`

- [ ] **Step 3: Write the implementation**

Create `server/src/utils/variantMatrix.js`. Key design points to honour:

- `cellKey(color, size)` returns `` `${color}||${size}` ``. `''` marks an absent axis, matching
  `sale.service.js`'s `v.size === size && v.color === color` lookup where the cart defaults both to `''`.
- `buildMatrix` normalises `rows = colors.length ? colors : ['']` and `cols = sizes.length ? sizes : ['']`,
  but returns `cells: {}` when **both** axes are empty.
- A cell is `{ color, size, stock: 0, costPrice: null, price: null, discountType: null, discountValue: null, discount: null }`.
  Pricing fields default `null` (inherit), never `0`.
- `existing` is a cells map; surviving keys keep their whole cell object.
- `distributeEvenly` uses `Math.floor(total / n)` and hands the remainder to the first cells one at a
  time, so the grand total is exactly `total`.
- All bulk operations deep-copy cells and return a new matrix — never mutate the argument.
- `toVariantStock` emits `{ size, color, stock }` and **omits null pricing keys entirely** so Mongoose
  stores nothing rather than nulls, keeping documents identical to today for uniform-priced products.
- `fromVariantStock` derives `rows` from distinct colors in first-seen order and `cols` from distinct
  sizes, collapsing to `['']` when that axis is entirely empty.

- [ ] **Step 4: Write the client mirror**

Create `client/src/utils/variantMatrix.js` with the same header convention as the pricing mirror and
identical bodies, ESM exports.

- [ ] **Step 5: Append to the test script**

Modify `server/package.json`: add `&& node src/utils/variantMatrix.test.js` to `test`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd server && npm test`
Expected: PASS, `0 failed`

- [ ] **Step 7: Commit**

```bash
git add server/src/utils/variantMatrix.js server/src/utils/variantMatrix.test.js client/src/utils/variantMatrix.js server/package.json
git commit -m "feat: variant matrix engine with client mirror drift guard"
```

---

### Task 3: Extend the product schema

**Files:**
- Modify: `server/src/modules/products/product.model.js:3-60`

**Interfaces:**
- Produces: new Product fields `brand`, `profitPercent`, `discountType`, `discountValue`, `gstRate`,
  `hasVariantPricing`; `variantStock[]` entries gain `costPrice`, `price`, `discount`, `discountType`, `discountValue`.

- [ ] **Step 1: Extend `variantStockSchema`**

Add to the existing schema at `product.model.js:9-16`, keeping `{ _id: false }`:

```js
    // ── Optional per-variant pricing ───────────────────────────────────────────
    // null means "inherit the product-level value". NEVER default these to 0:
    // a 0 price would sell the variant for free and a 0 costPrice would report
    // fake profit. sale.service.js reads them with `variant?.price ?? product.price`.
    costPrice:     { type: Number, default: null, min: 0 },
    price:         { type: Number, default: null, min: 0 },
    discount:      { type: Number, default: null, min: 0, max: 100 },  // canonical %
    discountType:  { type: String, enum: ['none', 'percent', 'fixed', null], default: null },
    discountValue: { type: Number, default: null, min: 0 },
```

- [ ] **Step 2: Extend `productSchema`**

Add alongside the existing ERP phase fields (after `maxStock`, before `shopId`):

```js
    brand:         { type: String, trim: true, default: '' },
    // Markup on cost the user asked for, retained so the wizard reopens showing
    // "30%" instead of re-deriving it. `price` remains authoritative.
    profitPercent: { type: Number, default: null, min: 0 },
    // `discount` above stays the canonical percent billing reads. These two only
    // exist so a rupee discount reopens as "₹200 off" rather than "15.384%".
    discountType:  { type: String, enum: ['none', 'percent', 'fixed'], default: 'none' },
    discountValue: { type: Number, default: 0, min: 0 },
    // null = no product-level rate; billing falls back to the invoice taxRate.
    // Defaulting this to 0 would zero the tax on every pre-existing product.
    gstRate:       { type: Number, default: null, min: 0, max: 100 },
    hasVariantPricing: { type: Boolean, default: false },
```

- [ ] **Step 3: Add a brand index and extend text search**

Modify the text index at `product.model.js:99` to include `brand`, and add:

```js
productSchema.index({ shopId: 1, brand: 1 });
```

- [ ] **Step 4: Verify the server still boots and existing tests pass**

Run: `cd server && npm test && node -e "require('./src/modules/products/product.model.js'); console.log('model OK')"`
Expected: PASS, then `model OK`

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/products/product.model.js
git commit -m "feat: add brand, pricing and gstRate fields to Product"
```

---

### Task 4: Server-side normalization

**Files:**
- Create: `server/src/modules/products/product.normalize.js`
- Create: `server/src/modules/products/product.normalize.test.js`
- Modify: `server/src/modules/products/product.service.js:79-95` (`createProduct`, `updateProduct`)
- Modify: `server/package.json` (append to `test`)

**Interfaces:**
- Consumes: `pricing.normalizeDiscountPercent`, `variantMatrix.findDuplicateCombos`.
- Produces: `normalizeProductPayload(data, existing = null) -> normalizedData` (throws `{status:400}` on invalid input).

- [ ] **Step 1: Write the failing test**

Create `server/src/modules/products/product.normalize.test.js`, same `t()` harness plus a `throws` helper:

```js
const assert = require('node:assert');
const { normalizeProductPayload } = require('./product.normalize');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
  catch (e) { fail += 1; console.error(`  ✗ ${name}\n      ${e.message}`); }
};
const rejects = (fn, re) => assert.throws(fn, (e) => e.status === 400 && re.test(e.message));

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
t('a size-only matrix still drives stock', () => {
  const out = normalizeProductPayload({
    trackVariantStock: true,
    variantStock: [{ size: 'M', color: '', stock: 7 }],
  });
  assert.equal(out.stock, 7);
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
  assert.equal(out.trackVariantStock, undefined);
  assert.equal(out.variantStock, undefined);
});

console.log('\nVariant validation');

t('rejects a negative variant quantity', () => {
  rejects(() => normalizeProductPayload({
    trackVariantStock: true, variantStock: [{ size: '7', color: 'Black', stock: -1 }],
  }), /negative/i);
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
t('rejects variant tracking with an empty matrix', () => {
  rejects(() => normalizeProductPayload({ trackVariantStock: true, variantStock: [] }),
    /at least one variant/i);
});
t('coerces variant quantities to integers', () => {
  const out = normalizeProductPayload({
    trackVariantStock: true, variantStock: [{ size: '7', color: 'Black', stock: '5' }],
  });
  assert.equal(out.variantStock[0].stock, 5);
  assert.equal(out.stock, 5);
});

console.log('\nPartial updates must not destroy a matrix');

const EXISTING = {
  trackVariantStock: true,
  stock: 15,
  variantStock: [
    { size: '7', color: 'Black', stock: 5 },
    { size: '8', color: 'Black', stock: 10 },
  ],
};

t('a price-only PUT leaves variantStock and stock alone', () => {
  const out = normalizeProductPayload({ price: 1500 }, EXISTING);
  assert.equal(out.variantStock, undefined);   // not written, so Object.assign cannot clear it
  assert.equal(out.stock, undefined);
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
  assert.equal(out.discountType, undefined);
});
t('profitPercent derives price when price is absent', () => {
  const out = normalizeProductPayload({ costPrice: 1000, profitPercent: 30 });
  assert.equal(out.price, 1300);
});
t('an explicit price back-derives profitPercent', () => {
  const out = normalizeProductPayload({ costPrice: 1000, price: 1300 });
  assert.equal(Math.round(out.profitPercent), 30);
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
t('an absent gstRate is not written at all', () => {
  assert.equal('gstRate' in normalizeProductPayload({ name: 'Pen' }), false);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node src/modules/products/product.normalize.test.js`
Expected: FAIL — `Cannot find module './product.normalize'`

- [ ] **Step 3: Write the implementation**

Create `server/src/modules/products/product.normalize.js`. Rules, in order:

1. Shallow-copy `data`. Every decision is gated on `Object.prototype.hasOwnProperty.call(data, key)`
   so a partial PUT never writes a field the caller did not send — that is what stops a `{price}`-only
   update from clearing a matrix via `Object.assign`.
2. Resolve effective variant tracking: `data.trackVariantStock ?? existing?.trackVariantStock ?? false`.
3. If the payload includes `variantStock`:
   - Coerce each `stock` with `Number.parseInt`; throw 400 `"Variant quantities cannot be negative"` on `< 0` or `NaN`.
   - `findDuplicateCombos` → throw 400 `` `Duplicate variant combinations: ${dupes.join(', ')}` ``.
   - When tracking is on and the array is empty → throw 400 `"A variant product needs at least one variant"`.
   - Set `out.stock = sum`.
4. If tracking is on and the payload sends `stock` **without** `variantStock` → throw 400
   `"Cannot set stock directly on a variant product — update the variant matrix, or adjust a specific size/color"`.
   This is the guard that keeps root stock from drifting.
5. If tracking is explicitly `false` in the payload → `out.variantStock = []` and leave `stock` as sent.
6. Variant pricing: when effective `hasVariantPricing` is false, null every pricing field on each
   variant. When true, run each variant's `discountType`/`discountValue` through
   `normalizeDiscountPercent` against that variant's effective price (`variant.price ?? product price`),
   writing `discount`. Leave untouched fields `null`.
7. Product pricing: if `discountType` is present, write `out.discount = normalizeDiscountPercent(...)`
   against the effective price. If `discountType` is absent, do not touch `discount` — legacy payloads
   keep working.
8. If `profitPercent` is present and `price` is not, `out.price = sellingPriceFromMarkup(...)`.
   If `price` is present, `out.profitPercent = markupFromSellingPrice(cost, price)` using
   `data.costPrice ?? existing?.costPrice ?? 0`.
9. `gstRate`: `''`/`null`/`undefined` → `null`; otherwise clamp 0–100.
10. Never allow `shopId`/`ownerId` to be re-derived here — tenant checks stay in the service.

- [ ] **Step 4: Wire into the service**

Modify `server/src/modules/products/product.service.js`:

```js
const { normalizeProductPayload } = require('./product.normalize');
```

In `createProduct` (line ~79), after the shop-access check:

```js
  const clean = normalizeProductPayload(data);
  return Product.create({ ...clean, ownerId: user.role === 'super_admin' ? data.ownerId : user._id });
```

In `updateProduct` (line ~86), after the access check, replacing `Object.assign(product, data)`:

```js
  // Pass the existing doc so a partial update cannot silently break the
  // stock === sum(variantStock) invariant.
  Object.assign(product, normalizeProductPayload(data, product.toObject()));
```

- [ ] **Step 5: Append to the test script and run**

Modify `server/package.json`: add `&& node src/modules/products/product.normalize.test.js`.

Run: `cd server && npm test`
Expected: PASS, `0 failed` in all four suites

- [ ] **Step 6: Commit**

```bash
git add server/src/modules/products/product.normalize.js server/src/modules/products/product.normalize.test.js server/src/modules/products/product.service.js server/package.json
git commit -m "feat: normalize product payloads and enforce variant stock invariant"
```

---

### Task 5: Close the three stock-mutation landmines

**Files:**
- Modify: `server/src/modules/products/product.service.js:306-326` (`adjustStock`)
- Modify: `server/src/modules/products/product.service.js:330-381` (`bulkAuditAdjust`)
- Modify: `server/src/modules/insights/insights.service.js:216-231` (`bulkRestockProducts`)
- Modify: `server/src/modules/products/product.controller.js:154-160` (pass `size`/`color`)
- Modify: `client/src/api/products.api.js:44-46` (pass `size`/`color`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `adjustStock(id, user, { delta, reason, notes, size, color })`;
  `bulkAuditAdjust` result gains `skipped: [{ productId, name, reason }]`;
  `bulkRestockProducts` result gains `skipped: number`.

- [ ] **Step 1: Make `adjustStock` variant-aware**

In `product.service.js`, after the existing access check and before `const newStock = ...`:

```js
  // A variant product's root stock is the sum of its cells. Moving root alone
  // would break the invariant buildStockMovementOps relies on, so a variant
  // must be named — and then both move together, exactly as a sale does.
  if (product.trackVariantStock) {
    const size  = variantSize  || '';
    const color = variantColor || '';
    if (!size && !color) {
      const available = (product.variantStock || [])
        .map((v) => [v.color, v.size].filter(Boolean).join('/'))
        .join(', ');
      throw Object.assign(
        new Error(`"${product.name}" tracks stock per variant — specify size/color. Available: ${available}`),
        { status: 400 }
      );
    }
    const cell = (product.variantStock || []).find((v) => v.size === size && v.color === color);
    if (!cell)
      throw Object.assign(new Error(`Variant (${size}/${color}) not found for "${product.name}"`), { status: 400 });
    if (cell.stock + qty < 0)
      throw Object.assign(
        new Error(`Cannot reduce ${size}/${color} below 0 (current: ${cell.stock}, delta: ${qty})`),
        { status: 400 }
      );
    cell.stock += qty;
    product.stock += qty;          // lockstep — never one without the other
    await product.save();
    return {
      product, previousStock: product.stock - qty, newStock: product.stock,
      delta: qty, reason, variant: { size, color, newStock: cell.stock },
    };
  }
```

Destructure `size: variantSize, color: variantColor` from the options argument.

- [ ] **Step 2: Make `bulkAuditAdjust` skip variant products**

Add `trackVariantStock` to the `.find(...).lean()` projection (it currently selects everything, so no
change needed there), then inside the item loop, before computing `delta`:

```js
    // A physical count for the whole product cannot be split across cells, and
    // writing it to root alone would desync the matrix. Report, never guess.
    if (product.trackVariantStock) {
      skipped.push({
        productId: product._id, name: product.name,
        reason: 'Tracks stock per variant — audit each size/color from the product editor',
      });
      continue;
    }
```

Declare `const skipped = [];` next to `results`, and return `{ adjusted: results.length, items: results, skipped }`.

- [ ] **Step 3: Make `bulkRestockProducts` skip variant products**

In `insights.service.js`, replace the `ops` construction so variant products are filtered out first:

```js
const bulkRestockProducts = async (shopId, items) => {
  if (!Array.isArray(items) || items.length === 0) return { updated: 0, skipped: 0 };

  const wanted = items.filter((i) => i.productId && Number(i.addQty) > 0);

  // Variant products keep stock in variantStock[]; a root-only $inc would
  // desync them from the matrix, so restock those from the product editor.
  const variantIds = new Set(
    (await Product.find({ _id: { $in: wanted.map((i) => i.productId) }, trackVariantStock: true })
      .select('_id').lean()).map((p) => p._id.toString())
  );

  const ops = wanted
    .filter((i) => !variantIds.has(i.productId.toString()))
    .map((i) => Product.findOneAndUpdate(
      { _id: i.productId, shopId },
      { $inc: { stock: Number(i.addQty) } },
      { new: true }
    ));

  const results = await Promise.all(ops);
  return { updated: results.filter(Boolean).length, skipped: variantIds.size };
};
```

- [ ] **Step 4: Thread `size`/`color` through the controller and API client**

`product.controller.js` `adjustStock`:

```js
  const { delta, reason, notes, size, color } = req.body;
  ...
  const result = await productService.adjustStock(req.params.id, req.user, { delta, reason, notes, size, color });
```

`client/src/api/products.api.js`:

```js
  adjustStock: (id, { delta, reason, notes, size, color }) =>
    api.patch(`/products/${id}/adjust-stock`, { delta, reason, notes, size, color }),
```

- [ ] **Step 5: Verify existing tests and boot**

Run: `cd server && npm test && node -e "require('./src/app.js'); console.log('app OK')"`
Expected: PASS then `app OK`

- [ ] **Step 6: Commit**

```bash
git add server/src/modules/products/product.service.js server/src/modules/products/product.controller.js server/src/modules/insights/insights.service.js client/src/api/products.api.js
git commit -m "fix: keep root stock and variantStock consistent across all mutation paths"
```

---

### Task 6: Billing uses variant pricing and product GST

**Files:**
- Modify: `server/src/modules/sales/sale.service.js:19-105` (`enrichItems`)
- Modify: `server/src/modules/sales/sale.service.js:357-365` (invoice line map)
- Modify: `server/src/modules/sales/sale.service.js:1027` (edit-bill invoice line map)

**Interfaces:**
- Consumes: `variantStock[].price/costPrice/discount`, `product.gstRate` from Task 3.
- Produces: enriched items carry a transient `gstRate` used by `computeInvoice` (dropped by the strict
  sale item schema, exactly like the existing `_trackVariant` flag).

- [ ] **Step 1: Resolve the variant once in `enrichItems`**

The variant lookup already happens inside the stock-check branch. Hoist it above the check so pricing
can reuse it:

```js
    // Resolved once: the stock check and the pricing below both need it.
    const variant = product.trackVariantStock && (size || color)
      ? (product.variantStock || []).find((v) => v.size === size && v.color === color)
      : null;
```

Then the existing check becomes `if (product.trackVariantStock && (size || color)) { if (!variant) throw ... }`.

- [ ] **Step 2: Prefer variant pricing, with nullish fallback**

Replace the pricing block (currently lines ~71-79):

```js
    // Variant pricing overrides the product's, when set. `??` not `||` — a
    // deliberate ₹0 discount must not fall through to the product's discount,
    // and an unset field is null, never 0 (see product.model.js).
    const unitCost  = variant?.costPrice ?? product.costPrice;
    const listPrice = variant?.price     ?? product.price;
    const productDiscount = variant?.discount ?? product.discount ?? 0;

    const discount        = item.discount || 0;
    const effectiveDisc   = Math.max(discount, productDiscount);
    const basePrice       = preservePrice && item.price > 0 ? item.price : listPrice;
    const discountedPrice = basePrice * (1 - effectiveDisc / 100);
    const subtotal        = +(discountedPrice * qty).toFixed(2);
    const profit          = +((discountedPrice - unitCost) * qty).toFixed(2);
```

In the `enrichedItems.push({...})` object, change `price` and `costPrice` to the resolved values and
add the transient rate:

```js
      price:         listPrice,
      costPrice:     unitCost,
      ...
      // Transient: consumed by computeInvoice below, then dropped by the strict
      // saleItem schema — same mechanism as _trackVariant.
      gstRate:       product.gstRate ?? null,
```

Also update `totalDiscount` to use `listPrice` instead of `product.price`.

- [ ] **Step 3: Let the product's GST rate drive its invoice line**

In both `computeInvoice` line maps (create at ~line 358, edit at ~line 1027):

```js
      // A product-level rate wins; null means "not configured" and falls back to
      // the invoice rate. `== null` catches undefined too — `||` would let a
      // legitimate 0% product be overridden by the invoice rate.
      taxRate:     i.gstRate == null ? taxRate : i.gstRate,
```

- [ ] **Step 4: Verify no regression in existing behaviour**

Run: `cd server && npm test`
Expected: PASS. Then confirm by inspection that a product with `gstRate: null` and no variant pricing
produces the identical `enrichedItems` shape as before this task.

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/sales/sale.service.js
git commit -m "feat: bill at variant price and product GST rate when set"
```

---

### Task 7: Extract shared wizard field widgets

**Files:**
- Create: `client/src/components/product-wizard/fields.jsx`
- Reference: `client/src/components/ProductForm.jsx:6-268` (source of the widgets)

**Interfaces:**
- Produces: `inp` (shared input class string), `DEFAULT_SIZES`, `SHOE_SIZES`, `PRESET_COLORS`,
  `SUB_CATS`, `UNITS`, `GST_RATES`, and components `CategoryCombobox`, `SizeSelector`,
  `ColorSelector`, `ImageUploader`, `Field` (label + error wrapper).

- [ ] **Step 1: Move the widgets verbatim**

Copy `CategoryCombobox`, `SizeSelector`, `ColorSelector`, `ImageUploader`, the `inp` string, and the
constants out of `ProductForm.jsx` into `fields.jsx` and export each. Do not change behaviour — these
are already tested by use.

- [ ] **Step 2: Add wizard-specific additions**

```jsx
// Footwear sizes — the wizard's motivating use case is 100 pairs of shoes, and
// typing 6..12 by hand every time is exactly the friction this feature removes.
export const SHOE_SIZES = ['5', '6', '7', '8', '9', '10', '11', '12'];

export const GST_RATES = [0, 5, 12, 18, 28];

/**
 * Field — label + inline error. Inline validation only: the spec rules out
 * error modals, so the message renders under the control that caused it.
 */
export function Field({ label, required, error, hint, children }) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          {label}{required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children}
      {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
             : hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Make `SizeSelector` accept a preset list**

Add an optional `presets = DEFAULT_SIZES` prop so the variants step can offer shoe sizes instead of
clothing sizes. Default keeps existing behaviour.

- [ ] **Step 4: Verify the build**

Run: `cd client && npm run build`
Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
git add client/src/components/product-wizard/fields.jsx
git commit -m "refactor: extract shared product form field widgets"
```

---

### Task 8: Wizard state hook and stepper shell

**Files:**
- Create: `client/src/components/product-wizard/useProductWizard.js`
- Create: `client/src/components/product-wizard/ProductWizard.jsx`

**Interfaces:**
- Consumes: `utils/pricing.js`, `utils/variantMatrix.js`, `fields.jsx`.
- Produces:
  `EMPTY_WIZARD_FORM`, `useProductWizard({ initial, shopId, productId }) -> { form, upd, matrix, setMatrix, totals, pricing, variantPricing, errors, stepErrors, canAdvance, toPayload, clearDraft }`
  and `<ProductWizard form=... onSubmit=... loading shops shopId categories isEdit />`.
  `toPayload()` returns the exact object POSTed/PUT to `/products`.

- [ ] **Step 1: Define the form shape and hydration**

`EMPTY_WIZARD_FORM` extends the old `EMPTY_FORM` with:

```js
  brand: '', hasVariants: false, variantAxis: 'both',   // 'color' | 'size' | 'both'
  totalReceived: '', profitPercent: 30,
  discountType: 'none', discountValue: 0,
  gstRate: '', hasVariantPricing: false,
  trackVariantStock: false, variantStock: [],
```

Hydration for edit/duplicate derives `hasVariants` from `trackVariantStock`, the matrix from
`fromVariantStock(product.variantStock)`, and `variantAxis` from whether the rebuilt matrix's
`rows`/`cols` are `['']`.

- [ ] **Step 2: Derive everything, store nothing derivable**

- `totals = matrixTotals(matrix)` — recomputed on render, never stored.
- `pricing = computeProductPricing({ costPrice, price, profitPercent, discountType, discountValue, gstRate, gstMode })`
  where `gstMode` comes from `activeShop.gstMode || 'exclusive'`.
- Two-way price/profit: `upd('profitPercent', v)` also sets `price = sellingPriceFromMarkup(cost, v)`;
  `upd('price', v)` also sets `profitPercent = markupFromSellingPrice(cost, v)`. Guard against loops by
  only writing the *other* field, never re-entering.
- `variantPricing` maps each cell to its own `computeProductPricing` result, falling back to
  product-level values for null fields — so the review step can total cost and revenue correctly.

- [ ] **Step 3: Validation per step, inline only**

`errors` is a flat `{ fieldName: message }`. `stepErrors` is `{ 1: n, 2: n, ... }` counts for the
stepper badges. `canAdvance(step)` is `stepErrors[step] === 0`.

Rules: step 1 requires `name`, `category`, `shopId`; step 2 (only when `hasVariants`) requires at
least one axis value and `grandTotal > 0`; step 3 requires `costPrice` and `price` numeric and
`>= 0`, and flags `discountValue > price` for a fixed discount.

The received-quantity mismatch is a **warning**, not an error — it must never block `canAdvance`.

- [ ] **Step 4: Autosave the draft**

```js
// Draft survives an accidental modal close or refresh, not just step navigation.
const draftKey = `ms_product_draft_${shopId || 'none'}_${productId || 'new'}`;
```

Write `{ form, matrix }` to `sessionStorage` on change (debounced ~400ms); read it on mount when no
`initial` product is supplied; `clearDraft()` on successful save.

- [ ] **Step 5: Build `toPayload()`**

```js
// The server re-derives stock, discount and profitPercent, but sending the same
// values keeps the request self-describing and the optimistic UI honest.
const toPayload = () => {
  const base = { ...form, brand: form.brand.trim(), gstRate: form.gstRate === '' ? null : Number(form.gstRate) };
  delete base.hasVariants; delete base.variantAxis; delete base.totalReceived;
  if (!form.hasVariants) return { ...base, trackVariantStock: false, variantStock: [], stock: Number(form.stock) || 0 };
  const variantStock = toVariantStock(matrix);
  return { ...base, trackVariantStock: true, variantStock, stock: totals.grandTotal };
};
```

- [ ] **Step 6: Build the stepper shell**

`ProductWizard.jsx` renders: a step rail (numbered, with error-count badges, click to jump back to any
completed step), the active step's component, and a footer.

```jsx
const STEPS = [
  { n: 1, label: 'Basic',    icon: Package },
  { n: 2, label: 'Variants', icon: Grid3x3 },
  { n: 3, label: 'Pricing',  icon: Tag },
  { n: 4, label: 'Details',  icon: FileText },
  { n: 5, label: 'Review',   icon: ClipboardCheck },
];
```

Step 2 is skipped in both directions when `!form.hasVariants` — the Next button on step 1 jumps to 3,
and Back from 3 returns to 1. The toggle itself lives on step 1 so the skip is predictable.

Footer is `sticky bottom-0` with a `border-t` and `safe-bottom` (existing utility): Back on the left,
Next / Save Product on the right, full-width buttons on mobile via `flex-1 sm:flex-none`. Uses
`btn-primary` / `btn-secondary` tokens. Next is disabled when `!canAdvance(step)`, with the blocking
reason rendered above the footer, not in a modal.

- [ ] **Step 7: Verify the build**

Run: `cd client && npm run build`
Expected: build succeeds

- [ ] **Step 8: Commit**

```bash
git add client/src/components/product-wizard/useProductWizard.js client/src/components/product-wizard/ProductWizard.jsx
git commit -m "feat: product wizard state hook and stepper shell"
```

---

### Task 9: Step 1 (Basic) and Step 2 (Variants + Matrix)

**Files:**
- Create: `client/src/components/product-wizard/StepBasic.jsx`
- Create: `client/src/components/product-wizard/StepVariants.jsx`
- Create: `client/src/components/product-wizard/VariantMatrix.jsx`

**Interfaces:**
- Consumes: `fields.jsx`, `useProductWizard` (`form`, `upd`, `matrix`, `setMatrix`, `totals`, `errors`).
- Produces: `<StepBasic .../>`, `<StepVariants .../>`, `<VariantMatrix matrix totals onCellChange onBulk />`.

- [ ] **Step 1: Build `StepBasic`**

Two-column on `sm:` and up, one column below. Fields: name (with the existing Add-by-Photo AI button
preserved verbatim from `ProductForm.jsx:314-325`), brand, category (`CategoryCombobox`),
sub-category, unit, shop, SKU, barcode, images (`ImageUploader`), description.

Ends with the variants toggle, so the step-2 skip is decided here:

```jsx
<label className="flex items-start gap-3 p-3 rounded-xl border border-purple-200 bg-purple-50 cursor-pointer">
  <input type="checkbox" checked={form.hasVariants}
    onChange={(e) => upd('hasVariants', e.target.checked)}
    className="mt-0.5 w-4 h-4 rounded accent-purple-600" />
  <div>
    <span className="text-sm font-semibold text-purple-800">This product has variants</span>
    <p className="text-xs text-purple-600 mt-0.5">
      Split the received quantity across colors and sizes — e.g. 100 pairs across Black/Brown and sizes 7–11.
    </p>
  </div>
</label>
```

- [ ] **Step 2: Build `StepVariants`**

Top: a three-way axis selector (`Color only` / `Size only` / `Color + Size`) as segmented buttons
writing `form.variantAxis`. Changing it rebuilds the matrix through `buildMatrix` with `existing`, so
quantities survive.

Then `ColorSelector` (hidden when axis is `size`) and `SizeSelector` with `presets={SHOE_SIZES}` when
the category looks like footwear, else `DEFAULT_SIZES` (hidden when axis is `color`).

Then a "Total received" input bound to `form.totalReceived`, and the matrix.

The mismatch banner, warning only:

```jsx
{Number(form.totalReceived) > 0 && totals.grandTotal !== Number(form.totalReceived) && (
  <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50">
    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
    <p className="text-sm text-amber-800 flex-1">
      Matrix totals <b>{totals.grandTotal}</b> but you received <b>{form.totalReceived}</b>
      {' '}({totals.grandTotal > Number(form.totalReceived) ? 'over' : 'short'} by{' '}
      {Math.abs(totals.grandTotal - Number(form.totalReceived))}).
    </p>
    <button type="button" className="btn-xs btn-secondary"
      onClick={() => upd('totalReceived', String(totals.grandTotal))}>Use matrix total</button>
    <button type="button" className="btn-xs btn-secondary"
      onClick={() => setMatrix(distributeEvenly(matrix, Number(form.totalReceived)))}>Distribute evenly</button>
  </div>
)}
```

- [ ] **Step 3: Build `VariantMatrix`**

The grid: color rows, size columns, a Total column and a Total row.

```jsx
// Sticky header row + sticky first column so a 3x8 shoe matrix stays readable
// while scrolling horizontally on a phone.
<div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
  <table className="min-w-full border-separate border-spacing-0 text-sm">
```

- First column: `sticky left-0 z-10 bg-white` with the color swatch and name.
- Cells use the existing `NumberInput` (`components/ui/NumberInput.jsx`) — it exists precisely to stop
  the "clear the field and type 10 gives 010" bug that would otherwise mis-enter stock. `min="0"`,
  and `onCommit` clamps with `Math.max(0, parseInt(v, 10) || 0)` so negatives are impossible to enter.
- Row totals and column totals render from `totals`, bold, right-aligned; grand total in the corner
  cell with a `bg-blue-50` highlight.
- Each row gets a small kebab with **Copy to all rows** (`copyRow(matrix, row, otherRows)`) and
  **Fill row**.
- A toolbar above the table: `Fill All`, `Distribute Evenly`, `Clear` — all calling the pure helpers
  and setting the returned matrix.

- [ ] **Step 4: Verify the build**

Run: `cd client && npm run build`
Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
git add client/src/components/product-wizard/StepBasic.jsx client/src/components/product-wizard/StepVariants.jsx client/src/components/product-wizard/VariantMatrix.jsx
git commit -m "feat: wizard basic info and variant matrix steps"
```

---

### Task 10: Step 3 (Pricing) with live summary and variant pricing

**Files:**
- Create: `client/src/components/product-wizard/StepPricing.jsx`
- Create: `client/src/components/product-wizard/VariantPricingTable.jsx`

**Interfaces:**
- Consumes: `pricing` and `variantPricing` from `useProductWizard`.
- Produces: `<StepPricing .../>`, `<VariantPricingTable matrix pricing onCellChange />`.

- [ ] **Step 1: Build the pricing inputs**

Cost Price, Profit % and Selling Price sit in one row, wired two-way — editing profit updates selling
price and vice versa. Then discount type (segmented `None` / `%` / `₹`) and, when not `None`, the
discount value with the unit shown inline.

- [ ] **Step 2: Build the live summary**

A card that updates on every keystroke, showing exactly the chain from the spec:

```jsx
{[
  { label: 'Selling Price (MRP)', value: pricing.price },
  { label: 'Discount',            value: -pricing.discountAmount, tone: 'amber' },
  { label: 'Customer Pays',       value: pricing.finalPrice, big: true },
  { label: 'Profit',              value: pricing.profitAmount, tone: pricing.profitAmount >= 0 ? 'green' : 'red' },
].map(...)}
```

Below it, a secondary line: `Margin {pricing.marginPercentOnSell}% on sale · {Math.round(pricing.profitPercentOnCost)}% on cost`
— both numbers, because the Inventory table shows the first and this step's input is the second.

A loss warning renders inline when `pricing.profitAmount < 0`: *"Selling below cost — you lose ₹X per
unit."* It warns; it does not block.

- [ ] **Step 3: Add the variant pricing toggle and table**

Rendered only when `form.hasVariants`. Toggle writes `form.hasVariantPricing`. When on,
`VariantPricingTable` lists one row per matrix cell with Cost, Profit %, Selling, Discount and a
computed Final column. Empty inputs mean *inherit* and render the product-level value as greyed
placeholder text — so `null` stays visibly different from a typed `0`.

- [ ] **Step 4: Verify the build**

Run: `cd client && npm run build`
Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
git add client/src/components/product-wizard/StepPricing.jsx client/src/components/product-wizard/VariantPricingTable.jsx
git commit -m "feat: wizard pricing step with live summary and variant pricing"
```

---

### Task 11: Step 4 (GST & Details) and Step 5 (Review)

**Files:**
- Create: `client/src/components/product-wizard/StepDetails.jsx`
- Create: `client/src/components/product-wizard/StepReview.jsx`

**Interfaces:**
- Consumes: `form`, `pricing`, `variantPricing`, `totals`, `matrix`.
- Produces: `<StepDetails .../>`, `<StepReview onJumpToStep=... />`.

- [ ] **Step 1: Build `StepDetails`**

Every remaining existing field, so nothing regresses: `gstRate` (segmented `GST_RATES` plus a custom
input, defaulting to blank = inherit invoice rate), `hsnCode`, `taxType`, `lowStockThreshold`,
`reorderPoint`, `minStock`, `maxStock`, `trackBatch`/`batchNumber`, `trackExpiry`/`expiryDate`, the
`isFeatured`/`isNewArrival`/`isTrending` checkboxes, and `notifyCustomers` (create only, matching
`ProductForm.jsx:478-495`).

The GST control must make "not set" explicit:

```jsx
<Field label="GST Rate" hint="Leave unset to use the bill's tax rate at checkout.">
```

- [ ] **Step 2: Build `StepReview`**

Read-only summary with a section per step and an *Edit* link calling `onJumpToStep(n)`:

- **Product** — image thumb, name, brand, category, SKU, unit, shop
- **Variants** — the matrix rendered read-only with totals, or "No variants — single stock line"
- **Stock** — total units, and for variant products the per-color breakdown
- **Money** — a totals card:

```jsx
// Aggregate across variants so a per-variant-priced product reviews correctly,
// rather than multiplying one price by the total count.
const costValue       = sum(cell.stock * effectiveCost(cell));
const expectedRevenue = sum(cell.stock * effectiveFinalPrice(cell));
const expectedProfit  = expectedRevenue - costValue;
```

Showing: Total Stock, Cost Value, Expected Revenue, Expected Profit, Discount given, Final customer
price, and GST (rate + estimated tax, labelled as estimated because place-of-supply is decided at
billing time).

For the spec example this reads: 100 pairs, cost ₹1,00,000, revenue ₹1,30,000, profit ₹30,000.

- [ ] **Step 3: Verify the build**

Run: `cd client && npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add client/src/components/product-wizard/StepDetails.jsx client/src/components/product-wizard/StepReview.jsx
git commit -m "feat: wizard GST/details and review steps"
```

---

### Task 12: Wire the wizard into Inventory

**Files:**
- Modify: `client/src/pages/Inventory.jsx:16` (import), `:178-224` (open handlers), `:295-299` (submit), `:559-566` (modal)
- Modify: `client/src/components/StockAdjustModal.jsx` (variant picker)
- Delete: `client/src/components/ProductForm.jsx`

**Interfaces:**
- Consumes: `ProductWizard`, `EMPTY_WIZARD_FORM`.

- [ ] **Step 1: Swap the import and form state**

```js
import { ProductWizard } from '../components/product-wizard/ProductWizard';
import { EMPTY_WIZARD_FORM } from '../components/product-wizard/useProductWizard';
```

Replace every `EMPTY_FORM` reference with `EMPTY_WIZARD_FORM`.

- [ ] **Step 2: Hydrate edit and duplicate through the wizard**

`openEdit` keeps spreading the product (the hook derives `hasVariants` and the matrix from
`trackVariantStock`/`variantStock`). `openDuplicate` additionally clears `barcode`/`sku` as it does
today but **keeps `variantStock`** — duplicating a shoe product with its whole matrix is the point.

- [ ] **Step 3: Render the wizard**

```jsx
<Modal open={showModal} onClose={closeModal}
  title={editProduct ? 'Edit Product' : 'Add Product'} size="xl">
  <ProductWizard
    form={form} setForm={setForm} onSubmit={handleSubmit}
    loading={createMut.isPending || updateMut.isPending}
    shops={shops} shopId={shopId} categories={categories}
    isEdit={!!editProduct} productId={editProduct?._id}
  />
</Modal>
```

`handleSubmit` sends `toPayload()` rather than raw `form`, and clears the draft on success.

- [ ] **Step 4: Show variant stock in the list**

In the `stock` column render, add a per-variant hint for variant products so the table stops looking
like a single bucket:

```jsx
{r.trackVariantStock && (
  <span className="ml-1 text-[10px] text-purple-600 font-medium">
    {r.variantStock?.length} variants
  </span>
)}
```

- [ ] **Step 5: Make `StockAdjustModal` variant-aware**

Task 5 makes the API reject a variant adjustment with no size/color. Add a variant `<select>` (built
from `product.variantStock`) shown only when `product.trackVariantStock`, required before submit, and
pass `size`/`color` to `productsApi.adjustStock`. Without this the modal 400s on variant products.

- [ ] **Step 6: Delete the old form and confirm nothing else imports it**

Run: `cd client && grep -rn "ProductForm\|EMPTY_FORM" src/ ; rm src/components/ProductForm.jsx`
Expected: grep returns no hits before deletion (other than the file itself)

- [ ] **Step 7: Verify the build**

Run: `cd client && npm run build`
Expected: build succeeds with no unresolved imports

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/Inventory.jsx client/src/components/StockAdjustModal.jsx
git rm client/src/components/ProductForm.jsx
git commit -m "feat: use the product wizard for add, edit and duplicate"
```

---

### Task 13: Cypress end-to-end coverage

**Files:**
- Create: `client/cypress/e2e/15-product-variant-matrix.cy.js`
- Create: `client/cypress/e2e/16-variant-pricing.cy.js`
- Modify: `client/package.json` (add `cy:run:wizard` script)

**Interfaces:**
- Consumes: `cy.login`, `cy.apiRequest`, `cy.getShopId`, `Cypress.unwrapProduct`, `Cypress.unwrapSale`
  from `cypress/support/commands.js`.

These are API-level specs, matching `05-variant-stock.cy.js` — they assert the contract the wizard
depends on, which is what regressions actually break.

- [ ] **Step 1: Write `15-product-variant-matrix.cy.js`**

Header comment explaining the invariant, then:

```js
describe('Product variant matrix', () => {
  let shopId;
  before(() => { cy.login(); cy.getShopId().then((id) => { shopId = id; }); });
  beforeEach(() => cy.login());

  const create = (body) => cy.apiRequest('POST', '/products', {
    name: `Wizard ${Date.now()}-${Math.random()}`, category: 'Footwear',
    price: 1300, costPrice: 1000, shopId, ...body,
  });

  it('simple product: stock behaves exactly as before', () => {
    create({ stock: 50 }).then((res) => {
      const p = Cypress.unwrapProduct(res);
      expect(p.stock).to.eq(50);
      expect(p.trackVariantStock).to.eq(false);
      expect(p.variantStock).to.have.length(0);
    });
  });

  it('color + size matrix: stock equals the matrix total', () => {
    const variantStock = [];
    ['Black', 'Brown', 'White'].forEach((color, ci) =>
      ['7', '8', '9', '10', '11'].forEach((size, si) =>
        variantStock.push({ size, color, stock: [ [5,10,10,10,5], [5,5,10,10,5], [5,5,5,5,5] ][ci][si] })));

    create({ trackVariantStock: true, variantStock, stock: 999 }).then((res) => {
      const p = Cypress.unwrapProduct(res);
      expect(p.variantStock).to.have.length(15);
      expect(p.stock, 'server recomputes stock from the matrix').to.eq(100);
      const black = p.variantStock.filter((v) => v.color === 'Black')
        .reduce((s, v) => s + v.stock, 0);
      expect(black).to.eq(40);
    });
  });

  it('size-only product uses an empty color', () => { /* variantStock: [{size:'M',color:'',stock:4}] → stock 4 */ });
  it('color-only product uses an empty size', () => { /* variantStock: [{size:'',color:'Red',stock:6}] → stock 6 */ });

  it('editing variants recomputes stock and preserves untouched cells', () => {
    create({ trackVariantStock: true, stock: 0, variantStock: [
      { size: '7', color: 'Black', stock: 5 }, { size: '8', color: 'Black', stock: 10 },
    ]}).then((res) => {
      const id = Cypress.unwrapProduct(res)._id;
      cy.apiRequest('PUT', `/products/${id}`, { variantStock: [
        { size: '7', color: 'Black', stock: 5 },
        { size: '8', color: 'Black', stock: 20 },
        { size: '9', color: 'Black', stock: 7 },
      ]}).then((r2) => {
        const p = Cypress.unwrapProduct(r2);
        expect(p.stock).to.eq(32);
        expect(p.variantStock.find((v) => v.size === '7').stock).to.eq(5);
      });
    });
  });

  it('rejects negative quantities', () => {
    create({ trackVariantStock: true, variantStock: [{ size: '7', color: 'Black', stock: -1 }] })
      .then((res) => { expect(res.status).to.eq(400); expect(res.body.message).to.match(/negative/i); });
  });

  it('rejects duplicate combinations', () => {
    create({ trackVariantStock: true, variantStock: [
      { size: '7', color: 'Black', stock: 1 }, { size: '7', color: 'Black', stock: 2 },
    ]}).then((res) => { expect(res.status).to.eq(400); expect(res.body.message).to.match(/duplicate/i); });
  });

  it('rejects a direct stock write on a variant product', () => { /* PUT { stock: 500 } → 400 /variant/i */ });

  it('adjust-stock requires a variant, and moves cell + root together', () => {
    // no size/color → 400
    // { delta: -2, size: '8', color: 'Black', reason: 'damage' } → cell 10→8 AND root 15→13
  });

  it('bulk audit skips variant products instead of desyncing them', () => {
    // POST /products/audit/bulk with a variant product → res.body.data.skipped has 1 entry
  });

  it('tenant isolation: cannot create or edit a variant product in another shop', () => {
    cy.apiRequest('GET', '/shops').then((res) => {
      const shops = Cypress.unwrapShops(res);
      if (shops.length < 2) return;                       // single-shop env, nothing to prove
      cy.apiRequest('POST', '/products', {
        name: 'Cross tenant', category: 'X', price: 1, costPrice: 1, shopId: shops[1]._id,
        trackVariantStock: true, variantStock: [{ size: '7', color: 'Black', stock: 1 }],
      }).then((r) => expect(r.status).to.be.oneOf([403, 404]));
    });
  });
});
```

Fill in the bodies marked with comments — write them out fully, following the pattern of the
completed tests above.

- [ ] **Step 2: Write `16-variant-pricing.cy.js`**

```js
describe('Variant pricing and GST at the counter', () => {
  it('sells a variant at its own price and cost', () => {
    // Create: price 1300 / costPrice 1000, hasVariantPricing: true,
    //   variantStock: [{ size:'10', color:'Black', stock:5, price:1500, costPrice:1100 },
    //                  { size:'9',  color:'Black', stock:5 }]                       // inherits
    // POST /sales with selectedSize '10', selectedColor 'Black', quantity 1
    // → item.price 1500, item.costPrice 1100, item.profit 400
    // POST /sales for size '9' → item.price 1300, item.profit 300  (inherited)
  });

  it('a variant discount overrides the product discount', () => { /* variant discount 20 vs product 10 */ });

  it('product gstRate drives the invoice line tax rate', () => {
    // gstRate: 12, POST /sales with taxRate: 5 → invoice line taxRate is 12, not 5
  });

  it('a product with gstRate null still uses the invoice tax rate', () => {
    // gstRate omitted, taxRate: 5 → line taxRate 5. Guards the null-vs-0 regression.
  });

  it('a product with gstRate 0 is genuinely zero-rated', () => {
    // gstRate: 0, taxRate: 18 → taxAmount 0. Guards `== null` vs `||`.
  });

  it('overselling a variant still fails', () => { /* qty > cell stock → 409 */ });
});
```

Write every body out fully.

- [ ] **Step 3: Add the run script**

`client/package.json`:

```json
"cy:run:wizard": "cypress run --spec \"cypress/e2e/{15,16}-*.cy.js\""
```

- [ ] **Step 4: Run the specs**

Requires the API in test mode. Run in three terminals:

```bash
cd server && npm run dev:test
cd client && npm run dev
cd client && npm run cy:run:wizard
```

Expected: all specs pass. Also re-run the existing variant suite to prove no regression:
`npm run cy:run:variant`

- [ ] **Step 5: Commit**

```bash
git add client/cypress/e2e/15-product-variant-matrix.cy.js client/cypress/e2e/16-variant-pricing.cy.js client/package.json
git commit -m "test: e2e coverage for variant matrix and variant pricing"
```

---

### Task 14: Full verification

**Files:** none created.

- [ ] **Step 1: Unit tests**

Run: `cd server && npm test`
Expected: every suite reports `0 failed`

- [ ] **Step 2: Client build (this repo's typecheck)**

Run: `cd client && npm run build`
Expected: build succeeds, no unresolved imports

- [ ] **Step 3: Regression suites**

Run: `cd client && npm run cy:run:core && npm run cy:run:variant && npm run cy:run:wizard`
Expected: all pass. `01-billing-cash` and `04-partial-refund` passing is the proof that simple
products and refunds are untouched.

- [ ] **Step 4: Manual smoke of the invariant**

```bash
cd server && node -e "
require('dotenv').config();
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const Product = require('./src/modules/products/product.model');
  const bad = await Product.find({ trackVariantStock: true }).lean();
  const drift = bad.filter(p => p.stock !== (p.variantStock||[]).reduce((s,v)=>s+v.stock,0));
  console.log(drift.length ? 'DRIFT: ' + drift.map(p=>p.name).join(', ') : 'invariant holds for all ' + bad.length);
  await mongoose.disconnect();
})();
"
```

Expected: `invariant holds`

- [ ] **Step 5: Commit any fixes and report**

Report: unit test counts, build result, Cypress pass counts, and the invariant check output. Do not
claim completion without pasting the actual output of steps 1–4.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Step 1 basic fields incl. brand | 3 (schema), 9 |
| Step 2 variants, matrix, live totals | 2, 9 |
| Fill All / Copy Row / Distribute / Clear | 2 (engine), 9 (UI) |
| Prevent negative + duplicate combos | 2, 4, 13 |
| `stock` always equals matrix total | 4, 13, 14 |
| Step 3 cost → profit → selling, two-way | 1, 10 |
| Discount % or ₹, live summary | 1, 10 |
| Per-variant pricing | 3, 4, 6, 10 |
| Step 4 GST with product-level fallback | 3, 6, 11 |
| All existing fields retained | 7, 11, 12 |
| Step 5 review summary | 11 |
| Keep `trackVariantStock` architecture | 3, 4, 6 |
| Backward compatibility, null not 0 | 3, 6, 13 |
| All stock mutation paths consistent | 5 |
| `adjustStock` requires color/size | 5, 12, 13 |
| Bulk audit/restock don't touch variants | 5, 13 |
| Billing uses variant price/cost/discount/GST | 6, 13 |
| Desktop two-column, mobile sticky footer | 8 |
| Inline validation, no modals | 7, 8 |
| sessionStorage autosave | 8 |
| Edit + Duplicate reuse the wizard | 12 |
| Tests: all 12 listed scenarios | 1, 2, 4, 13 |

No gaps.

**Placeholder scan:** The `/* ... */` markers in Tasks 9–13 are explicitly labelled "write these out
fully" with a completed sibling test or component to pattern-match against. Task 1 Step 4 and Task 2
Step 4 say to copy the real bodies from the server file, and say so explicitly.

**Type consistency:** `cellKey`, `buildMatrix`, `matrixTotals`, `toVariantStock`, `fromVariantStock`,
`fillAll`, `distributeEvenly`, `copyRow`, `clearAll`, `findDuplicateCombos` are named identically in
Tasks 2, 8, 9 and the mirror guard. `computeProductPricing`, `sellingPriceFromMarkup`,
`markupFromSellingPrice`, `normalizeDiscountPercent` are consistent across Tasks 1, 4, 8, 10.
`normalizeProductPayload(data, existing)` has one signature everywhere. `EMPTY_WIZARD_FORM` replaces
`EMPTY_FORM` consistently in Tasks 8 and 12.
