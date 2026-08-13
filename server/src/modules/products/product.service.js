const Product = require('./product.model');
const Shop    = require('../shops/shop.model');
const { normalizeProductPayload } = require('./product.normalize');
const { toCsv, toXlsx, exportFilename, MIME } = require('../../utils/exportFile');
const { COLUMNS, IMPORT_COLUMNS, IMPORT_HEADER, productToRow, parseVariants, colorToHex } = require('./product.schema');

// ── Helper ────────────────────────────────────────────────────────────────────
const buildFilter = (user, shopId, query) => {
  const filter = { isActive: true };

  if (shopId) {
    filter.shopId = shopId;
  } else if (user.role !== 'super_admin') {
    filter.shopId = { $in: user.shops };
  }

  if (query.category)    filter.category    = query.category;
  if (query.subCategory) filter.subCategory = query.subCategory;

  // Substring search across the fields a cashier actually types or scans.
  // A $text index only matches whole words, so "pep" would never find "Pepsi"
  // and a hyphenated barcode wouldn't match at all — both fatal at the counter.
  if (query.search) {
    const term = String(query.search).trim();
    if (term) {
      const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: rx },
        { sku: rx },
        { barcode: rx },
        { category: rx },
        { brand: rx },
      ];
    }
  }
  if (query.lowStock === 'true') filter.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
  if (query.barcode)     filter.barcode     = query.barcode;
  if (query.isFeatured === 'true')   filter.isFeatured   = true;
  if (query.isNewArrival === 'true') filter.isNewArrival = true;
  if (query.isTrending === 'true')   filter.isTrending   = true;

  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }

  if (query.size)  filter.sizes  = query.size;
  if (query.color) filter['colors.name'] = { $regex: query.color, $options: 'i' };

  return filter;
};

// ── Admin: protected ──────────────────────────────────────────────────────────
const getProducts = async (user, shopId, query) => {
  const filter = buildFilter(user, shopId, query);
  const page   = Math.max(parseInt(query.page)  || 1, 1);
  const limit  = Math.min(parseInt(query.limit) || 20, 100);
  const skip   = (page - 1) * limit;

  const sort = {};
  if (query.sort === 'price_asc')    sort.price     = 1;
  else if (query.sort === 'price_desc') sort.price  = -1;
  else if (query.sort === 'stock_asc')  sort.stock  = 1;
  else sort.createdAt = -1;

  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  return { products, total, page, limit };
};

const getProductById = async (id, user) => {
  const product = await Product.findById(id);
  if (!product || !product.isActive)
    throw Object.assign(new Error('Product not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === product.shopId.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });
  return product;
};

const createProduct = async (user, data) => {
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === data.shopId)) {
    throw Object.assign(new Error('No access to this shop'), { status: 403 });
  }
  // Normalise before create so a variant product's root stock is the matrix sum
  // from the very first save, never a client-supplied guess.
  const clean = normalizeProductPayload(data);
  return Product.create({ ...clean, ownerId: user.role === 'super_admin' ? data.ownerId : user._id });
};

const updateProduct = async (id, user, data) => {
  const product = await Product.findById(id);
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === product.shopId.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });

  // The existing doc is passed in so a PARTIAL update cannot break the
  // stock === sum(variantStock) invariant: normalizeProductPayload only emits
  // keys the caller actually sent, and refuses a bare `stock` write on a
  // variant-tracked product instead of letting root drift from the matrix.
  Object.assign(product, normalizeProductPayload(data, product.toObject()));
  await product.save();
  return product;
};

const deleteProduct = async (id, user) => {
  const product = await Product.findById(id);
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
  if (user.role !== 'super_admin' && product.ownerId.toString() !== user._id.toString())
    throw Object.assign(new Error('Access denied'), { status: 403 });

  product.isActive = false;
  await product.save();
  return product;
};

