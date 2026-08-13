/**
 * Export-core tests — plain Node, no test framework needed.
 *   node src/utils/exportFile.test.js
 *
 * These exist because the previous export was silently unreadable in Excel. The
 * bugs were not crashes — the endpoint returned 200 and a plausible-looking
 * file — so only assertions on the actual bytes catch a regression here.
 *
 * The XLSX half is hand-rolled ZIP writing, so it is verified by inflating the
 * archive back and checking every part, and separately (in the verification
 * script) by handing the file to PowerShell's Expand-Archive — an unzipper that
 * shares nothing with this code.
 */
const assert = require('node:assert');
const zlib = require('node:zlib');
const {
  toCsv, toXlsx, exportFilename, MIME, csvCell, cellValue, cellRef, crc32, isNumeric, sumColumns,
} = require('./exportFile');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
  catch (e) { fail += 1; console.error(`  ✗ ${name}\n      ${e.message}`); }
};

const COLS = [
  { key: 'name',  label: 'Product' },
  { key: 'qty',   label: 'Stock',  total: true },
  { key: 'price', label: 'Price',  total: true, money: true },
];

console.log('\nValue coercion — the "undefined in exports" complaint');

t('undefined becomes empty, not the string "undefined"', () => {
  assert.equal(cellValue(undefined), '');
  assert.equal(csvCell(undefined), '');
});
t('null becomes empty, not the string "null"', () => {
  assert.equal(cellValue(null), '');
  assert.equal(csvCell(null), '');
});
t('NaN and Infinity become empty, not "NaN"', () => {
  assert.equal(cellValue(NaN), '');
  assert.equal(cellValue(Infinity), '');
});
t('zero is preserved — it is a real stock level, not missing', () => {
  assert.equal(csvCell(0), '0');
});
t('false is preserved as No, not dropped', () => {
  assert.equal(cellValue(false), 'No');
});
t('a Date becomes an ISO day, not a full timestamp', () => {
  assert.equal(cellValue(new Date('2026-08-13T10:22:33Z')), '2026-08-13');
});
t('an invalid Date becomes empty', () => {
  assert.equal(cellValue(new Date('nonsense')), '');
});
t('an ObjectId-like object uses its toString', () => {
  assert.equal(cellValue({ toString: () => 'abc123' }), 'abc123');
});

console.log('\nCSV — Excel compatibility');

t('output starts with the UTF-8 BOM', () => {
  // Without this, Excel on Windows shows "Blocks Set â€" Premium" for the 23
  // seeded products whose names contain an em-dash.
  const csv = toCsv(COLS, [{ name: 'Blocks — Premium', qty: 1, price: 2 }]);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
});
t('the BOM can be suppressed for machine consumers', () => {
  const csv = toCsv(COLS, [], { bom: false });
  assert.notEqual(csv.charCodeAt(0), 0xFEFF);
});
t('rows are CRLF-terminated per RFC 4180', () => {
  const csv = toCsv(COLS, [{ name: 'A', qty: 1, price: 2 }], { bom: false });
  assert.ok(csv.includes('\r\n'), 'no CRLF found');
  assert.equal(/[^\r]\n/.test(csv), false, 'found a bare LF');
});
t('non-ASCII text survives intact', () => {
  const csv = toCsv(COLS, [{ name: 'कुर्ता — ₹500', qty: 1, price: 2 }]);
  assert.ok(csv.includes('कुर्ता — ₹500'));
});
t('numbers are unquoted so Excel treats them as numbers', () => {
  const csv = toCsv(COLS, [{ name: 'A', qty: 12, price: 1200.5 }], { bom: false });
  assert.ok(csv.includes(',12,1200.5'), csv);
});
t('quotes inside text are doubled', () => {
  assert.equal(csvCell('9" pipe'), '"9"" pipe"');
});
t('commas inside text do not break the row', () => {
  const csv = toCsv(COLS, [{ name: 'Shoes, Black', qty: 1, price: 2 }], { bom: false });
  assert.equal(csv.split('\r\n')[1], '"Shoes, Black",1,2');
});
t('embedded newlines are flattened, keeping one row per record', () => {
  // A literal newline in a quoted field is legal CSV but breaks line-based
  // re-import, including our own importer.
  const csv = toCsv(COLS, [{ name: 'Line1\nLine2', qty: 1, price: 2 }], { bom: false });
  assert.equal(csv.trim().split('\r\n').length, 2, 'record split across rows');
  assert.ok(csv.includes('Line1 Line2'), csv);
});
t('plain values are NOT quoted — quoting headers broke our own re-import', () => {
  // With a BOM in front, a quoted first header stops being recognised as quoted,
  // so csv-parser keyed every row on the literal '"name"' and the importer
  // reported `Missing required field: name` for all of them.
  const csv = toCsv(COLS, [{ name: 'Sandal', qty: 1, price: 2 }]);
  assert.ok(csv.startsWith('﻿Product,Stock,Price\r\n'), JSON.stringify(csv.slice(0, 40)));
});
t('a value that needs quoting still gets it', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell(' padded '), '" padded "');
});

