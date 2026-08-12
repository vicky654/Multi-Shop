/**
 * Variant matrix engine — mirror of server/src/utils/variantMatrix.js.
 *
 * The wizard needs the grid maths live in the browser; the server re-derives and
 * validates everything before persisting. Do NOT edit one copy alone —
 * server/src/utils/variantMatrix.test.js loads this file, strips the ESM syntax
 * and asserts identical output, so drift fails the test run.
 *
 * See the server copy for the full rationale. The rule that matters most: a cell
 * is keyed `${color}||${size}` and AN ABSENT AXIS IS THE EMPTY STRING, because
 * that is exactly what sale.service.js matches on at the counter.
 */

const PRICING_KEYS = ['costPrice', 'price', 'discount', 'discountType', 'discountValue'];

export const cellKey = (color, size) => `${color || ''}||${size || ''}`;

const toInt = (n) => {
  const v = Number.parseInt(n, 10);
  return Number.isFinite(v) ? Math.max(0, v) : 0;
};

// Colours arrive either as plain names or as the ColorSelector's {name,hex}.
const colorName = (c) => (typeof c === 'string' ? c : c?.name || '');

const emptyCell = (color, size) => ({
  color: color || '',
  size:  size  || '',
  stock: 0,
  costPrice:     null,
  price:         null,
  discount:      null,
  discountType:  null,
  discountValue: null,
});

const cloneCells = (cells) =>
  Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, { ...v }]));

/**
 * Build (or rebuild) a matrix from the current axes.
 *
 * `existing` is a cells map from a previous build. Surviving keys keep their
 * whole cell — quantity and pricing — so adding a size does not wipe the work
 * already done on the other columns.
 */
export function buildMatrix({ colors = [], sizes = [], existing = {} } = {}) {
  const colorNames = colors.map(colorName).filter((c) => c !== '');
  const sizeNames  = sizes.map((s) => String(s)).filter((s) => s !== '');

  // With no axes at all there is nothing to break down.
  if (colorNames.length === 0 && sizeNames.length === 0) {
    return { rows: [], cols: [], cells: {} };
  }

  // A missing axis collapses to a single '' row/column — see the key contract.
  const rows = colorNames.length ? colorNames : [''];
  const cols = sizeNames.length  ? sizeNames  : [''];

  const cells = {};
  for (const color of rows) {
    for (const size of cols) {
      const key = cellKey(color, size);
      cells[key] = existing[key] ? { ...existing[key] } : emptyCell(color, size);
    }
  }
  return { rows, cols, cells };
}

/** Row totals, column totals and the grand total. Always derived, never stored. */
export function matrixTotals({ rows = [], cols = [], cells = {} } = {}) {
  const rowTotals = {};
  const colTotals = {};
  let grandTotal = 0;

  for (const color of rows) {
    rowTotals[color] = 0;
    for (const size of cols) {
      const qty = toInt(cells[cellKey(color, size)]?.stock);
      rowTotals[color] += qty;
      colTotals[size]   = (colTotals[size] || 0) + qty;
      grandTotal       += qty;
    }
  }
  // Guarantee a key per column even when there are no rows.
  for (const size of cols) if (colTotals[size] === undefined) colTotals[size] = 0;

  return { rowTotals, colTotals, grandTotal };
}

/** Update one cell. Quantities are clamped so a negative can never be entered. */
export function setCell(matrix, color, size, patch) {
  const cells = cloneCells(matrix.cells);
  const key   = cellKey(color, size);
  const cell  = cells[key] || emptyCell(color, size);
  const next  = { ...cell, ...patch };
  if ('stock' in patch) next.stock = toInt(patch.stock);
  cells[key] = next;
  return { ...matrix, cells };
}

/** Set every cell to the same quantity. */
export function fillAll(matrix, qty) {
  const value = toInt(qty);
  const cells = cloneCells(matrix.cells);
  for (const key of Object.keys(cells)) cells[key].stock = value;
  return { ...matrix, cells };
}

/** Set every cell in one row to the same quantity. */
export function fillRow(matrix, color, qty) {
  const value = toInt(qty);
  const cells = cloneCells(matrix.cells);
  for (const size of matrix.cols) {
    const key = cellKey(color, size);
    if (cells[key]) cells[key].stock = value;
  }
  return { ...matrix, cells };
}