const getCategories = async (user, shopId) => {
  const filter = shopId ? { shopId, isActive: true } : { shopId: { $in: user.shops }, isActive: true };
  return Product.distinct('category', filter);
};

const getLowStockProducts = async (user, shopId) => {
  const filter = {
    isActive: true,
    shopId: shopId || { $in: user.shops },
    $expr: { $lte: ['$stock', '$lowStockThreshold'] },
  };
  return Product.find(filter).sort({ stock: 1 }).limit(50);
};

// ── Public: no auth (customer shop) ──────────────────────────────────────────
const getPublicProducts = async (query) => {
  const { shopId, category, subCategory, search, minPrice, maxPrice,
          size, color, isFeatured, isNewArrival, isTrending,
          page = 1, limit = 24, sort } = query;

  const filter = { isActive: true };
  if (shopId)      filter.shopId      = shopId;
  if (category)    filter.category    = category;
  if (subCategory) filter.subCategory = subCategory;
  if (search)      filter.$text       = { $search: search };
  if (isFeatured === 'true')   filter.isFeatured   = true;
  if (isNewArrival === 'true') filter.isNewArrival = true;
  if (isTrending === 'true')   filter.isTrending   = true;
  if (size)  filter.sizes            = size;
  if (color) filter['colors.name']   = { $regex: color, $options: 'i' };
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  const sortMap = {
    price_asc:  { price: 1 },
    price_desc: { price: -1 },
    newest:     { createdAt: -1 },
    popular:    { stock: -1 },
  };
  const sortObj = sortMap[sort] || { createdAt: -1 };

  const skip  = (Number(page) - 1) * Number(limit);
  const lim   = Math.min(Number(limit), 60);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .select('-costPrice -ownerId')     // hide internal cost from customers
      .sort(sortObj)
      .skip(skip)
      .limit(lim),
    Product.countDocuments(filter),
  ]);

  return { products, total, page: Number(page), limit: lim };
};

const getPublicProductById = async (id) => {
  const product = await Product.findOne({ _id: id, isActive: true })
    .select('-costPrice -ownerId')
    .populate('shopId', 'name address phone currency');
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
  return product;
};

const getPublicCategories = async (shopId) => {
  const filter = { isActive: true };
  if (shopId) filter.shopId = shopId;
  const [categories, subCategories] = await Promise.all([
    Product.distinct('category', filter),
    Product.distinct('subCategory', filter),
  ]);
  return { categories, subCategories: subCategories.filter(Boolean) };
};

// ── Bulk CSV Import ───────────────────────────────────────────────────────────

/**
 * Read a numeric cell.
 *
 * `Number('')` is 0 and `!row.price` is true for a legitimate 0, so the previous
 * `!row.price || isNaN(...)` rejected a genuinely free item as "missing price"
 * and turned a blank cell into 0. Absent and zero are different answers here.
 *
 * @returns {{ok:true, value:number|null}|{ok:false}} value null = cell was blank
 */
