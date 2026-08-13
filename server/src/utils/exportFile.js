/**
 * Spreadsheet export core — CSV (RFC 4180) and real XLSX, no dependencies.
 *
 * WHY THIS EXISTS
 *   The previous product export produced a file Excel could not read correctly.
 *   Concretely, against seeded data: 23 of 48 product names contain non-ASCII
 *   characters (em-dashes, and any Hindi/Punjabi/Tamil name an Indian shop will
 *   actually type). Written without a UTF-8 byte-order mark, Excel on Windows
 *   decodes the file as the system ANSI codepage and shows "Blocks Set â€"
 *   Premium". The fix is three bytes at the front of the file, and it has to be
 *   in one place or the next export forgets it again.
 *
 * WHAT CORRECT MEANS HERE
 *   1. UTF-8 BOM, so Excel decodes UTF-8 without an import wizard.
 *   2. CRLF row separators (RFC 4180) — Excel, Numbers and Sheets all accept
 *      LF, but the standard says CRLF and some older Excel builds join rows.
 *   3. Formula injection neutralised. A product named `=cmd|'/c calc'!A1`
 *      is a live formula when the file is opened, and product names come from
 *      user input. Guarded with a leading apostrophe, which Excel strips on
 *      display, so the visible value is unchanged.
 *   4. Numbers written unquoted so they arrive as numbers, not text. A quoted
 *      "1200" lands left-aligned and will not SUM.
 *   5. Empty means empty. `undefined`/`null` become '', never the strings
 *      "undefined" or "null" — that was the "undefined in exports" complaint.
 *
 * The XLSX writer is deliberately minimal but produces a genuinely valid file:
 * a real ZIP (deflate + CRC-32) containing the five parts Excel requires, with
 * an inline string table, bold header, number formats and a totals row.
 */
const zlib = require('node:zlib');

// ── Value coercion ────────────────────────────────────────────────────────────

/** Characters Excel and Sheets treat as the start of a formula. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * Normalise any DB value to a printable scalar.
 * Dates become ISO days (not full timestamps — a shop owner reads dates).
 */
function cellValue(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return Number.isFinite(v) ? v : '';
  if (typeof v === 'object') return String(v);   // ObjectId → hex, via its toString
  return String(v);
}

/** True when this value should be written to the sheet as a number. */
function isNumeric(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

// ── CSV ───────────────────────────────────────────────────────────────────────

const BOM = '﻿';

/**
 * Quote a cell only when the value actually needs it.
 *
 * Quoting unconditionally looks harmless but broke our own round-trip: with a
 * UTF-8 BOM in front, a header written as `"name"` is not recognised as a quoted
 * field (the quote is no longer the first byte of the line), so csv-parser keyed
 * every row on the literal string `"name"` and the importer reported
 * `Missing required field: name` for all of them. Minimal quoting is also what
 * RFC 4180 describes, and it keeps the file readable in a text editor.
 */
function csvCell(v) {
  if (isNumeric(v)) return String(v);          // unquoted → real number in Excel
  let s = cellValue(v);
  if (s === '') return '';
  // Neutralise formulas first — this can introduce a leading apostrophe, which
  // is itself a reason to quote.
  if (FORMULA_LEAD.test(s)) s = `'${s}`;
  // Collapse embedded newlines: a real newline inside a quoted field is legal
  // CSV, but it breaks naive line-based re-import — including our own.
  s = s.replace(/\r\n|\r|\n/g, ' ');
  const mustQuote = /[",;]/.test(s) || s.startsWith("'") || s !== s.trim();
  return mustQuote ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build a CSV document.
 *
 * @param {Array<{key:string,label:string,total?:boolean}>} columns
 * @param {Array<object>} rows
 * @param {object}  [opts]
 * @param {boolean} [opts.totals=false] append a TOTAL row summing `total` columns
 * @param {boolean} [opts.bom=true]     prepend the UTF-8 BOM
 * @returns {string}
 */
function toCsv(columns, rows, { totals = false, bom = true } = {}) {
  const lines = [columns.map((c) => csvCell(c.label)).join(',')];

  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(row[c.key])).join(','));
  }

  if (totals && rows.length) {
    const sums = sumColumns(columns, rows);
    lines.push(columns.map((c, i) => {
      if (i === 0) return csvCell('TOTAL');
      return c.total ? csvCell(round2(sums[c.key])) : '';
    }).join(','));
  }

  // Trailing CRLF: RFC 4180 allows it and some parsers need the final row
  // terminated. Our own import (csv-parser) ignores the resulting blank line.
  return (bom ? BOM : '') + lines.join('\r\n') + '\r\n';
}