console.log('\nCSV — formula injection');

t('a leading = is neutralised', () => {
  // Product names are user input, and this one runs on open.
  // Only double quotes are doubled by CSV quoting; the single quotes are literal.
  assert.equal(csvCell('=cmd|\'/c calc\'!A1'), '"\'=cmd|\'/c calc\'!A1"');
});
t('leading +, -, @ and tab are neutralised', () => {
  for (const lead of ['+', '-', '@', '\t']) {
    assert.ok(csvCell(`${lead}SUM(A1)`).startsWith('"\''), `${lead} not guarded`);
  }
});
t('a negative NUMBER is not mangled by the - guard', () => {
  // The guard is for strings only; -50 must stay a usable number.
  assert.equal(csvCell(-50), '-50');
});
t('an inner = is left alone (and needs no quoting)', () => {
  assert.equal(csvCell('Size=10'), 'Size=10');
});

console.log('\nCSV — totals');

t('a TOTAL row sums only the flagged columns', () => {
  const rows = [{ name: 'A', qty: 2, price: 10.5 }, { name: 'B', qty: 3, price: 4.25 }];
  const last = toCsv(COLS, rows, { totals: true, bom: false }).trim().split('\r\n').pop();
  assert.equal(last, 'TOTAL,5,14.75');
});
t('non-numeric values are ignored by the sum, not coerced', () => {
  const rows = [{ name: 'A', qty: 2, price: 10 }, { name: 'B', qty: 'n/a', price: null }];
  assert.deepEqual(sumColumns(COLS, rows), { qty: 2, price: 10 });
});
t('float sums are rounded to 2dp, not 0.30000000000000004', () => {
  const rows = [{ name: 'A', qty: 0, price: 0.1 }, { name: 'B', qty: 0, price: 0.2 }];
  const last = toCsv(COLS, rows, { totals: true, bom: false }).trim().split('\r\n').pop();
  assert.ok(last.endsWith(',0.3'), last);
});
t('no TOTAL row is emitted for an empty export', () => {
  const csv = toCsv(COLS, [], { totals: true, bom: false });
  assert.equal(csv.trim().split('\r\n').length, 1, 'expected header only');
});
t('an empty export still has a header row — never a 0-byte file', () => {
  const csv = toCsv(COLS, []);
  assert.ok(csv.includes('Product'));
});

console.log('\nA1 references');

t('column indices map to A, Z, AA, AB', () => {
  assert.equal(cellRef(0, 0), 'A1');
  assert.equal(cellRef(4, 25), 'Z5');
  assert.equal(cellRef(0, 26), 'AA1');
  assert.equal(cellRef(0, 27), 'AB1');
});

console.log('\nCRC-32 (ZIP integrity)');

t('matches known vectors', () => {
  // Wrong CRCs produce an archive Excel silently refuses to open.
  assert.equal(crc32(Buffer.from('')), 0);
  assert.equal(crc32(Buffer.from('123456789')), 0xCBF43926);
  assert.equal(crc32(Buffer.from('The quick brown fox jumps over the lazy dog')), 0x414FA339);
});

console.log('\nXLSX — is it a real, readable workbook?');