const numCell = (raw) => {
  if (raw === undefined || raw === null || String(raw).trim() === '') return { ok: true, value: null };
  // Tolerate what people actually paste out of Excel: ₹, thousands separators,
  // a trailing %, and stray spaces. Rejecting these produced "invalid price"
  // on files that looked perfectly fine to the owner.
  const cleaned = String(raw).replace(/[₹,\s%]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
};

const strCell = (raw) => (raw === undefined || raw === null ? '' : String(raw).trim());

/**
 * Import product rows.
 *
 * @param {object} user
 * @param {Array<object>} records  parsed CSV rows (headers already BOM-stripped)
 * @param {string|null} [targetShopId]  shop to import into — the shop the owner
 *   is actually looking at. Previously omitted, so every import landed in
 *   `user.shops[0]`: an owner viewing their second shop silently filled their
 *   first one. A row-level `shopId` column still wins, for multi-shop files.
 */
const importProducts = async (user, records, targetShopId = null) => {
  let successCount = 0;
  let failedCount  = 0;
  const errors     = [];
  const created    = [];

  // Barcodes seen in THIS file. Without it, two rows sharing a barcode both pass
  // the DB check (neither is committed yet) and the second fails on the unique
  // index with a raw Mongo error instead of a readable row message.
  const seenBarcodes = new Set();

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2; // 1-based + header row
    const rowErr = (error) => { errors.push({ row: rowNum, field: strCell(row.name), error }); failedCount += 1; };

    const name = strCell(row.name);
    if (!name)                 { rowErr('Missing required field: name'); continue; }
    const category = strCell(row.category);
    if (!category)             { rowErr('Missing required field: category'); continue; }

    const price = numCell(row.price);
    if (!price.ok || price.value === null) { rowErr('Missing or invalid field: price'); continue; }
    if (price.value < 0)       { rowErr('price cannot be negative'); continue; }

    const cost = numCell(row.costPrice);
    if (!cost.ok || cost.value === null)   { rowErr('Missing or invalid field: costPrice'); continue; }
    if (cost.value < 0)        { rowErr('costPrice cannot be negative'); continue; }

    const shopId = row.shopId || targetShopId || (user.shops && user.shops[0]?.toString());
    if (!shopId)               { rowErr('No shopId provided or assigned'); continue; }

    if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === shopId.toString())) {
      rowErr('No access to shopId: ' + shopId); continue;
    }

    // Variant matrix, if the row carries one.
    const { cells, errors: vErrors } = parseVariants(row.variants);
    if (vErrors.length)        { rowErr(`Invalid variants — ${vErrors.join('; ')}`); continue; }

    const barcode = strCell(row.barcode);
    if (barcode) {
      if (seenBarcodes.has(barcode)) { rowErr(`Duplicate barcode within this file: ${barcode}`); continue; }
      const existing = await Product.findOne({ barcode, shopId, isActive: true }).lean();
      if (existing)            { rowErr(`Duplicate barcode: ${barcode}`); continue; }
    }

    const discount = numCell(row.discount);
    if (!discount.ok)          { rowErr('Invalid field: discount'); continue; }
    const gst = numCell(row.gstRate);
    if (!gst.ok)               { rowErr('Invalid field: gstRate'); continue; }
    const stockCell = numCell(row.stock);
    if (!stockCell.ok)         { rowErr('Invalid field: stock'); continue; }
    const threshold = numCell(row.lowStockThreshold);
    if (!threshold.ok)         { rowErr('Invalid field: lowStockThreshold'); continue; }

    const payload = {
      name,
      category,
      subCategory:       strCell(row.subCategory),
      brand:             strCell(row.brand),
      price:             price.value,
      costPrice:         cost.value,
      discount:          discount.value === null ? 0 : Math.min(100, Math.max(0, discount.value)),
      stock:             stockCell.value === null ? 0 : Math.max(0, stockCell.value),
      unit:              strCell(row.unit) || 'pcs',
      description:       strCell(row.description),
      lowStockThreshold: threshold.value === null ? 10 : Math.max(0, threshold.value),
      shopId,
      ownerId:           user._id,
    };
    if (barcode) payload.barcode = barcode;
    const sku = strCell(row.sku);
    if (sku) payload.sku = sku;
    // Blank gstRate stays unset so the shop default applies; an explicit 0 is
    // kept, because a zero-rated product is a real thing.
    if (gst.value !== null) payload.gstRate = Math.min(100, Math.max(0, gst.value));

    // Route variants through the same normaliser the wizard uses, so the
    // stock === sum(variantStock) invariant holds for imported products too.
    if (cells.length) {
      payload.trackVariantStock = true;
      payload.variantStock = cells;
      payload.sizes  = [...new Set(cells.map((c) => c.size).filter(Boolean))];
      // hex is required by the model; the CSV only carries a name, so resolve it.
      payload.colors = [...new Set(cells.map((c) => c.color).filter(Boolean))]
        .map((n) => ({ name: n, hex: colorToHex(n) }));
    }

    try {
      const doc = await Product.create(normalizeProductPayload(payload, {}));
      created.push(doc._id);
      successCount++;
    } catch (err) {
      rowErr(err.message);
    }
  }

  return { successCount, failedCount, errors, created };
};

