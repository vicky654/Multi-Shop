const saleService   = require('./sale.service');
const asyncHandler  = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');
const notifService  = require('../../services/notification.service');

// ── Admin (protected) ─────────────────────────────────────────────────────────
const create = asyncHandler(async (req, res) => {
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
  const { sales, total, page, limit } = await saleService.getSales(req.user, req.query);
  paginated(res, sales, total, page, limit, 'Sales fetched');
});

const getOne = asyncHandler(async (req, res) => {
  const sale = await saleService.getSaleById(req.params.id, req.user);
  success(res, { sale }, 'Sale fetched');
});

const refund = asyncHandler(async (req, res) => {
  const sale = await saleService.refundSale(req.params.id, req.user);
  success(res, { sale }, 'Sale refunded');
});

// ── Public (online customer checkout) ────────────────────────────────────────
const publicCheckout = asyncHandler(async (req, res) => {
  const sale = await saleService.createPublicSale(req.body);
  success(res, { sale }, 'Order placed successfully', 201);
});

module.exports = { create, getAll, getOne, refund, publicCheckout };