/** Minimal independent ZIP reader: walks the central directory. */
function readZip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4B, 0x05, 0x06]));
  assert.notEqual(eocd, -1, 'no end-of-central-directory record');
  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i += 1) {
    assert.equal(buf.readUInt32LE(ptr), 0x02014B50, 'bad central header');
    const crcExpected = buf.readUInt32LE(ptr + 16);
    const compSize = buf.readUInt32LE(ptr + 20);
    const rawSize = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOff = buf.readUInt32LE(ptr + 42);
    const name = buf.slice(ptr + 46, ptr + 46 + nameLen).toString('utf8');

    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = buf.slice(dataStart, dataStart + compSize);
    const raw = zlib.inflateRawSync(comp);

    assert.equal(raw.length, rawSize, `${name}: size mismatch`);
    assert.equal(crc32(raw), crcExpected, `${name}: CRC mismatch`);
    files[name] = raw.toString('utf8');
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const XROWS = [
  { name: 'Running Shoe — Blue', qty: 12, price: 2499.5 },
  { name: 'Sandal', qty: 3, price: 799 },
];
const book = toXlsx(COLS, XROWS, { sheetName: 'Inventory', totals: true });

t('output is a Buffer beginning with the PK signature', () => {
  assert.ok(Buffer.isBuffer(book));
  assert.equal(book.slice(0, 2).toString(), 'PK');
});
t('every part inflates with a matching CRC and length', () => {
  readZip(book);   // asserts internally
});
t('contains exactly the parts Excel requires', () => {
  const files = readZip(book);
  for (const p of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) {
    assert.ok(files[p], `missing ${p}`);
  }
});
t('every part is well-formed XML with balanced roots', () => {
  const files = readZip(book);
  for (const [name, xml] of Object.entries(files)) {
    assert.ok(xml.startsWith('<?xml'), `${name}: no XML declaration`);
    const root = xml.match(/<([A-Za-z_][\w:.-]*)/g);
    assert.ok(root && root.length > 1, `${name}: no elements`);
    // Every opened tag must be closed: count < and matching >.
    assert.equal((xml.match(/</g) || []).length, (xml.match(/>/g) || []).length,
      `${name}: unbalanced angle brackets`);
  }
});
t('the sheet carries the real data', () => {
  const sheet = readZip(book)['xl/worksheets/sheet1.xml'];
  assert.ok(sheet.includes('Running Shoe — Blue'), 'product name missing');
  assert.ok(sheet.includes('<v>2499.5</v>'), 'price missing');
  assert.ok(sheet.includes('<v>12</v>'), 'stock missing');
});
t('numbers are numeric cells, text is inlineStr', () => {
  const sheet = readZip(book)['xl/worksheets/sheet1.xml'];
  assert.ok(/<c r="B2" s="0"><v>12<\/v><\/c>/.test(sheet), 'stock is not a numeric cell');
  assert.ok(/<c r="A2"[^>]*t="inlineStr"/.test(sheet), 'name is not an inline string');
});
t('the totals row uses live SUM formulas, not baked values', () => {
  const sheet = readZip(book)['xl/worksheets/sheet1.xml'];
  assert.ok(sheet.includes('<f>SUM(B2:B3)</f>'), 'no SUM for stock');
  assert.ok(sheet.includes('<f>SUM(C2:C3)</f>'), 'no SUM for price');
});
t('XML metacharacters in data are escaped, not emitted raw', () => {
  const b = toXlsx(COLS, [{ name: 'A & B <script> "x"', qty: 1, price: 1 }]);
  const sheet = readZip(b)['xl/worksheets/sheet1.xml'];
  assert.ok(sheet.includes('A &amp; B &lt;script&gt;'), 'not escaped');
  assert.equal(sheet.includes('<script>'), false);
});
t('control characters are stripped rather than breaking the file', () => {
  const b = toXlsx(COLS, [{ name: `bad\x07char`, qty: 1, price: 1 }]);
  const sheet = readZip(b)['xl/worksheets/sheet1.xml'];
  assert.equal(sheet.includes('\x07'), false);
  assert.ok(sheet.includes('badchar'));
});
t('an illegal sheet name is sanitised and truncated to 31 chars', () => {
  const b = toXlsx(COLS, [], { sheetName: 'a/b\\c?d*e[f]g:h' + 'x'.repeat(40) });
  const wb = readZip(b)['xl/workbook.xml'];
  const nm = wb.match(/name="([^"]*)"/)[1];
  assert.ok(nm.length <= 31, `name too long: ${nm.length}`);
  assert.equal(/[\\/?*[\]:]/.test(nm), false, `illegal chars remain: ${nm}`);
});
t('an empty dataset still produces a valid openable workbook', () => {
  const b = toXlsx(COLS, [], { totals: true });
  const files = readZip(b);
  assert.ok(files['xl/worksheets/sheet1.xml'].includes('Product'));
  assert.equal(files['xl/worksheets/sheet1.xml'].includes('SUM('), false);
});
t('a 1000-row export stays well-formed', () => {
  const many = Array.from({ length: 1000 }, (_, i) => ({ name: `P${i}`, qty: i, price: i * 1.5 }));
  const files = readZip(toXlsx(COLS, many, { totals: true }));
  assert.ok(files['xl/worksheets/sheet1.xml'].includes('<f>SUM(B2:B1001)</f>'));
});

console.log('\nFilenames');

t('filename is descriptive, slugged and dated', () => {
  assert.equal(exportFilename('products', 'StepUp Footwear', '2026-08-13', 'csv'),
    'products-stepup-footwear-2026-08-13.csv');
});
t('unsafe characters never reach the filesystem', () => {
  const f = exportFilename('products', 'A/B\\C:*?"<>|', '2026-08-13', 'xlsx');
  assert.equal(/[/\\:*?"<>|]/.test(f), false, f);
});
t('a missing shop name degrades gracefully', () => {
  assert.equal(exportFilename('products', '', '2026-08-13', 'csv'), 'products-2026-08-13.csv');
});
t('MIME types are correct for both formats', () => {
  assert.ok(MIME.csv.includes('charset=utf-8'));
  assert.equal(MIME.xlsx,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
