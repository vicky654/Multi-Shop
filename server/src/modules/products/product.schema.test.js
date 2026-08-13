/**
 * Product spreadsheet contract tests — plain Node.
 *   node src/modules/products/product.schema.test.js
 *
 * The export, the importer and the downloadable sample all read COLUMNS from
 * this module. These tests pin the parts that silently corrupt data when wrong:
 * the nullable gstRate, the variant packing round-trip, and the derived columns
 * that must be computed here because `.lean()` queries carry no virtuals.
 */
const assert = require('node:assert');
const {
  COLUMNS, IMPORT_COLUMNS, IMPORT_HEADER, REQUIRED_KEYS,
  formatVariants, parseVariants, productToRow,
} = require('./product.schema');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
  catch (e) { fail += 1; console.error(`  ✗ ${name}\n      ${e.message}`); }
};

console.log('\nColumn contract');

t('required columns are exactly name, category, price, costPrice', () => {
  assert.deepEqual(REQUIRED_KEYS.sort(), ['category', 'costPrice', 'name', 'price']);
});
t('every required column is also importable', () => {
  // A required-but-not-importable column would make every import impossible.
  for (const c of COLUMNS.filter((x) => x.required)) {
    assert.ok(c.importable, `${c.key} is required but not importable`);
  }
});
t('calculated columns are NOT importable', () => {
  // Re-importing a calculated column would double-apply the discount.
  for (const key of ['finalPrice', 'profitPerUnit', 'marginPercent', 'stockValue']) {
    const c = COLUMNS.find((x) => x.key === key);
    assert.ok(c, `${key} missing`);
    assert.ok(!c.importable, `${key} must not be importable`);
  }
});
t('the variant column is importable — otherwise export is lossy', () => {
  assert.ok(COLUMNS.find((c) => c.key === 'variants')?.importable);
});
t('brand and gstRate are importable (they were missing entirely before)', () => {
  assert.ok(COLUMNS.find((c) => c.key === 'brand')?.importable);
  assert.ok(COLUMNS.find((c) => c.key === 'gstRate')?.importable);
});
t('the import header has no duplicates', () => {
  assert.equal(new Set(IMPORT_HEADER).size, IMPORT_HEADER.length);
});
t('importable labels equal their keys, so a hand-edited file still parses', () => {
  // csv-parser keys rows by header text; a label of "Price (₹)" would silently
  // stop matching `row.price`.
  for (const c of IMPORT_COLUMNS) assert.equal(c.label, c.key, `${c.key} label differs`);
});
t('every column carries help text for the sample file', () => {
  for (const c of COLUMNS) assert.ok(c.help && c.help.length > 5, `${c.key} has no help`);
});

console.log('\nVariant packing');

t('a matrix round-trips through format → parse', () => {
  const cells = [
    { color: 'Red', size: 'S', stock: 10 },
    { color: 'Red', size: 'M', stock: 5 },
    { color: 'Blue', size: 'S', stock: 8 },
  ];
  const packed = formatVariants(cells);
  assert.equal(packed, 'Red:S:10; Red:M:5; Blue:S:8');
  assert.deepEqual(parseVariants(packed).cells, cells);
});
t('an empty matrix packs to an empty string', () => {
  assert.equal(formatVariants([]), '');
  assert.equal(formatVariants(undefined), '');
});
t('a zero-quantity cell survives the round-trip', () => {
  // Deleting it would change the matrix shape and break stock === sum(cells).
  const cells = [{ color: 'Red', size: 'S', stock: 0 }];
  assert.deepEqual(parseVariants(formatVariants(cells)).cells, cells);
});
t('a size-only product packs with a blank colour', () => {
  const cells = [{ color: '', size: 'L', stock: 4 }];
  assert.equal(formatVariants(cells), ':L:4');
  assert.deepEqual(parseVariants(':L:4').cells, cells);
});
t('a colour-only product packs with a blank size', () => {
  assert.deepEqual(parseVariants('Red::7').cells, [{ color: 'Red', size: '', stock: 7 }]);
});
t('whitespace around entries is tolerated', () => {
  assert.deepEqual(parseVariants('  Red : S : 10 ;  Blue : M : 2  ').cells, [
    { color: 'Red', size: 'S', stock: 10 },
    { color: 'Blue', size: 'M', stock: 2 },
  ]);
});
t('a blank cell yields no variants and no errors', () => {
  assert.deepEqual(parseVariants(''), { cells: [], errors: [] });
  assert.deepEqual(parseVariants(null), { cells: [], errors: [] });
});
t('a trailing semicolon is not an error', () => {
  const r = parseVariants('Red:S:1;');
  assert.equal(r.errors.length, 0);
  assert.equal(r.cells.length, 1);
});

console.log('\nVariant packing — malformed input is reported, not guessed');

t('a two-part entry is rejected', () => {
  const r = parseVariants('Red:10');
  assert.equal(r.cells.length, 0);
  assert.match(r.errors[0], /not colour:size:qty/);
});
t('an entry with neither axis is rejected', () => {
  assert.match(parseVariants('::5').errors[0], /neither a colour nor a size/);
});
t('a non-numeric quantity is rejected', () => {
  assert.match(parseVariants('Red:S:many').errors[0], /invalid quantity/);
});
t('a negative quantity is rejected', () => {
  assert.match(parseVariants('Red:S:-3').errors[0], /invalid quantity/);
});
t('a fractional quantity is rejected — you cannot stock 2.5 shoes', () => {
  assert.match(parseVariants('Red:S:2.5').errors[0], /invalid quantity/);
});
t('a blank quantity is rejected rather than defaulting to 0', () => {
  assert.match(parseVariants('Red:S:').errors[0], /invalid quantity/);
});
t('a duplicate colour/size pair is rejected', () => {
  // Two cells with the same key would make the sale-time lookup ambiguous.
  const r = parseVariants('Red:S:5; Red:S:3');
  assert.equal(r.cells.length, 1);
  assert.match(r.errors[0], /duplicate variant/i);
});
t('valid entries alongside an invalid one are still parsed', () => {
  const r = parseVariants('Red:S:5; garbage; Blue:M:2');
  assert.equal(r.cells.length, 2);
  assert.equal(r.errors.length, 1);
});