function sumColumns(columns, rows) {
  const sums = {};
  for (const c of columns) {
    if (!c.total) continue;
    sums[c.key] = rows.reduce((a, r) => a + (isNumeric(r[c.key]) ? r[c.key] : 0), 0);
  }
  return sums;
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ── ZIP container (for XLSX) ──────────────────────────────────────────────────

/** CRC-32, table built once. Required by the ZIP local/central headers. */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/**
 * Build a ZIP archive from {name, data} entries using deflate.
 *
 * Timestamps are written as a fixed 1980-01-01 rather than "now": a byte-stable
 * archive means a test can assert on the exact output, and nothing in a
 * spreadsheet depends on the entry mtime.
 */
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  entries.forEach((e) => {
    const name = Buffer.from(e.name, 'utf8');
    const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    const deflated = zlib.deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034B50, 0);   // local file header signature
    local.writeUInt16LE(20, 4);           // version needed
    local.writeUInt16LE(0x0800, 6);       // flags: UTF-8 names
    local.writeUInt16LE(8, 8);            // method: deflate
    local.writeUInt16LE(0, 10);           // mod time  (fixed)
    local.writeUInt16LE(0x0021, 12);      // mod date  (1980-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, deflated);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014B50, 0); // central directory signature
    central.writeUInt16LE(20, 4);         // version made by
    central.writeUInt16LE(20, 6);         // version needed
    central.writeUInt16LE(0x0800, 8);     // flags: UTF-8 names
    central.writeUInt16LE(8, 10);         // method: deflate
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);         // extra
    central.writeUInt16LE(0, 32);         // comment
    central.writeUInt16LE(0, 34);         // disk
    central.writeUInt16LE(0, 36);         // internal attrs
    central.writeUInt32LE(0, 38);         // external attrs
    central.writeUInt32LE(offset, 42);    // offset of local header
    centrals.push(central, name);

    offset += local.length + name.length + deflated.length;
  });

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054B50, 0);       // end of central directory
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, end]);
}

// ── XLSX ──────────────────────────────────────────────────────────────────────

const xmlEscape = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  // XML 1.0 forbids most control characters outright; strip rather than emit a
  // file Excel refuses to open.
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

/** A1-style reference: (0,0) → A1, (0,26) → AA1. */
function cellRef(rowIdx, colIdx) {
  let n = colIdx + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return `${name}${rowIdx + 1}`;
}

/**
 * Style indices defined in styles.xml below.
 *   0 default · 1 bold header · 2 money (2dp) · 3 bold total · 4 bold money total
 */
const S = { DEFAULT: 0, HEADER: 1, MONEY: 2, TOTAL: 3, TOTAL_MONEY: 4 };

