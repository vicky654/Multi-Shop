/**
 * The product spreadsheet contract — ONE definition shared by export, import and
 * the downloadable sample file.
 *
 * WHY IT IS ONE MODULE
 *   These three used to be written independently, and the export drifted: it
 *   emitted 12 columns while the product model had grown `brand`, `gstRate` and
 *   the variant matrix. So exporting a variant product and re-importing it
 *   silently flattened every colour/size cell into one number. A sample file
 *   maintained separately would drift the same way within a release.
 *
 *   Here, `COLUMNS` is the single source of truth. `importable: true` marks the
 *   columns the importer accepts; anything else is a derived, read-only column
 *   (profit, margin) that is useful in Excel and ignored on the way back in.
 *   A test asserts the sample file round-trips, so drift breaks the build.
 *
 * VARIANT PACKING
 *   A variant product has a colour × size matrix. Repeating a product across
 *   many rows would break the "one row per product" shape the owner sees in the
 *   product list, so the matrix travels in a single `variants` cell:
 *
 *     Red:S:10; Red:M:5; Blue:S:8
 *
 *   colour : size : quantity, semicolon-separated. Either axis may be blank
 *   (`:S:10` is size-only, `Red::4` is colour-only) because the matrix
 *   legitimately supports one-axis products. This is parsed back by
 *   `parseVariants` and fed through the same normaliser the wizard uses, so the
 *   `stock === sum(variantStock)` invariant is enforced on import too.
 */

/**
 * @typedef {object} Column
 * @property {string}  key        product field / computed key
 * @property {string}  label      spreadsheet header text
 * @property {boolean} [importable] accepted by the importer
 * @property {boolean} [required]   importer rejects the row without it
 * @property {boolean} [money]      format as currency in XLSX
 * @property {boolean} [total]      include in the TOTAL row
 * @property {string}  [help]       shown in the sample file's guidance sheet
 */

/** @type {Column[]} */
const COLUMNS = [
  { key: 'name',              label: 'name',              importable: true, required: true,
    help: 'Product name. Required.' },
  { key: 'category',          label: 'category',          importable: true, required: true,
    help: 'Top-level category, e.g. Footwear. Required.' },
  { key: 'subCategory',       label: 'subCategory',       importable: true,
    help: 'Optional sub-category, e.g. Mens.' },
  { key: 'brand',             label: 'brand',             importable: true,
    help: 'Optional brand name.' },
  { key: 'price',             label: 'price',             importable: true, required: true, money: true,
    help: 'Selling price per unit, before discount. Required. Numbers only — no ₹ symbol.' },
  { key: 'costPrice',         label: 'costPrice',         importable: true, required: true, money: true,
    help: 'What you paid per unit. Required. Drives profit and margin.' },
  { key: 'discount',          label: 'discount',          importable: true,
    help: 'Discount PERCENT, 0-100. Leave blank or 0 for none.' },
  { key: 'gstRate',           label: 'gstRate',           importable: true,
    help: 'GST percent for this product (0, 5, 12, 18, 28). Blank uses the shop default.' },
  { key: 'stock',             label: 'stock',             importable: true, total: true,
    help: 'Total units in hand. For variant products leave blank — it is summed from variants.' },
  { key: 'variants',          label: 'variants',          importable: true,
    help: 'Optional colour/size breakdown: "Red:S:10; Red:M:5; Blue:S:8". Sets stock automatically.' },
  { key: 'unit',              label: 'unit',              importable: true,
    help: 'pcs, kg, ltr, box… Defaults to pcs.' },
  { key: 'barcode',           label: 'barcode',           importable: true,
    help: 'Optional. Must be unique within the shop.' },
  { key: 'sku',               label: 'sku',               importable: true,
    help: 'Optional internal code. Auto-generated when blank.' },
  { key: 'lowStockThreshold', label: 'lowStockThreshold', importable: true,
    help: 'Alert when stock falls to this number. Defaults to 10.' },
  { key: 'description',       label: 'description',       importable: true,
    help: 'Optional free text.' },

  // ── Derived, read-only. Present so the exported file is useful in Excel;
  //    ignored by the importer so a round-trip does not double-apply them.
  { key: 'finalPrice',  label: 'finalPrice (calculated)',  money: true,
    help: 'Read-only: price after discount. Ignored on import.' },
  { key: 'profitPerUnit', label: 'profitPerUnit (calculated)', money: true,
    help: 'Read-only: finalPrice - costPrice. Ignored on import.' },
  { key: 'marginPercent', label: 'marginPercent (calculated)',
    help: 'Read-only: profit as a % of selling price. Ignored on import.' },
  { key: 'stockValue',  label: 'stockValue (calculated)',  money: true, total: true,
    help: 'Read-only: costPrice × stock. Totalled at the bottom. Ignored on import.' },
];

const IMPORT_COLUMNS = COLUMNS.filter((c) => c.importable);
const REQUIRED_KEYS = COLUMNS.filter((c) => c.required).map((c) => c.key);
/** Header row the importer expects, in order. */
const IMPORT_HEADER = IMPORT_COLUMNS.map((c) => c.label);

// ── Variant packing ───────────────────────────────────────────────────────────

/**
 * Serialise a variantStock array to the packed cell form.
 * Cells with no quantity are still emitted, so an intentional 0 survives.
 */
function formatVariants(variantStock) {
  if (!Array.isArray(variantStock) || !variantStock.length) return '';
  return variantStock
    .map((v) => `${v.color || ''}:${v.size || ''}:${Number(v.stock) || 0}`)
    .join('; ');
}

