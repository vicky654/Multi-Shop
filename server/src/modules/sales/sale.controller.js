const saleService = require('./sale.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

// ── Admin (protected) ─────────────────────────────────────────────────────────
const create = asyncHandler(async (req, res) => {
  const sale = await saleService.createSale(req.user, req.body);
  success(res, { sale }, 'Sale created', 201);
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