// ── Export All Products ───────────────────────────────────────────────────────
/**
 * Export products as CSV or XLSX.
 *
 * Tenant scoping note: `shopAccess` middleware already validates any supplied
 * `shopId` against `req.user.shops` before this runs, so an explicit shopId is
 * safe to trust here. With no shopId we still restrict non-super-admins to their
 * own shops — the export must never be a way to read another tenant's catalogue.
 *
 * Columns, derived values and variant packing all come from product.schema.js,
 * which the importer and the sample file share, so the three cannot drift.
 *
 * @param {object} user
 * @param {string|null} shopId
 * @param {'csv'|'xlsx'} [format='csv']
 * @returns {Promise<{buffer:Buffer, filename:string, contentType:string, count:number}>}
 */
const exportAllProducts = async (user, shopId, format = 'csv') => {
  const fmt = format === 'xlsx' ? 'xlsx' : 'csv';

  const filter = { isActive: true };
  if (shopId) {
    filter.shopId = shopId;
  } else if (user.role !== 'super_admin') {
    filter.shopId = { $in: user.shops };
  }

  // Oldest-first: a spreadsheet reads naturally in the order the shop grew, and
  // it keeps the file stable between exports for diffing.
  const products = await Product.find(filter).sort({ createdAt: 1 }).lean();
  const rows = products.map(productToRow);

  // Name the file after the shop when the export is scoped to one, so a
  // downloads folder with several exports stays intelligible.
  let shopName = '';
  if (shopId) {
    const shop = await Shop.findById(shopId).select('name').lean();
    shopName = shop?.name || '';
  }
  const day = new Date().toISOString().slice(0, 10);
  const filename = exportFilename('products', shopName, day, fmt);

  const buffer = fmt === 'xlsx'
    ? toXlsx(COLUMNS, rows, { sheetName: shopName ? `${shopName} products` : 'Products', totals: true })
    : Buffer.from(toCsv(COLUMNS, rows, { totals: true }), 'utf8');

  return { buffer, filename, contentType: MIME[fmt], count: products.length };
};

// ── Sample Import File ────────────────────────────────────────────────────────

/**
 * Realistic sample rows for the downloadable import template.
 *
 * These are chosen to teach the format by example, and every one of them must
 * import successfully — a test feeds this exact file back through
 * `importProducts` and asserts 0 failures, so the sample can never become a
 * file that the parser rejects.
 *
 * Deliberate coverage: a plain product, one with a discount and a barcode, a
 * zero-GST item (proving 0 is honoured, not treated as blank), a variant product
 * using the packed matrix form, and one with only the required columns filled.
 */
