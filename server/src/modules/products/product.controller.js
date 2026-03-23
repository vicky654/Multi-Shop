const productService = require('./product.service');
const asyncHandler   = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');
const notifService   = require('../notifications/notification.service');

// ── Admin (protected) ─────────────────────────────────────────────────────────
const getAll = asyncHandler(async (req, res) => {
  const shopId = req.query.shopId || null;
  const { products, total, page, limit } = await productService.getProducts(req.user, shopId, req.query);
  paginated(res, products, total, page, limit, 'Products fetched');
});

const getOne = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id, req.user);
  success(res, { product }, 'Product fetched');
});

const create = asyncHandler(async (req, res) => {
  const { notifyCustomers, ...rest } = req.body;
  const product = await productService.createProduct(req.user, rest);
  if (notifyCustomers) {
    notifService.notifyShopStaff(product, req.user).catch((err) =>
      console.error('notifyShopStaff error:', err.message)
    );
  }
  success(res, { product }, 'Product created', 201);
});

const update = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.user, req.body);
  success(res, { product }, 'Product updated');
});

const remove = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.params.id, req.user);
  success(res, {}, 'Product deleted');
});

const categories = asyncHandler(async (req, res) => {
  const cats = await productService.getCategories(req.user, req.query.shopId);
  success(res, { categories: cats }, 'Categories fetched');
});

const lowStock = asyncHandler(async (req, res) => {
  const products = await productService.getLowStockProducts(req.user, req.query.shopId);
  success(res, { products }, 'Low stock products');
});

// ── Public (no auth) ──────────────────────────────────────────────────────────
const getPublic = asyncHandler(async (req, res) => {
  const { products, total, page, limit } = await productService.getPublicProducts(req.query);
  paginated(res, products, total, page, limit, 'Products fetched');
});

const getPublicOne = asyncHandler(async (req, res) => {
  const product = await productService.getPublicProductById(req.params.id);
  success(res, { product }, 'Product fetched');
});

const getPublicCategories = asyncHandler(async (req, res) => {
  const data = await productService.getPublicCategories(req.query.shopId);
  success(res, data, 'Categories fetched');
});

module.exports = { getAll, getOne, create, update, remove, categories, lowStock, getPublic, getPublicOne, getPublicCategories };