/**
 * Spread `total` across every cell as evenly as possible.
 *
 * The remainder goes to the first cells one unit at a time, so the grand total
 * is EXACTLY `total` — a plain Math.round per cell would overshoot or undershoot
 * and then the mismatch warning would fire on the value we just generated.
 */
export function distributeEvenly(matrix, total) {
  const keys = Object.keys(matrix.cells);
  if (keys.length === 0) return { ...matrix, cells: cloneCells(matrix.cells) };

  const want  = toInt(total);
  const base  = Math.floor(want / keys.length);
  let   extra = want - base * keys.length;

  const cells = cloneCells(matrix.cells);
  for (const key of keys) {
    cells[key].stock = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
  }
  return { ...matrix, cells };
}

/** Copy one row's quantities and pricing onto the named rows. */
export function copyRow(matrix, fromColor, toColors = []) {
  const cells = cloneCells(matrix.cells);
  for (const size of matrix.cols) {
    const source = cells[cellKey(fromColor, size)];
    if (!source) continue;
    for (const color of toColors) {
      const key = cellKey(color, size);
      if (!cells[key]) continue;
      cells[key] = { ...source, color, size };
    }
  }
  return { ...matrix, cells };
}

/** Zero every quantity. Pricing is deliberately kept — this clears stock only. */
export function clearAll(matrix) {
  const cells = cloneCells(matrix.cells);
  for (const key of Object.keys(cells)) cells[key].stock = 0;
  return { ...matrix, cells };
}

/**
 * Flatten to the array the Product model stores and sale.service.js reads.
 * Null pricing keys are omitted so a uniformly priced product produces the exact
 * same document it would have before per-variant pricing existed.
 */
export function toVariantStock({ rows = [], cols = [], cells = {} } = {}) {
  const out = [];
  for (const color of rows) {
    for (const size of cols) {
      const cell = cells[cellKey(color, size)];
      if (!cell) continue;
      const entry = { size: size || '', color: color || '', stock: toInt(cell.stock) };
      for (const key of PRICING_KEYS) {
        if (cell[key] !== null && cell[key] !== undefined && cell[key] !== '') {
          entry[key] = cell[key];
        }
      }
      out.push(entry);
    }
  }
  return out;
}

/**
 * Rebuild a matrix from a stored variantStock array.
 *
 * Axes are derived in first-seen order so an edit reopens with the columns in
 * the order the user created them. A pair that was never stocked still gets a
 * zero cell, so the grid renders complete rather than gappy.
 */
export function fromVariantStock(variantStock) {
  const list = Array.isArray(variantStock) ? variantStock : [];
  const colors = [];
  const sizes  = [];
  for (const v of list) {
    const c = v?.color || '';
    const s = v?.size  || '';
    if (c && !colors.includes(c)) colors.push(c);
    if (s && !sizes.includes(s))  sizes.push(s);
  }

  const matrix = buildMatrix({ colors, sizes });
  for (const v of list) {
    const key = cellKey(v?.color, v?.size);
    if (!matrix.cells[key]) continue;
    matrix.cells[key].stock = toInt(v.stock);
    for (const pk of PRICING_KEYS) {
      if (v[pk] !== null && v[pk] !== undefined && v[pk] !== '') matrix.cells[key][pk] = v[pk];
    }
  }
  return matrix;
}

/**
 * Names of any size/color pair that appears more than once.
 *
 * Two cells for the same combination make the matrix ambiguous and would let
 * sale.service.js decrement whichever one `.find()` happened to hit first.
 */
export function findDuplicateCombos(variantStock) {
  const seen = new Set();
  const dupes = new Set();
  for (const v of Array.isArray(variantStock) ? variantStock : []) {
    const key = cellKey(v?.color, v?.size);
    if (seen.has(key)) {
      dupes.add([v?.color || '', v?.size || ''].filter(Boolean).join(' / ') || '(no size/color)');
    }
    seen.add(key);
  }
  return [...dupes];
}

/** The authoritative total for a variant product's root `stock`. */
export function sumVariantStock(variantStock) {
  return (Array.isArray(variantStock) ? variantStock : [])
    .reduce((sum, v) => sum + toInt(v?.stock), 0);
}
