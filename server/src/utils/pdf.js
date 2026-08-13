/**
 * Minimal PDF writer — enough to render an invoice, with no dependencies.
 *
 * WHY HAND-ROLLED
 *   The app had no PDF capability at all: invoices went through the browser's
 *   print dialog, which is fine at the counter but gives you nothing to attach to
 *   an email or hand to an accountant. A PDF is a plain, well-documented format
 *   and the subset needed for a text-and-lines invoice is small, so this avoids
 *   adding a heavyweight dependency (and a native build step) to the server.
 *
 * WHAT IT SUPPORTS
 *   A4 pages, the three built-in Helvetica faces (no font embedding needed, so no
 *   binary assets), left/right/centre text, horizontal rules, and filled boxes.
 *   That covers an invoice. It is not a general-purpose PDF library and does not
 *   pretend to be — no images, no wrapping beyond what the caller asks for.
 *
 * ENCODING NOTE
 *   The built-in fonts use WinAnsi, which has no rupee sign (₹) and no Devanagari.
 *   Emitting those bytes raw produces mojibake in a viewer, so `latin1Safe`
 *   transliterates what it can ("₹" → "Rs.") and drops the rest rather than
 *   writing a file that renders as garbage. A future version wanting true ₹ and
 *   Indic text has to embed a TrueType font, which is a much larger job.
 */

const PAGE = { width: 595.28, height: 841.89 };   // A4 in points
const MARGIN = 40;

/** Widths (per 1000 units) for Helvetica — needed for right-align and centring. */
const HELV_WIDTHS = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  0: 556, 1: 556, 2: 556, 3: 556, 4: 556, 5: 556, 6: 556, 7: 556, 8: 556, 9: 556,
  ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500,
  K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611,
  U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
  u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584,
};

/** Approximate width of a string at a given size, in points. */
function textWidth(str, size, bold = false) {
  let w = 0;
  for (const ch of String(str)) w += HELV_WIDTHS[ch] ?? 556;
  // Bold Helvetica is slightly wider; 3% is close enough for layout purposes.
  return (w / 1000) * size * (bold ? 1.03 : 1);
}

/**
 * Make a string safe for the WinAnsi built-in fonts.
 * Transliterates the characters an Indian invoice actually hits, then strips the
 * rest — a dropped glyph is better than a mojibake page.
 */
function latin1Safe(str) {
  return String(str ?? '')
    .replace(/₹/g, 'Rs.')
    .replace(/[—–]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

/** Escape the characters that terminate a PDF string literal. */
const pdfEscape = (s) => latin1Safe(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/**
 * A single-page PDF builder with a downward-flowing cursor.
 *
 * Coordinates are exposed top-down (y grows downward, like every other layout
 * system) and converted to PDF's bottom-up space on write, because doing that
 * arithmetic at every call site is how off-by-a-page bugs happen.
 */
class PdfDoc {
  constructor() {
    this.ops = [];
    this.y = MARGIN;
    this.width = PAGE.width;
    this.contentWidth = PAGE.width - MARGIN * 2;
  }

  /** Convert a top-down y to PDF user space. */
  _y(y) { return PAGE.height - y; }

  /**
   * Draw text.
   * @param {string} text
   * @param {object} [opt] {x, y, size, bold, align:'left'|'right'|'center', gray}
   */
  text(text, opt = {}) {
    const size = opt.size ?? 10;
    const bold = !!opt.bold;
    const font = bold ? '/F2' : '/F1';
    const str = pdfEscape(text);
    if (!str) return this;

    let x = opt.x ?? MARGIN;
    if (opt.align === 'right') {
      x = (opt.x ?? PAGE.width - MARGIN) - textWidth(latin1Safe(text), size, bold);
    } else if (opt.align === 'center') {
      x = (opt.x ?? PAGE.width / 2) - textWidth(latin1Safe(text), size, bold) / 2;
    }
    const y = this._y(opt.y ?? this.y);
    const g = opt.gray ?? 0;

    this.ops.push(`BT ${g} g ${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${str}) Tj ET`);
    return this;
  }

  /** Move the cursor down. */
  move(dy) { this.y += dy; return this; }

  /** Horizontal rule across the content width. */
  rule(opt = {}) {
    const y = this._y(opt.y ?? this.y);
    const g = opt.gray ?? 0.75;
    const w = opt.lineWidth ?? 0.6;
    this.ops.push(
      `${g} G ${w} w ${(opt.x1 ?? MARGIN).toFixed(2)} ${y.toFixed(2)} m `
      + `${(opt.x2 ?? PAGE.width - MARGIN).toFixed(2)} ${y.toFixed(2)} l S`
    );
    return this;
  }

  /** Filled rectangle — used for the header band and table stripes. */
  box(x, y, w, h, gray = 0.94) {
    this.ops.push(`${gray} g ${x.toFixed(2)} ${this._y(y + h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    return this;
  }

  /**
   * Serialise to a PDF buffer.
   *
   * Builds the 5 required objects and a correct xref table. Byte offsets must be
   * exact — a viewer that cannot parse the xref refuses the file outright, so the
   * offsets are measured from the assembled buffer rather than predicted.
   */
  build() {
    const content = this.ops.join('\n');
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] `
        + '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((body, i) => {
      offsets.push(Buffer.byteLength(pdf, 'latin1'));
      pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xrefStart = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
         + `startxref\n${xrefStart}\n%%EOF\n`;

    // latin1 so each byte written is the byte intended — the fonts are WinAnsi.
    return Buffer.from(pdf, 'latin1');
  }
}

module.exports = { PdfDoc, PAGE, MARGIN, textWidth, latin1Safe, pdfEscape };