/**
 * Parse the packed cell back to variantStock entries.
 *
 * Returns `{ cells, errors }` rather than throwing, because the importer reports
 * per-row problems to the owner instead of aborting a 500-row file.
 */
function parseVariants(raw) {
  const cells = [];
  const errors = [];
  const text = String(raw ?? '').trim();
  if (!text) return { cells, errors };

  const seen = new Set();
  for (const chunk of text.split(';')) {
    const part = chunk.trim();
    if (!part) continue;

    const bits = part.split(':');
    if (bits.length !== 3) {
      errors.push(`"${part}" is not colour:size:qty`);
      continue;
    }
    const color = bits[0].trim();
    const size = bits[1].trim();
    const qtyRaw = bits[2].trim();

    if (!color && !size) {
      errors.push(`"${part}" has neither a colour nor a size`);
      continue;
    }
    const stock = Number(qtyRaw);
    if (qtyRaw === '' || !Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
      errors.push(`"${part}" has an invalid quantity`);
      continue;
    }
    // Same key contract as the sale lookup and the wizard matrix.
    const key = `${color}||${size}`;
    if (seen.has(key)) {
      errors.push(`duplicate variant "${color || '-'}/${size || '-'}"`);
      continue;
    }
    seen.add(key);
    cells.push({ color, size, stock });
  }
  return { cells, errors };
}

// ── Colour names → hex ────────────────────────────────────────────────────────

/**
 * The spreadsheet carries a colour NAME ("Blue"), because that is what a shop
 * owner types. The Product model requires a hex for every colour, so an import
 * that passed `{ name: 'Blue' }` alone failed validation with
 * `colors.0.hex: Path 'hex' is required` — the whole variant row rejected.
 *
 * Rather than loosen the model (the storefront swatches rely on hex), resolve a
 * sensible hex here. Unknown names get a neutral grey: a slightly wrong swatch
 * is recoverable in the product editor, a rejected import is not.
 */
const COLOR_HEX = {
  black: '#000000', white: '#FFFFFF', grey: '#808080', gray: '#808080',
  red: '#DC2626', maroon: '#7F1D1D', pink: '#EC4899', orange: '#F97316',
  yellow: '#FACC15', gold: '#D4AF37', green: '#16A34A', olive: '#65A30D',
  teal: '#0D9488', blue: '#2563EB', navy: '#1E3A8A', skyblue: '#0EA5E9',
  purple: '#7C3AED', violet: '#8B5CF6', brown: '#78350F', tan: '#D2B48C',
  beige: '#F5F5DC', cream: '#FFFDD0', silver: '#C0C0C0', khaki: '#C3B091',
  mustard: '#FFDB58', rust: '#B7410E', peach: '#FFDAB9', lavender: '#E6E6FA',
  charcoal: '#36454F', ivory: '#FFFFF0', multicolour: '#9CA3AF', multicolor: '#9CA3AF',
};
const DEFAULT_HEX = '#9CA3AF';

/** Resolve a colour name to a hex value. Accepts a hex directly. */
function colorToHex(name) {
  const raw = String(name || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    // Expand #abc → #AABBCC so the stored value is always 7 characters.
    return ('#' + raw.slice(1).split('').map((c) => c + c).join('')).toUpperCase();
  }
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  return COLOR_HEX[key] || DEFAULT_HEX;
}

// ── Row projection ────────────────────────────────────────────────────────────

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Project a Product document to a spreadsheet row.
 *
 * Derived values are computed here rather than read from Mongoose virtuals,
 * because `.lean()` queries (which the export uses, for memory) do not carry
 * virtuals — reading `p.finalPrice` there is how you get a column of blanks.
 */
function productToRow(p) {
  const price = Number(p.price) || 0;
  const cost = Number(p.costPrice) || 0;
  const discount = Number(p.discount) || 0;
  const finalPrice = round2(price - (price * discount) / 100);
  const stock = Number(p.stock) || 0;
  const profit = round2(finalPrice - cost);

  return {
    name:              p.name || '',
    category:          p.category || '',
    subCategory:       p.subCategory || '',
    brand:             p.brand || '',
    price:             price,
    costPrice:         cost,
    discount:          discount,
    // `gstRate` is nullable on purpose: null means "use the shop default", and 0
    // means "genuinely zero-rated". Collapsing null to 0 would silently make
    // every unset product zero-rated on re-import.
    gstRate:           p.gstRate == null ? '' : Number(p.gstRate),
    stock:             stock,
    variants:          formatVariants(p.variantStock),
    unit:              p.unit || 'pcs',
    barcode:           p.barcode || '',
    sku:               p.sku || '',
    lowStockThreshold: p.lowStockThreshold == null ? 10 : Number(p.lowStockThreshold),
    description:       p.description || '',
    finalPrice,
    profitPerUnit:     profit,
    // Margin on the SELLING price, matching the model's `profitMargin` virtual.
    // Guarded against a 0 price, which would otherwise be Infinity/NaN.
    marginPercent:     finalPrice > 0 ? round2((profit / finalPrice) * 100) : '',
    stockValue:        round2(cost * stock),
  };
}

module.exports = {
  COLUMNS, IMPORT_COLUMNS, IMPORT_HEADER, REQUIRED_KEYS,
  formatVariants, parseVariants, productToRow, round2, colorToHex,
};