const SAMPLE_IMPORT_ROWS = [
  {
    name: 'Canvas Sneaker', category: 'Footwear', subCategory: 'Mens', brand: 'StepUp',
    price: 1299, costPrice: 780, discount: 10, gstRate: 12, stock: 24, variants: '',
    unit: 'pcs', barcode: '8901234567890', sku: 'FW-SNK-001', lowStockThreshold: 6,
    description: 'Lace-up canvas sneaker, breathable lining',
  },
  {
    name: 'Running Shoe', category: 'Footwear', subCategory: 'Mens', brand: 'StepUp',
    price: 2499, costPrice: 1550, discount: 0, gstRate: 12, stock: '', variants: 'Blue:8:4; Blue:9:6; Black:8:3; Black:9:5',
    unit: 'pcs', barcode: '8901234567891', sku: 'FW-RUN-002', lowStockThreshold: 4,
    description: 'Variant example — stock is summed from the variants column (18)',
  },
  {
    name: 'Cotton Socks (3 pack)', category: 'Accessories', subCategory: '', brand: '',
    price: 249, costPrice: 120, discount: 0, gstRate: 5, stock: 60, variants: '',
    unit: 'pack', barcode: '', sku: '', lowStockThreshold: 12,
    description: '',
  },
  {
    name: 'Shoe Care Kit', category: 'Accessories', subCategory: '', brand: 'StepUp',
    price: 399, costPrice: 210, discount: 5, gstRate: 0, stock: 15, variants: '',
    unit: 'box', barcode: '', sku: '', lowStockThreshold: 5,
    description: 'gstRate 0 is honoured as genuinely zero-rated, not treated as blank',
  },
  {
    name: 'Leather Belt', category: 'Accessories', subCategory: '', brand: '',
    price: 799, costPrice: 400, discount: '', gstRate: '', stock: '', variants: '',
    unit: '', barcode: '', sku: '', lowStockThreshold: '',
    description: 'Only the four required columns are filled — the rest take defaults',
  },
];

/**
 * Build the sample import file.
 *
 * Only importable columns are included: putting the read-only calculated columns
 * in a template invites the owner to fill them in and wonder why nothing happens.
 *
 * @param {'csv'|'xlsx'} [format='csv']
 */
const buildSampleImportFile = (format = 'csv') => {
  const fmt = format === 'xlsx' ? 'xlsx' : 'csv';
  const filename = `multishop-product-import-sample.${fmt}`;

  const buffer = fmt === 'xlsx'
    ? toXlsx(IMPORT_COLUMNS, SAMPLE_IMPORT_ROWS, { sheetName: 'Products', totals: false })
    // No totals row here: a TOTAL line in a template would be re-imported as a
    // product literally named "TOTAL".
    : Buffer.from(toCsv(IMPORT_COLUMNS, SAMPLE_IMPORT_ROWS, { totals: false }), 'utf8');

  return { buffer, filename, contentType: MIME[fmt], rowCount: SAMPLE_IMPORT_ROWS.length };
};

// ── Stock Adjustment (damage / theft / restock / audit correction) ────────────
const ADJUSTMENT_REASONS = ['restock', 'damage', 'theft', 'correction', 'audit', 'return'];

