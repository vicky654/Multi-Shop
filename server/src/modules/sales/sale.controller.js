const saleService   = require('./sale.service');
const asyncHandler  = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');
const notifService  = require('../../services/notification.service');
const { logAction, LOG_ACTIONS } = require('../../utils/logger');

// ── Admin (protected) ─────────────────────────────────────────────────────────
const create = asyncHandler(async (req, res) => {
  logAction(req, LOG_ACTIONS.ORDER_CREATE, 'sales', `Created sale with ${req.body.items?.length || 0} items`, { total: req.body.totalAmount, shopId: req.query.shopId });
  const sale = await saleService.createSale(req.user, req.body);
  success(res, { sale }, 'Sale created', 201);

  // ── Auto-trigger: send receipt SMS if customer has phone ─────────────────
  if (sale.customerId?.phone) {
    const shopName = sale.shopId?.name || '';
    notifService
      .sendReceipt(sale.customerId, sale, shopName)
      .then((r) => {
        if (!r.success) console.warn('[AutoSMS] Receipt failed:', r.error);
      })
      .catch((err) => console.error('[AutoSMS] Receipt error:', err.message));
  }
});

const getAll = asyncHandler(async (req, res) => {
  logAction(req, LOG_ACTIONS.ORDER_GET_ALL, 'sales', 'Fetched sales list', { shopId: req.query.shopId, page: req.query.page });
  const { sales, total, page, limit } = await saleService.getSales(req.user, req.query);
  paginated(res, sales, total, page, limit, 'Sales fetched');
});

const getOne = asyncHandler(async (req, res) => {
  const sale = await saleService.getSaleById(req.params.id, req.user);
  success(res, { sale }, 'Sale fetched');
});

const refund = asyncHandler(async (req, res) => {
  logAction(req, LOG_ACTIONS.ORDER_UPDATE, 'sales', `Refunded sale ID: ${req.params.id}`);
  const sale = await saleService.refundSale(req.params.id, req.user);
  success(res, { sale }, 'Sale refunded');
});

const partialRefund = asyncHandler(async (req, res) => {
  logAction(req, LOG_ACTIONS.ORDER_UPDATE, 'sales', `Partial refund on sale ID: ${req.params.id}`);
  const result = await saleService.partialRefund(req.params.id, req.user, req.body.refundItems);
  success(res, result, 'Partial refund applied');
});

// ── Bulk sync (offline → online) ──────────────────────────────────────────────
// Accepts { sales: [...] } — processes sequentially, returns per-item results.
// Designed to be idempotent: each item carries an offlineId that prevents
// double-processing even if the request is retried.
const bulkSync = asyncHandler(async (req, res) => {
  const { sales } = req.body;
  logAction(req, LOG_ACTIONS.ORDER_CREATE, 'sales', `Bulk sync: ${sales?.length || 0} offline sales`);

  const results = await saleService.bulkSyncSales(req.user, sales);

  const synced = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  success(res, { results, total: sales.length, synced, failed }, 'Bulk sync complete');
});

// ── Public (online customer checkout) ────────────────────────────────────────
const publicCheckout = asyncHandler(async (req, res) => {
  const sale = await saleService.createPublicSale(req.body);
  success(res, { sale }, 'Order placed successfully', 201);
});

module.exports = { create, getAll, getOne, refund, partialRefund, publicCheckout, bulkSync };
