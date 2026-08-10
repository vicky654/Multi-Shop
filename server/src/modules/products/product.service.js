const Product = require('./product.model');

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
  return Product.create({ ...data, ownerId: user.role === 'super_admin' ? data.ownerId : user._id });
};

const updateProduct = async (id, user, data) => {
  const product = await Product.findById(id);
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === product.shopId.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });

  Object.assign(product, data);
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
const importProducts = async (user, records) => {
  let successCount = 0;
  let failedCount  = 0;
  const errors     = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2; // 1-based + header row

    // Validate required fields
    if (!row.name || !row.name.trim()) {
      errors.push({ row: rowNum, error: 'Missing required field: name' });
      failedCount++;
      continue;
    }
    if (!row.price || isNaN(Number(row.price))) {
      errors.push({ row: rowNum, field: row.name, error: 'Missing or invalid field: price' });
      failedCount++;
      continue;
    }
    if (!row.costPrice || isNaN(Number(row.costPrice))) {
      errors.push({ row: rowNum, field: row.name, error: 'Missing or invalid field: costPrice' });
      failedCount++;
      continue;
    }
    if (!row.category || !row.category.trim()) {
      errors.push({ row: rowNum, field: row.name, error: 'Missing required field: category' });
      failedCount++;
      continue;
    }

    // Resolve shopId: use row value if super_admin, else fall back to user's first shop
    const shopId = row.shopId || (user.shops && user.shops[0]?.toString());
    if (!shopId) {
      errors.push({ row: rowNum, field: row.name, error: 'No shopId provided or assigned' });
      failedCount++;
      continue;
    }

    if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === shopId.toString())) {
      errors.push({ row: rowNum, field: row.name, error: 'No access to shopId: ' + shopId });
      failedCount++;
      continue;
    }

    // Prevent duplicate barcode within the same shop
    if (row.barcode && row.barcode.trim()) {
      const existing = await Product.findOne({ barcode: row.barcode.trim(), shopId, isActive: true });
      if (existing) {
        errors.push({ row: rowNum, field: row.name, error: `Duplicate barcode: ${row.barcode}` });
        failedCount++;
        continue;
      }
    }

    try {
      await Product.create({
        name:              row.name.trim(),
        category:          row.category.trim(),
        subCategory:       row.subCategory?.trim() || '',
        price:             Number(row.price),
        costPrice:         Number(row.costPrice),
        discount:          row.discount ? Math.min(100, Math.max(0, Number(row.discount))) : 0,
        stock:             row.stock ? Number(row.stock) : 0,
        barcode:           row.barcode?.trim() || undefined,
        sku:               row.sku?.trim()     || undefined,
        unit:              row.unit?.trim()    || 'pcs',
        description:       row.description?.trim() || '',
        lowStockThreshold: row.lowStockThreshold ? Number(row.lowStockThreshold) : 10,
        shopId,
        ownerId:           user._id,
      });
      successCount++;
    } catch (err) {
      errors.push({ row: rowNum, field: row.name, error: err.message });
      failedCount++;
    }
  }

  return { successCount, failedCount, errors };
};

// ── Export All Products to CSV ────────────────────────────────────────────────
const exportAllProducts = async (user, shopId) => {
  const filter = { isActive: true };
  if (shopId) {
    filter.shopId = shopId;
  } else if (user.role !== 'super_admin') {
    filter.shopId = { $in: user.shops };
  }

  const products = await Product.find(filter).sort({ createdAt: -1 }).lean();

  const header = ['name','category','subCategory','price','costPrice','discount','stock','barcode','sku','unit','description','lowStockThreshold'];
  const rows   = [header.join(',')];

  products.forEach((p) => {
    const row = [
      `"${(p.name         || '').replace(/"/g, '""')}"`,
      `"${(p.category     || '').replace(/"/g, '""')}"`,
      `"${(p.subCategory  || '').replace(/"/g, '""')}"`,
      p.price        ?? '',
      p.costPrice    ?? '',
      p.discount     ?? 0,
      p.stock        ?? 0,
      `"${(p.barcode      || '').replace(/"/g, '""')}"`,
      `"${(p.sku          || '').replace(/"/g, '""')}"`,
      `"${(p.unit         || 'pcs').replace(/"/g, '""')}"`,
      `"${(p.description  || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      p.lowStockThreshold ?? 10,
    ];
    rows.push(row.join(','));
  });

  return { csv: rows.join('\n'), count: products.length };
};

// ── Stock Adjustment (damage / theft / restock / audit correction) ────────────
const ADJUSTMENT_REASONS = ['restock', 'damage', 'theft', 'correction', 'audit', 'return'];

const adjustStock = async (id, user, { delta, reason, notes }) => {
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

  for (const item of items) {
    const product = prodMap[item.productId?.toString()];
    if (!product) continue;

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

  return { adjusted: results.length, items: results };
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
  importProducts, exportAllProducts, bulkDeleteProducts,
  adjustStock, bulkAuditAdjust,
};
