/**
 * Purchase / GRN pure-logic tests — plain Node, no test framework needed.
 *   node src/modules/purchases/purchase.service.test.js
 *
 * These cover totals and, more importantly, the SHAPE of the stock-movement ops:
 * a variant line must move its cell and root stock in the SAME update, or the
 * invariant stock === sum(variantStock) breaks the first time a GRN is posted.
 * The DB-level behaviour is verified separately against a live database.
 */
const assert = require('node:assert');
const { computeTotals, buildStockOps } = require('./purchase.service');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
  catch (e) { fail += 1; console.error(`  ✗ ${name}\n      ${e.message}`); }
};

console.log('\nTotals');

t('sums quantity × cost across lines', () => {
  const r = computeTotals({ lines: [
    { quantity: 10, costPrice: 100 },
    { quantity: 5,  costPrice: 200 },
  ]});
  assert.equal(r.subTotal, 2000);
  assert.equal(r.totalUnits, 15);
});
t('line discount reduces the line before tax', () => {
  const r = computeTotals({ lines: [{ quantity: 10, costPrice: 100, discount: 200 }] });
  assert.equal(r.subTotal, 800);
});
t('GST derives from the rate when no amount is given', () => {
  const r = computeTotals({ lines: [{ quantity: 10, costPrice: 100, gstRate: 18 }] });
  assert.equal(r.totalGst, 180);
});
t('an explicit GST amount wins over the rate', () => {
  // The supplier invoice is the document of record, to the paisa.
  const r = computeTotals({ lines: [{ quantity: 10, costPrice: 100, gstRate: 18, gstAmount: 179.99 }] });
  assert.equal(r.totalGst, 179.99);
});
t('GST is computed after the line discount', () => {
  const r = computeTotals({ lines: [{ quantity: 10, costPrice: 100, discount: 200, gstRate: 18 }] });
  assert.equal(r.totalGst, 144);   // 18% of 800, not of 1000
});
t('freight and other charges add to the net total', () => {
  const r = computeTotals({
    lines: [{ quantity: 10, costPrice: 100, gstRate: 18 }],
    freightCharges: 500, otherCharges: 100,
  });
  assert.equal(r.netTotal, 1780);  // 1000 + 180 + 600
});
t('invoice discount reduces the net total', () => {
  const r = computeTotals({
    lines: [{ quantity: 10, costPrice: 100 }], invoiceDiscount: 300,
  });
  assert.equal(r.netTotal, 700);
});
t('net total never goes negative', () => {
  const r = computeTotals({ lines: [{ quantity: 1, costPrice: 100 }], invoiceDiscount: 999999 });
  assert.equal(r.netTotal, 0);
});
t('no lines yields zeroes, not NaN', () => {
  const r = computeTotals({ lines: [] });
  for (const v of Object.values(r)) assert.ok(Number.isFinite(v));
});

console.log('\nStock movement ops — the invariant');

t('a variant line moves the cell AND root in ONE update', () => {
  const [op] = buildStockOps([{ product: 'p1', size: '9', color: 'Black', quantity: 10 }], +1);
  const inc = op.updateOne.update.$inc;
  // Both keys in the same $inc is what makes the movement atomic and keeps root
  // from drifting away from the breakdown.
  assert.equal(inc['variantStock.$.stock'], 10);
  assert.equal(inc.stock, 10);
  assert.equal(Object.keys(inc).length, 2);
});
t('the positional match targets the exact cell', () => {
  const [op] = buildStockOps([{ product: 'p1', size: '9', color: 'Black', quantity: 10 }], +1);
  assert.deepEqual(op.updateOne.filter.variantStock.$elemMatch, { size: '9', color: 'Black' });
});
t('a non-variant line moves root stock only', () => {
  const [op] = buildStockOps([{ product: 'p1', size: '', color: '', quantity: 7 }], +1);
  assert.deepEqual(op.updateOne.update.$inc, { stock: 7 });
  assert.equal(op.updateOne.filter.variantStock, undefined);
});
t('receiving needs no availability guard', () => {
  const [op] = buildStockOps([{ product: 'p1', size: '', color: '', quantity: 7 }], +1);
  assert.equal(op.updateOne.filter.stock, undefined);
});

