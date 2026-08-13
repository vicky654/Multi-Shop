const productService = require('./product.service');
const asyncHandler   = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');
const notifService   = require('../notifications/notification.service');
const { logAction, LOG_ACTIONS } = require('../../utils/logger');

// ── Admin (protected) ─────────────────────────────────────────────────────────
const getAll = asyncHandler(async (req, res) => {
  logAction(req, LOG_ACTIONS.PRODUCT_GET_ALL, 'products', 'Fetched products list', { shopId: req.query.shopId, page: req.query.page, limit: req.query.limit });
  const shopId = req.query.shopId || null;
  const { products, total, page, limit } = await productService.getProducts(req.user, shopId, req.query);
  paginated(res, products, total, page, limit, 'Products fetched');
});

const getOne = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id, req.user);
  success(res, { product }, 'Product fetched');
});

const create = asyncHandler(async (req, res) => {
  const { name, category } = req.body;
  logAction(req, LOG_ACTIONS.PRODUCT_CREATE, 'products', `Created product: ${name}`);
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
  logAction(req, LOG_ACTIONS.PRODUCT_UPDATE, 'products', `Updated product ID: ${req.params.id}`);
  const product = await productService.updateProduct(req.params.id, req.user, req.body);
  success(res, { product }, 'Product updated');
});

const remove = asyncHandler(async (req, res) => {
  logAction(req, LOG_ACTIONS.PRODUCT_DELETE, 'products', `Deleted product ID: ${req.params.id}`);
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

// ── AI: Analyze Product Photo (OpenAI Vision) ─────────────────────────────────
const analyzeImage = asyncHandler(async (req, res) => {
  if (!req.file) throw Object.assign(new Error('No image uploaded'), { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw Object.assign(new Error('OPENAI_API_KEY not configured'), { status: 503 });

  const OpenAI    = require('openai');
  const client    = new OpenAI({ apiKey });
  const b64       = req.file.buffer.toString('base64');
  const mimeType  = req.file.mimetype || 'image/jpeg';

  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Analyze this retail product image. Return ONLY valid JSON with these keys: {"name":"short product name","category":"product category","description":"one sentence description"}. Keep it concise for a POS system.',
        },
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${b64}`, detail: 'low' },
        },
      ],
    }],
    max_tokens: 200,
  });

  let detected = {};
  try {
    const raw = completion.choices[0]?.message?.content || '{}';
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    detected = JSON.parse(cleaned);
  } catch {
    detected = { name: '', category: '', description: '' };
  }

  success(res, { detected }, 'Image analyzed');
});

// ── Bulk CSV Import ───────────────────────────────────────────────────────────
const importCSV = asyncHandler(async (req, res) => {
  logAction(req, LOG_ACTIONS.PRODUCT_BULK_IMPORT, 'products', 'Started CSV import');
  if (!req.file) throw Object.assign(new Error('No CSV file uploaded'), { status: 400 });

  const csv    = require('csv-parser');
  const stream = require('stream');
  const records = [];

  await new Promise((resolve, reject) => {
    const readable = stream.Readable.from(req.file.buffer);
    readable
      // Excel-authored CSVs — and our own export — begin with a UTF-8 BOM. Left
      // in place, csv-parser names the first header "﻿name", so `row.name`
      // is undefined and EVERY row fails as "Missing required field: name".
      // Also trim header whitespace, since "price " is a normal Excel artifact.
      .pipe(csv({
        mapHeaders: ({ header }) => header
          .replace(/^﻿/, '')        // UTF-8 BOM (Excel and our own export)
          .replace(/^"+|"+$/g, '')       // stray quotes a BOM can hide from the parser
          .trim(),
      }))
      .on('data', (row) => records.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  // Import into the shop the owner is looking at, not blindly into their first
  // shop. shopAccess middleware has already validated this shopId.
  const targetShopId = req.body?.shopId || req.query.shopId || null;
  const result = await productService.importProducts(req.user, records, targetShopId);
  logAction(req, LOG_ACTIONS.PRODUCT_BULK_IMPORT, 'products', `CSV import complete: ${result.successCount} success, ${result.failedCount} failed`);
  success(res, result, `Import complete: ${result.successCount} added, ${result.failedCount} failed`, 200);
});

// ── Export All Products (CSV or XLSX) ─────────────────────────────────────────
const exportCSV = asyncHandler(async (req, res) => {
  const shopId = req.query.shopId || null;
  const format = String(req.query.format || 'csv').toLowerCase();
  const { buffer, filename, contentType, count } =
    await productService.exportAllProducts(req.user, shopId, format);

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // Let the browser read the filename and the row count off a cross-origin
  // response — without this the client cannot see either and has to invent a
  // filename, which is how `products-1786606512696.csv` happened.
  res.setHeader('X-Export-Count', String(count));
  res.setHeader('X-Export-Filename', filename);
  res.setHeader('Access-Control-Expose-Headers',
    'Content-Disposition, X-Export-Count, X-Export-Filename');
  res.send(buffer);
});

// ── Download Sample Import File ───────────────────────────────────────────────
/**
 * The sample uses the exact production import schema and real importable values,
 * so an owner can download it, edit it, and upload it straight back. A test
 * round-trips this file through the importer, so it cannot drift from the parser.
 */
const sampleImportFile = asyncHandler(async (req, res) => {
  const format = String(req.query.format || 'csv').toLowerCase();
  const { buffer, filename, contentType } = productService.buildSampleImportFile(format);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('X-Export-Filename', filename);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Export-Filename');
  res.send(buffer);
});

// ── Bulk Delete ───────────────────────────────────────────────────────────────
const bulkDelete = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  const result  = await productService.bulkDeleteProducts(req.user, ids);
  success(res, result, `${result.deletedCount} products deleted`);
});

// ── Stock Adjustment ──────────────────────────────────────────────────────────
const adjustStock = asyncHandler(async (req, res) => {
  const { delta, reason, notes, size, color } = req.body;
  const variantLabel = [color, size].filter(Boolean).join('/');
  logAction(req, LOG_ACTIONS.PRODUCT_UPDATE, 'products',
    `Stock adjusted: ID ${req.params.id}, delta ${delta}, reason ${reason}`
    + (variantLabel ? `, variant ${variantLabel}` : ''));
  const result = await productService.adjustStock(req.params.id, req.user, { delta, reason, notes, size, color });
  success(res, result, 'Stock adjusted');
});

// ── Bulk Stock Audit ──────────────────────────────────────────────────────────
const bulkAuditAdjust = asyncHandler(async (req, res) => {
  const { shopId, items } = req.body;
  logAction(req, LOG_ACTIONS.PRODUCT_UPDATE, 'products',
    `Stock audit submitted: ${items?.length || 0} items`);
  const result = await productService.bulkAuditAdjust(req.user, shopId, items);
  success(res, result, `Audit complete: ${result.adjusted} product(s) adjusted`);
});

module.exports = {
  getAll, getOne, create, update, remove, categories, lowStock,
  getPublic, getPublicOne, getPublicCategories,
  importCSV, exportCSV, sampleImportFile, bulkDelete, analyzeImage,
  adjustStock, bulkAuditAdjust,
};