console.log('\nRow projection — derived values');

const P = {
  name: 'Shoe', category: 'Footwear', price: 1000, costPrice: 600,
  discount: 10, stock: 5, unit: 'pcs', lowStockThreshold: 3,
};

t('finalPrice applies the discount percent', () => {
  assert.equal(productToRow(P).finalPrice, 900);
});
t('profitPerUnit is finalPrice minus cost', () => {
  assert.equal(productToRow(P).profitPerUnit, 300);
});
t('marginPercent is profit over the SELLING price', () => {
  // Matches the model's profitMargin virtual: 300/900 = 33.33%.
  assert.equal(productToRow(P).marginPercent, 33.33);
});
t('stockValue is cost times stock', () => {
  assert.equal(productToRow(P).stockValue, 3000);
});
t('a zero price yields a blank margin, not Infinity or NaN', () => {
  const r = productToRow({ ...P, price: 0, discount: 0 });
  assert.equal(r.marginPercent, '');
});
t('missing numbers become 0, never the string "undefined"', () => {
  const r = productToRow({ name: 'X', category: 'Y' });
  assert.strictEqual(r.price, 0);
  assert.strictEqual(r.costPrice, 0);
  assert.strictEqual(r.stock, 0);
  assert.strictEqual(r.finalPrice, 0);
});
t('an unset gstRate exports BLANK, not 0', () => {
  // 0 would re-import as "genuinely zero-rated" and permanently override the
  // shop default for every product that had simply never been configured.
  assert.strictEqual(productToRow({ name: 'X', category: 'Y', gstRate: null }).gstRate, '');
  assert.strictEqual(productToRow({ name: 'X', category: 'Y' }).gstRate, '');
});
t('an explicit gstRate of 0 is preserved as 0', () => {
  assert.strictEqual(productToRow({ name: 'X', category: 'Y', gstRate: 0 }).gstRate, 0);
});
t('lowStockThreshold defaults to 10 but keeps an explicit 0', () => {
  assert.strictEqual(productToRow({ name: 'X', category: 'Y' }).lowStockThreshold, 10);
  assert.strictEqual(productToRow({ name: 'X', category: 'Y', lowStockThreshold: 0 }).lowStockThreshold, 0);
});
t('variantStock is projected into the packed column', () => {
  const r = productToRow({ ...P, variantStock: [{ color: 'Red', size: 'S', stock: 5 }] });
  assert.equal(r.variants, 'Red:S:5');
});
t('every column key is present on a projected row', () => {
  // A missing key becomes an empty cell silently; assert the shape instead.
  const r = productToRow(P);
  for (const c of COLUMNS) assert.ok(c.key in r, `row is missing ${c.key}`);
});

console.log('\nClient mirror drift guard');

/**
 * The import dialog shows the owner which columns the file needs. It cannot
 * require server code, so it keeps a mirror in
 * client/src/constants/importSchema.js. That text had ALREADY gone stale once —
 * it still listed the original 12 columns after brand/gstRate/variants were
 * added, so the product was telling owners the wrong format.
 *
 * This reads the client mirror and asserts it matches the real importer, so
 * adding a column server-side without updating the dialog fails the build.
 * Same approach as the pricing.js / variantMatrix.js mirror guards.
 */
const CLIENT_MIRROR = require('node:path').join(
  __dirname, '..', '..', '..', '..', 'client', 'src', 'constants', 'importSchema.js'
);

t('the client mirror file exists where the dialog imports it from', () => {
  assert.ok(require('node:fs').existsSync(CLIENT_MIRROR), CLIENT_MIRROR);
});

t('client REQUIRED_COLS matches the importer exactly', () => {
  const src = require('node:fs').readFileSync(CLIENT_MIRROR, 'utf8');
  const mod = {};
  // Strip ESM `export` so the file can be evaluated as CommonJS here.
  new Function('exports', src.replace(/export const/g, 'exports.'))(mod);
  assert.deepEqual(
    [...mod.REQUIRED_COLS].sort(),
    [...REQUIRED_KEYS].sort(),
    'the import dialog lists different required columns from the importer'
  );
});

t('client OPTIONAL_COLS matches the importer exactly', () => {
  const src = require('node:fs').readFileSync(CLIENT_MIRROR, 'utf8');
  const mod = {};
  new Function('exports', src.replace(/export const/g, 'exports.'))(mod);
  const serverOptional = IMPORT_COLUMNS.filter((c) => !c.required).map((c) => c.key);
  assert.deepEqual(
    [...mod.OPTIONAL_COLS].sort(),
    [...serverOptional].sort(),
    'the import dialog lists different optional columns from the importer'
  );
});

t('every column the dialog mentions is actually importable', () => {
  const src = require('node:fs').readFileSync(CLIENT_MIRROR, 'utf8');
  const mod = {};
  new Function('exports', src.replace(/export const/g, 'exports.'))(mod);
  const importable = new Set(IMPORT_COLUMNS.map((c) => c.key));
  for (const key of [...mod.REQUIRED_COLS, ...mod.OPTIONAL_COLS, ...Object.keys(mod.COLUMN_NOTES)]) {
    assert.ok(importable.has(key), `dialog mentions "${key}", which the importer ignores`);
  }
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
