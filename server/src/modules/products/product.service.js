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
  if (query.search)      filter.$text       = { $search: query.search };
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

module.exports = {
  getProducts, getProductById, createProduct, updateProduct,
  deleteProduct, getCategories, getLowStockProducts,
  getPublicProducts, getPublicProductById, getPublicCategories,
};