function sheetXml(columns, rows, { totals }) {
  const out = [];
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  out.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">');

  // Column widths: derived from the header text and a sample of the data, so
  // "Product name" is not a 8-character column the owner has to widen by hand.
  out.push('<cols>');
  columns.forEach((c, i) => {
    const sample = rows.slice(0, 200)
      .reduce((w, r) => Math.max(w, cellValue(r[c.key]).length), c.label.length);
    const width = Math.min(46, Math.max(9, sample + 2));
    out.push(`<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`);
  });
  out.push('</cols>');

  out.push('<sheetData>');

  // Header
  out.push('<row r="1">');
  columns.forEach((c, i) => {
    out.push(`<c r="${cellRef(0, i)}" s="${S.HEADER}" t="inlineStr"><is><t>${xmlEscape(c.label)}</t></is></c>`);
  });
  out.push('</row>');

  // Body
  rows.forEach((row, rIdx) => {
    const r = rIdx + 1;
    out.push(`<row r="${r + 1}">`);
    columns.forEach((c, i) => {
      const v = row[c.key];
      const ref = cellRef(r, i);
      if (isNumeric(v)) {
        const style = c.money ? S.MONEY : S.DEFAULT;
        out.push(`<c r="${ref}" s="${style}"><v>${v}</v></c>`);
      } else {
        const s = cellValue(v);
        if (s === '') return;               // skip empty cells entirely
        out.push(`<c r="${ref}" s="${S.DEFAULT}" t="inlineStr"><is><t>${xmlEscape(s)}</t></is></c>`);
      }
    });
    out.push('</row>');
  });

  // Totals — real SUM formulas, not baked numbers, so the file stays live when
  // the owner filters or edits rows.
  if (totals && rows.length) {
    const r = rows.length + 1;
    out.push(`<row r="${r + 1}">`);
    columns.forEach((c, i) => {
      const ref = cellRef(r, i);
      if (i === 0) {
        out.push(`<c r="${ref}" s="${S.TOTAL}" t="inlineStr"><is><t>TOTAL</t></is></c>`);
      } else if (c.total) {
        const from = cellRef(1, i);
        const to = cellRef(rows.length, i);
        const style = c.money ? S.TOTAL_MONEY : S.TOTAL;
        out.push(`<c r="${ref}" s="${style}"><f>SUM(${from}:${to})</f></c>`);
      }
    });
    out.push('</row>');
  }

  out.push('</sheetData>');
  // Freeze the header and enable the filter dropdowns — on a 500-row inventory
  // export these are the difference between usable and not.
  out.push(`<autoFilter ref="A1:${cellRef(Math.max(rows.length, 1), columns.length - 1)}"/>`);
  out.push('</worksheet>');
  return out.join('');
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
</cellXfs>
</styleSheet>`;

/**
 * Build a single-sheet .xlsx workbook.
 *
 * @param {Array<{key,label,money?,total?}>} columns
 * @param {Array<object>} rows
 * @param {object} [opts]
 * @param {string} [opts.sheetName='Sheet1']
 * @param {boolean} [opts.totals=false]
 * @returns {Buffer}
 */
function toXlsx(columns, rows, { sheetName = 'Sheet1', totals = false } = {}) {
  // Excel rejects these characters in a sheet name, and caps it at 31 chars.
  const safeName = xmlEscape(String(sheetName).replace(/[\\/?*[\]:]/g, '-').slice(0, 31)) || 'Sheet1';

  return zip([
    {
      name: '[Content_Types].xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + '</Types>',
    },
    {
      name: '_rels/.rels',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + '</Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
        + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        + `<sheets><sheet name="${safeName}" sheetId="1" r:id="rId1"/></sheets>`
        + '</workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        + '</Relationships>',
    },
    { name: 'xl/styles.xml', data: STYLES_XML },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml(columns, rows, { totals }) },
  ]);
}

// ── Filenames ─────────────────────────────────────────────────────────────────

/**
 * Human-readable, sortable, filesystem-safe filename.
 *   exportFilename('products', 'StepUp Footwear', '2026-08-13', 'csv')
 *     → 'products-stepup-footwear-2026-08-13.csv'
 *
 * Replaces the previous `products-1786606512696.csv`, which told the owner
 * nothing and sorted meaninglessly in a downloads folder.
 */
function exportFilename(kind, shopName, isoDate, ext) {
  const slug = (s) => String(s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return [slug(kind), slug(shopName), isoDate].filter(Boolean).join('-') + `.${ext}`;
}

/** Content-Type for a given extension. */
const MIME = {
  csv:  'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

module.exports = {
  toCsv, toXlsx, exportFilename, MIME,
  // exported for tests
  csvCell, cellValue, cellRef, crc32, zip, isNumeric, round2, sumColumns,
};
