/**
 * Client-side MIRROR of the server's product import schema.
 *
 * WHY A MIRROR EXISTS AT ALL
 *   The import dialog tells the owner which columns the file needs. That text was
 *   hardcoded and had already gone stale: it still listed the original 12 columns
 *   after `brand`, `gstRate` and `variants` were added, so the dialog was telling
 *   owners the wrong format — the exact "guide disagrees with the product"
 *   problem, just inside the product itself.
 *
 *   The client cannot require server code, so this is a deliberate mirror. It is
 *   kept honest by a drift guard in
 *   server/src/modules/products/product.schema.test.js, which reads this file and
 *   asserts the lists match the server's IMPORT_COLUMNS exactly. Adding a column
 *   server-side without updating this file fails the test suite.
 *
 *   Same pattern already used in this repo for utils/pricing.js and
 *   utils/variantMatrix.js.
 */

/** Columns the importer rejects a row without. */
export const REQUIRED_COLS = ['name', 'category', 'price', 'costPrice'];

/** Columns the importer accepts but does not require. */
export const OPTIONAL_COLS = [
  'subCategory', 'brand', 'discount', 'gstRate', 'stock', 'variants',
  'unit', 'barcode', 'sku', 'lowStockThreshold', 'description',
];

/** Short notes for the columns whose behaviour is not obvious from the name. */
export const COLUMN_NOTES = {
  variants: 'colour/size breakdown, e.g. "Blue:8:4; Blue:9:6" — sets stock automatically',
  gstRate:  'per-product GST percent; leave blank to use the shop default',
  discount: 'a percentage, 0-100',
  stock:    'leave blank for variant products — it is summed from variants',
};