console.log('\nReversal guards — refuse rather than go negative');

t('reversing a variant line guards BOTH the cell and root', () => {
  const [op] = buildStockOps([{ product: 'p1', size: '9', color: 'Black', quantity: 10 }], -1);
  // Cell guard: the cell must hold at least what is being taken back.
  assert.deepEqual(op.updateOne.filter.variantStock.$elemMatch,
    { size: '9', color: 'Black', stock: { $gte: 10 } });
  // Root guard: so does the total.
  assert.deepEqual(op.updateOne.filter.stock, { $gte: 10 });
  const inc = op.updateOne.update.$inc;
  assert.equal(inc['variantStock.$.stock'], -10);
  assert.equal(inc.stock, -10);
});
t('reversing a non-variant line guards root stock', () => {
  const [op] = buildStockOps([{ product: 'p1', size: '', color: '', quantity: 7 }], -1);
  assert.deepEqual(op.updateOne.filter.stock, { $gte: 7 });
  assert.deepEqual(op.updateOne.update.$inc, { stock: -7 });
});
t('a guard that cannot be satisfied simply does not match', () => {
  // This is the mechanism by which "goods already sold" surfaces as a refusal:
  // the filter fails, modifiedCount falls short, and the service throws 409.
  const [op] = buildStockOps([{ product: 'p1', size: '', color: '', quantity: 100 }], -1);
  assert.equal(op.updateOne.filter.stock.$gte, 100);
});

console.log('\nMulti-line and mixed products');

t('one op per line, order preserved', () => {
  const ops = buildStockOps([
    { product: 'p1', size: '6',  color: 'Black', quantity: 10 },
    { product: 'p1', size: '7',  color: 'Black', quantity: 15 },
    { product: 'p2', size: '',   color: '',      quantity: 5  },
  ], +1);
  assert.equal(ops.length, 3);
  assert.equal(ops[0].updateOne.update.$inc['variantStock.$.stock'], 10);
  assert.equal(ops[1].updateOne.update.$inc['variantStock.$.stock'], 15);
  assert.deepEqual(ops[2].updateOne.update.$inc, { stock: 5 });
});
t('the shoe example: 6 cells sum to the root increase', () => {
  const grid = [
    { size: '6', color: 'Black', quantity: 10 },
    { size: '7', color: 'Black', quantity: 15 },
    { size: '8', color: 'Black', quantity: 20 },
    { size: '6', color: 'Brown', quantity: 10 },
    { size: '7', color: 'Brown', quantity: 15 },
    { size: '8', color: 'Brown', quantity: 10 },
  ].map((l) => ({ ...l, product: 'nike' }));

  const ops = buildStockOps(grid, +1);
  const rootTotal = ops.reduce((s, o) => s + o.updateOne.update.$inc.stock, 0);
  const cellTotal = ops.reduce((s, o) => s + o.updateOne.update.$inc['variantStock.$.stock'], 0);
  assert.equal(rootTotal, 80);
  assert.equal(cellTotal, 80);
  // Equal by construction — which is exactly the invariant.
  assert.equal(rootTotal, cellTotal);
});
t('a colour-only line uses an empty size, matching the sale-time lookup', () => {
  const [op] = buildStockOps([{ product: 'p1', size: '', color: 'Red', quantity: 4 }], +1);
  assert.deepEqual(op.updateOne.filter.variantStock.$elemMatch, { size: '', color: 'Red' });
});
t('a size-only line uses an empty colour', () => {
  const [op] = buildStockOps([{ product: 'p1', size: 'M', color: '', quantity: 4 }], +1);
  assert.deepEqual(op.updateOne.filter.variantStock.$elemMatch, { size: 'M', color: '' });
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
