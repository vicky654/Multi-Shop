/**
 * Variant matrix tests — plain Node, no test framework needed.
 *   node src/utils/variantMatrix.test.js
 */
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
t('a fresh cell carries null pricing, never zero', () => {
  const c = M.buildMatrix({ colors: ['Black'], sizes: ['7'] }).cells[M.cellKey('Black', '7')];
  assert.equal(c.price,     null);
  assert.equal(c.costPrice, null);
  assert.equal(c.discount,  null);
  assert.equal(c.stock,     0);
});
t('color objects from the ColorSelector are accepted as {name,hex}', () => {
  const m = M.buildMatrix({ colors: [{ name: 'Black', hex: '#111' }], sizes: ['7'] });
  assert.deepEqual(m.rows, ['Black']);
  assert.ok(M.cellKey('Black', '7') in m.cells);
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
t('switching from both axes to size-only keeps nothing stale', () => {
  let m = M.buildMatrix({ colors: COLORS, sizes: SIZES });
  m = M.fillAll(m, 2);
  m = M.buildMatrix({ colors: [], sizes: SIZES, existing: m.cells });
  assert.deepEqual(m.rows, ['']);
  assert.equal(Object.keys(m.cells).length, 5);
  // The old Black/7 cell is gone, so the new ''/7 cell starts empty.
  assert.equal(m.cells[M.cellKey('', '7')].stock, 0);
});

console.log('\nTotals — the spec example matrix');

t('row, column and grand totals match the spec table', () => {
  const m = M.buildMatrix({ colors: COLORS, sizes: SIZES });
  const grid = [[5, 10, 10, 10, 5], [5, 5, 10, 10, 5], [5, 5, 5, 5, 5]];
  COLORS.forEach((color, ci) =>
    SIZES.forEach((size, si) => { m.cells[M.cellKey(color, size)].stock = grid[ci][si]; }));

  const tot = M.matrixTotals(m);
  assert.equal(tot.rowTotals.Black, 40);
  assert.equal(tot.rowTotals.Brown, 35);
  assert.equal(tot.rowTotals.White, 25);
  assert.deepEqual(SIZES.map((s) => tot.colTotals[s]), [15, 20, 25, 25, 15]);
  assert.equal(tot.grandTotal, 100);
});
t('an empty matrix totals zero rather than NaN', () => {
  const tot = M.matrixTotals(M.buildMatrix({ colors: [], sizes: [] }));
  assert.equal(tot.grandTotal, 0);
});

console.log('\nBulk operations');

t('fillAll sets every cell', () => {
  const m = M.fillAll(M.buildMatrix({ colors: COLORS, sizes: SIZES }), 4);
  assert.equal(M.matrixTotals(m).grandTotal, 60);
});
t('fillAll clamps negatives to 0', () => {
  const m = M.fillAll(M.buildMatrix({ colors: ['Black'], sizes: ['7'] }), -5);
  assert.equal(m.cells[M.cellKey('Black', '7')].stock, 0);
});
t('distributeEvenly spreads a total and gives the remainder to the first cells', () => {
  const m = M.distributeEvenly(M.buildMatrix({ colors: ['Black'], sizes: ['7', '8', '9'] }), 100);
  assert.equal(M.matrixTotals(m).grandTotal, 100);   // 34 + 33 + 33
  assert.equal(m.cells[M.cellKey('Black', '7')].stock, 34);
  assert.equal(m.cells[M.cellKey('Black', '9')].stock, 33);
});
t('distributeEvenly across the full 15-cell shoe matrix still totals exactly', () => {
  const m = M.distributeEvenly(M.buildMatrix({ colors: COLORS, sizes: SIZES }), 100);
  assert.equal(M.matrixTotals(m).grandTotal, 100);
});
t('distributeEvenly on an empty matrix is a no-op, not a divide by zero', () => {
  const m = M.distributeEvenly(M.buildMatrix({ colors: [], sizes: [] }), 100);
  assert.equal(M.matrixTotals(m).grandTotal, 0);
});
t('copyRow copies quantities to the named rows only', () => {
  let m = M.buildMatrix({ colors: COLORS, sizes: ['7', '8'] });
  m.cells[M.cellKey('Black', '7')].stock = 3;
  m.cells[M.cellKey('Black', '8')].stock = 4;
  m = M.copyRow(m, 'Black', ['Brown']);
  assert.equal(m.cells[M.cellKey('Brown', '8')].stock, 4);
  assert.equal(m.cells[M.cellKey('White', '8')].stock, 0);
});
t('copyRow also copies per-variant pricing', () => {
  let m = M.buildMatrix({ colors: COLORS, sizes: ['7'] });
  m.cells[M.cellKey('Black', '7')].price = 1500;
  m = M.copyRow(m, 'Black', ['Brown']);
  assert.equal(m.cells[M.cellKey('Brown', '7')].price, 1500);
});
t('fillRow sets one row only', () => {
  const m = M.fillRow(M.buildMatrix({ colors: COLORS, sizes: ['7', '8'] }), 'Brown', 6);
  assert.equal(M.matrixTotals(m).rowTotals.Brown, 12);
  assert.equal(M.matrixTotals(m).rowTotals.Black, 0);
});
t('clearAll zeroes quantities but keeps the axes', () => {
  const m = M.clearAll(M.fillAll(M.buildMatrix({ colors: COLORS, sizes: SIZES }), 9));
  assert.equal(M.matrixTotals(m).grandTotal, 0);
  assert.equal(Object.keys(m.cells).length, 15);
});
t('clearAll keeps per-variant pricing — it clears stock, not prices', () => {
  let m = M.buildMatrix({ colors: ['Black'], sizes: ['7'] });
  m.cells[M.cellKey('Black', '7')].price = 1500;
  m = M.clearAll(M.fillAll(m, 5));
  assert.equal(m.cells[M.cellKey('Black', '7')].price, 1500);
  assert.equal(m.cells[M.cellKey('Black', '7')].stock, 0);
});
t('setCell clamps negatives to 0 so a negative can never be entered', () => {
  const m = M.setCell(M.buildMatrix({ colors: ['Black'], sizes: ['7'] }), 'Black', '7', { stock: -3 });
  assert.equal(m.cells[M.cellKey('Black', '7')].stock, 0);
});
t('bulk operations do not mutate the input matrix', () => {
  const before = M.buildMatrix({ colors: ['Black'], sizes: ['7'] });
  M.fillAll(before, 7);
  M.clearAll(before);
  M.setCell(before, 'Black', '7', { stock: 9 });
  assert.equal(before.cells[M.cellKey('Black', '7')].stock, 0);
});

console.log('\nRound-trip through the API shape');

t('toVariantStock emits the flat shape sale.service looks up', () => {
  const m = M.fillAll(M.buildMatrix({ colors: ['Black'], sizes: ['9'] }), 6);
  assert.deepEqual(M.toVariantStock(m), [{ size: '9', color: 'Black', stock: 6 }]);
});
t('toVariantStock omits null pricing keys entirely', () => {
  const m = M.fillAll(M.buildMatrix({ colors: ['Black'], sizes: ['9'] }), 1);
  assert.deepEqual(Object.keys(M.toVariantStock(m)[0]).sort(), ['color', 'size', 'stock']);
});
t('toVariantStock includes per-variant pricing only when set', () => {
  const m = M.setCell(M.buildMatrix({ colors: ['Black'], sizes: ['9'] }), 'Black', '9',
    { stock: 2, price: 1500 });
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
  // A pair that was never stocked still gets a zero cell so the grid is complete.
  assert.equal(m.cells[M.cellKey('Black', '8')].stock, 0);
});
t('fromVariantStock handles a size-only product', () => {
  const m = M.fromVariantStock([{ size: 'M', color: '', stock: 4 }]);
  assert.deepEqual(m.rows, ['']);
  assert.deepEqual(m.cols, ['M']);
});
t('fromVariantStock handles a color-only product', () => {
  const m = M.fromVariantStock([{ size: '', color: 'Red', stock: 6 }]);
  assert.deepEqual(m.rows, ['Red']);
  assert.deepEqual(m.cols, ['']);
});
t('fromVariantStock on an empty list yields an empty matrix', () => {
  assert.deepEqual(M.fromVariantStock([]).cells, {});
  assert.deepEqual(M.fromVariantStock(undefined).cells, {});
});
t('round trip is lossless', () => {
  const vs = [{ size: '7', color: 'Black', stock: 5 }, { size: '8', color: 'Black', stock: 6 }];
  assert.deepEqual(M.toVariantStock(M.fromVariantStock(vs)), vs);
});
t('round trip preserves per-variant pricing', () => {
  const vs = [{ size: '7', color: 'Black', stock: 5, price: 1500, costPrice: 900 }];
  assert.deepEqual(M.toVariantStock(M.fromVariantStock(vs)), vs);
});
t('fromVariantStock tolerates a Mongoose lean doc with extra keys', () => {
  const m = M.fromVariantStock([{ size: '7', color: 'Black', stock: 5, _id: 'x', __v: 0 }]);
  assert.deepEqual(M.toVariantStock(m), [{ size: '7', color: 'Black', stock: 5 }]);
});

console.log('\nValidation helpers');

t('findDuplicateCombos flags a repeated size/color pair', () => {
  assert.deepEqual(M.findDuplicateCombos([
    { size: '7', color: 'Black', stock: 1 },
    { size: '7', color: 'Black', stock: 2 },
  ]), ['Black / 7']);
});
t('findDuplicateCombos returns empty for a clean list', () => {
  assert.deepEqual(M.findDuplicateCombos([{ size: '7', color: 'Black', stock: 1 }]), []);
});
t('findDuplicateCombos treats missing size/color as the empty axis', () => {
  assert.deepEqual(M.findDuplicateCombos([{ color: 'Red' }, { color: 'Red' }]), ['Red']);
});
t('findDuplicateCombos reports each duplicate pair once', () => {
  const dupes = M.findDuplicateCombos([
    { size: '7', color: 'Black' }, { size: '7', color: 'Black' }, { size: '7', color: 'Black' },
  ]);
  assert.deepEqual(dupes, ['Black / 7']);
});
t('sumVariantStock adds quantities and coerces strings', () => {
  assert.equal(M.sumVariantStock([{ stock: 5 }, { stock: '10' }]), 15);
  assert.equal(M.sumVariantStock([]), 0);
  assert.equal(M.sumVariantStock(undefined), 0);
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
    'fillAll', 'fillRow', 'distributeEvenly', 'copyRow', 'clearAll', 'setCell',
    'findDuplicateCombos', 'sumVariantStock',
  ]);
  const args = { colors: COLORS, sizes: SIZES };

  assert.deepEqual(C.buildMatrix(args), M.buildMatrix(args));
  assert.deepEqual(C.matrixTotals(C.fillAll(C.buildMatrix(args), 4)),
                   M.matrixTotals(M.fillAll(M.buildMatrix(args), 4)));
  assert.deepEqual(C.distributeEvenly(C.buildMatrix(args), 100).cells,
                   M.distributeEvenly(M.buildMatrix(args), 100).cells);
  assert.deepEqual(C.copyRow(C.fillRow(C.buildMatrix(args), 'Black', 3), 'Black', ['White']).cells,
                   M.copyRow(M.fillRow(M.buildMatrix(args), 'Black', 3), 'Black', ['White']).cells);

  const vs = [{ size: '7', color: 'Black', stock: 5, price: 1500 }];
  assert.deepEqual(C.toVariantStock(C.fromVariantStock(vs)), M.toVariantStock(M.fromVariantStock(vs)));
  assert.deepEqual(C.findDuplicateCombos([{ color: 'Red' }, { color: 'Red' }]),
                   M.findDuplicateCombos([{ color: 'Red' }, { color: 'Red' }]));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