const adjustStock = async (id, user, { delta, reason, notes, size, color }) => {
  const qty = parseInt(delta, 10);
  if (isNaN(qty) || qty === 0)
    throw Object.assign(new Error('delta must be a non-zero integer'), { status: 400 });
  if (!ADJUSTMENT_REASONS.includes(reason))
    throw Object.assign(new Error(`reason must be one of: ${ADJUSTMENT_REASONS.join(', ')}`), { status: 400 });

  const product = await Product.findById(id);
  if (!product || !product.isActive)
    throw Object.assign(new Error('Product not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === product.shopId.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });

  // ── Variant products: the cell and root must move together ──────────────────
  // Root stock on a variant product is the sum of its cells. Moving root alone
  // would desync it from variantStock[], and from then on sale.service.js
  // decrements a total that no longer matches the breakdown. So the caller must
  // name a variant, and then both move in lockstep — exactly as a sale does.
  if (product.trackVariantStock) {
    const vSize  = (size  || '').trim();
    const vColor = (color || '').trim();

    if (!vSize && !vColor) {
      const available = (product.variantStock || [])
        .map((v) => [v.color, v.size].filter(Boolean).join('/'))
        .join(', ');
      throw Object.assign(
        new Error(
          `"${product.name}" tracks stock per variant — specify size/color to adjust. `
          + `Available: ${available || 'none'}`
        ),
        { status: 400 }
      );
    }

    const cell = (product.variantStock || []).find((v) => v.size === vSize && v.color === vColor);
    if (!cell)
      throw Object.assign(
        new Error(`Variant (${vSize}/${vColor}) not found for "${product.name}"`),
        { status: 400 }
      );

    if (cell.stock + qty < 0)
      throw Object.assign(
        new Error(`Cannot reduce ${[vColor, vSize].filter(Boolean).join('/')} below 0 `
          + `(current: ${cell.stock}, delta: ${qty})`),
        { status: 400 }
      );

    const previousStock = product.stock;
    cell.stock    += qty;
    product.stock += qty;              // lockstep — never one without the other
    await product.save();
    return {
      product, previousStock, newStock: product.stock, delta: qty, reason,
      variant: { size: vSize, color: vColor, newStock: cell.stock },
    };
  }

  const newStock = product.stock + qty;
  if (newStock < 0)
    throw Object.assign(new Error(`Cannot reduce stock below 0 (current: ${product.stock}, delta: ${qty})`), { status: 400 });

  product.stock = newStock;
  await product.save();
  return { product, previousStock: product.stock - qty, newStock, delta: qty, reason };
};

// ── Bulk Stock Audit — apply multiple adjustments in one call ─────────────────
// items: [{ productId, physicalCount }]
const bulkAuditAdjust = async (user, shopId, items) => {
  if (!Array.isArray(items) || items.length === 0)
    throw Object.assign(new Error('No audit items provided'), { status: 400 });

  const ids      = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: ids }, isActive: true }).lean();
  const prodMap  = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

  // Access check — all products must belong to a shop the user owns
  if (user.role !== 'super_admin') {
    const shopStr = (user.shops || []).map((s) => s.toString());
    for (const p of products) {
      if (!shopStr.includes(p.shopId.toString()))
        throw Object.assign(new Error(`Access denied for product ${p._id}`), { status: 403 });
    }
  }

  const ops = [];
  const results = [];
  const skipped = [];

  for (const item of items) {
    const product = prodMap[item.productId?.toString()];
    if (!product) continue;

    // A single physical count cannot be split back across a size/colour matrix,
    // and writing it to root alone would desync root from variantStock[]. Report
    // it as skipped rather than guessing a distribution the counter never saw.
    if (product.trackVariantStock) {
      skipped.push({
        productId: product._id,
        name:      product.name,
        reason:    'Tracks stock per variant — audit each size/color from the product editor',
      });
      continue;
    }

    const physicalCount = parseInt(item.physicalCount, 10);
    if (isNaN(physicalCount) || physicalCount < 0) continue;

    const delta = physicalCount - product.stock;
    if (delta === 0) continue; // no discrepancy — skip

    ops.push({
      updateOne: {
        filter: { _id: product._id },
        update: { $set: { stock: physicalCount } },
      },
    });

    results.push({
      productId:     product._id,
      name:          product.name,
      previousStock: product.stock,
      physicalCount,
      discrepancy:   delta,
    });
  }

  if (ops.length > 0) {
    await Product.bulkWrite(ops, { ordered: false });
  }

  return { adjusted: results.length, items: results, skipped };
};

// ── Bulk Delete ───────────────────────────────────────────────────────────────
const bulkDeleteProducts = async (user, ids) => {
  if (!Array.isArray(ids) || ids.length === 0)
    throw Object.assign(new Error('No product IDs provided'), { status: 400 });

  const filter = { _id: { $in: ids } };
  if (user.role !== 'super_admin') {
    filter.shopId = { $in: user.shops };
  }

  const result = await Product.updateMany(filter, { $set: { isActive: false } });
  return { deletedCount: result.modifiedCount };
};

module.exports = {
  getProducts, getProductById, createProduct, updateProduct,
  deleteProduct, getCategories, getLowStockProducts,
  getPublicProducts, getPublicProductById, getPublicCategories,
  importProducts, exportAllProducts, buildSampleImportFile, bulkDeleteProducts,
  adjustStock, bulkAuditAdjust,
};
